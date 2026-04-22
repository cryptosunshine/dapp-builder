import { z } from 'zod';

export const supportedChains = ['conflux-espace-testnet'] as const;
export const supportedSkills = [
  'token-dashboard',
  'nft-mint-page',
  'claim-page',
  'staking-page',
] as const;

export type ChainKey = (typeof supportedChains)[number];
export type SkillName = (typeof supportedSkills)[number];
export type TaskStatus = 'queued' | 'processing' | 'completed' | 'failed';
export type ContractType = 'token' | 'nft' | 'claim' | 'staking' | 'generic';

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
  apiKey: z.string().trim().min(1),
});

export const pageMethodSchema = z.object({
  name: z.string(),
  label: z.string(),
  type: z.enum(['read', 'write']),
  dangerLevel: z.enum(['safe', 'warn', 'danger']),
  stateMutability: z.string(),
  inputs: z.array(abiParameterSchema),
  outputs: z.array(abiParameterSchema),
  description: z.string(),
  category: z.string().optional(),
});

export const pageSectionSchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string().default(''),
  variant: z.enum(['overview', 'read', 'actions', 'danger']),
  methodNames: z.array(z.string()).default([]),
});

export const pageConfigSchema = z.object({
  title: z.string(),
  description: z.string(),
  chain: z.enum(supportedChains),
  chainId: z.number().int(),
  contractAddress: z.string(),
  contractName: z.string(),
  skill: z.enum(supportedSkills),
  warnings: z.array(z.string()).default([]),
  dangerousMethods: z.array(pageMethodSchema).default([]),
  methods: z.array(pageMethodSchema).default([]),
  sections: z.array(pageSectionSchema).default([]),
});

export const analysisSummarySchema = z.object({
  contractType: z.enum(['token', 'nft', 'claim', 'staking', 'generic']),
  skillMatch: z.boolean(),
  recommendedSkills: z.array(z.enum(supportedSkills)),
});

export const builderTaskResultSchema = z.object({
  abi: z.array(abiEntrySchema).optional(),
  warnings: z.array(z.string()).default([]),
  dangerousMethods: z.array(pageMethodSchema).default([]),
  methods: z.array(pageMethodSchema).default([]),
  sections: z.array(pageSectionSchema).default([]),
  pageConfig: pageConfigSchema,
  analysis: analysisSummarySchema.optional(),
});

export const builderTaskSchema = z.object({
  id: z.string(),
  status: z.enum(['queued', 'processing', 'completed', 'failed']),
  createdAt: z.string(),
  updatedAt: z.string(),
  input: builderTaskInputSchema,
  result: builderTaskResultSchema.optional(),
  error: z.string().optional(),
});

export type AbiParameter = z.infer<typeof abiParameterSchema>;
export type AbiEntry = z.infer<typeof abiEntrySchema>;
export type BuilderTaskInput = z.infer<typeof builderTaskInputSchema>;
export type PageMethod = z.infer<typeof pageMethodSchema>;
export type PageSection = z.infer<typeof pageSectionSchema>;
export type PageConfig = z.infer<typeof pageConfigSchema>;
export type BuilderTaskResult = z.infer<typeof builderTaskResultSchema>;
export type BuilderTask = z.infer<typeof builderTaskSchema>;
export type AnalysisSummary = z.infer<typeof analysisSummarySchema>;

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
  warnings: string[];
  methods: PageMethod[];
  dangerousMethods: PageMethod[];
}
