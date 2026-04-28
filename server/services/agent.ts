import { pageConfigSchema, type BuilderTaskInput, type BuilderTaskResult, type PageConfig, type PageSection } from '../../shared/schema.js';
import { fetchContractMetadata } from './abi.js';
import { analyzeContract } from './analyzer.js';
import { buildCapabilityPrimitives } from './capabilities.js';
import { buildDeterministicExperience } from './experience.js';
import { validateExperience } from './experience-validator.js';
import { runHermesAgentGeneration } from './hermes-agent.js';
import { enhancePageConfigWithLlm } from './llm.js';
import { buildPageConfig } from './page-config.js';
import { normalizeSelectedSkills } from './skills.js';

function mergeGeneratedPageConfig(base: PageConfig, generated?: PageConfig): PageConfig {
  if (!generated) {
    return base;
  }

  const allowedMethodNames = new Set(base.methods.map((method) => method.name));
  const safeSections = generated.sections
    .map((section): PageSection => ({
      ...section,
      methodNames: section.methodNames.filter((methodName) => allowedMethodNames.has(methodName)),
    }))
    .filter((section) => section.variant === 'overview' || section.methodNames.length > 0);

  return pageConfigSchema.parse({
    ...base,
    ...(generated.title ? { title: generated.title } : {}),
    ...(generated.description ? { description: generated.description } : {}),
    sections: safeSections.length > 0 ? safeSections : base.sections,
    warnings: [...new Set([...base.warnings, ...generated.warnings])],
    methods: base.methods,
    dangerousMethods: base.dangerousMethods,
  });
}

export async function runBuilderAgent(input: BuilderTaskInput): Promise<BuilderTaskResult> {
  const { abi, contractName } = await fetchContractMetadata(input.contractAddress);
  const normalizedSkills = normalizeSelectedSkills(input.skills ?? [input.skill]);
  const requestedSkill = normalizedSkills.businessSkills[0] ?? 'auto';

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
  const generated = await runHermesAgentGeneration({
    input,
    abi,
    analysis,
    capabilities,
    normalizedSkills,
    deterministicPageConfig,
    deterministicExperience,
  });
  const candidateExperience = generated?.status === 'success'
    ? generated.experience ?? generated.pageConfig.experience
    : undefined;
  const validated = validateExperience({
    incoming: candidateExperience ?? deterministicExperience,
    fallback: deterministicExperience,
    methods: deterministicPageConfig.methods,
    dangerousMethods: deterministicPageConfig.dangerousMethods,
    deterministicWarnings: deterministicPageConfig.warnings,
  });
  const agentPageConfig = mergeGeneratedPageConfig(deterministicPageConfig, generated?.status === 'success' ? generated.pageConfig : undefined);
  const pageConfigWithExperience = pageConfigSchema.parse({
    ...agentPageConfig,
    skills: normalizedSkills.skills,
    experience: validated.experience,
    warnings: [...new Set([...agentPageConfig.warnings, ...validated.experience.warnings, ...normalizedSkills.diagnostics])],
  });
  const enhancedPageConfig = await enhancePageConfigWithLlm({
    modelConfig: input.modelConfig,
    apiKey: input.apiKey,
    model: input.model,
    analysis,
    pageConfig: pageConfigWithExperience,
  });
  const pageConfig = enhancedPageConfig ?? pageConfigWithExperience;

  return {
    abi,
    summary: generated?.status === 'success' ? generated.summary : undefined,
    status: generated?.status,
    warnings: pageConfig.warnings,
    dangerousMethods: pageConfig.dangerousMethods,
    methods: pageConfig.methods,
    sections: pageConfig.sections,
    pageConfig,
    experience: pageConfig.experience,
    analysis: {
      contractType: analysis.contractType,
      skillMatch: analysis.skillMatch,
      recommendedSkills: analysis.recommendedSkills,
    },
    error: generated?.status === 'failed' ? generated.error : '',
  };
}
