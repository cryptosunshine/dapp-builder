# Guided dApp Generation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the guided dApp generation MVP: multi-select skills, capability primitives, guided agent experience schema, validator fallback, and a product-like preview renderer.

**Architecture:** Keep deterministic ABI analysis as the source of truth, then derive capability primitives and a deterministic experience schema before asking the guided agent for a richer schema. Validate agent output against deterministic methods, warnings, skills, and renderer component support before returning it to the React previewer.

**Tech Stack:** TypeScript, Zod, Express, React, Vite, viem, Vitest, Testing Library.

---

## File Structure

- Modify `shared/schema.ts`: extend task input from single `skill` to multi `skills`, add `modelConfig`, skill registry types, capability primitive schemas, and experience schemas while preserving compatibility with existing stored tasks.
- Create `server/services/skills.ts`: skill definitions, normalization, category grouping, conflicts, and preview-support diagnostics.
- Create `server/services/capabilities.ts`: convert `AnalyzeContractResult` into ERC20/NFT/Voting/generic capability primitives.
- Create `server/services/experience.ts`: deterministic experience schema builder for fallback and common successful cases.
- Create `server/services/experience-validator.ts`: validate and repair guided agent output before rendering.
- Modify `server/services/analyzer.ts`: support new business skills and voting detection while keeping existing method classification.
- Modify `server/services/agent.ts`: orchestrate skills, capabilities, deterministic experience, guided agent output, validator, and optional model enhancement.
- Modify `server/services/hermes-agent.ts`: prompt the local agent for `experience` output instead of only legacy `pageConfig`.
- Modify `server/services/llm.ts`: read `modelConfig.baseUrl`, `modelConfig.apiKey`, and `modelConfig.model`; do not require root-level `apiKey`.
- Modify `server/services/task-store.ts`: sanitize `modelConfig.apiKey` and persist selected skills without secrets.
- Modify `src/components/BuilderForm.tsx`: replace single skill select with categorized multi-select skills and optional model configuration fields.
- Modify `src/components/PreviewPage.tsx`: render `experience` when present, with legacy `pageConfig.sections` fallback.
- Create `src/components/ExperienceRenderer.tsx`: render supported experience components.
- Create `src/components/ExperienceComponents.tsx`: focused components for hero, metric, lookup, action, flow, timeline, risk, explorer link, and unsupported states.
- Modify `src/lib/wallet.ts`: add EIP-6963 discovery helper while keeping injected-wallet fallback.
- Modify `src/lib/contract.ts`: support experience action method references and transaction timeline result metadata.
- Add or update tests in `tests/skill-registry.test.ts`, `tests/capabilities.test.ts`, `tests/experience-validator.test.ts`, `tests/agent.test.ts`, `tests/tasks-api.test.ts`, `tests/builder-form.test.tsx`, and `tests/frontend-preview.test.tsx`.

---

### Task 1: Shared Schema Upgrade

**Files:**
- Modify: `shared/schema.ts`
- Test: `tests/schema.test.ts`

- [ ] **Step 1: Write failing schema tests**

Create `tests/schema.test.ts`:

```ts
import { describe, expect, test } from 'vitest';
import {
  builderTaskInputSchema,
  experienceSchema,
  sanitizeTaskInput,
  supportedSkills,
} from '../shared/schema';

describe('guided generation shared schema', () => {
  test('accepts multi-select skills and modelConfig input', () => {
    const input = builderTaskInputSchema.parse({
      contractAddress: '0x1234567890123456789012345678901234567890',
      chain: 'conflux-espace-testnet',
      skills: ['token-dashboard', 'eip-6963-wallet-discovery', 'guided-flow'],
      modelConfig: {
        baseUrl: 'https://api.openai.com/v1',
        model: 'gpt-5.4',
        apiKey: 'secret-key',
      },
    });

    expect(input.skills).toEqual(['token-dashboard', 'eip-6963-wallet-discovery', 'guided-flow']);
    expect(input.modelConfig?.baseUrl).toBe('https://api.openai.com/v1');
  });

  test('keeps legacy single skill input compatible', () => {
    const input = builderTaskInputSchema.parse({
      contractAddress: '0x1234567890123456789012345678901234567890',
      chain: 'conflux-espace-testnet',
      skill: 'token-dashboard',
      model: 'gpt-5.4',
      apiKey: '',
    });

    expect(input.skills).toEqual(['token-dashboard']);
  });

  test('sanitizeTaskInput removes model api keys', () => {
    const stored = sanitizeTaskInput({
      contractAddress: '0x1234567890123456789012345678901234567890',
      chain: 'conflux-espace-testnet',
      skills: ['auto', 'explorer-links'],
      modelConfig: {
        baseUrl: 'https://example.test/v1',
        model: 'custom-model',
        apiKey: 'never-store-me',
      },
    });

    expect(stored).toEqual({
      contractAddress: '0x1234567890123456789012345678901234567890',
      chainId: 71,
      skills: ['auto', 'explorer-links'],
      modelConfig: {
        baseUrl: 'https://example.test/v1',
        model: 'custom-model',
      },
    });
  });

  test('experience schema accepts renderer-supported components', () => {
    const experience = experienceSchema.parse({
      id: 'exp-token',
      title: 'Token Console',
      summary: 'Manage token balances and approvals.',
      template: 'token-dashboard',
      confidence: 0.92,
      skills: ['token-dashboard', 'guided-flow'],
      components: [
        { id: 'hero', type: 'hero', title: 'Token Console', description: 'A product-like token app.' },
        { id: 'balance', type: 'metric', title: 'Your balance', methodName: 'balanceOf' },
        { id: 'send', type: 'action', title: 'Send tokens', methodName: 'transfer' },
        { id: 'risk', type: 'risk', title: 'Risk review', warnings: ['Dangerous methods detected.'] },
      ],
      warnings: ['Dangerous methods detected.'],
      unsupported: [],
    });

    expect(experience.components.map((component) => component.type)).toEqual(['hero', 'metric', 'action', 'risk']);
    expect(supportedSkills).toContain('eip-6963-wallet-discovery');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- --run tests/schema.test.ts`

Expected: FAIL because `experienceSchema`, multi-select `skills`, and `modelConfig` are not defined.

- [ ] **Step 3: Update shared schema**

Modify `shared/schema.ts` with these definitions and compatibility transforms:

```ts
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
] as const;

export const businessSkills = ['auto', 'token-dashboard', 'nft-mint-experience', 'voting-participation'] as const;
export const walletSkills = ['injected-wallet', 'eip-6963-wallet-discovery', 'chain-switching'] as const;
export const experienceSkills = ['guided-flow', 'transaction-timeline', 'risk-explainer', 'explorer-links'] as const;

export type SkillName = (typeof supportedSkills)[number];
export type BusinessSkillName = (typeof businessSkills)[number];
export type WalletSkillName = (typeof walletSkills)[number];
export type ExperienceSkillName = (typeof experienceSkills)[number];
export type ContractType = 'token' | 'nft' | 'voting' | 'unknown' | 'generic';

export const modelConfigSchema = z.object({
  baseUrl: z.string().url().default('https://api.openai.com/v1'),
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
    .map((skill) => legacySkillMap[String(skill)] ?? String(skill))
    .filter((skill): skill is SkillName => (supportedSkills as readonly string[]).includes(skill));
  return [...new Set(normalized.length > 0 ? normalized : ['auto'])];
}

export const builderTaskInputSchema = z.object({
  contractAddress: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
  chain: z.enum(supportedChains),
  skill: z.string().optional(),
  skills: z.array(z.enum(supportedSkills)).optional(),
  model: z.string().trim().min(1).optional(),
  apiKey: z.string().optional(),
  modelConfig: modelConfigSchema.optional(),
}).transform((input) => {
  const modelConfig = input.modelConfig ?? {
    baseUrl: 'https://api.openai.com/v1',
    model: input.model ?? 'gpt-5.4',
    apiKey: input.apiKey ?? '',
  };
  return {
    contractAddress: input.contractAddress,
    chain: input.chain,
    skills: normalizeSkillList(input.skills ?? input.skill),
    skill: normalizeSkillList(input.skills ?? input.skill)[0],
    model: modelConfig.model,
    apiKey: modelConfig.apiKey,
    modelConfig,
  };
});
```

Also add experience component schemas:

```ts
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
```

Extend `pageConfigSchema` and `builderTaskResultSchema`:

```ts
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
  dangerousMethods: z.array(pageMethodSchema).default([]),
  methods: z.array(pageMethodSchema).default([]),
  sections: z.array(pageSectionSchema).default([]),
  experience: experienceSchema.optional(),
});

export const builderTaskResultSchema = z.object({
  abi: z.array(abiEntrySchema).optional(),
  warnings: z.array(z.string()).default([]),
  dangerousMethods: z.array(pageMethodSchema).default([]),
  methods: z.array(pageMethodSchema).default([]),
  sections: z.array(pageSectionSchema).default([]),
  pageConfig: pageConfigSchema,
  experience: experienceSchema.optional(),
  analysis: analysisSummarySchema.optional(),
  summary: z.string().optional(),
  status: z.enum(['success', 'failed']).optional(),
  error: z.string().default(''),
});
```

Update `sanitizeTaskInput` to return `skills` and sanitized `modelConfig`:

```ts
export function sanitizeTaskInput(input: BuilderTaskInput | BuilderTaskRequest): StoredTaskInput {
  const request = toBuilderTaskRequest(input);
  return storedTaskInputSchema.parse({
    contractAddress: request.contractAddress,
    chainId: request.chainId,
    skills: request.skills,
    modelConfig: request.modelConfig
      ? { baseUrl: request.modelConfig.baseUrl, model: request.modelConfig.model }
      : undefined,
  });
}
```

- [ ] **Step 4: Run schema tests**

Run: `npm test -- --run tests/schema.test.ts`

Expected: PASS.

- [ ] **Step 5: Run impacted existing tests**

Run: `npm test -- --run tests/task-store.test.ts tests/tasks-api.test.ts tests/builder-form.test.tsx`

