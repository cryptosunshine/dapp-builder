import { execFile, execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  agentRunResultSchema,
  sanitizeTaskInput,
  type AbiEntry,
  type AgentRunResult,
  type AnalyzeContractResult,
  type BuilderTaskInput,
  type Experience,
  type PageConfig,
} from '../../shared/schema.js';
import { appConfig } from '../config.js';
import type { CapabilitySet } from './capabilities.js';
import type { NormalizedSkills } from './skills.js';

interface HermesAgentGenerationInput {
  input: BuilderTaskInput;
  abi: AbiEntry[];
  analysis: AnalyzeContractResult;
  capabilities: CapabilitySet;
  normalizedSkills: NormalizedSkills;
  deterministicPageConfig: PageConfig;
  deterministicExperience: Experience;
}

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const embeddedProductPrompt = `# Agent Generated dApp Product Prompt

你是 dapp-builder 的“合约理解 + dApp 产品设计 + 页面生成” Agent。

目标不是把 ABI 原样展示成 scan / explorer，也不是把所有方法机械列出来。
目标是基于 ABI、合约类型、skill、链信息和风险边界，产出一个精致、易懂、可直接操作的 dApp 页面配置。

核心要求：
- 不是 scan
- 不是 ABI viewer
- 不是 method dump
- 要像真实产品，围绕用户任务流组织页面
- 要优先展示高价值主操作
- 要给出清晰标题、说明、风险边界、空状态、结果反馈
- 要让普通用户一眼看懂“这个页面能做什么”

ERC20 / token dashboard 要优先支持：
- Check wallet balance
- Transfer tokens
- Review approvals
- Approve spender
- Revoke approval
- Safety notes
- Danger zone（如必须暴露）

页面分区应该围绕用户目标，而不是只围绕 ABI：
- overview
- your wallet
- send tokens
- approvals & spender safety
- advanced actions / reads
- danger zone

严格约束：
- 不能发明 ABI 中不存在的方法
- 不能突破 deterministic pageConfig 的 method / risk 边界
- 不能暴露 apiKey 或任何 secrets
- 高风险管理员方法不能作为主 CTA
- 如果不确定，宁可保守，也不要乱编
`;

function loadProductPrompt(): string {
  const candidatePaths = [
    resolve(process.cwd(), 'docs/prompts/agent-generated-dapp-product-prompt.md'),
    resolve(repoRoot, 'docs/prompts/agent-generated-dapp-product-prompt.md'),
  ];

  for (const candidatePath of candidatePaths) {
    try {
      return readFileSync(candidatePath, 'utf8').trim();
    } catch {
      // Try the next location.
    }
  }

  return embeddedProductPrompt.trim();
}

function buildHermesPrompt({ input, abi, analysis, capabilities, normalizedSkills, deterministicPageConfig, deterministicExperience }: HermesAgentGenerationInput) {
  const safeInput = sanitizeTaskInput(input);
  const productPrompt = loadProductPrompt();
  return `You are dapp-builder's guided product generation agent.
Return ONLY strict JSON matching this guided dApp result shape:
{
  "summary": "short summary",
  "contractAnalysis": {
    "contractType": "token|nft|voting|claim|staking|unknown|generic",
    "recommendedSkill": "auto|token-dashboard|nft-mint-experience|voting-participation|unknown",
    "readMethods": [],
    "writeMethods": [],
    "dangerousMethods": [],
    "warnings": []
  },
  "pageConfig": {
    "chainId": 71,
    "rpcUrl": "https://evmtestnet.confluxrpc.com",
    "contractAddress": "${safeInput.contractAddress}",
    "skill": "${safeInput.skills[0]}",
    "title": "",
    "description": "",
    "chain": "conflux-espace-testnet",
    "contractName": "",
    "warnings": [],
    "primaryActions": [],
    "dangerousMethods": [],
    "methods": [],
    "sections": [],
    "experience": {}
  },
  "experience": {},
  "status": "success|failed",
  "error": ""
}

Product generation brief:
${productPrompt}

Hard rules:
- Do not invent contract methods. Use only methods from the deterministic pageConfig.
- Do not expose secrets. The apiKey was intentionally omitted.
- Use the capability primitives as your design material.
- You may generate an experience schema using only supported component types.
- Do not reference methods outside deterministicPageConfig.methods or deterministicPageConfig.dangerousMethods.
- Preserve risk boundaries and warnings from deterministic analysis and deterministic experience.
- You may improve title, description, section ordering, experience structure, and safe helper copy.
- You may improve sections and primaryActions, but keep deterministic actions unless you can refine them safely.

Sanitized task input:
${JSON.stringify(safeInput, null, 2)}

Selected skills:
${JSON.stringify(normalizedSkills, null, 2)}

ABI:
${JSON.stringify(abi, null, 2)}

Deterministic analysis:
${JSON.stringify(analysis, null, 2)}

Capability primitives:
${JSON.stringify(capabilities, null, 2)}

Deterministic pageConfig safety boundary:
${JSON.stringify(deterministicPageConfig, null, 2)}

Deterministic experience fallback:
${JSON.stringify(deterministicExperience, null, 2)}
`;
}

function resolveHermesAgentInvocation(input: HermesAgentGenerationInput, prompt: string): { command: string; args: string[] } {
  const command = appConfig.hermesAgentCommand;
  const modelConfig = input.input.modelConfig;
  const sharedArgs = [
    `--query=${prompt}`,
    `--model=${modelConfig?.model ?? input.input.model}`,
    `--base_url=${modelConfig?.baseUrl ?? appConfig.openAiBaseUrl}`,
    '--max_turns=3',
  ];

  const apiKey = modelConfig?.apiKey ?? input.input.apiKey;
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
    if (!pythonPath) {
      return { command, args: sharedArgs };
    }

    const hermesRoot = resolve(dirname(pythonPath), '..', '..');
    const runAgentPath = resolve(hermesRoot, 'run_agent.py');
    if (!existsSync(runAgentPath)) {
      return { command, args: sharedArgs };
    }

    return {
      command: pythonPath,
      args: [runAgentPath, ...sharedArgs],
    };
  } catch {
    return { command, args: sharedArgs };
  }
}

function parseAgentRunResult(stdout: string): AgentRunResult | null {
  const fenced = stdout.match(/```(?:json)?\s*([\s\S]*?)```/i)?.[1];
  const candidates = [fenced, stdout.slice(stdout.indexOf('{'), stdout.lastIndexOf('}') + 1)].filter(
    (candidate): candidate is string => Boolean(candidate && candidate.trim().startsWith('{')),
  );

  for (const candidate of candidates) {
    try {
      return agentRunResultSchema.parse(JSON.parse(candidate));
    } catch {
      // Try the next candidate.
    }
  }

  return null;
}

export async function runHermesAgentGeneration(input: HermesAgentGenerationInput): Promise<AgentRunResult | null> {
  const prompt = buildHermesPrompt(input);
  const invocation = resolveHermesAgentInvocation(input, prompt);

  return new Promise((resolve) => {
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
          resolve(null);
          return;
        }
        resolve(parseAgentRunResult(stdout.toString()));
      },
    );
  });
}
