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

function resolveAgentInvocation(input: BuilderTaskInput, prompt: string): { command: string; args: string[] } {
  const command = appConfig.hermesAgentCommand;
  const modelConfig = input.modelConfig;
  const sharedArgs = [
    `--query=${prompt}`,
    `--model=${modelConfig?.model ?? input.model}`,
    `--base_url=${modelConfig?.baseUrl ?? appConfig.openAiBaseUrl}`,
    '--max_turns=4',
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
    return { command, args: sharedArgs };
  }
}

async function defaultInvokeAgent({ input, prompt }: InvokeAgentInput): Promise<unknown> {
  const invocation = resolveAgentInvocation(input, prompt);
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
          reject(error);
          return;
        }
        try {
          resolvePromise(parseJsonFromAgent(stdout.toString()));
        } catch (parseError) {
          reject(parseError);
        }
      },
    );
  });
}

function buildSharedContext(input: RunAgentGeneratedDappWorkflowInput) {
  return JSON.stringify({
    taskInput: sanitizeTaskInput(input.input),
    analysis: input.analysis,
    capabilities: input.capabilities,
    normalizedSkills: input.normalizedSkills,
    abi: input.abi,
  }, null, 2);
}

function buildProductPrompt(input: RunAgentGeneratedDappWorkflowInput) {
  return `You are the PM agent for dapp-builder.
Return strict JSON: {"role":"product-manager","title":"...","markdown":"..."}.
Design a product flow document from the contract. Do not write UI code.
The product must not be a scan, ABI viewer, or method dump. Translate contract methods into user goals and safe flows.

Context:
${buildSharedContext(input)}`;
}

function buildDesignPrompt(input: RunAgentGeneratedDappWorkflowInput, productPlan: AgentDocument) {
  return `You are the designer agent for dapp-builder.
Return strict JSON: {"role":"designer","title":"...","markdown":"..."}.
Create a visual and interaction design document from the PM plan. Define layout, hierarchy, states, mobile behavior, and risk surfaces.
Avoid scan-like method lists. Prefer product workflows, action tabs, asset panels, and advanced method collapse.

Product plan:
${productPlan.markdown}

Context:
${buildSharedContext(input)}`;
}

function buildFrontendPrompt(input: RunAgentGeneratedDappWorkflowInput, productPlan: AgentDocument, designSpec: AgentDocument) {
  return `You are the frontend engineer agent for dapp-builder.
Return strict JSON: {"summary":"...","files":[{"path":"package.json","content":"..."},{"path":"index.html","content":"..."},{"path":"src/App.jsx","content":"..."}]}.
Generate a complete Vite React app. The generated page must be product-like and must not render the ABI as a scan or method table.
Use only contract methods present in the ABI context. Keep dangerous/admin methods away from primary CTAs.
The app can use React and browser wallet APIs. Do not include API keys or secrets.

Product plan:
${productPlan.markdown}

Design spec:
${designSpec.markdown}

Context:
${buildSharedContext(input)}`;
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
  const productPlan = agentDocumentSchema.parse(await invokeAgent({
    stage: 'product_planning',
    prompt: buildProductPrompt(input),
    input: input.input,
  }));

  await reportProgress(input.onProgress, 'experience_design', 'Designer agent is defining the page structure and interactions.');
  const designSpec = agentDocumentSchema.parse(await invokeAgent({
    stage: 'experience_design',
    prompt: buildDesignPrompt(input, productPlan),
    input: input.input,
  }));

  await reportProgress(input.onProgress, 'frontend_generation', 'Frontend agent is generating the React dApp source.');
  const frontendApp: GeneratedFrontendApp = generatedFrontendAppSchema.parse(await invokeAgent({
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
