import { execFile, execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import {
  agentDocumentSchema,
  generatedFrontendAppSchema,
  sanitizeTaskInput,
  type AbiEntry,
  type AgentDocument,
  type AnalyzeContractResult,
  type BuilderTaskInput,
  type GeneratedAppArtifact,
  type GeneratedFrontendApp,
  type TaskProgress,
} from '../../shared/schema.js';
import { appConfig } from '../config.js';
import type { CapabilitySet } from './capabilities.js';
import { createGeneratedAppArtifact } from './generated-apps.js';
import type { NormalizedSkills } from './skills.js';

type AgentStage = 'product_planning' | 'experience_design' | 'frontend_generation';
const maxPromptLength = 16_000;
const maxDocumentLength = 1_500;
const maxContextMethods = 30;

interface InvokeAgentInput {
  stage: AgentStage;
  prompt: string;
  input: BuilderTaskInput;
}

interface AgentInvocation {
  command: string;
  args: string[];
}

interface RunAgentGeneratedDappWorkflowInput {
  taskId: string;
  rootDir: string;
  input: BuilderTaskInput;
  abi: AbiEntry[];
  analysis: AnalyzeContractResult;
  capabilities: CapabilitySet;
  normalizedSkills: NormalizedSkills;
  onProgress?: (progress: TaskProgress, summary: string) => void | Promise<void>;
  build?: boolean;
  invokeAgent?: (input: InvokeAgentInput) => Promise<unknown>;
}

function parseJsonFromAgent(stdout: string): unknown {
  const fenced = stdout.match(/```(?:json)?\s*([\s\S]*?)```/i)?.[1];
  const candidates = [fenced, stdout.slice(stdout.indexOf('{'), stdout.lastIndexOf('}') + 1)].filter(
    (candidate): candidate is string => Boolean(candidate && candidate.trim().startsWith('{')),
  );

  for (const candidate of candidates) {
    try {
      return JSON.parse(candidate);
    } catch {
      // Try the next candidate.
    }
  }

  throw new Error('Agent did not return valid JSON.');
}

function parseJsonIfPresent(value: unknown): unknown {
  if (typeof value !== 'string') {
    return value;
  }

  try {
    return parseJsonFromAgent(value);
  } catch {
    return value;
  }
}

function coerceAgentDocument(value: unknown, role: AgentDocument['role'], title: string): AgentDocument {
  const parsed = parseJsonIfPresent(value);
  if (typeof parsed === 'string') {
    return agentDocumentSchema.parse({
      role,
      title,
      markdown: parsed.trim() || title,
    });
  }
  return agentDocumentSchema.parse(parsed);
}

function coerceGeneratedFrontendApp(value: unknown): GeneratedFrontendApp {
  return generatedFrontendAppSchema.parse(parseJsonIfPresent(value));
}

function truncateText(value: string, maxLength = maxDocumentLength) {
  if (value.length <= maxLength) {
    return value;
  }
  return `${value.slice(0, maxLength)}\n\n[Truncated ${value.length - maxLength} characters to keep the agent prompt within process limits.]`;
}

function compactAbi(abi: AbiEntry[]) {
  return abi.slice(0, maxContextMethods).map((entry) => ({
    type: entry.type,
    name: entry.name,
    stateMutability: entry.stateMutability,
    inputs: entry.inputs.map((input) => ({ name: input.name, type: input.type })),
    outputs: entry.outputs.map((output) => ({ name: output.name, type: output.type })),
  }));
}

function compactMethods(methods: AnalyzeContractResult['methods']) {
  return methods.slice(0, maxContextMethods).map((method) => ({
    name: method.name,
    label: method.label,
    type: method.type,
    dangerLevel: method.dangerLevel,
    stateMutability: method.stateMutability,
    inputs: method.inputs.map((input) => ({ name: input.name, type: input.type })),
    outputs: method.outputs.map((output) => ({ name: output.name, type: output.type })),
  }));
}

function compactContext(input: RunAgentGeneratedDappWorkflowInput) {
  return {
    taskInput: {
      contractAddress: input.input.contractAddress,
      chain: input.input.chain,
      skills: sanitizeTaskInput(input.input).skills,
    },
    analysis: {
      contractAddress: input.analysis.contractAddress,
      contractName: input.analysis.contractName,
      chain: input.analysis.chain,
      requestedSkill: input.analysis.requestedSkill,
      contractType: input.analysis.contractType,
      skillMatch: input.analysis.skillMatch,
      recommendedSkills: input.analysis.recommendedSkills,
      warnings: input.analysis.warnings.slice(0, 8),
      methods: compactMethods(input.analysis.methods),
      dangerousMethods: compactMethods(input.analysis.dangerousMethods),
      omittedMethodCount: Math.max(0, input.analysis.methods.length - maxContextMethods),
    },
    capabilities: {
      kind: input.capabilities.kind,
      confidence: input.capabilities.confidence,
      primitives: input.capabilities.primitives.slice(0, 24),
      unsupported: input.capabilities.unsupported.slice(0, 8),
    },
    normalizedSkills: {
      skills: input.normalizedSkills.skills,
      businessSkills: input.normalizedSkills.businessSkills,
      walletSkills: input.normalizedSkills.walletSkills,
      experienceSkills: input.normalizedSkills.experienceSkills,
    },
    abi: compactAbi(input.abi),
    omittedAbiEntryCount: Math.max(0, input.abi.length - maxContextMethods),
  };
}

function clampPrompt(prompt: string) {
  if (prompt.length <= maxPromptLength) {
    return prompt;
  }
  return `${prompt.slice(0, maxPromptLength)}\n\n[Prompt truncated to avoid OS process argument limits. Use the provided compact ABI and safety boundaries only.]`;
}

function resolveAgentInvocation(input: BuilderTaskInput, prompt: string): AgentInvocation | null {
  const command = appConfig.hermesAgentCommand;
  const modelConfig = input.modelConfig;
  const sharedArgs = [
    `--query=${prompt}`,
    `--model=${modelConfig?.model ?? input.model}`,
    `--base_url=${modelConfig?.baseUrl ?? appConfig.openAiBaseUrl}`,
    '--max_turns=2',
  ];

  const apiKey = modelConfig?.apiKey ?? input.apiKey;
  if (apiKey) {
    sharedArgs.push(`--api_key=${apiKey}`);
  }

  if (command !== 'hermes-agent') {
    return { command, args: sharedArgs };
  }

  try {
    const wrapperPath = execFileSync('which', [command], { encoding: 'utf8' }).trim();
    if (wrapperPath.endsWith('/venv/bin/hermes-agent')) {
      const hermesRoot = resolve(dirname(wrapperPath), '..', '..');
      return {
        command: resolve(hermesRoot, 'venv/bin/python3'),
        args: [resolve(hermesRoot, 'run_agent.py'), ...sharedArgs],
      };
    }

    const wrapperSource = readFileSync(wrapperPath, 'utf8');
    const pythonPath = wrapperSource.match(/^#!(.+)$/m)?.[1]?.trim();
    if (!pythonPath) return { command, args: sharedArgs };
    const hermesRoot = resolve(dirname(pythonPath), '..', '..');
    const runAgentPath = resolve(hermesRoot, 'run_agent.py');
    if (!existsSync(runAgentPath)) return { command, args: sharedArgs };
    return { command: pythonPath, args: [runAgentPath, ...sharedArgs] };
  } catch {
    return null;
  }
}

function describeAgentApiError(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
}

function isRetriableAgentApiError(error: unknown) {
  if (error instanceof Error && (error.name === 'AbortError' || error.message === 'fetch failed')) {
    return true;
  }

  const status = typeof error === 'object' && error !== null && 'status' in error ? Number(error.status) : 0;
  return status === 429 || status >= 500;
}

async function requestOpenAiCompatibleAgent(input: BuilderTaskInput, prompt: string): Promise<unknown> {
  const modelConfig = input.modelConfig;
  const apiKey = modelConfig?.apiKey ?? input.apiKey;
  const model = modelConfig?.model ?? input.model;
  const baseUrl = modelConfig?.baseUrl ?? appConfig.openAiBaseUrl;

  if (!apiKey || !model) {
    throw new Error('Agent runtime is unavailable. Install hermes-agent or provide modelConfig.apiKey and model.');
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), appConfig.agentApiTimeoutMs);
  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    signal: controller.signal,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages: [
        {
          role: 'system',
          content:
            'You are a fast strict JSON agent for dapp-builder. Return only requested JSON. Keep content concise. Do not include reasoning.',
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
    }),
  }).finally(() => clearTimeout(timeout));

  if (!response.ok) {
    const message = await response.text().catch(() => '');
    const error = new Error(`Agent API request failed with ${response.status}${message ? `: ${message}` : ''}`);
    Object.assign(error, { status: response.status });
    throw error;
  }

  const payload = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const content = payload.choices?.[0]?.message?.content;
  if (typeof content !== 'string' || !content.trim()) {
    throw new Error('Agent API did not return message content.');
  }
  return parseJsonIfPresent(content);
}