Expected: PASS after updating assertions in this step to expect `skills` plus backward-compatible `skill` in parsed and stored task inputs.

- [ ] **Step 6: Commit**

```bash
git add shared/schema.ts tests/schema.test.ts tests/task-store.test.ts tests/tasks-api.test.ts tests/builder-form.test.tsx
git commit -m "feat: add guided generation schemas"
```

---

### Task 2: Skill Registry and Normalization

**Files:**
- Create: `server/services/skills.ts`
- Test: `tests/skill-registry.test.ts`

- [ ] **Step 1: Write failing skill registry tests**

Create `tests/skill-registry.test.ts`:

```ts
import { describe, expect, test } from 'vitest';
import { getSkillDefinitions, normalizeSelectedSkills } from '../server/services/skills';

describe('skill registry', () => {
  test('groups supported skills by category', () => {
    const definitions = getSkillDefinitions();
    expect(definitions.find((skill) => skill.id === 'token-dashboard')?.category).toBe('business');
    expect(definitions.find((skill) => skill.id === 'eip-6963-wallet-discovery')?.category).toBe('wallet');
    expect(definitions.find((skill) => skill.id === 'transaction-timeline')?.category).toBe('experience');
  });

  test('normalizes empty skill input to auto and injected wallet', () => {
    const normalized = normalizeSelectedSkills([]);
    expect(normalized.skills).toEqual(['auto', 'injected-wallet']);
    expect(normalized.businessSkills).toEqual(['auto']);
    expect(normalized.walletSkills).toEqual(['injected-wallet']);
    expect(normalized.experienceSkills).toEqual([]);
    expect(normalized.diagnostics).toEqual([]);
  });

  test('dedupes selected skills and records unsupported preview skills', () => {
    const normalized = normalizeSelectedSkills([
      'token-dashboard',
      'token-dashboard',
      'eip-6963-wallet-discovery',
      'guided-flow',
    ]);

    expect(normalized.skills).toEqual(['token-dashboard', 'eip-6963-wallet-discovery', 'guided-flow']);
    expect(normalized.businessSkills).toEqual(['token-dashboard']);
    expect(normalized.walletSkills).toEqual(['eip-6963-wallet-discovery']);
    expect(normalized.experienceSkills).toEqual(['guided-flow']);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- --run tests/skill-registry.test.ts`

Expected: FAIL because `server/services/skills.ts` does not exist.

- [ ] **Step 3: Implement skill registry**

Create `server/services/skills.ts`:

```ts
import {
  businessSkills,
  experienceSkills,
  supportedSkills,
  walletSkills,
  type BusinessSkillName,
  type ExperienceSkillName,
  type SkillName,
  type WalletSkillName,
} from '../../shared/schema.js';

export interface SkillDefinition {
  id: SkillName;
  category: 'business' | 'wallet' | 'experience';
  label: string;
  description: string;
  requires: SkillName[];
  conflictsWith: SkillName[];
  supportedInPreview: boolean;
  agentInstructions: string;
  rendererCapabilities: string[];
}

export interface NormalizedSkills {
  skills: SkillName[];
  businessSkills: BusinessSkillName[];
  walletSkills: WalletSkillName[];
  experienceSkills: ExperienceSkillName[];
  diagnostics: string[];
}

const definitions: SkillDefinition[] = [
  {
    id: 'auto',
    category: 'business',
    label: 'Auto',
    description: 'Let the system choose the best product direction from detected capabilities.',
    requires: [],
    conflictsWith: [],
    supportedInPreview: true,
    agentInstructions: 'Choose the best product direction when confidence is high; otherwise use generic partial support.',
    rendererCapabilities: ['hero', 'unsupported', 'risk'],
  },
  {
    id: 'token-dashboard',
    category: 'business',
    label: 'Token dashboard',
    description: 'Generate a product-like ERC20 token management console.',
    requires: [],
    conflictsWith: [],
    supportedInPreview: true,
    agentInstructions: 'Emphasize balances, transfers, approvals, allowances, and token risk review.',
    rendererCapabilities: ['hero', 'metric', 'lookup', 'action', 'flow', 'timeline', 'risk', 'explorerLink'],
  },
  {
    id: 'nft-mint-experience',
    category: 'business',
    label: 'NFT mint experience',
    description: 'Generate a mint or collection interaction preview.',
    requires: [],
    conflictsWith: [],
    supportedInPreview: true,
    agentInstructions: 'Emphasize minting, collection supply, ownership lookup, token metadata, and mint risks.',
    rendererCapabilities: ['hero', 'metric', 'lookup', 'action', 'flow', 'timeline', 'risk', 'explorerLink'],
  },
  {
    id: 'voting-participation',
    category: 'business',
    label: 'Voting participation',
    description: 'Generate an on-chain voting participation preview.',
    requires: [],
    conflictsWith: [],
    supportedInPreview: true,
    agentInstructions: 'Emphasize proposal status, voter eligibility, cast vote actions, and governance lifecycle.',
    rendererCapabilities: ['hero', 'metric', 'lookup', 'action', 'flow', 'timeline', 'risk', 'explorerLink'],
  },
  {
    id: 'injected-wallet',
    category: 'wallet',
    label: 'Injected wallet',
    description: 'Use the browser injected EVM provider.',
    requires: [],
    conflictsWith: [],
    supportedInPreview: true,
    agentInstructions: 'Assume a standard injected EVM wallet is available.',
    rendererCapabilities: ['wallet'],
  },
  {
    id: 'eip-6963-wallet-discovery',
    category: 'wallet',
    label: 'EIP-6963 wallet discovery',
    description: 'Discover multiple injected wallets through EIP-6963 events.',
    requires: [],
    conflictsWith: [],
    supportedInPreview: true,
    agentInstructions: 'Show wallet choice as a first-class part of the connection experience.',
    rendererCapabilities: ['wallet'],
  },
  {
    id: 'chain-switching',
    category: 'wallet',
    label: 'Chain switching',
    description: 'Guide users to switch to Conflux eSpace Testnet.',
    requires: [],
    conflictsWith: [],
    supportedInPreview: true,
    agentInstructions: 'Explain network mismatch and provide chain-switch guidance.',
    rendererCapabilities: ['wallet', 'unsupported'],
  },
  {
    id: 'guided-flow',
    category: 'experience',
    label: 'Guided flow',
    description: 'Prefer step-by-step interactions instead of raw method cards.',
    requires: [],
    conflictsWith: [],
    supportedInPreview: true,
    agentInstructions: 'Compose lookups and actions into a clear sequence with preflight copy.',
    rendererCapabilities: ['flow'],
  },
  {
    id: 'transaction-timeline',
    category: 'experience',
    label: 'Transaction timeline',
    description: 'Show pending, success, and failure states as a timeline.',
    requires: [],
    conflictsWith: [],
    supportedInPreview: true,
    agentInstructions: 'Include a transaction timeline near write actions.',
    rendererCapabilities: ['timeline'],
  },
  {
    id: 'risk-explainer',
    category: 'experience',
    label: 'Risk explainer',
    description: 'Explain warnings and dangerous methods in user-friendly language.',
    requires: [],
    conflictsWith: [],
    supportedInPreview: true,
    agentInstructions: 'Surface warnings clearly and avoid minimizing admin risks.',
    rendererCapabilities: ['risk'],
  },
  {
    id: 'explorer-links',
    category: 'experience',
    label: 'Explorer links',
    description: 'Link to contract and transaction pages on the explorer.',
    requires: [],
    conflictsWith: [],
    supportedInPreview: true,
    agentInstructions: 'Add explorer links for contract and transaction review.',
    rendererCapabilities: ['explorerLink'],
  },
];

const definitionById = new Map(definitions.map((definition) => [definition.id, definition]));

export function getSkillDefinitions() {
  return definitions;
}

function isBusinessSkill(skill: SkillName): skill is BusinessSkillName {
  return (businessSkills as readonly string[]).includes(skill);
}

function isWalletSkill(skill: SkillName): skill is WalletSkillName {
  return (walletSkills as readonly string[]).includes(skill);
}

function isExperienceSkill(skill: SkillName): skill is ExperienceSkillName {
  return (experienceSkills as readonly string[]).includes(skill);
}

export function normalizeSelectedSkills(input: SkillName[]): NormalizedSkills {
  const diagnostics: string[] = [];
  const valid = input.filter((skill): skill is SkillName => (supportedSkills as readonly string[]).includes(skill));
  const skills = [...new Set(valid.length > 0 ? valid : ['auto'])];

  if (!skills.some(isBusinessSkill)) {
    skills.unshift('auto');
  }
  if (!skills.some(isWalletSkill)) {
    skills.push('injected-wallet');
  }

  for (const skill of skills) {
    const definition = definitionById.get(skill);
    if (!definition?.supportedInPreview) {
      diagnostics.push(`${skill} is not supported in the preview renderer.`);
    }
    for (const conflict of definition?.conflictsWith ?? []) {
      if (skills.includes(conflict)) {
        diagnostics.push(`${skill} conflicts with ${conflict}.`);
      }
    }
  }

  return {
    skills,
    businessSkills: skills.filter(isBusinessSkill),
    walletSkills: skills.filter(isWalletSkill),
    experienceSkills: skills.filter(isExperienceSkill),
    diagnostics,
  };
}
```

- [ ] **Step 4: Run registry tests**

Run: `npm test -- --run tests/skill-registry.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add server/services/skills.ts tests/skill-registry.test.ts
git commit -m "feat: add skill registry"
```

---

### Task 3: Capability Primitives

**Files:**
- Create: `server/services/capabilities.ts`
- Modify: `server/services/analyzer.ts`
- Test: `tests/capabilities.test.ts`, `tests/analyzer.test.ts`

- [ ] **Step 1: Write failing capability tests**

Create `tests/capabilities.test.ts`:

