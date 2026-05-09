import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { runBuilderAgent } from '../server/services/agent.js';
import type { BuilderTaskInput } from '../shared/schema.js';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const contractAddress = '0x05d714465e24b7639a31eeb57d37396f889df725';
const chain = 'conflux-espace-testnet' as const;

type ModelPreset = {
  id: string;
  label: string;
  input: Pick<BuilderTaskInput, 'model' | 'apiKey' | 'modelConfig'>;
  requiresEnv?: string;
};

type SkillPreset = {
  id: string;
  label: string;
  skills: BuilderTaskInput['skills'];
  agentSkills: string[];
  customAgentSkill: string;
};

type ExperimentResult = {
  runId: string;
  modelId: string;
  modelLabel: string;
  skillId: string;
  skillLabel: string;
  status: 'success' | 'failed' | 'skipped';
  previewUrl?: string;
  sourceDir?: string;
  distDir?: string;
  buildStatus?: string;
  generationMode?: string;
  summary?: string;
  latencyMs?: number;
  error?: string;
  signals?: Record<string, boolean | number>;
};

const skillPresets: SkillPreset[] = [
  {
    id: 'no-generation-skill',
    label: 'No generation skill',
    skills: ['auto'],
    agentSkills: [],
    customAgentSkill: '',
  },
  {
    id: 'eip-6963-wallet-discovery',
    label: 'EIP-6963 wallet discovery skill',
    skills: ['auto', 'eip-6963-wallet-discovery'],
    agentSkills: [],
    customAgentSkill:
      'Prioritize EIP-6963 multi-wallet discovery UX: explain wallet discovery, show clear wallet provider/account/network state, and make the connection entry point feel like a wallet-ready dApp rather than a raw contract form.',
  },
  {
    id: 'wagmi-viem-contract-pattern',
    label: 'wagmi + viem contract pattern skill',
    skills: ['auto'],
    agentSkills: ['wagmi-viem-contract-pattern'],
    customAgentSkill: '',
  },
];

function modelPresets(): ModelPreset[] {
  const deepseekApiKey = process.env.DEEPSEEK_API_KEY ?? '';
  const deepseekBaseUrl = process.env.DEEPSEEK_BASE_URL ?? 'https://api.deepseek.com/v1';
  const deepseekModel = process.env.DEEPSEEK_MODEL ?? 'deepseek-v4-pro';

  return [
    {
      id: 'builtin-gpt-5-5',
      label: 'Built-in agent / current GPT-5.5',
      input: {
        model: 'current-hermes-model',
        apiKey: '',
        modelConfig: {
          providerId: 'local-hermes-agent',
          baseUrl: 'http://localhost',
          model: 'current-hermes-model',
          apiKey: '',
        },
      },
    },
    {
      id: 'deepseek-v4-pro',
      label: `DeepSeek ${deepseekModel}`,
      requiresEnv: 'DEEPSEEK_API_KEY',
      input: {
        model: deepseekModel,
        apiKey: deepseekApiKey,
        modelConfig: {
          providerId: 'custom',
          baseUrl: deepseekBaseUrl,
          model: deepseekModel,
          apiKey: deepseekApiKey,
        },
      },
    },
  ];
}

function parseArgs() {
  const args = new Set(process.argv.slice(2));
  return {
    run: args.has('--run'),
    dryRun: args.has('--dry-run') || !args.has('--run'),
    onlyModel: process.argv.find((arg) => arg.startsWith('--model='))?.split('=')[1],
    onlySkill: process.argv.find((arg) => arg.startsWith('--skill='))?.split('=')[1],
  };
}

function redactInput(input: BuilderTaskInput) {
  return {
    ...input,
    apiKey: input.apiKey ? '[redacted]' : '',
    modelConfig: input.modelConfig
      ? {
          ...input.modelConfig,
          apiKey: input.modelConfig.apiKey ? '[redacted]' : '',
        }
      : undefined,
  };
}

