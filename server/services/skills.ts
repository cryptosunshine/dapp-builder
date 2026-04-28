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

function isBusinessSkill(skill: string): skill is BusinessSkillName {
  return (businessSkills as readonly string[]).includes(skill);
}

function isWalletSkill(skill: string): skill is WalletSkillName {
  return (walletSkills as readonly string[]).includes(skill);
}

function isExperienceSkill(skill: string): skill is ExperienceSkillName {
  return (experienceSkills as readonly string[]).includes(skill);
}

export function normalizeSelectedSkills(input: SkillName[]): NormalizedSkills {
  const diagnostics: string[] = [];
  const valid: SkillName[] = input.filter((skill): skill is SkillName => (supportedSkills as readonly string[]).includes(skill));
  const skills: SkillName[] = [...new Set<SkillName>(valid.length > 0 ? valid : ['auto'])];

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