```ts
import { describe, expect, test } from 'vitest';
import { analyzeContract } from '../server/services/analyzer';
import { buildCapabilityPrimitives } from '../server/services/capabilities';
import type { AbiEntry } from '../shared/schema';

const erc20Abi: AbiEntry[] = [
  { type: 'function', name: 'name', stateMutability: 'view', inputs: [], outputs: [{ name: '', type: 'string' }] },
  { type: 'function', name: 'symbol', stateMutability: 'view', inputs: [], outputs: [{ name: '', type: 'string' }] },
  { type: 'function', name: 'decimals', stateMutability: 'view', inputs: [], outputs: [{ name: '', type: 'uint8' }] },
  { type: 'function', name: 'totalSupply', stateMutability: 'view', inputs: [], outputs: [{ name: '', type: 'uint256' }] },
  { type: 'function', name: 'balanceOf', stateMutability: 'view', inputs: [{ name: 'account', type: 'address' }], outputs: [{ name: '', type: 'uint256' }] },
  { type: 'function', name: 'transfer', stateMutability: 'nonpayable', inputs: [{ name: 'to', type: 'address' }, { name: 'amount', type: 'uint256' }], outputs: [{ name: '', type: 'bool' }] },
  { type: 'function', name: 'allowance', stateMutability: 'view', inputs: [{ name: 'owner', type: 'address' }, { name: 'spender', type: 'address' }], outputs: [{ name: '', type: 'uint256' }] },
  { type: 'function', name: 'approve', stateMutability: 'nonpayable', inputs: [{ name: 'spender', type: 'address' }, { name: 'amount', type: 'uint256' }], outputs: [{ name: '', type: 'bool' }] },
  { type: 'function', name: 'pause', stateMutability: 'nonpayable', inputs: [], outputs: [] },
];

const votingAbi: AbiEntry[] = [
  { type: 'function', name: 'proposals', stateMutability: 'view', inputs: [{ name: 'proposalId', type: 'uint256' }], outputs: [{ name: 'votesFor', type: 'uint256' }] },
  { type: 'function', name: 'hasVoted', stateMutability: 'view', inputs: [{ name: 'proposalId', type: 'uint256' }, { name: 'voter', type: 'address' }], outputs: [{ name: '', type: 'bool' }] },
  { type: 'function', name: 'castVote', stateMutability: 'nonpayable', inputs: [{ name: 'proposalId', type: 'uint256' }, { name: 'support', type: 'uint8' }], outputs: [{ name: '', type: 'uint256' }] },
];

describe('buildCapabilityPrimitives', () => {
  test('builds ERC20 product primitives from standard methods', () => {
    const analysis = analyzeContract({
      abi: erc20Abi,
      contractAddress: '0x1234567890123456789012345678901234567890',
      contractName: 'Mock Token',
      chain: 'conflux-espace-testnet',
      requestedSkill: 'token-dashboard',
    });

    const capabilities = buildCapabilityPrimitives(analysis, ['token-dashboard', 'guided-flow']);

    expect(capabilities.kind).toBe('token');
    expect(capabilities.confidence).toBeGreaterThan(0.7);
    expect(capabilities.primitives.map((primitive) => primitive.id)).toEqual(
      expect.arrayContaining(['tokenIdentity', 'walletBalance', 'addressBalanceLookup', 'transferAction', 'allowanceLookup', 'approvalAction', 'adminRiskPanel']),
    );
  });

  test('builds voting primitives from on-chain voting methods', () => {
    const analysis = analyzeContract({
      abi: votingAbi,
      contractAddress: '0x1234567890123456789012345678901234567890',
      contractName: 'Mock Voting',
      chain: 'conflux-espace-testnet',
      requestedSkill: 'voting-participation',
    });

    const capabilities = buildCapabilityPrimitives(analysis, ['voting-participation']);

    expect(capabilities.kind).toBe('voting');
    expect(capabilities.primitives.map((primitive) => primitive.id)).toEqual(
      expect.arrayContaining(['proposalLookup', 'voterStatus', 'voteAction']),
    );
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- --run tests/capabilities.test.ts`

Expected: FAIL because `buildCapabilityPrimitives` does not exist and analyzer does not recognize `voting-participation`.

- [ ] **Step 3: Update analyzer skill hints**

Modify `server/services/analyzer.ts`:

```ts
const TOKEN_HINTS = ['balanceof', 'transfer', 'approve', 'totalsupply', 'allowance', 'symbol', 'decimals'];
const NFT_HINTS = ['ownerof', 'tokenuri', 'safetransferfrom', 'setapprovalforall', 'mint', 'safemint'];
const VOTING_HINTS = ['vote', 'castvote', 'hasvoted', 'proposal', 'proposals', 'quorum', 'delegate', 'getvotes', 'state'];

const skillToContractType: Partial<Record<SkillName, AnalyzeContractResult['contractType']>> = {
  'token-dashboard': 'token',
  'nft-mint-experience': 'nft',
  'voting-participation': 'voting',
};
```

Replace recommendation scoring with token, NFT, and voting scores:

```ts
function detectRecommendedSkills(functionNames: string[]) {
  const tokenScore = scoreCapability(functionNames, TOKEN_HINTS);
  const nftScore = scoreCapability(functionNames, NFT_HINTS);
  const votingScore = scoreCapability(functionNames, VOTING_HINTS);

  const recommendations: SkillName[] = [];
  if (tokenScore >= 3) recommendations.push('token-dashboard');
  if (nftScore >= 2) recommendations.push('nft-mint-experience');
  if (votingScore >= 2) recommendations.push('voting-participation');

  return { recommendations, scores: { token: tokenScore, nft: nftScore, voting: votingScore } };
}
```

- [ ] **Step 4: Implement capability primitives**

Create `server/services/capabilities.ts`:

```ts
import type { AnalyzeContractResult, PageMethod, SkillName } from '../../shared/schema.js';

export interface CapabilityPrimitive {
  id: string;
  label: string;
  description: string;
  methodNames: string[];
  required: boolean;
}

export interface CapabilitySet {
  kind: 'token' | 'nft' | 'voting' | 'generic';
  confidence: number;
  primitives: CapabilityPrimitive[];
  unsupported: string[];
  warnings: string[];
}

function findMethod(methods: PageMethod[], names: string[]) {
  const lowered = new Set(names.map((name) => name.toLowerCase()));
  return methods.find((method) => lowered.has(method.name.toLowerCase()));
}

function hasMethod(methods: PageMethod[], names: string[]) {
  return Boolean(findMethod(methods, names));
}

function primitive(id: string, label: string, description: string, methodNames: string[], required = false): CapabilityPrimitive {
  return { id, label, description, methodNames, required };
}

export function buildCapabilityPrimitives(analysis: AnalyzeContractResult, selectedSkills: SkillName[]): CapabilitySet {
  const methods = analysis.methods;
  const dangerousMethods = analysis.dangerousMethods;
  const primitives: CapabilityPrimitive[] = [];
  const unsupported: string[] = [];

  const tokenSignals = [
    hasMethod(methods, ['name', 'symbol', 'decimals']),
    hasMethod(methods, ['totalSupply']),
    hasMethod(methods, ['balanceOf']),
    hasMethod(methods, ['transfer']),
    hasMethod(methods, ['allowance', 'approve']),
  ].filter(Boolean).length;

  const nftSignals = [
    hasMethod(methods, ['name', 'symbol']),
    hasMethod(methods, ['ownerOf', 'balanceOf']),
    hasMethod(methods, ['tokenURI']),
    hasMethod(methods, ['mint', 'safeMint']),
    hasMethod(methods, ['totalSupply', 'maxSupply']),
  ].filter(Boolean).length;

  const votingSignals = [
    hasMethod(methods, ['proposal', 'proposals', 'state']),
    hasMethod(methods, ['vote', 'castVote']),
    hasMethod(methods, ['hasVoted', 'getReceipt', 'getVotes']),
    hasMethod(methods, ['execute', 'queue', 'cancel']),
  ].filter(Boolean).length;

  const requestedToken = selectedSkills.includes('token-dashboard');
  const requestedNft = selectedSkills.includes('nft-mint-experience');
  const requestedVoting = selectedSkills.includes('voting-participation');

  const kind =
    requestedToken && tokenSignals >= 3 ? 'token'
      : requestedNft && nftSignals >= 2 ? 'nft'
        : requestedVoting && votingSignals >= 2 ? 'voting'
          : tokenSignals >= Math.max(nftSignals, votingSignals) && tokenSignals >= 3 ? 'token'
            : nftSignals >= Math.max(tokenSignals, votingSignals) && nftSignals >= 2 ? 'nft'
              : votingSignals >= 2 ? 'voting'
                : 'generic';

  if (kind === 'token') {
    if (hasMethod(methods, ['name', 'symbol', 'decimals', 'totalSupply'])) primitives.push(primitive('tokenIdentity', 'Token identity', 'Token metadata and supply details.', ['name', 'symbol', 'decimals', 'totalSupply']));
    if (hasMethod(methods, ['balanceOf'])) primitives.push(primitive('walletBalance', 'Wallet balance', 'Connected wallet token balance.', ['balanceOf'], true));
    if (hasMethod(methods, ['balanceOf'])) primitives.push(primitive('addressBalanceLookup', 'Address balance lookup', 'Check any address token balance.', ['balanceOf']));
    if (hasMethod(methods, ['transfer'])) primitives.push(primitive('transferAction', 'Transfer tokens', 'Send tokens to a recipient.', ['transfer']));
    if (hasMethod(methods, ['allowance'])) primitives.push(primitive('allowanceLookup', 'Allowance lookup', 'Check owner and spender allowance.', ['allowance']));
    if (hasMethod(methods, ['approve'])) primitives.push(primitive('approvalAction', 'Approve spending', 'Approve a spender amount.', ['approve']));
  }

  if (kind === 'nft') {
    if (hasMethod(methods, ['name', 'symbol'])) primitives.push(primitive('collectionIdentity', 'Collection identity', 'Collection metadata.', ['name', 'symbol']));
    if (hasMethod(methods, ['mint', 'safeMint'])) primitives.push(primitive('mintAction', 'Mint NFT', 'Mint from the collection.', ['mint', 'safeMint'], true));
    if (methods.some((method) => ['mint', 'safemint'].includes(method.name.toLowerCase()) && method.stateMutability === 'payable')) primitives.push(primitive('payableMintAction', 'Payable mint', 'Mint requiring native currency.', ['mint', 'safeMint']));
    if (hasMethod(methods, ['totalSupply', 'maxSupply'])) primitives.push(primitive('supplyMetrics', 'Supply metrics', 'Collection supply details.', ['totalSupply', 'maxSupply']));
    if (hasMethod(methods, ['ownerOf', 'balanceOf'])) primitives.push(primitive('ownershipLookup', 'Ownership lookup', 'Check ownership or holder balance.', ['ownerOf', 'balanceOf']));
    if (hasMethod(methods, ['tokenURI'])) primitives.push(primitive('tokenMetadataLookup', 'Token metadata lookup', 'Read token metadata URI.', ['tokenURI']));
  }

  if (kind === 'voting') {
    if (hasMethod(methods, ['proposal', 'proposals', 'state'])) primitives.push(primitive('proposalLookup', 'Proposal lookup', 'Inspect proposal status and details.', ['proposal', 'proposals', 'state']));
    if (hasMethod(methods, ['vote', 'castVote'])) primitives.push(primitive('voteAction', 'Cast vote', 'Submit an on-chain vote.', ['vote', 'castVote'], true));
    if (hasMethod(methods, ['hasVoted', 'getReceipt', 'getVotes'])) primitives.push(primitive('voterStatus', 'Voter status', 'Check voting power or whether an account voted.', ['hasVoted', 'getReceipt', 'getVotes']));
    if (hasMethod(methods, ['execute', 'queue', 'cancel'])) primitives.push(primitive('proposalLifecycle', 'Proposal lifecycle', 'Governance lifecycle actions.', ['execute', 'queue', 'cancel']));
  }

  if (dangerousMethods.length > 0) {
    primitives.push(primitive('adminRiskPanel', 'Admin risk panel', 'Administrative or risky methods detected.', dangerousMethods.map((method) => method.name)));
  }

  if (kind === 'generic') {
    unsupported.push('No supported product direction reached the minimum capability confidence.');
  }

  const signalCount = kind === 'token' ? tokenSignals : kind === 'nft' ? nftSignals : kind === 'voting' ? votingSignals : 0;
  const confidence = Math.min(1, signalCount / (kind === 'token' ? 5 : 4));

  return { kind, confidence, primitives, unsupported, warnings: analysis.warnings };
}
```