async function collectSignals(sourceDir?: string): Promise<Record<string, boolean | number>> {
  if (!sourceDir) return {};
  const appPath = join(sourceDir, 'src', 'App.jsx');
  const stylesPath = join(sourceDir, 'src', 'styles.css');
  const app = await readFile(appPath, 'utf8').catch(() => '');
  const styles = await readFile(stylesPath, 'utf8').catch(() => '');
  const source = `${app}\n${styles}`.toLowerCase();
  return {
    appSourceBytes: app.length,
    styleSourceBytes: styles.length,
    mentionsEip6963: source.includes('6963') || source.includes('provider discovery'),
    mentionsWagmi: source.includes('wagmi'),
    mentionsViem: source.includes('viem'),
    hasWalletCopy: source.includes('wallet'),
    hasConnectCopy: source.includes('connect'),
    hasBalanceFlow: source.includes('balance'),
    hasTransferFlow: source.includes('transfer'),
    hasApprovalFlow: source.includes('approve') || source.includes('allowance'),
    hasRiskCopy: source.includes('risk') || source.includes('safety') || source.includes('danger'),
  };
}

function markdownReport(experimentId: string, results: ExperimentResult[]) {
  const lines = [
    `# dApp generation experiment ${experimentId}`,
    '',
    `Contract: \`${contractAddress}\``,
    `Chain: \`${chain}\``,
    '',
    '## Matrix',
    '',
    '| Model | Skill | Status | Build | Mode | Latency | Preview | Notes |',
    '| --- | --- | --- | --- | --- | ---: | --- | --- |',
    ...results.map((result) => {
      const preview = result.previewUrl ? `[open](${result.previewUrl})` : '-';
      const notes = result.error ? result.error.replace(/\|/g, '\\|').slice(0, 120) : result.summary?.replace(/\|/g, '\\|').slice(0, 120) ?? '';
      return `| ${result.modelLabel} | ${result.skillLabel} | ${result.status} | ${result.buildStatus ?? '-'} | ${result.generationMode ?? '-'} | ${result.latencyMs ?? 0}ms | ${preview} | ${notes} |`;
    }),
    '',
    '## Signal scan',
    '',
    '| Run | Wallet | EIP-6963 | wagmi | viem | Balance | Transfer | Approval | Risk | Source bytes |',
    '| --- | --- | --- | --- | --- | --- | --- | --- | --- | ---: |',
    ...results.map((result) => {
      const s = result.signals ?? {};
      const yes = (value: unknown) => (value ? 'yes' : 'no');
      const bytes = Number(s.appSourceBytes ?? 0) + Number(s.styleSourceBytes ?? 0);
      return `| ${result.runId} | ${yes(s.hasWalletCopy)} | ${yes(s.mentionsEip6963)} | ${yes(s.mentionsWagmi)} | ${yes(s.mentionsViem)} | ${yes(s.hasBalanceFlow)} | ${yes(s.hasTransferFlow)} | ${yes(s.hasApprovalFlow)} | ${yes(s.hasRiskCopy)} | ${bytes} |`;
    }),
    '',
    '## Manual review checklist',
    '',
    '- Product feel: does it look like a dApp instead of a scanner?',
    '- Skill adherence: does the selected skill visibly change layout/copy/flow?',
    '- ERC20 completeness: balance, transfer, allowance/approve, decimals/symbol/totalSupply where available.',
    '- Wallet UX: connection state, account/network readiness, wrong-network guidance.',
    '- Safety: approvals and risky actions separated from the main flow.',
    '- Winner: mark the best generated app after opening previews.',
  ];
  return `${lines.join('\n')}\n`;
}

