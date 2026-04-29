import { z } from 'zod';

export const supportedChains = ['conflux-espace-testnet'] as const;
export const supportedChainIds = [71] as const;
export const supportedSkills = [
  'auto',
  'token-dashboard',
  'nft-mint-experience',
  'voting-participation',
  'injected-wallet',
  'eip-6963-wallet-discovery',
  'chain-switching',
  'guided-flow',
  'transaction-timeline',
  'risk-explainer',
  'explorer-links',
  // Legacy skill ids remain accepted so old task files and tests can parse.
  'nft-mint-page',
  'claim-page',
  'staking-page',
] as const;
export const businessSkills = [
  'auto',
  'token-dashboard',
  'nft-mint-experience',
  'voting-participation',
] as const;
export const walletSkills = [
  'injected-wallet',
  'eip-6963-wallet-discovery',
  'chain-switching',
] as const;
export const experienceSkills = [
  'guided-flow',
  'transaction-timeline',
  'risk-explainer',
  'explorer-links',
] as const;
export const promptTaskStatuses = ['pending', 'running', 'success', 'failed'] as const;
export const legacyTaskStatuses = ['queued', 'processing', 'completed', 'failed'] as const;
export const allTaskStatuses = ['pending', 'running', 'success', 'queued', 'processing', 'completed', 'failed'] as const;
export const taskProgressStages = [
  'pending',
  'fetching_abi',
  'analyzing_contract',
  'product_planning',
  'experience_design',
  'frontend_generation',
  'validating_generated_app',
  'generating_page_config',
  'completed',
] as const;

export type ChainKey = (typeof supportedChains)[number];
export type ChainId = (typeof supportedChainIds)[number];
export type SkillName = (typeof supportedSkills)[number];
export type BusinessSkillName = (typeof businessSkills)[number];
export type WalletSkillName = (typeof walletSkills)[number];
export type ExperienceSkillName = (typeof experienceSkills)[number];
export type PromptTaskStatus = (typeof promptTaskStatuses)[number];
export type LegacyTaskStatus = (typeof legacyTaskStatuses)[number];
export type TaskStatus = (typeof allTaskStatuses)[number];
export type TaskProgress = (typeof taskProgressStages)[number];
export type ContractType = 'token' | 'nft' | 'voting' | 'claim' | 'staking' | 'unknown' | 'generic';

export const chainKeyToId: Record<ChainKey, ChainId> = {
  'conflux-espace-testnet': 71,
};

export const chainIdToKey: Record<ChainId, ChainKey> = {
  71: 'conflux-espace-testnet',
};

export const defaultModelProviderId = 'nvidia-deepseek-v4-pro';
export const defaultModelBaseUrl = 'https://integrate.api.nvidia.com/v1';
export const defaultModelName = 'deepseek-ai/deepseek-v4-pro';

export const chainMetadataById: Record<ChainId, { chainId: ChainId; chain: ChainKey; chainName: string; rpcUrl: string }> = {
  71: {
    chainId: 71,
    chain: 'conflux-espace-testnet',
    chainName: 'Conflux eSpace Testnet',
    rpcUrl: 'https://evmtestnet.confluxrpc.com',
  },
};

export const abiParameterSchema = z.object({
  name: z.string().default(''),
  type: z.string(),
});

export const abiEntrySchema = z.object({
  type: z.string(),
  name: z.string().optional(),
  stateMutability: z.string().optional(),
  inputs: z.array(abiParameterSchema).default([]),
  outputs: z.array(abiParameterSchema).default([]),
});

export const modelConfigSchema = z.object({
  providerId: z.string().trim().min(1).optional(),
  baseUrl: z.string().url().default(defaultModelBaseUrl),
  model: z.string().trim().min(1),
  apiKey: z.string().default(''),
});

export const storedModelConfigSchema = modelConfigSchema.omit({ apiKey: true });

const legacySkillMap: Record<string, SkillName> = {
  'token-dashboard': 'token-dashboard',
  'nft-mint-page': 'nft-mint-experience',
  'claim-page': 'auto',
  'staking-page': 'auto',
};