async function invokeOpenAiCompatibleAgent(input: BuilderTaskInput, prompt: string): Promise<unknown> {
  const baseUrl = input.modelConfig?.baseUrl ?? appConfig.openAiBaseUrl;
  const maxAttempts = Math.max(1, appConfig.agentApiMaxAttempts);
  let lastError: unknown;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      return await requestOpenAiCompatibleAgent(input, prompt);
    } catch (error) {
      lastError = error;
      if (attempt >= maxAttempts || !isRetriableAgentApiError(error)) {
        break;
      }
    }
  }

  throw new Error(
    `Agent API request to ${baseUrl}/chat/completions failed after ${maxAttempts} attempt(s): ${describeAgentApiError(lastError)}`,
  );
}

async function defaultInvokeAgent({ input, prompt }: InvokeAgentInput): Promise<unknown> {
  if (input.modelConfig?.apiKey || input.apiKey) {
    return invokeOpenAiCompatibleAgent(input, prompt);
  }

  const invocation = resolveAgentInvocation(input, prompt);
  if (!invocation) {
    return invokeOpenAiCompatibleAgent(input, prompt);
  }

  return new Promise((resolvePromise, reject) => {
    execFile(
      invocation.command,
      invocation.args,
      {
        timeout: appConfig.hermesAgentTimeoutMs,
        maxBuffer: appConfig.hermesAgentMaxBufferBytes,
        env: {
          ...process.env,
          HERMES_AGENT_DAPP_BUILDER: '1',
        },
      },
      (error, stdout) => {
        if (error) {
          if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
            invokeOpenAiCompatibleAgent(input, prompt).then(resolvePromise, reject);
            return;
          }
          reject(error);
          return;
        }
        resolvePromise(parseJsonIfPresent(stdout.toString()));
      },
    );
  });
}

