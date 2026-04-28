import { type BuilderTaskInput, type BuilderTaskResult, type TaskProgress } from '../../shared/schema.js';
import { appConfig } from '../config.js';
import { fetchContractMetadata } from './abi.js';
import { analyzeContract } from './analyzer.js';
import { buildCapabilityPrimitives } from './capabilities.js';
import { buildDeterministicExperience } from './experience.js';
import { runAgentGeneratedDappWorkflow } from './agent-workflow.js';
import { buildPageConfig } from './page-config.js';
import { normalizeSelectedSkills } from './skills.js';

interface RunBuilderAgentOptions {
  taskId?: string;
  generatedAppsDir?: string;
  onProgress?: (progress: TaskProgress, summary: string) => void | Promise<void>;
}

async function reportProgress(options: RunBuilderAgentOptions | undefined, progress: TaskProgress, summary: string) {
  await options?.onProgress?.(progress, summary);
}

export async function runBuilderAgent(input: BuilderTaskInput, options: RunBuilderAgentOptions = {}): Promise<BuilderTaskResult> {
  await reportProgress(options, 'fetching_abi', 'Fetching contract ABI and metadata from ConfluxScan.');
  const { abi, contractName } = await fetchContractMetadata(input.contractAddress);
  const normalizedSkills = normalizeSelectedSkills(input.skills ?? [input.skill]);
  const requestedSkill = normalizedSkills.businessSkills[0] ?? 'auto';

  await reportProgress(options, 'analyzing_contract', 'Analyzing contract capabilities and safety boundaries.');
  const analysis = analyzeContract({
    abi,
    contractAddress: input.contractAddress,
    contractName,
    chain: input.chain,
    requestedSkill,
  });

  const capabilities = buildCapabilityPrimitives(analysis, normalizedSkills.skills);
  const deterministicExperience = buildDeterministicExperience({
    analysis,
    capabilities,
    skills: normalizedSkills.skills,
  });
  const deterministicPageConfig = buildPageConfig(analysis, deterministicExperience);
  const generatedApp = await runAgentGeneratedDappWorkflow({
    taskId: options.taskId ?? `task-${Date.now()}`,
    rootDir: options.generatedAppsDir ?? appConfig.generatedDappsDir,
    input,
    abi,
    analysis,
    capabilities,
    normalizedSkills,
    onProgress: options.onProgress,
  });
  const pageConfig = {
    ...deterministicPageConfig,
    skills: normalizedSkills.skills,
    experience: deterministicExperience,
    warnings: [...new Set([...deterministicPageConfig.warnings, ...normalizedSkills.diagnostics])],
  };

  return {
    abi,
    summary: generatedApp.frontendSummary,
    status: generatedApp.buildStatus === 'failed' ? 'failed' : 'success',
    warnings: pageConfig.warnings,
    dangerousMethods: pageConfig.dangerousMethods,
    methods: pageConfig.methods,
    sections: pageConfig.sections,
    pageConfig,
    experience: pageConfig.experience,
    generatedApp,
    analysis: {
      contractType: analysis.contractType,
      skillMatch: analysis.skillMatch,
      recommendedSkills: analysis.recommendedSkills,
    },
    error: '',
  };
}