function normalizeSkillList(value: unknown): SkillName[] {
  const raw = Array.isArray(value) ? value : value ? [value] : ['auto'];
  const normalized = raw
    .map((skill): string => legacySkillMap[String(skill)] ?? String(skill))
    .filter((skill): skill is SkillName => (supportedSkills as readonly string[]).includes(skill));
  return [...new Set<SkillName>(normalized.length > 0 ? normalized : ['auto'])];
}

const builderTaskInputBaseSchema = z.object({
  contractAddress: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
  chain: z.enum(supportedChains),
  skill: z.string().optional(),
  skills: z.array(z.enum(supportedSkills)).optional(),
  model: z.string().trim().min(1).optional(),
  apiKey: z.string().optional(),
  modelConfig: modelConfigSchema.optional(),
});

const transformedBuilderTaskInputSchema = builderTaskInputBaseSchema.transform((input) => {
  const skills = normalizeSkillList(input.skills ?? input.skill);
  const modelConfig = input.modelConfig ?? {
    providerId: defaultModelProviderId,
    baseUrl: defaultModelBaseUrl,
    model: input.model ?? defaultModelName,
    apiKey: input.apiKey ?? '',
  };

  return {
    contractAddress: input.contractAddress,
    chain: input.chain,
    skills,
    skill: skills[0],
    model: modelConfig.model,
    apiKey: modelConfig.apiKey,
    modelConfig,
  };
});

export const builderTaskInputSchema = Object.assign(transformedBuilderTaskInputSchema, {
  shape: builderTaskInputBaseSchema.shape,
});

export const builderTaskRequestSchema = z.object({
  contractAddress: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
  chainId: z.literal(71),
  skill: z.enum(supportedSkills).optional(),
  skills: z.array(z.enum(supportedSkills)).optional(),
  model: z.string().trim().min(1).optional(),
  apiKey: z.string().optional(),
  modelConfig: modelConfigSchema.optional(),
}).transform((input) => {
  const skills = normalizeSkillList(input.skills ?? input.skill);
  const modelConfig = input.modelConfig ?? {
    providerId: defaultModelProviderId,
    baseUrl: defaultModelBaseUrl,
    model: input.model ?? defaultModelName,
    apiKey: input.apiKey ?? '',
  };

  return {
    contractAddress: input.contractAddress,
    chainId: input.chainId,
    skills,
    skill: skills[0],
    model: modelConfig.model,
    apiKey: modelConfig.apiKey,
    modelConfig,
  };
});

export const storedTaskInputSchema = z.object({
  contractAddress: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
  chainId: z.literal(71),
  skill: z.enum(supportedSkills).optional(),
  skills: z.array(z.enum(supportedSkills)).optional(),
  model: z.string().trim().min(1).optional(),
  modelConfig: storedModelConfigSchema.optional(),
}).transform((input) => {
  const skills = normalizeSkillList(input.skills ?? input.skill);
  return {
    contractAddress: input.contractAddress,
    chainId: input.chainId,
    skills,
    modelConfig: input.modelConfig,
  };
});

export const pageMethodSchema = z.object({
  name: z.string(),
  label: z.string(),
  type: z.enum(['read', 'write']),
  dangerLevel: z.enum(['safe', 'warn', 'danger']),
  stateMutability: z.string(),
  inputs: z.array(abiParameterSchema).default([]),
  outputs: z.array(abiParameterSchema).default([]),
  description: z.string(),
  category: z.string().optional(),
});

export const pageSectionSchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string().default(''),
  variant: z.enum(['overview', 'read', 'write', 'actions', 'danger']),
  methodNames: z.array(z.string()).default([]),
});

export const experienceComponentTypeSchema = z.enum([
  'hero',
  'wallet',
  'metric',
  'lookup',
  'action',
  'flow',
  'timeline',
  'risk',
  'explorerLink',
  'unsupported',
]);

export const experienceComponentSchema = z.object({
  id: z.string().min(1),
  type: experienceComponentTypeSchema,
  title: z.string().default(''),
  description: z.string().default(''),
  methodName: z.string().optional(),
  methodNames: z.array(z.string()).default([]),
  warnings: z.array(z.string()).default([]),
  href: z.string().optional(),
  children: z.array(z.string()).default([]),
});

