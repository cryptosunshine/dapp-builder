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

type AgentStage = 'frontend_generation';
const maxPromptLength = 16_000;
const maxDocumentLength = 1_500;
const maxContextMethods = 30;

interface InvokeAgentInput {
  stage: AgentStage;
  prompt: string;
  input: BuilderTaskInput;
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
  const configuredAccount = appConfig.modelAccounts.find((account) => account.id === modelConfig?.providerId);
  const apiKey = modelConfig?.apiKey || input.apiKey || configuredAccount?.apiKey || '';
  const model = configuredAccount?.model ?? modelConfig?.model ?? input.model;
  const baseUrl = configuredAccount?.baseUrl ?? modelConfig?.baseUrl ?? appConfig.openAiBaseUrl;

  if (!apiKey || !model) {
    throw new Error('Model API credentials are unavailable. Select a configured built-in account or provide a custom API key.');
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
  const configuredAccount = appConfig.modelAccounts.find((account) => account.id === input.modelConfig?.providerId);
  const baseUrl = configuredAccount?.baseUrl ?? input.modelConfig?.baseUrl ?? appConfig.openAiBaseUrl;
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
  return invokeOpenAiCompatibleAgent(input, prompt);
}

function buildSharedContext(input: RunAgentGeneratedDappWorkflowInput) {
  return JSON.stringify(compactContext(input));
}

function createWorkflowDocuments(input: RunAgentGeneratedDappWorkflowInput): { productPlan: AgentDocument; designSpec: AgentDocument } {
  const primaryMethods = input.analysis.methods
    .slice(0, 8)
    .map((method) => `- ${method.label} (${method.type})`)
    .join('\n') || '- Review contract state';

  return {
    productPlan: agentDocumentSchema.parse({
      role: 'product-manager',
      title: 'Direct frontend generation brief',
      markdown: `# Direct frontend generation brief\n\nGenerate a usable ${input.analysis.contractType} dApp directly from ABI analysis.\n\n${primaryMethods}`,
    }),
    designSpec: agentDocumentSchema.parse({
      role: 'designer',
      title: 'MVP interface brief',
      markdown: '# MVP interface brief\n\nUse a focused product workspace with wallet status, primary action, safety notes, and compact advanced methods.',
    }),
  };
}

function buildFrontendPrompt(input: RunAgentGeneratedDappWorkflowInput) {
  return clampPrompt(`Frontend agent. Return only JSON: {"summary":"...","files":[{"path":"index.html","content":"..."},{"path":"src/App.jsx","content":"..."},{"path":"src/styles.css","content":"..."}]}.
Generate compact React source directly from the context. Product-like, not ABI scan. Use only methods in context. No secrets.
Do not include package.json, vite.config.js, dependencies, markdown, or explanations.
The app should include wallet connection UI, primary user flow, safety notes, and compact advanced method access.

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
import './styles.css';

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
          <p className="summary">The frontend agent could not finish in time, so this task produced a compact local preview that still follows the detected contract capabilities.</p>
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

createRoot(document.getElementById('root')).render(<App />);
`;

  const styleSource = `
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
`;

  return generatedFrontendAppSchema.parse({
    summary: `Generated deterministic fallback React app after frontend agent failed: ${describeAgentApiError(error)}`,
    files: [
      { path: 'index.html', content: '<div id="root"></div><script type="module" src="/src/App.jsx"></script>' },
      { path: 'src/App.jsx', content: appSource },
      { path: 'src/styles.css', content: styleSource },
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
  const { productPlan, designSpec } = createWorkflowDocuments(input);

  await reportProgress(input.onProgress, 'frontend_generation', 'Frontend agent is generating the React dApp source.');
  let frontendApp: GeneratedFrontendApp;
  let generationMode: GeneratedAppArtifact['generationMode'] = 'agent';
  try {
    frontendApp = coerceGeneratedFrontendApp(await invokeAgent({
      stage: 'frontend_generation',
      prompt: buildFrontendPrompt(input),
      input: input.input,
    }));
  } catch (error) {
    frontendApp = createFallbackFrontendApp(input, productPlan, designSpec, error);
    generationMode = 'fallback';
  }

  await reportProgress(input.onProgress, 'validating_generated_app', 'Writing and validating the generated React app.');
  try {
    return await createGeneratedAppArtifact({
      taskId: input.taskId,
      rootDir: input.rootDir,
      files: frontendApp.files,
      productPlan,
      designSpec,
      frontendSummary: frontendApp.summary,
      apiKey: input.input.modelConfig?.apiKey ?? input.input.apiKey,
      build: input.build,
      generationMode,
    });
  } catch (error) {
    if (generationMode === 'fallback') {
      throw error;
    }
    const fallbackApp = createFallbackFrontendApp(input, productPlan, designSpec, error);
    return createGeneratedAppArtifact({
      taskId: input.taskId,
      rootDir: input.rootDir,
      files: fallbackApp.files,
      productPlan,
      designSpec,
      frontendSummary: fallbackApp.summary,
      apiKey: input.input.modelConfig?.apiKey ?? input.input.apiKey,
      build: input.build,
      generationMode: 'fallback',
    });
  }
}
