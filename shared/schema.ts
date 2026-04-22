import { z } from 'zod';

export const supportedChains = ['conflux-espace-testnet'] as const;
export const supportedChainIds = [71] as const;
export const supportedSkills = [
  'token-dashboard',
  'nft-mint-page',
  'claim-page',
  'staking-page',
] as const;
export const promptTaskStatuses = ['pending', 'running', 'success', 'failed'] as const;
export const legacyTaskStatuses = ['queued', 'processing', 'completed', 'failed'] as const;
export const allTaskStatuses = ['pending', 'running', 'success', 'queued', 'processing', 'completed', 'failed'] as const;
export const taskProgressStages = ['pending', 'fetching_abi', 'analyzing_contract', 'generating_page_config', 'completed'] as const;

export type ChainKey = (typeof supportedChains)[number];
export type ChainId = (typeof supportedChainIds)[number];
export type SkillName = (typeof supportedSkills)[number];
export type PromptTaskStatus = (typeof promptTaskStatuses)[number];
export type LegacyTaskStatus = (typeof legacyTaskStatuses)[number];
export type TaskStatus = (typeof allTaskStatuses)[number];
export type TaskProgress = (typeof taskProgressStages)[number];
export type ContractType = 'token' | 'nft' | 'claim' | 'staking' | 'unknown' | 'generic';

export const chainKeyToId: Record<ChainKey, ChainId> = {
  'conflux-espace-testnet': 71,
};

export const chainIdToKey: Record<ChainId, ChainKey> = {
  71: 'conflux-espace-testnet',
};

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

export const builderTaskInputSchema = z.object({
  contractAddress: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
  chain: z.enum(supportedChains),
  skill: z.enum(supportedSkills),
  model: z.string().trim().min(1),
  apiKey: z.string(),
});

export const builderTaskRequestSchema = z.object({
  contractAddress: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
  chainId: z.literal(71),
  skill: z.enum(supportedSkills),
  model: z.string().trim().min(1),
  apiKey: z.string(),
});

export const storedTaskInputSchema = z.object({
  contractAddress: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
  chainId: z.literal(71),
  skill: z.enum(supportedSkills),
  model: z.string().trim().min(1),
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

export const pageConfigSchema = z.object({
  chainId: z.number().int().default(71),
  rpcUrl: z.string().default('https://evmtestnet.confluxrpc.com'),
  contractAddress: z.string(),
  skill: z.enum(supportedSkills),
  title: z.string(),
  description: z.string().default(''),
  chain: z.enum(supportedChains).default('conflux-espace-testnet'),
  contractName: z.string().default(''),
  warnings: z.array(z.string()).default([]),
  dangerousMethods: z.array(pageMethodSchema).default([]),
  methods: z.array(pageMethodSchema).default([]),
  sections: z.array(pageSectionSchema).default([]),
});

export const analysisSummarySchema = z.object({
  contractType: z.enum(['token', 'nft', 'claim', 'staking', 'unknown', 'generic']),
  skillMatch: z.boolean().optional(),
  recommendedSkills: z.array(z.enum(supportedSkills)).optional(),
  recommendedSkill: z.union([z.enum(supportedSkills), z.literal('unknown')]).optional(),
  readMethods: z.array(pageMethodSchema).optional(),
  writeMethods: z.array(pageMethodSchema).optional(),
  dangerousMethods: z.array(pageMethodSchema).optional(),
  warnings: z.array(z.string()).optional(),
});

export const agentRunResultSchema = z.object({
  summary: z.string(),
  contractAnalysis: analysisSummarySchema.extend({
    contractType: z.enum(['token', 'nft', 'claim', 'staking', 'unknown']),
    recommendedSkill: z.union([z.enum(supportedSkills), z.literal('unknown')]),
  }),
  pageConfig: pageConfigSchema,
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
export type BuilderTaskInput = z.infer<typeof builderTaskInputSchema>;
export type BuilderTaskRequest = z.infer<typeof builderTaskRequestSchema>;
export type StoredTaskInput = z.infer<typeof storedTaskInputSchema>;
export type PageMethod = z.infer<typeof pageMethodSchema>;
export type PageSection = z.infer<typeof pageSectionSchema>;
export type PageConfig = z.infer<typeof pageConfigSchema>;
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
    skill: input.skill,
    model: input.model,
    apiKey: input.apiKey,
  });
}

export function sanitizeTaskInput(input: BuilderTaskInput | BuilderTaskRequest): StoredTaskInput {
  const request = toBuilderTaskRequest(input);
  return storedTaskInputSchema.parse({
    contractAddress: request.contractAddress,
    chainId: request.chainId,
    skill: request.skill,
    model: request.model,
  });
}

export function chainIdToChainKey(chainId: ChainId): ChainKey {
  return chainIdToKey[chainId];
}