export const experienceSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  summary: z.string().default(''),
  template: z.enum(['auto', 'token-dashboard', 'nft-mint-experience', 'voting-participation', 'generic']),
  confidence: z.number().min(0).max(1),
  skills: z.array(z.enum(supportedSkills)).default(['auto']),
  components: z.array(experienceComponentSchema).default([]),
  warnings: z.array(z.string()).default([]),
  unsupported: z.array(z.string()).default([]),
});

export const pageConfigSchema = z.object({
  chainId: z.number().int().default(71),
  rpcUrl: z.string().default('https://evmtestnet.confluxrpc.com'),
  contractAddress: z.string(),
  skill: z.enum(supportedSkills).default('auto'),
  skills: z.array(z.enum(supportedSkills)).default(['auto']),
  title: z.string(),
  description: z.string().default(''),
  chain: z.enum(supportedChains).default('conflux-espace-testnet'),
  contractName: z.string().default(''),
  warnings: z.array(z.string()).default([]),
  primaryActions: z.array(z.string()).default([]),
  dangerousMethods: z.array(pageMethodSchema).default([]),
  methods: z.array(pageMethodSchema).default([]),
  sections: z.array(pageSectionSchema).default([]),
  experience: experienceSchema.optional(),
});

export const analysisSummarySchema = z.object({
  contractType: z.enum(['token', 'nft', 'voting', 'claim', 'staking', 'unknown', 'generic']),
  skillMatch: z.boolean().optional(),
  recommendedSkills: z.array(z.enum(supportedSkills)).optional(),
  recommendedSkill: z.union([z.enum(supportedSkills), z.literal('unknown')]).optional(),
  readMethods: z.array(pageMethodSchema).optional(),
  writeMethods: z.array(pageMethodSchema).optional(),
  dangerousMethods: z.array(pageMethodSchema).optional(),
  warnings: z.array(z.string()).optional(),
});

export const agentDocumentSchema = z.object({
  role: z.enum(['product-manager', 'designer']),
  title: z.string().min(1),
  markdown: z.string().min(1),
});

export const generatedAppFileSchema = z.object({
  path: z.string().min(1),
  content: z.string(),
});

export const generatedFrontendAppSchema = z.object({
  summary: z.string().min(1),
  files: z.array(generatedAppFileSchema).min(3),
});

export const generatedAppArtifactSchema = z.object({
  taskId: z.string().min(1),
  sourceDir: z.string().min(1),
  distDir: z.string().min(1),
  previewUrl: z.string().min(1),
  buildStatus: z.enum(['success', 'failed', 'skipped']),
  productPlan: agentDocumentSchema,
  designSpec: agentDocumentSchema,
  frontendSummary: z.string().default(''),
  validationWarnings: z.array(z.string()).default([]),
});

export const agentRunResultSchema = z.object({
  summary: z.string(),
  contractAnalysis: analysisSummarySchema.extend({
    contractType: z.enum(['token', 'nft', 'voting', 'claim', 'staking', 'unknown', 'generic']),
    recommendedSkill: z.union([z.enum(supportedSkills), z.literal('unknown')]),
  }),
  pageConfig: pageConfigSchema,
  experience: experienceSchema.optional(),
  status: z.enum(['success', 'failed']),
  error: z.string().default(''),
});

export const builderTaskResultSchema = z.object({
  abi: z.array(abiEntrySchema).optional(),
  warnings: z.array(z.string()).default([]),
  dangerousMethods: z.array(pageMethodSchema).default([]),
  methods: z.array(pageMethodSchema).default([]),
  sections: z.array(pageSectionSchema).default([]),
  pageConfig: pageConfigSchema,
  experience: experienceSchema.optional(),
  generatedApp: generatedAppArtifactSchema.optional(),
  analysis: analysisSummarySchema.optional(),
  summary: z.string().optional(),
  status: z.enum(['success', 'failed']).optional(),
  error: z.string().default(''),
});

export const builderTaskSchema = z.object({
  id: z.string().optional(),
  taskId: z.string().optional(),
  status: z.enum(allTaskStatuses),
  progress: z.enum(taskProgressStages).optional(),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
  input: z.union([builderTaskInputSchema, storedTaskInputSchema]).optional(),
  result: builderTaskResultSchema.optional(),
  pageConfig: z.union([pageConfigSchema, z.object({}).passthrough()]).optional(),
  summary: z.string().optional(),
  error: z.string().optional(),
});

