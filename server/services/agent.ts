import type { BuilderTaskInput, BuilderTaskResult } from '../../shared/schema.js';
import { fetchContractMetadata } from './abi.js';
import { analyzeContract } from './analyzer.js';
import { enhancePageConfigWithLlm } from './llm.js';
import { buildPageConfig } from './page-config.js';

export async function runBuilderAgent(input: BuilderTaskInput): Promise<BuilderTaskResult> {
  const { abi, contractName } = await fetchContractMetadata(input.contractAddress);

  const analysis = analyzeContract({
    abi,
    contractAddress: input.contractAddress,
    contractName,
    chain: input.chain,
    requestedSkill: input.skill,
  });

  const deterministicPageConfig = buildPageConfig(analysis);
  const enhancedPageConfig = await enhancePageConfigWithLlm({
    apiKey: input.apiKey,
    model: input.model,
    analysis,
    pageConfig: deterministicPageConfig,
  });
  const pageConfig = enhancedPageConfig ?? deterministicPageConfig;

  return {
    abi,
    warnings: pageConfig.warnings,
    dangerousMethods: pageConfig.dangerousMethods,
    methods: pageConfig.methods,
    sections: pageConfig.sections,
    pageConfig,
    analysis: {
      contractType: analysis.contractType,
      skillMatch: analysis.skillMatch,
      recommendedSkills: analysis.recommendedSkills,
    },
    error: '',
  };
}
