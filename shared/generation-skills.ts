export interface GenerationSkillCatalogItem {
  id: string;
  label: string;
  source: 'default' | 'github' | 'custom';
  description: string;
  prompt: string;
  defaultEnabled?: boolean;
  hermesSkill?: string;
}

export const defaultGenerationSkillIds = [
  'popular-web-designs',
  'wallet-first-flow',
  'risk-aware-transactions',
] as const;

export const generationSkillCatalog: GenerationSkillCatalogItem[] = [
  {
    id: 'popular-web-designs',
    label: 'Popular web design systems',
    source: 'default',
    description: 'Default Hermes skill: borrow hierarchy, spacing, card systems, and CTA discipline from strong production web apps.',
    prompt: 'Apply polished production web design hierarchy: clear hero, strong primary CTA, disciplined spacing, responsive cards, accessible contrast, and consistent button states.',
    defaultEnabled: true,
    hermesSkill: 'popular-web-designs',
  },
  {
    id: 'wallet-first-flow',
    label: 'Wallet-first dApp flow',
    source: 'default',
    description: 'Default dApp skill: make connection, network, account state, and transaction readiness obvious before actions.',
    prompt: 'Design around wallet state first: connect wallet, show expected network, explain account readiness, and keep read/write actions gated by clear wallet context.',
    defaultEnabled: true,
  },
  {
    id: 'risk-aware-transactions',
    label: 'Risk-aware transaction UX',
    source: 'default',
    description: 'Default dApp skill: isolate approvals/admin actions and make transaction risks visible without turning the page into a warning wall.',
    prompt: 'Separate risky/admin actions from normal flows, add concise safety rails near approvals and writes, and make confirmation/verification steps explicit.',
    defaultEnabled: true,
  },
  {
    id: 'uniswap-interface-pattern',
    label: 'Uniswap interface pattern',
    source: 'github',
    description: 'Inspired by the public Uniswap interface: focused action card, strong token/action context, minimal distractions.',
    prompt: 'Use a Uniswap-style interaction model: one focused primary action card, clear asset/action context, compact secondary details, and minimal scanner-like chrome.',
  },
  {
    id: 'aave-dashboard-pattern',
    label: 'Aave dashboard pattern',
    source: 'github',
    description: 'Inspired by the public Aave interface: portfolio-style overview, risk separation, and clear market/action panels.',
    prompt: 'Use an Aave-style app structure: dashboard overview, clear account/status metrics, action panels, and visibly separated risk/advanced zones.',
  },
  {
    id: 'rainbowkit-wallet-pattern',
    label: 'RainbowKit wallet pattern',
    source: 'github',
    description: 'Inspired by RainbowKit wallet UX: network/account clarity and friendly connection states.',
    prompt: 'Use RainbowKit-like wallet UX: friendly connect state, readable account/network badges, wrong-network guidance, and wallet state feedback near every transaction flow.',
  },
  {
    id: 'wagmi-viem-contract-pattern',
    label: 'wagmi + viem contract pattern',
    source: 'github',
    description: 'Inspired by wagmi/viem examples: predictable read/write grouping and transaction lifecycle feedback.',
    prompt: 'Structure contract interactions like a wagmi/viem app: separate read state, write preparation, pending/success/error feedback, and post-action verification steps.',
  },
  {
    id: 'openzeppelin-security-pattern',
    label: 'OpenZeppelin security pattern',
    source: 'github',
    description: 'Inspired by OpenZeppelin contract/security docs: safer copy for permissions, ownership, approvals, and admin calls.',
    prompt: 'Use OpenZeppelin-style safety language: call out ownership, roles, approvals, upgrade/admin controls, and irreversible writes in plain user-facing copy.',
  },
  {
    id: 'scaffold-eth-product-pattern',
    label: 'Scaffold-ETH app pattern',
    source: 'github',
    description: 'Inspired by Scaffold-ETH examples: fast contract app scaffolding, readable controls, and developer-friendly context without raw dumps.',
    prompt: 'Use Scaffold-ETH-like clarity: concise contract context, readable method controls, network/address utilities, and a generated app that feels ready to try.',
  },
];

export function normalizeGenerationSkillIds(value: unknown): string[] {
  if (Array.isArray(value) && value.length === 0) {
    return [];
  }
  const raw = Array.isArray(value) ? value : value ? [value] : defaultGenerationSkillIds;
  const allowed = new Set(generationSkillCatalog.map((skill) => skill.id));
  const normalized = raw
    .map((entry) => String(entry).trim())
    .filter((entry) => allowed.has(entry));
  if (Array.isArray(value)) {
    return Array.from(new Set(normalized));
  }
  return Array.from(new Set(normalized.length > 0 ? normalized : [...defaultGenerationSkillIds]));
}

export function normalizeCustomGenerationSkill(value: unknown): string {
  return String(value ?? '')
    .replace(/[\u0000-\u001f\u007f]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 800);
}

export function describeGenerationSkills(skillIds: unknown, customSkill = '') {
  const normalizedSkillIds = normalizeGenerationSkillIds(skillIds);
  const selected = normalizedSkillIds
    .map((id) => generationSkillCatalog.find((skill) => skill.id === id))
    .filter((skill): skill is GenerationSkillCatalogItem => Boolean(skill));

  const defaultSkills = generationSkillCatalog.filter((skill) => skill.defaultEnabled);
  const hermesSkills = Array.from(new Set(selected.map((skill) => skill.hermesSkill).filter((skill): skill is string => Boolean(skill))));
  const lines = selected.map((skill) => `- ${skill.label} (${skill.source}): ${skill.prompt}`);
  if (customSkill) {
    lines.push(`- Custom user skill: ${customSkill}`);
  }

  return {
    selected,
    defaultSkills,
    hermesSkills,
    promptBlock: lines.join('\n') || '- No additional generation skills selected. Use only the contract context and base safety/product rules.',
  };
}