export const createTaskResponseSchema = z.object({
  taskId: z.string(),
  status: z.literal('pending'),
});

export const taskDetailResponseSchema = z.object({
  taskId: z.string(),
  status: z.enum(promptTaskStatuses),
  progress: z.enum(taskProgressStages),
  summary: z.string().default(''),
  pageConfig: z.union([pageConfigSchema, z.object({}).passthrough()]),
  error: z.string().default(''),
});

export type AbiParameter = z.infer<typeof abiParameterSchema>;
export type AbiEntry = z.infer<typeof abiEntrySchema>;
export type ModelConfig = z.infer<typeof modelConfigSchema>;
export type StoredModelConfig = z.infer<typeof storedModelConfigSchema>;
export type BuilderTaskInput = z.infer<typeof builderTaskInputSchema>;
export type BuilderTaskRequest = z.infer<typeof builderTaskRequestSchema>;
export type StoredTaskInput = z.infer<typeof storedTaskInputSchema>;
export type PageMethod = z.infer<typeof pageMethodSchema>;
export type PageSection = z.infer<typeof pageSectionSchema>;
export type ExperienceComponentType = z.infer<typeof experienceComponentTypeSchema>;
export type ExperienceComponent = z.infer<typeof experienceComponentSchema>;
export type Experience = z.infer<typeof experienceSchema>;
export type PageConfig = z.infer<typeof pageConfigSchema>;
export type AgentDocument = z.infer<typeof agentDocumentSchema>;
export type GeneratedAppFile = z.infer<typeof generatedAppFileSchema>;
export type GeneratedFrontendApp = z.infer<typeof generatedFrontendAppSchema>;
export type GeneratedAppArtifact = z.infer<typeof generatedAppArtifactSchema>;
export type BuilderTaskResult = z.infer<typeof builderTaskResultSchema>;
export type BuilderTask = z.infer<typeof builderTaskSchema>;
export type AnalysisSummary = z.infer<typeof analysisSummarySchema>;
export type AgentRunResult = z.infer<typeof agentRunResultSchema>;
export type CreateTaskResponse = z.infer<typeof createTaskResponseSchema>;
export type TaskDetailResponse = z.infer<typeof taskDetailResponseSchema>;

export interface AnalyzeContractInput {
  abi: AbiEntry[];
  contractAddress: string;
  contractName: string;
  chain: ChainKey;
  requestedSkill: SkillName;
}

export interface AnalyzeContractResult extends AnalysisSummary {
  contractAddress: string;
  contractName: string;
  chain: ChainKey;
  requestedSkill: SkillName;
  contractType: ContractType;
  recommendedSkill?: SkillName | 'unknown';
  skillMatch: boolean;
  recommendedSkills?: SkillName[];
  methods: PageMethod[];
  readMethods?: PageMethod[];
  writeMethods?: PageMethod[];
  dangerousMethods: PageMethod[];
  warnings: string[];
}

export function toBuilderTaskRequest(input: BuilderTaskInput | BuilderTaskRequest): BuilderTaskRequest {
  if ('chainId' in input) {
    return builderTaskRequestSchema.parse(input);
  }

  return builderTaskRequestSchema.parse({
    contractAddress: input.contractAddress,
    chainId: chainKeyToId[input.chain],
    skills: input.skills,
    skill: input.skill,
    model: input.model,
    apiKey: input.apiKey,
    modelConfig: input.modelConfig,
  });
}

export function sanitizeTaskInput(input: BuilderTaskInput | BuilderTaskRequest): StoredTaskInput {
  const request = toBuilderTaskRequest(input);
  return storedTaskInputSchema.parse({
    contractAddress: request.contractAddress,
    chainId: request.chainId,
    skills: request.skills,
    skill: request.skill,
    model: request.model,
    modelConfig: request.modelConfig
      ? { providerId: request.modelConfig.providerId, baseUrl: request.modelConfig.baseUrl, model: request.modelConfig.model }
      : undefined,
  });
}

export function chainIdToChainKey(chainId: ChainId): ChainKey {
  return chainIdToKey[chainId];
}