function buildSharedContext(input: RunAgentGeneratedDappWorkflowInput) {
  return JSON.stringify(compactContext(input));
}

function buildProductPrompt(input: RunAgentGeneratedDappWorkflowInput) {
  return clampPrompt(`PM agent. Return only JSON: {"role":"product-manager","title":"...","markdown":"..."}.
Write a concise MVP product flow, max 8 bullets. No code. No scan/method dump. Focus on 2-4 user goals and safety notes.

Context:
${buildSharedContext(input)}`);
}

function buildDesignPrompt(input: RunAgentGeneratedDappWorkflowInput, productPlan: AgentDocument) {
  return clampPrompt(`Designer agent. Return only JSON: {"role":"designer","title":"...","markdown":"..."}.
Write a concise UI brief, max 8 bullets. Define layout, primary action area, wallet state, risk state, and mobile behavior. No scan/method table.

Product plan:
${truncateText(productPlan.markdown)}

Context:
${buildSharedContext(input)}`);
}

function buildFrontendPrompt(input: RunAgentGeneratedDappWorkflowInput, productPlan: AgentDocument, designSpec: AgentDocument) {
  return clampPrompt(`Frontend agent. Return only JSON: {"summary":"...","files":[{"path":"package.json","content":"..."},{"path":"index.html","content":"..."},{"path":"src/App.jsx","content":"..."}]}.
Generate a minimal complete Vite React app. Keep code compact. Product-like, not ABI scan. Use only methods in context. No secrets.

Product plan:
${truncateText(productPlan.markdown)}

Design spec:
${truncateText(designSpec.markdown)}

Context:
${buildSharedContext(input)}`);
}

