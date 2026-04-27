import { pageConfigSchema, type BuilderTaskInput, type BuilderTaskResult, type PageConfig, type PageMethod, type PageSection } from '../../shared/schema.js';
import { fetchContractMetadata } from './abi.js';
import { analyzeContract } from './analyzer.js';
import { runHermesAgentGeneration } from './hermes-agent.js';
import { enhancePageConfigWithLlm } from './llm.js';
import { buildPageConfig } from './page-config.js';

function mergeMethodCopy(baseMethods: PageMethod[], generatedMethods: PageMethod[] = []): PageMethod[] {
  const generatedByName = new Map(generatedMethods.map((method) => [method.name, method]));

  return baseMethods.map((baseMethod) => {
    const generatedMethod = generatedByName.get(baseMethod.name);
    if (!generatedMethod) {
      return baseMethod;
    }

    const inputs =
      generatedMethod.inputs.length === baseMethod.inputs.length
        ? baseMethod.inputs.map((input, index) => ({
            ...input,
            ...(generatedMethod.inputs[index]?.name ? { name: generatedMethod.inputs[index].name } : {}),
          }))
        : baseMethod.inputs;

    const outputs =
      generatedMethod.outputs.length === baseMethod.outputs.length
        ? baseMethod.outputs.map((output, index) => ({
            ...output,
            ...(generatedMethod.outputs[index]?.name ? { name: generatedMethod.outputs[index].name } : {}),
          }))
        : baseMethod.outputs;

    return {
      ...baseMethod,
      ...(generatedMethod.label ? { label: generatedMethod.label } : {}),
      ...(generatedMethod.description ? { description: generatedMethod.description } : {}),
      ...(generatedMethod.category ? { category: generatedMethod.category } : {}),
      inputs,
      outputs,
    };
  });
}

function mergeGeneratedPageConfig(base: PageConfig, generated?: PageConfig): PageConfig {
  if (!generated) {
    return base;
  }

  const allowedMethodNames = new Set([...base.methods, ...base.dangerousMethods].map((method) => method.name));
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
    ...(generated.contractName ? { contractName: generated.contractName } : {}),
    sections: safeSections.length > 0 ? safeSections : base.sections,
    warnings: [...new Set([...base.warnings, ...generated.warnings])],
    primaryActions: generated.primaryActions?.length ? generated.primaryActions : base.primaryActions,
    methods: mergeMethodCopy(base.methods, generated.methods),
    dangerousMethods: mergeMethodCopy(base.dangerousMethods, generated.dangerousMethods),
  });
}

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
  const generated = await runHermesAgentGeneration({
    input,
    abi,
    analysis,
    deterministicPageConfig,
  });
  const agentPageConfig = mergeGeneratedPageConfig(deterministicPageConfig, generated?.status === 'success' ? generated.pageConfig : undefined);
  const enhancedPageConfig = await enhancePageConfigWithLlm({
    apiKey: input.apiKey,
    model: input.model,
    analysis,
    pageConfig: agentPageConfig,
  });
  const pageConfig = enhancedPageConfig ?? agentPageConfig;

  return {
    abi,
    summary: generated?.status === 'success' ? generated.summary : undefined,
    status: generated?.status,
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
    error: generated?.status === 'failed' ? generated.error : '',
  };
}
