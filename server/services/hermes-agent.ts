import { execFile } from 'node:child_process';
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

function buildHermesPrompt({ input, abi, analysis, capabilities, normalizedSkills, deterministicPageConfig, deterministicExperience }: HermesAgentGenerationInput) {
  const safeInput = sanitizeTaskInput(input);
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
    "dangerousMethods": [],
    "methods": [],
    "sections": [],
    "experience": {}
  },
  "experience": {},
  "status": "success|failed",
  "error": ""
}

Hard rules:
- Do not invent contract methods. Use only methods from the deterministic pageConfig.
- Do not expose secrets. The apiKey was intentionally omitted.
- Use the capability primitives as your design material.
- You may generate an experience schema using only supported component types.
- Do not reference methods outside deterministicPageConfig.methods or deterministicPageConfig.dangerousMethods.
- Preserve risk boundaries and warnings from deterministic analysis and deterministic experience.
- You may improve title, description, section ordering, experience structure, and safe helper copy.

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
  const command = appConfig.hermesAgentCommand;

  return new Promise((resolve) => {
    execFile(
      command,
      [prompt],
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