function safeJsonForSource(value: unknown) {
  return JSON.stringify(value).replace(/</g, '\\u003c');
}

function createFallbackFrontendApp(
  input: RunAgentGeneratedDappWorkflowInput,
  productPlan: AgentDocument,
  designSpec: AgentDocument,
  error: unknown,
): GeneratedFrontendApp {
  const methods = compactMethods(input.analysis.methods);
  const reads = methods.filter((method) => method.type === 'read').slice(0, 6);
  const writes = methods.filter((method) => method.type === 'write').slice(0, 4);
  const title = input.analysis.contractName
    ? `${input.analysis.contractName} ${input.analysis.contractType === 'nft' ? 'Collection' : 'Workspace'}`
    : 'Generated dApp Workspace';
  const sourceData = {
    title,
    contractAddress: input.input.contractAddress,
    chain: input.analysis.chain,
    contractType: input.analysis.contractType,
    productPlan: truncateText(productPlan.markdown, 700),
    designSpec: truncateText(designSpec.markdown, 700),
    reads,
    writes,
    warnings: input.analysis.warnings.slice(0, 4),
    failedReason: describeAgentApiError(error),
  };

  const appSource = `import React from 'react';
import { createRoot } from 'react-dom/client';

const data = ${safeJsonForSource(sourceData)};

function MethodList({ title, methods }) {
  if (!methods.length) return null;
  return (
    <section className="panel">
      <div className="section-kicker">{title}</div>
      <div className="method-grid">
        {methods.map((method) => (
          <div className="method" key={method.name}>
            <span>{method.type}</span>
            <strong>{method.label}</strong>
            <small>{method.inputs.map((input) => input.type).join(', ') || 'No inputs'}</small>
          </div>
        ))}
      </div>
    </section>
  );
}

function App() {
  return (
    <main className="shell">
      <section className="hero">
        <div>
          <p className="eyebrow">{data.contractType} dApp</p>
          <h1>{data.title}</h1>
          <p className="summary">Agent planning completed. This MVP interface was generated locally after the frontend agent timed out.</p>
        </div>
        <div className="address">
          <span>Contract</span>
          <code>{data.contractAddress}</code>
          <small>{data.chain}</small>
        </div>
      </section>
      <section className="workspace">
        <div className="primary">
          <div className="section-kicker">Primary flow</div>
          <h2>{data.writes.length ? data.writes[0].label : 'Review contract state'}</h2>
          <p>{data.productPlan.replace(/^#+\\s*/gm, '').split('\\n').filter(Boolean)[0] || 'Connect a wallet and review the available contract interactions.'}</p>
          <button type="button">Connect wallet</button>
        </div>
        <aside>
          <div className="section-kicker">Safety</div>
          <p>{data.designSpec.replace(/^#+\\s*/gm, '').split('\\n').filter(Boolean)[0] || 'Review every transaction before signing.'}</p>
          <ul>
            {(data.warnings.length ? data.warnings : ['Confirm network and wallet before write actions.']).map((warning) => (
              <li key={warning}>{warning}</li>
            ))}
          </ul>
        </aside>
      </section>
      <MethodList title="Read actions" methods={data.reads} />
      <MethodList title="Write actions" methods={data.writes} />
    </main>
  );
}

const style = document.createElement('style');
style.textContent = \`
  :root { color-scheme: dark; font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; background: #0b1020; color: #eef3ff; }
  * { box-sizing: border-box; }
  body { margin: 0; min-height: 100vh; background: radial-gradient(circle at top left, #1b365d 0, transparent 34rem), #0b1020; }
  .shell { width: min(1120px, calc(100% - 32px)); margin: 0 auto; padding: 48px 0; }
  .hero, .workspace, .panel { border: 1px solid rgba(255,255,255,.12); background: rgba(15,23,42,.82); box-shadow: 0 24px 80px rgba(0,0,0,.28); }
  .hero { display: grid; grid-template-columns: minmax(0, 1fr) 360px; gap: 28px; align-items: end; padding: 36px; border-radius: 28px; }
  .eyebrow, .section-kicker { margin: 0 0 10px; color: #7dd3fc; text-transform: uppercase; letter-spacing: .12em; font-size: 12px; font-weight: 800; }
  h1 { margin: 0; font-size: clamp(38px, 6vw, 74px); line-height: .95; letter-spacing: 0; }
  h2 { margin: 0 0 12px; font-size: 30px; letter-spacing: 0; }
  p { color: #cbd5e1; line-height: 1.6; }
  .summary { max-width: 620px; font-size: 17px; }
  .address, aside, .primary, .method { border-radius: 20px; background: rgba(2,6,23,.64); padding: 22px; }
  .address code { display: block; margin: 10px 0; overflow-wrap: anywhere; color: #f8fafc; }
  .address span, .address small, .method small, .method span { color: #94a3b8; }
  .workspace { display: grid; grid-template-columns: minmax(0, 1.4fr) minmax(280px, .8fr); gap: 18px; margin-top: 22px; padding: 18px; border-radius: 28px; }
  button { border: 0; border-radius: 999px; padding: 13px 20px; color: #06111f; background: #67e8f9; font-weight: 800; }
  ul { margin: 0; padding-left: 18px; color: #cbd5e1; line-height: 1.7; }
  .panel { margin-top: 22px; padding: 24px; border-radius: 24px; }
  .method-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(190px, 1fr)); gap: 12px; }
  .method { display: grid; gap: 8px; }
  .method strong { color: #f8fafc; }
  @media (max-width: 820px) { .hero, .workspace { grid-template-columns: 1fr; } .shell { padding-top: 24px; } }
\`;
document.head.appendChild(style);
createRoot(document.getElementById('root')).render(<App />);
`;

  return generatedFrontendAppSchema.parse({
    summary: `Generated deterministic fallback React app after frontend agent failed: ${describeAgentApiError(error)}`,
    files: [
      { path: 'package.json', content: '{"type":"module","scripts":{"build":"vite build"},"dependencies":{"@vitejs/plugin-react":"^4.4.1","vite":"^6.3.5","typescript":"^5.8.3","react":"^18.3.1","react-dom":"^18.3.1"}}' },
      { path: 'index.html', content: '<div id="root"></div><script type="module" src="/src/App.jsx"></script>' },
      { path: 'src/App.jsx', content: appSource },
    ],
  });
}