- [ ] **Step 5: Run capability and analyzer tests**

Run: `npm test -- --run tests/capabilities.test.ts tests/analyzer.test.ts`

Expected: PASS after updating old tests that expect `claim-page` or `staking-page` recommendations to use `auto` or generic fallback.

- [ ] **Step 6: Commit**

```bash
git add server/services/analyzer.ts server/services/capabilities.ts tests/capabilities.test.ts tests/analyzer.test.ts
git commit -m "feat: derive contract capability primitives"
```

---

### Task 4: Deterministic Experience Builder

**Files:**
- Create: `server/services/experience.ts`
- Modify: `server/services/page-config.ts`
- Test: `tests/experience.test.ts`, `tests/page-config.test.ts`

- [ ] **Step 1: Write failing experience builder tests**

Create `tests/experience.test.ts`:

```ts
import { describe, expect, test } from 'vitest';
import { analyzeContract } from '../server/services/analyzer';
import { buildCapabilityPrimitives } from '../server/services/capabilities';
import { buildDeterministicExperience } from '../server/services/experience';
import type { AbiEntry } from '../shared/schema';

const erc20Abi: AbiEntry[] = [
  { type: 'function', name: 'symbol', stateMutability: 'view', inputs: [], outputs: [{ name: '', type: 'string' }] },
  { type: 'function', name: 'decimals', stateMutability: 'view', inputs: [], outputs: [{ name: '', type: 'uint8' }] },
  { type: 'function', name: 'totalSupply', stateMutability: 'view', inputs: [], outputs: [{ name: '', type: 'uint256' }] },
  { type: 'function', name: 'balanceOf', stateMutability: 'view', inputs: [{ name: 'account', type: 'address' }], outputs: [{ name: '', type: 'uint256' }] },
  { type: 'function', name: 'transfer', stateMutability: 'nonpayable', inputs: [{ name: 'to', type: 'address' }, { name: 'amount', type: 'uint256' }], outputs: [{ name: '', type: 'bool' }] },
  { type: 'function', name: 'approve', stateMutability: 'nonpayable', inputs: [{ name: 'spender', type: 'address' }, { name: 'amount', type: 'uint256' }], outputs: [{ name: '', type: 'bool' }] },
  { type: 'function', name: 'allowance', stateMutability: 'view', inputs: [{ name: 'owner', type: 'address' }, { name: 'spender', type: 'address' }], outputs: [{ name: '', type: 'uint256' }] },
];

describe('buildDeterministicExperience', () => {
  test('builds token product components from token primitives and selected skills', () => {
    const analysis = analyzeContract({
      abi: erc20Abi,
      contractAddress: '0x1234567890123456789012345678901234567890',
      contractName: 'Mock Token',
      chain: 'conflux-espace-testnet',
      requestedSkill: 'token-dashboard',
    });
    const capabilities = buildCapabilityPrimitives(analysis, ['token-dashboard', 'guided-flow', 'transaction-timeline', 'explorer-links']);

    const experience = buildDeterministicExperience({
      analysis,
      capabilities,
      skills: ['token-dashboard', 'guided-flow', 'transaction-timeline', 'explorer-links'],
    });

    expect(experience.template).toBe('token-dashboard');
    expect(experience.components.map((component) => component.type)).toEqual(
      expect.arrayContaining(['hero', 'wallet', 'metric', 'lookup', 'action', 'flow', 'timeline', 'risk', 'explorerLink']),
    );
    expect(experience.components.find((component) => component.id === 'transfer-action')?.methodName).toBe('transfer');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- --run tests/experience.test.ts`

Expected: FAIL because `buildDeterministicExperience` does not exist.

- [ ] **Step 3: Implement deterministic experience builder**

Create `server/services/experience.ts`:

```ts
import type { AnalyzeContractResult, Experience, ExperienceComponent, SkillName } from '../../shared/schema.js';
import type { CapabilitySet } from './capabilities.js';

interface BuildExperienceInput {
  analysis: AnalyzeContractResult;
  capabilities: CapabilitySet;
  skills: SkillName[];
}

function hasPrimitive(capabilities: CapabilitySet, id: string) {
  return capabilities.primitives.find((primitive) => primitive.id === id);
}

function component(input: ExperienceComponent): ExperienceComponent {
  return input;
}

export function buildDeterministicExperience({ analysis, capabilities, skills }: BuildExperienceInput): Experience {
  const components: ExperienceComponent[] = [
    component({
      id: 'hero',
      type: 'hero',
      title: capabilities.kind === 'generic' ? `${analysis.contractName} Contract Preview` : `${analysis.contractName} ${capabilities.kind === 'token' ? 'Token Console' : capabilities.kind === 'nft' ? 'Mint Experience' : 'Voting App'}`,
      description: `Generated product preview for ${analysis.contractName || analysis.contractAddress}.`,
      methodNames: [],
      warnings: [],
      children: [],
    }),
    component({
      id: 'wallet',
      type: 'wallet',
      title: 'Wallet connection',
      description: skills.includes('eip-6963-wallet-discovery') ? 'Choose from available injected wallets and connect to Conflux eSpace Testnet.' : 'Connect an injected EVM wallet on Conflux eSpace Testnet.',
      methodNames: [],
      warnings: [],
      children: [],
    }),
  ];

  if (hasPrimitive(capabilities, 'tokenIdentity') || hasPrimitive(capabilities, 'supplyMetrics') || hasPrimitive(capabilities, 'proposalLookup')) {
    components.push(component({
      id: 'primary-metrics',
      type: 'metric',
      title: capabilities.kind === 'voting' ? 'Proposal status' : 'Contract metrics',
      description: 'Read key contract state directly from the ABI-backed methods.',
      methodNames: (hasPrimitive(capabilities, 'tokenIdentity') ?? hasPrimitive(capabilities, 'supplyMetrics') ?? hasPrimitive(capabilities, 'proposalLookup'))?.methodNames ?? [],
      warnings: [],
      children: [],
    }));
  }

  if (hasPrimitive(capabilities, 'walletBalance')) {
    components.push(component({ id: 'wallet-balance', type: 'metric', title: 'Your balance', description: 'Read the connected wallet balance.', methodName: 'balanceOf', methodNames: ['balanceOf'], warnings: [], children: [] }));
  }
  if (hasPrimitive(capabilities, 'addressBalanceLookup')) {
    components.push(component({ id: 'address-balance-lookup', type: 'lookup', title: 'Check an address balance', description: 'Enter an address and read its token balance.', methodName: 'balanceOf', methodNames: ['balanceOf'], warnings: [], children: [] }));
  }
  if (hasPrimitive(capabilities, 'transferAction')) {
    components.push(component({ id: 'transfer-action', type: 'action', title: 'Send tokens', description: 'Transfer tokens to another address.', methodName: 'transfer', methodNames: ['transfer'], warnings: [], children: [] }));
  }
  if (hasPrimitive(capabilities, 'approvalAction')) {
    components.push(component({ id: 'approval-action', type: 'action', title: 'Approve spending', description: 'Approve a spender and amount.', methodName: 'approve', methodNames: ['approve'], warnings: [], children: [] }));
  }
  if (hasPrimitive(capabilities, 'mintAction')) {
    components.push(component({ id: 'mint-action', type: 'action', title: 'Mint NFT', description: 'Mint from this collection.', methodNames: hasPrimitive(capabilities, 'mintAction')?.methodNames ?? [], warnings: [], children: [] }));
  }
  if (hasPrimitive(capabilities, 'voteAction')) {
    components.push(component({ id: 'vote-action', type: 'action', title: 'Cast vote', description: 'Submit your vote on-chain.', methodNames: hasPrimitive(capabilities, 'voteAction')?.methodNames ?? [], warnings: [], children: [] }));
  }
  if (skills.includes('guided-flow')) {
    const actionIds = components.filter((entry) => entry.type === 'action').map((entry) => entry.id);
    if (actionIds.length > 0) {
      components.push(component({ id: 'guided-flow', type: 'flow', title: 'Guided interaction', description: 'Review inputs, connect wallet, submit transaction, and inspect the result.', methodNames: [], warnings: [], children: actionIds }));
    }
  }
  if (skills.includes('transaction-timeline')) {
    components.push(component({ id: 'transaction-timeline', type: 'timeline', title: 'Transaction timeline', description: 'Track wallet requests and confirmations in this session.', methodNames: [], warnings: [], children: [] }));
  }
  if (analysis.warnings.length > 0 || analysis.dangerousMethods.length > 0 || skills.includes('risk-explainer')) {
    components.push(component({ id: 'risk-review', type: 'risk', title: 'Risk review', description: 'Review warnings and administrative methods before interacting.', methodNames: analysis.dangerousMethods.map((method) => method.name), warnings: analysis.warnings, children: [] }));
  }
  if (skills.includes('explorer-links')) {
    components.push(component({ id: 'contract-explorer', type: 'explorerLink', title: 'View on explorer', description: 'Open the contract on ConfluxScan.', href: `https://evmtestnet.confluxscan.org/address/${analysis.contractAddress}`, methodNames: [], warnings: [], children: [] }));
  }
  for (const reason of capabilities.unsupported) {
    components.push(component({ id: `unsupported-${components.length}`, type: 'unsupported', title: 'Partial support', description: reason, methodNames: [], warnings: [], children: [] }));
  }

  return {
    id: `experience-${analysis.contractAddress.toLowerCase()}`,
    title: components[0].title,
    summary: components[0].description,
    template: capabilities.kind === 'generic' ? 'generic' : capabilities.kind === 'token' ? 'token-dashboard' : capabilities.kind === 'nft' ? 'nft-mint-experience' : 'voting-participation',
    confidence: capabilities.confidence,
    skills,
    components,
    warnings: analysis.warnings,
    unsupported: capabilities.unsupported,
  };
}
```

- [ ] **Step 4: Attach experience to pageConfig**

Modify `server/services/page-config.ts` so callers can pass an optional `experience`:

```ts
export function buildPageConfig(analysis: AnalyzeContractResult, experience?: Experience): PageConfig {
  // existing code
  return {
    // existing fields
    skills: [skill],
    experience,
  };
}
```

- [ ] **Step 5: Run tests**

Run: `npm test -- --run tests/experience.test.ts tests/page-config.test.ts`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add server/services/experience.ts server/services/page-config.ts tests/experience.test.ts tests/page-config.test.ts
git commit -m "feat: build deterministic dapp experience"
```