async function main() {
  const args = parseArgs();
  const experimentId = `erc20-skill-matrix-${new Date().toISOString().replace(/[:.]/g, '-')}`;
  const outputDir = resolve(repoRoot, 'data', 'experiments', experimentId);
  const generatedRoot = resolve(repoRoot, 'data', 'generated-dapps');
  const models = modelPresets().filter((model) => !args.onlyModel || model.id === args.onlyModel);
  const skills = skillPresets.filter((skill) => !args.onlySkill || skill.id === args.onlySkill);

  await mkdir(outputDir, { recursive: true });

  const plan = models.flatMap((model) => skills.map((skill) => ({ model, skill })));
  const results: ExperimentResult[] = [];

  if (args.dryRun) {
    const dryPlan = plan.map(({ model, skill }) => ({
      modelId: model.id,
      modelLabel: model.label,
      skillId: skill.id,
      skillLabel: skill.label,
      skippedReason: model.requiresEnv && !process.env[model.requiresEnv] ? `missing ${model.requiresEnv}` : undefined,
      input: redactInput({
        contractAddress,
        chain,
        skill: skill.skills[0] ?? 'auto',
        skills: skill.skills,
        agentSkills: skill.agentSkills,
        customAgentSkill: skill.customAgentSkill,
        ...model.input,
      }),
    }));
    await writeFile(join(outputDir, 'dry-run-plan.json'), JSON.stringify({ experimentId, dryRun: true, plan: dryPlan }, null, 2), 'utf8');
    console.log(`Dry run wrote ${join(outputDir, 'dry-run-plan.json')}`);
    console.log(`Run for real with: DEEPSEEK_API_KEY=... npm run experiment:erc20-skills -- --run`);
    return;
  }

  for (const { model, skill } of plan) {
    const runId = `${model.id}__${skill.id}`;
    const startedAt = Date.now();
    if (model.requiresEnv && !process.env[model.requiresEnv]) {
      results.push({
        runId,
        modelId: model.id,
        modelLabel: model.label,
        skillId: skill.id,
        skillLabel: skill.label,
        status: 'skipped',
        error: `Missing ${model.requiresEnv}`,
      });
      continue;
    }

    const input: BuilderTaskInput = {
      contractAddress,
      chain,
      skill: skill.skills[0] ?? 'auto',
      skills: skill.skills,
      agentSkills: skill.agentSkills,
      customAgentSkill: skill.customAgentSkill,
      ...model.input,
    };

    try {
      console.log(`Running ${runId}...`);
      const result = await runBuilderAgent(input, {
        taskId: `${experimentId}-${runId}`,
        generatedAppsDir: generatedRoot,
        onProgress: async (progress, summary) => {
          console.log(`[${runId}] ${progress}: ${summary}`);
        },
      });
      const generatedApp = result.generatedApp;
      results.push({
        runId,
        modelId: model.id,
        modelLabel: model.label,
        skillId: skill.id,
        skillLabel: skill.label,
        status: generatedApp?.generationMode === 'fallback' || result.status === 'failed' ? 'failed' : 'success',
        previewUrl: generatedApp?.previewUrl,
        sourceDir: generatedApp?.sourceDir,
        distDir: generatedApp?.distDir,
        buildStatus: generatedApp?.buildStatus,
        generationMode: generatedApp?.generationMode,
        summary: result.summary,
        latencyMs: Date.now() - startedAt,
        signals: await collectSignals(generatedApp?.sourceDir),
      });
    } catch (error) {
      results.push({
        runId,
        modelId: model.id,
        modelLabel: model.label,
        skillId: skill.id,
        skillLabel: skill.label,
        status: 'failed',
        latencyMs: Date.now() - startedAt,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  const payload = {
    experimentId,
    contractAddress,
    chain,
    models: models.map((model) => ({ id: model.id, label: model.label })),
    skills,
    results,
  };
  await writeFile(join(outputDir, 'results.json'), JSON.stringify(payload, null, 2), 'utf8');
  await writeFile(join(outputDir, 'report.md'), markdownReport(experimentId, results), 'utf8');
  console.log(`Experiment results: ${join(outputDir, 'results.json')}`);
  console.log(`Experiment report: ${join(outputDir, 'report.md')}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