async function reportProgress(
  onProgress: RunAgentGeneratedDappWorkflowInput['onProgress'],
  progress: TaskProgress,
  summary: string,
) {
  await onProgress?.(progress, summary);
}

export async function runAgentGeneratedDappWorkflow(input: RunAgentGeneratedDappWorkflowInput): Promise<GeneratedAppArtifact> {
  const invokeAgent = input.invokeAgent ?? defaultInvokeAgent;

  await reportProgress(input.onProgress, 'product_planning', 'PM agent is designing the product flow.');
  const productPlan = coerceAgentDocument(await invokeAgent({
    stage: 'product_planning',
    prompt: buildProductPrompt(input),
    input: input.input,
  }), 'product-manager', 'Product flow');

  await reportProgress(input.onProgress, 'experience_design', 'Designer agent is defining the page structure and interactions.');
  const designSpec = coerceAgentDocument(await invokeAgent({
    stage: 'experience_design',
    prompt: buildDesignPrompt(input, productPlan),
    input: input.input,
  }), 'designer', 'Generated dApp design');

  await reportProgress(input.onProgress, 'frontend_generation', 'Frontend agent is generating the React dApp source.');
  let frontendApp: GeneratedFrontendApp;
  try {
    frontendApp = coerceGeneratedFrontendApp(await invokeAgent({
      stage: 'frontend_generation',
      prompt: buildFrontendPrompt(input, productPlan, designSpec),
      input: input.input,
    }));
  } catch (error) {
    frontendApp = createFallbackFrontendApp(input, productPlan, designSpec, error);
  }

  await reportProgress(input.onProgress, 'validating_generated_app', 'Writing and validating the generated React app.');
  return createGeneratedAppArtifact({
    taskId: input.taskId,
    rootDir: input.rootDir,
    files: frontendApp.files,
    productPlan,
    designSpec,
    frontendSummary: frontendApp.summary,
    apiKey: input.input.modelConfig?.apiKey ?? input.input.apiKey,
    build: input.build,
  });
}