---

### Task 5: Experience Validator

**Files:**
- Create: `server/services/experience-validator.ts`
- Test: `tests/experience-validator.test.ts`

- [ ] **Step 1: Write failing validator tests**

Create `tests/experience-validator.test.ts`:

```ts
import { describe, expect, test } from 'vitest';
import { validateExperience } from '../server/services/experience-validator';
import type { Experience, PageMethod } from '../shared/schema';

const transfer: PageMethod = {
  name: 'transfer',
  label: 'Transfer',
  type: 'write',
  dangerLevel: 'warn',
  stateMutability: 'nonpayable',
  inputs: [{ name: 'to', type: 'address' }, { name: 'amount', type: 'uint256' }],
  outputs: [{ name: '', type: 'bool' }],
  description: 'Send tokens.',
};

const pause: PageMethod = {
  name: 'pause',
  label: 'Pause',
  type: 'write',
  dangerLevel: 'danger',
  stateMutability: 'nonpayable',
  inputs: [],
  outputs: [],
  description: 'Pause the contract.',
};

const deterministic: Experience = {
  id: 'fallback',
  title: 'Fallback',
  summary: 'Fallback experience',
  template: 'token-dashboard',
  confidence: 0.9,
  skills: ['token-dashboard'],
  components: [
    { id: 'hero', type: 'hero', title: 'Fallback', description: '', methodNames: [], warnings: [], children: [] },
    { id: 'risk', type: 'risk', title: 'Risk review', description: '', methodNames: ['pause'], warnings: ['Dangerous methods detected.'], children: [] },
  ],
  warnings: ['Dangerous methods detected.'],
  unsupported: [],
};

describe('validateExperience', () => {
  test('removes invented method references and preserves deterministic warnings', () => {
    const incoming: Experience = {
      id: 'agent',
      title: 'Agent Token App',
      summary: 'Agent generated',
      template: 'token-dashboard',
      confidence: 0.95,
      skills: ['token-dashboard'],
      components: [
        { id: 'send', type: 'action', title: 'Send', description: '', methodName: 'transferFromNowhere', methodNames: ['transferFromNowhere'], warnings: [], children: [] },
        { id: 'risk', type: 'risk', title: 'Risks', description: '', methodNames: [], warnings: [], children: [] },
      ],
      warnings: [],
      unsupported: [],
    };

    const validated = validateExperience({
      incoming,
      fallback: deterministic,
      methods: [transfer],
      dangerousMethods: [pause],
      deterministicWarnings: ['Dangerous methods detected.'],
    });

    expect(validated.experience.warnings).toContain('Dangerous methods detected.');
    expect(validated.experience.components.find((component) => component.id === 'send')).toBeUndefined();
    expect(validated.experience.components.find((component) => component.type === 'risk')?.methodNames).toContain('pause');
    expect(validated.diagnostics).toEqual(expect.arrayContaining([expect.stringMatching(/unknown method/i)]));
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- --run tests/experience-validator.test.ts`

Expected: FAIL because validator does not exist.

- [ ] **Step 3: Implement validator**

Create `server/services/experience-validator.ts`:

```ts
import { experienceComponentTypeSchema, experienceSchema, type Experience, type ExperienceComponent, type PageMethod } from '../../shared/schema.js';

interface ValidateExperienceInput {
  incoming: unknown;
  fallback: Experience;
  methods: PageMethod[];
  dangerousMethods: PageMethod[];
  deterministicWarnings: string[];
}

interface ValidateExperienceResult {
  experience: Experience;
  diagnostics: string[];
}

function methodNamesFor(component: ExperienceComponent) {
  return [...new Set([...(component.methodName ? [component.methodName] : []), ...component.methodNames])];
}

export function validateExperience({ incoming, fallback, methods, dangerousMethods, deterministicWarnings }: ValidateExperienceInput): ValidateExperienceResult {
  const diagnostics: string[] = [];
  const parsed = experienceSchema.safeParse(incoming);
  if (!parsed.success) {
    return { experience: fallback, diagnostics: ['Agent experience failed schema validation.'] };
  }

  const allMethods = new Map([...methods, ...dangerousMethods].map((method) => [method.name, method]));
  const dangerousNames = new Set(dangerousMethods.map((method) => method.name));

  const components = parsed.data.components.flatMap((component): ExperienceComponent[] => {
    const type = experienceComponentTypeSchema.safeParse(component.type);
    if (!type.success) {
      diagnostics.push(`Unsupported component type: ${component.type}`);
      return [];
    }

    const referenced = methodNamesFor(component);
    const unknown = referenced.filter((methodName) => !allMethods.has(methodName));
    if (unknown.length > 0) {
      diagnostics.push(`Component ${component.id} referenced unknown method(s): ${unknown.join(', ')}`);
      return [];
    }

    if ((component.type === 'metric' || component.type === 'lookup') && referenced.some((methodName) => allMethods.get(methodName)?.type !== 'read')) {
      diagnostics.push(`Component ${component.id} used a write method in a read component.`);
      return [];
    }

    if (component.type === 'action' && referenced.some((methodName) => allMethods.get(methodName)?.dangerLevel === 'danger')) {
      diagnostics.push(`Component ${component.id} tried to expose a dangerous method as a normal action.`);
      return [];
    }

    return [{
      ...component,
      methodName: referenced[0] ?? component.methodName,
      methodNames: referenced,
    }];
  });

  const hasRisk = components.some((component) => component.type === 'risk');
  if (!hasRisk && (dangerousMethods.length > 0 || deterministicWarnings.length > 0)) {
    components.push({
      id: 'risk-review',
      type: 'risk',
      title: 'Risk review',
      description: 'Review warnings and administrative methods before interacting.',
      methodNames: [...dangerousNames],
      warnings: deterministicWarnings,
      children: [],
    });
  }

  const repairedComponents = components.map((component) => {
    if (component.type !== 'risk') return component;
    return {
      ...component,
      methodNames: [...new Set([...component.methodNames, ...dangerousNames])],
      warnings: [...new Set([...component.warnings, ...deterministicWarnings])],
    };
  });

  const experience = experienceSchema.parse({
    ...parsed.data,
    components: repairedComponents.length > 0 ? repairedComponents : fallback.components,
    warnings: [...new Set([...parsed.data.warnings, ...deterministicWarnings])],
  });

  return { experience, diagnostics };
}
```

- [ ] **Step 4: Run validator tests**

Run: `npm test -- --run tests/experience-validator.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add server/services/experience-validator.ts tests/experience-validator.test.ts
git commit -m "feat: validate guided agent experience"
```

---

### Task 6: Guided Agent Orchestration

**Files:**
- Modify: `server/services/agent.ts`
- Modify: `server/services/hermes-agent.ts`
- Modify: `server/services/llm.ts`
- Test: `tests/agent.test.ts`, `tests/hermes-agent.test.ts`, `tests/llm.test.ts`

- [ ] **Step 1: Write failing orchestration test**

Update `tests/agent.test.ts` with:

```ts
test('builds capabilities, validates guided experience, and returns experience on pageConfig', async () => {
  mockedFetchContractMetadata.mockResolvedValue({ abi: tokenAbi, contractName: 'MockToken', metadata: undefined });
  mockedRunHermesAgentGeneration.mockImplementation(async ({ deterministicExperience }): Promise<AgentRunResult> => ({
    summary: 'Guided token app generated.',
    contractAnalysis: {
      contractType: 'token',
      recommendedSkill: 'token-dashboard',
      readMethods: [],
      writeMethods: [],
      dangerousMethods: [],
      warnings: deterministicExperience.warnings,
    },
    pageConfig: {
      ...deterministicPageConfigForTest,
      experience: {
        ...deterministicExperience,
        title: 'Agent Designed Token Console',
      },
    },
    experience: {
      ...deterministicExperience,
      title: 'Agent Designed Token Console',
    },
    status: 'success',
    error: '',
  }));

  const result = await runBuilderAgent({
    contractAddress: '0x1234567890123456789012345678901234567890',
    chain: 'conflux-espace-testnet',
    skills: ['token-dashboard', 'guided-flow', 'transaction-timeline'],
    skill: 'token-dashboard',
    model: 'gpt-5.4',
    apiKey: '',
    modelConfig: {
      baseUrl: 'https://api.openai.com/v1',
      model: 'gpt-5.4',
      apiKey: '',
    },
  });

  expect(result.experience?.title).toBe('Agent Designed Token Console');
  expect(result.pageConfig.experience?.components.map((component) => component.type)).toContain('flow');
});
```

Construct the generated page config from the actual `deterministicPageConfig` argument inside the mock:

```ts
mockedRunHermesAgentGeneration.mockImplementation(async ({ deterministicPageConfig, deterministicExperience }) => ({
  summary: 'Guided token app generated.',
  contractAnalysis: { contractType: 'token', recommendedSkill: 'token-dashboard', warnings: [] },
  pageConfig: { ...deterministicPageConfig, experience: { ...deterministicExperience, title: 'Agent Designed Token Console' } },
  experience: { ...deterministicExperience, title: 'Agent Designed Token Console' },
  status: 'success',
  error: '',
}));
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- --run tests/agent.test.ts`

Expected: FAIL because `runBuilderAgent` does not build capabilities or pass `deterministicExperience`.

- [ ] **Step 3: Update Hermes result schema and prompt**

Modify `shared/schema.ts` `agentRunResultSchema`:

```ts
export const agentRunResultSchema = z.object({
  summary: z.string(),
  contractAnalysis: analysisSummarySchema.extend({
    contractType: z.enum(['token', 'nft', 'voting', 'unknown', 'generic']),
    recommendedSkill: z.union([z.enum(supportedSkills), z.literal('unknown')]),
  }),
  pageConfig: pageConfigSchema,
  experience: experienceSchema.optional(),
  status: z.enum(['success', 'failed']),
  error: z.string().default(''),
});
```

Modify `server/services/hermes-agent.ts` input:

```ts
interface HermesAgentGenerationInput {
  input: BuilderTaskInput;
  abi: AbiEntry[];
  analysis: AnalyzeContractResult;
  capabilities: CapabilitySet;
  normalizedSkills: NormalizedSkills;
  deterministicPageConfig: PageConfig;
  deterministicExperience: Experience;
}
```

Update prompt hard rules:

```ts
Return ONLY strict JSON matching the guided dApp generation result shape.
Use the provided capability primitives as your design material.
You may generate an experience schema using only supported component types.
Do not reference methods outside deterministicPageConfig.methods or deterministicPageConfig.dangerousMethods.
Do not remove warnings from deterministicExperience.
```

Pass sanitized input, normalized skills, capabilities, deterministic pageConfig, and deterministic experience in the prompt. Continue omitting `modelConfig.apiKey`.

- [ ] **Step 4: Update agent orchestration**

Modify `server/services/agent.ts`:

```ts
import { buildCapabilityPrimitives } from './capabilities.js';
import { buildDeterministicExperience } from './experience.js';
import { validateExperience } from './experience-validator.js';
import { normalizeSelectedSkills } from './skills.js';

export async function runBuilderAgent(input: BuilderTaskInput): Promise<BuilderTaskResult> {
  const { abi, contractName } = await fetchContractMetadata(input.contractAddress);
  const normalizedSkills = normalizeSelectedSkills(input.skills);
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
```

- [ ] **Step 5: Update LLM model config**

Modify `server/services/llm.ts` signature:

```ts
interface LlmEnhancementInput {
  modelConfig?: ModelConfig;
  analysis: AnalyzeContractResult;
  pageConfig: PageConfig;
}
```

Use:

```ts
if (!modelConfig?.apiKey || !modelConfig.model) return null;
const baseUrl = modelConfig.baseUrl || appConfig.openAiBaseUrl;
const response = await fetch(`${baseUrl}/chat/completions`, {
  headers: { Authorization: `Bearer ${modelConfig.apiKey}` },
  body: JSON.stringify({ model: modelConfig.model, temperature: 0.2, messages }),
});
```

Ensure LLM merge can update `pageConfig.experience.title`, `summary`, and component copy only. It must not add method references outside the existing experience.

- [ ] **Step 6: Run orchestration tests**

Run: `npm test -- --run tests/agent.test.ts tests/hermes-agent.test.ts tests/llm.test.ts`

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add shared/schema.ts server/services/agent.ts server/services/hermes-agent.ts server/services/llm.ts tests/agent.test.ts tests/hermes-agent.test.ts tests/llm.test.ts
git commit -m "feat: orchestrate guided agent experience"
```

---

### Task 7: Task API and Storage Compatibility

**Files:**
- Modify: `server/routes/tasks.ts`
- Modify: `server/services/task-store.ts`
- Test: `tests/tasks-api.test.ts`, `tests/task-store.test.ts`

- [ ] **Step 1: Write failing API/storage tests**

Add to `tests/tasks-api.test.ts`:

```ts
test('creates a task with multi-select skills and sanitized model config', async () => {
  const response = await request(app)
    .post('/api/tasks')
    .send({
      contractAddress: '0x1234567890123456789012345678901234567890',
      chain: 'conflux-espace-testnet',
      skills: ['token-dashboard', 'eip-6963-wallet-discovery', 'guided-flow'],
      modelConfig: {
        baseUrl: 'https://api.openai.com/v1',
        model: 'gpt-5.4',
        apiKey: 'secret',
      },
    });

  expect(response.status).toBe(202);
  expect(response.body.input.skills).toEqual(['token-dashboard', 'eip-6963-wallet-discovery', 'guided-flow']);
  expect(response.body.input.modelConfig).toEqual({
    baseUrl: 'https://api.openai.com/v1',
    model: 'gpt-5.4',
  });
  expect(JSON.stringify(response.body)).not.toContain('secret');
});
```

Add to `tests/task-store.test.ts`:

```ts
test('does not persist modelConfig apiKey', async () => {
  const store = createTaskStore({ dataDir });
  const task = await store.createTask({
    contractAddress: '0x1234567890123456789012345678901234567890',
    chain: 'conflux-espace-testnet',
    skills: ['auto', 'explorer-links'],
    skill: 'auto',
    model: 'gpt-5.4',
    apiKey: 'legacy-secret',
    modelConfig: {
      baseUrl: 'https://api.openai.com/v1',
      model: 'gpt-5.4',
      apiKey: 'model-secret',
    },
  });

  const persisted = await store.getTask(task.id!);
  expect(JSON.stringify(persisted)).not.toContain('model-secret');
  expect(JSON.stringify(persisted)).not.toContain('legacy-secret');
  expect(persisted?.input).toMatchObject({
    skills: ['auto', 'explorer-links'],
    modelConfig: { baseUrl: 'https://api.openai.com/v1', model: 'gpt-5.4' },
  });
});
```

- [ ] **Step 2: Run tests to verify failures**

Run: `npm test -- --run tests/tasks-api.test.ts tests/task-store.test.ts`

Expected: FAIL on old request shape or persisted model config until Task 1 and store updates are complete.

- [ ] **Step 3: Update task store sanitization**

Modify `server/services/task-store.ts` `sanitizeTask`:

```ts
const sanitizeTask = (task: BuilderTask): BuilderTask => ({
  ...task,
  ...(task.input ? { input: sanitizeTaskInput(task.input) } : {}),
});
```

Ensure `builderTaskSchema` accepts sanitized `StoredTaskInput` with `skills` and `modelConfig` without `apiKey`.

- [ ] **Step 4: Confirm routes use parsed transformed input**

Confirm `server/routes/tasks.ts` uses the parsed transformed input exactly like this:

```ts
const input = builderTaskInputSchema.parse(request.body);
const task = await taskStore.createTask(input);
```

The transformed input should already contain `skills`, compatibility `skill`, and `modelConfig`.

- [ ] **Step 5: Run API/storage tests**

Run: `npm test -- --run tests/tasks-api.test.ts tests/task-store.test.ts`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add server/routes/tasks.ts server/services/task-store.ts tests/tasks-api.test.ts tests/task-store.test.ts
git commit -m "feat: store guided task inputs safely"
```

---

### Task 8: Builder Form Multi-Skill Input

**Files:**
- Modify: `src/components/BuilderForm.tsx`
- Modify: `src/types.ts`
- Test: `tests/builder-form.test.tsx`

- [ ] **Step 1: Write failing form test**

Add to `tests/builder-form.test.tsx`:

```tsx
test('submits selected skills and model config', async () => {
  const user = userEvent.setup();
  const onSubmit = vi.fn();
  render(<BuilderForm onSubmit={onSubmit} isSubmitting={false} />);

  await user.clear(screen.getByLabelText(/contract address/i));
  await user.type(screen.getByLabelText(/contract address/i), '0x1234567890123456789012345678901234567890');
  await user.click(screen.getByLabelText(/Token dashboard/i));
  await user.click(screen.getByLabelText(/EIP-6963 wallet discovery/i));
  await user.click(screen.getByLabelText(/Guided flow/i));
  await user.clear(screen.getByLabelText(/Base URL/i));
  await user.type(screen.getByLabelText(/Base URL/i), 'https://api.openai.com/v1');
  await user.clear(screen.getByLabelText(/^Model$/i));
  await user.type(screen.getByLabelText(/^Model$/i), 'gpt-5.4');
  await user.type(screen.getByLabelText(/API key/i), 'secret');
  await user.click(screen.getByRole('button', { name: /generate dapp preview/i }));

  expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({
    contractAddress: '0x1234567890123456789012345678901234567890',
    chain: 'conflux-espace-testnet',
    skills: expect.arrayContaining(['token-dashboard', 'eip-6963-wallet-discovery', 'guided-flow']),
    modelConfig: {
      baseUrl: 'https://api.openai.com/v1',
      model: 'gpt-5.4',
      apiKey: 'secret',
    },
  }));
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- --run tests/builder-form.test.tsx`

Expected: FAIL because current form has a single select and root-level model fields.

- [ ] **Step 3: Update form state**

Modify `src/components/BuilderForm.tsx`:

```ts
const initialState: BuilderTaskInput = {
  contractAddress: '',
  chain: 'conflux-espace-testnet',
  skills: ['auto', 'injected-wallet', 'guided-flow', 'risk-explainer'],
  skill: 'auto',
  model: 'gpt-5.4',
  apiKey: '',
  modelConfig: {
    baseUrl: 'https://api.openai.com/v1',
    model: 'gpt-5.4',
    apiKey: '',
  },
};

const skillGroups = [
  {
    title: 'Business direction',
    skills: [
      ['auto', 'Auto'],
      ['token-dashboard', 'Token dashboard'],
      ['nft-mint-experience', 'NFT mint experience'],
      ['voting-participation', 'Voting participation'],
    ],
  },
  {
    title: 'Wallet',
    skills: [
      ['injected-wallet', 'Injected wallet'],
      ['eip-6963-wallet-discovery', 'EIP-6963 wallet discovery'],
      ['chain-switching', 'Chain switching'],
    ],
  },
  {
    title: 'Experience',
    skills: [
      ['guided-flow', 'Guided flow'],
      ['transaction-timeline', 'Transaction timeline'],
      ['risk-explainer', 'Risk explainer'],
      ['explorer-links', 'Explorer links'],
    ],
  },
] as const;
```

Add helper:

```ts
function toggleSkill(current: BuilderTaskInput, skill: BuilderTaskInput['skills'][number]) {
  const skills = current.skills.includes(skill)
    ? current.skills.filter((entry) => entry !== skill)
    : [...current.skills, skill];
  return {
    ...current,
    skills,
    skill: skills[0] ?? 'auto',
  };
}
```

- [ ] **Step 4: Replace skill select with checkbox groups**

Use this JSX inside the form grid:

```tsx
<fieldset className="field field-full skill-fieldset">
  <legend>Skills</legend>
  {skillGroups.map((group) => (
    <div key={group.title} className="skill-group">
      <strong>{group.title}</strong>
      <div className="skill-grid">
        {group.skills.map(([skill, label]) => (
          <label key={skill} className="checkbox-option">
            <input
              type="checkbox"
              checked={formState.skills.includes(skill)}
              onChange={() => setFormState((current) => toggleSkill(current, skill))}
            />
            <span>{label}</span>
          </label>
        ))}
      </div>
    </div>
  ))}
</fieldset>
```

Replace model/API inputs with:

```tsx
<label className="field">
  <span>Base URL</span>
  <input
    value={formState.modelConfig?.baseUrl ?? ''}
    onChange={(event) => setFormState((current) => ({
      ...current,
      modelConfig: {
        baseUrl: event.target.value,
        model: current.modelConfig?.model ?? current.model ?? 'gpt-5.4',
        apiKey: current.modelConfig?.apiKey ?? '',
      },
    }))}
    placeholder="https://api.openai.com/v1"
  />
</label>

<label className="field">
  <span>Model</span>
  <input
    value={formState.modelConfig?.model ?? ''}
    onChange={(event) => setFormState((current) => ({
      ...current,
      model: event.target.value,
      modelConfig: {
        baseUrl: current.modelConfig?.baseUrl ?? 'https://api.openai.com/v1',
        model: event.target.value,
        apiKey: current.modelConfig?.apiKey ?? '',
      },
    }))}
    placeholder="gpt-5.4"
  />
</label>
```

Keep API key field but bind to `modelConfig.apiKey`.

- [ ] **Step 5: Run form tests**

Run: `npm test -- --run tests/builder-form.test.tsx`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/components/BuilderForm.tsx src/types.ts tests/builder-form.test.tsx
git commit -m "feat: collect guided generation skills"
```

---

### Task 9: Experience Renderer

**Files:**
- Create: `src/components/ExperienceRenderer.tsx`
- Create: `src/components/ExperienceComponents.tsx`
- Modify: `src/components/PreviewPage.tsx`
- Modify: `src/styles.css`
- Test: `tests/frontend-preview.test.tsx`

- [ ] **Step 1: Write failing renderer test**

Add to `tests/frontend-preview.test.tsx`:

```tsx
test('renders product experience components when pageConfig includes experience', () => {
  const experienceTask: BuilderTask = {
    ...task,
    result: {
      ...task.result!,
      pageConfig: {
        ...task.result!.pageConfig,
        skills: ['token-dashboard', 'guided-flow', 'transaction-timeline', 'explorer-links'],
        experience: {
          id: 'exp-token',
          title: 'Agent Designed Token Console',
          summary: 'Manage balances, transfers, approvals, and risk.',
          template: 'token-dashboard',
          confidence: 0.91,
          skills: ['token-dashboard', 'guided-flow', 'transaction-timeline', 'explorer-links'],
          components: [
            { id: 'hero', type: 'hero', title: 'Agent Designed Token Console', description: 'Manage balances, transfers, approvals, and risk.', methodNames: [], warnings: [], children: [] },
            { id: 'wallet', type: 'wallet', title: 'Wallet connection', description: 'Choose a wallet.', methodNames: [], warnings: [], children: [] },
            { id: 'send', type: 'action', title: 'Send tokens', description: 'Transfer tokens safely.', methodName: 'claim', methodNames: ['claim'], warnings: [], children: [] },
            { id: 'timeline', type: 'timeline', title: 'Transaction timeline', description: 'Track transaction state.', methodNames: [], warnings: [], children: [] },
            { id: 'explorer', type: 'explorerLink', title: 'View on explorer', description: 'Open contract.', href: 'https://evmtestnet.confluxscan.org/address/0x1234567890123456789012345678901234567890', methodNames: [], warnings: [], children: [] },
          ],
          warnings: [],
          unsupported: [],
        },
      },
    },
  };

  render(
    <PreviewPage
      task={experienceTask}
      walletState={{ account: null, chainId: null, isConnecting: false }}
      onConnectWallet={vi.fn()}
      onRunMethod={vi.fn()}
      activeResult={null}
    />,
  );

  expect(screen.getByText('Agent Designed Token Console')).toBeInTheDocument();
  expect(screen.getByText('Wallet connection')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: /send tokens/i })).toBeInTheDocument();
  expect(screen.getByText('Transaction timeline')).toBeInTheDocument();
  expect(screen.getByRole('link', { name: /view on explorer/i })).toHaveAttribute('href', expect.stringContaining('confluxscan'));
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- --run tests/frontend-preview.test.tsx`

Expected: FAIL because `PreviewPage` ignores `pageConfig.experience`.

- [ ] **Step 3: Create experience renderer components**

Create `src/components/ExperienceRenderer.tsx`:

```tsx
import type { Experience, MethodRunResult, PageMethod, WalletState } from '../types';
import { ExperienceComponentView } from './ExperienceComponents';

interface ExperienceRendererProps {
  experience: Experience;
  methods: PageMethod[];
  dangerousMethods: PageMethod[];
  walletState: WalletState;
  onConnectWallet: () => void | Promise<void>;
  onRunMethod: (method: PageMethod, formValues: Record<string, string>) => void | Promise<void>;
  activeResult: MethodRunResult | null;
}

export function ExperienceRenderer(props: ExperienceRendererProps) {
  const methodMap = new Map([...props.methods, ...props.dangerousMethods].map((method) => [method.name, method]));

  return (
    <div className="experience-page">
      {props.experience.components.map((component) => (
        <ExperienceComponentView
          key={component.id}
          component={component}
          methodMap={methodMap}
          walletState={props.walletState}
          onConnectWallet={props.onConnectWallet}
          onRunMethod={props.onRunMethod}
          activeResult={props.activeResult}
        />
      ))}
    </div>
  );
}
```

Create `src/components/ExperienceComponents.tsx`:

```tsx
import type { ExperienceComponent, MethodRunResult, PageMethod, WalletState } from '../types';
import { MethodCard } from './MethodCard';
import { WalletBar } from './WalletBar';
import { WarningBanner } from './WarningBanner';

interface Props {
  component: ExperienceComponent;
  methodMap: Map<string, PageMethod>;
  walletState: WalletState;
  onConnectWallet: () => void | Promise<void>;
  onRunMethod: (method: PageMethod, formValues: Record<string, string>) => void | Promise<void>;
  activeResult: MethodRunResult | null;
}

