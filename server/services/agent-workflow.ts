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
  const frontendApp: GeneratedFrontendApp = coerceGeneratedFrontendApp(await invokeAgent({
    stage: 'frontend_generation',
    prompt: buildFrontendPrompt(input, productPlan, designSpec),
    input: input.input,
  }));

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