export function ExperienceComponentView({ component, methodMap, walletState, onConnectWallet, onRunMethod, activeResult }: Props) {
  const methods = component.methodNames.map((methodName) => methodMap.get(methodName)).filter((method): method is PageMethod => Boolean(method));

  if (component.type === 'hero') {
    return (
      <header className="hero-card experience-hero">
        <div>
          <p className="eyebrow">Generated dApp Experience</p>
          <h1>{component.title}</h1>
          {component.description && <p>{component.description}</p>}
        </div>
      </header>
    );
  }

  if (component.type === 'wallet') {
    return (
      <section className="preview-section">
        <header><h2>{component.title}</h2>{component.description && <p>{component.description}</p>}</header>
        <WalletBar walletState={walletState} onConnectWallet={onConnectWallet} chain="conflux-espace-testnet" />
      </section>
    );
  }

  if (component.type === 'risk') {
    return (
      <section className="preview-section variant-danger">
        <header><h2>{component.title}</h2>{component.description && <p>{component.description}</p>}</header>
        {component.warnings.map((warning) => <WarningBanner key={warning} warning={warning} />)}
        <div className="method-grid">
          {methods.map((method) => <MethodCard key={method.name} method={method} onRunMethod={onRunMethod} activeResult={activeResult} />)}
        </div>
      </section>
    );
  }

  if (component.type === 'explorerLink') {
    return (
      <section className="preview-section">
        <header><h2>{component.title}</h2>{component.description && <p>{component.description}</p>}</header>
        {component.href && <a className="secondary-button" href={component.href} target="_blank" rel="noreferrer">{component.title}</a>}
      </section>
    );
  }

  if (component.type === 'timeline') {
    return (
      <section className="preview-section">
        <header><h2>{component.title}</h2>{component.description && <p>{component.description}</p>}</header>
        <div className="timeline-box">{activeResult?.message ?? 'No transaction submitted in this session.'}</div>
      </section>
    );
  }

  if (component.type === 'unsupported') {
    return (
      <section className="preview-section">
        <header><h2>{component.title}</h2>{component.description && <p>{component.description}</p>}</header>
      </section>
    );
  }

  return (
    <section className="preview-section">
      <header><h2>{component.title}</h2>{component.description && <p>{component.description}</p>}</header>
      <div className="method-grid">
        {methods.map((method) => <MethodCard key={method.name} method={method} onRunMethod={onRunMethod} activeResult={activeResult} />)}
        {methods.length === 0 && <div className="empty-state">This component has no runnable methods.</div>}
      </div>
    </section>
  );
}
```

- [ ] **Step 4: Wire renderer into PreviewPage**

Modify `src/components/PreviewPage.tsx`:

```tsx
import { ExperienceRenderer } from './ExperienceRenderer';

if (pageConfig.experience) {
  return (
    <div className="preview-page">
      <ExperienceRenderer
        experience={pageConfig.experience}
        methods={pageConfig.methods}
        dangerousMethods={pageConfig.dangerousMethods}
        walletState={walletState}
        onConnectWallet={onConnectWallet}
        onRunMethod={onRunMethod}
        activeResult={activeResult}
      />
    </div>
  );
}
```

Place this after `pageConfig` null check and before legacy section rendering.

- [ ] **Step 5: Add minimal styles**

Append to `src/styles.css`:

```css
.experience-page {
  display: grid;
  gap: 1rem;
}

.experience-hero {
  min-height: 180px;
}

.timeline-box {
  border: 1px solid var(--border-color);
  border-radius: 8px;
  padding: 1rem;
  background: var(--panel-muted);
}
```

Use existing CSS variables if names differ; if `--border-color` or `--panel-muted` do not exist, use existing border/background tokens from the file.

- [ ] **Step 6: Run frontend preview tests**

Run: `npm test -- --run tests/frontend-preview.test.tsx`

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/components/ExperienceRenderer.tsx src/components/ExperienceComponents.tsx src/components/PreviewPage.tsx src/styles.css tests/frontend-preview.test.tsx
git commit -m "feat: render guided dapp experiences"
```

---

### Task 10: EIP-6963 Wallet Discovery

**Files:**
- Modify: `src/lib/wallet.ts`
- Modify: `src/components/WalletBar.tsx`
- Test: `tests/frontend-components.test.tsx`

- [ ] **Step 1: Write failing wallet discovery test**

Add to `tests/frontend-components.test.tsx`:

```tsx
test('WalletBar can show discovered EIP-6963 wallets', () => {
  render(
    <WalletBar
      walletState={{ account: null, chainId: null, isConnecting: false }}
      onConnectWallet={vi.fn()}
      chain="conflux-espace-testnet"
      wallets={[
        { id: 'io.metamask', name: 'MetaMask' },
        { id: 'com.rabby', name: 'Rabby' },
      ]}
    />,
  );

  expect(screen.getByText('MetaMask')).toBeInTheDocument();
  expect(screen.getByText('Rabby')).toBeInTheDocument();
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- --run tests/frontend-components.test.tsx`

Expected: FAIL because `WalletBar` has no `wallets` prop.

- [ ] **Step 3: Add discovery helper**

Modify `src/lib/wallet.ts`:

```ts
export interface DiscoveredWallet {
  id: string;
  name: string;
  icon?: string;
  provider?: unknown;
}

export async function discoverEip6963Wallets(timeoutMs = 300): Promise<DiscoveredWallet[]> {
  if (typeof window === 'undefined') return [];
  const wallets = new Map<string, DiscoveredWallet>();

  function onAnnounce(event: Event) {
    const detail = (event as CustomEvent).detail as { info?: { uuid?: string; rdns?: string; name?: string; icon?: string }; provider?: unknown };
    const id = detail.info?.rdns ?? detail.info?.uuid ?? detail.info?.name;
    if (!id || !detail.info?.name) return;
    wallets.set(id, { id, name: detail.info.name, icon: detail.info.icon, provider: detail.provider });
  }

  window.addEventListener('eip6963:announceProvider', onAnnounce);
  window.dispatchEvent(new Event('eip6963:requestProvider'));
  await new Promise((resolve) => window.setTimeout(resolve, timeoutMs));
  window.removeEventListener('eip6963:announceProvider', onAnnounce);

  return [...wallets.values()];
}
```

- [ ] **Step 4: Update WalletBar props**

Modify `src/components/WalletBar.tsx` to accept optional wallets:

```ts
interface WalletBarProps {
  walletState: WalletState;
  onConnectWallet: () => void | Promise<void>;
  chain: ChainKey;
  wallets?: Array<{ id: string; name: string; icon?: string }>;
}
```

Render discovered wallets:

```tsx
{wallets && wallets.length > 0 && (
  <div className="wallet-options">
    {wallets.map((wallet) => (
      <span key={wallet.id} className="wallet-chip">{wallet.name}</span>
    ))}
  </div>
)}
```

- [ ] **Step 5: Wire discovery when skill selected**

In `PreviewPage` or `ExperienceRenderer`, discover wallets only when `pageConfig.skills.includes('eip-6963-wallet-discovery')` and pass them to `WalletBar`. Use a local state:

```ts
const [wallets, setWallets] = useState<DiscoveredWallet[]>([]);

useEffect(() => {
  if (!pageConfig?.skills.includes('eip-6963-wallet-discovery')) return;
  void discoverEip6963Wallets().then(setWallets);
}, [pageConfig?.skills]);
```

- [ ] **Step 6: Run wallet tests**

Run: `npm test -- --run tests/frontend-components.test.tsx tests/frontend-preview.test.tsx`

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/lib/wallet.ts src/components/WalletBar.tsx src/components/PreviewPage.tsx src/components/ExperienceComponents.tsx tests/frontend-components.test.tsx tests/frontend-preview.test.tsx
git commit -m "feat: show eip6963 wallet discovery"
```

---

### Task 11: Full Verification and Documentation Refresh

**Files:**
- Modify: `README.md`
- Modify: `docs/prompts/agent-execution-prompt.md`
- Test: full suite

- [ ] **Step 1: Update README**

Modify `README.md` sections:

```md
## What it does

1. Frontend collects:
   - contractAddress
   - chain
   - selected skills
   - optional modelConfig
2. Backend creates a task and processes it:
   - fetch ABI from ConfluxScan
   - analyze contract capabilities
   - normalize selected skills
   - build capability primitives
   - generate deterministic experience fallback
   - call `hermes-agent` for guided product experience generation
   - validate agent output against deterministic methods and warnings
   - optionally let an OpenAI-compatible model improve copy
   - store task result on disk without API keys
3. Frontend renders a product-like preview from the validated experience schema.
```

Add supported skills:

```md
## Supported MVP skills

Business:
- auto
- token-dashboard
- nft-mint-experience
- voting-participation

Wallet:
- injected-wallet
- eip-6963-wallet-discovery
- chain-switching

Experience:
- guided-flow
- transaction-timeline
- risk-explainer
- explorer-links
```

- [ ] **Step 2: Update agent prompt reference**

Modify `docs/prompts/agent-execution-prompt.md` to describe:

```md
The agent receives sanitized task input, selected skills, deterministic capability primitives, deterministic pageConfig, and deterministic experience. It returns strict JSON with `summary`, `contractAnalysis`, `pageConfig`, optional top-level `experience`, `status`, and `error`.

The agent must not reference methods outside deterministic method lists, remove warnings, or use unsupported component types.
```

- [ ] **Step 3: Run full verification**

Run: `npm test`

Expected: PASS for all Vitest suites.

Run: `npm run build`

Expected: PASS for Vite build and server TypeScript build.

- [ ] **Step 4: Commit**

```bash
git add README.md docs/prompts/agent-execution-prompt.md
git commit -m "docs: describe guided dapp generation"
```

---

## Self-Review Notes

Spec coverage:

- Multi-select skills: covered by Tasks 1, 2, 8.
- Model config and API key safety: covered by Tasks 1, 6, 7.
- Capability primitives: covered by Task 3.
- Experience schema: covered by Tasks 1 and 4.
- Guided agent: covered by Task 6.
- Validator: covered by Task 5.
- Renderer boundary: covered by Task 9.
- EIP-6963 preview behavior: covered by Task 10.
- Fallback behavior: covered by Tasks 4, 5, and 6.
- Documentation and full verification: covered by Task 11.

Type consistency:

- The plan uses `skills: SkillName[]`, `modelConfig`, `Experience`, `ExperienceComponent`, and `pageConfig.experience` consistently.
- Existing legacy fields `skill`, `model`, and `apiKey` remain compatibility fields during the migration.
- The renderer consumes schema-supported component types only.
