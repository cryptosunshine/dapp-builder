export interface GenerationSkillCatalogItem {
  id: string;
  label: string;
  source: 'default' | 'github' | 'custom';
  description: string;
  prompt: string;
  defaultEnabled?: boolean;
  /** Real Hermes skill name for loading via --skills flag. Only set when a matching skill exists in ~/.hermes/skills/ */
  hermesSkill?: string;
}

/** Default generation skills loaded for every dApp generation. */
export const defaultGenerationSkillIds = [
  'popular-web-designs',
  'wallet-first-flow',
  'risk-aware-transactions',
] as const;

/**
 * Complete catalog of available generation skills.
 *
 * Structure:
 * - default: 3 carefully chosen skills loaded by default
 * - github: 5 popular open-source dApp skill patterns users can opt into
 * - Users can also write a custom skill in the textarea.
 */
export const generationSkillCatalog: GenerationSkillCatalogItem[] = [
  // ── Default skills (loaded for every generation) ────────────────────────
  {
    id: 'popular-web-designs',
    label: 'Popular web design systems',
    source: 'default',
    description:
      'Borrow hierarchy, spacing, card systems, and CTA discipline from 54+ production web apps.',
    prompt:
      'Apply polished production web design hierarchy: clear hero, strong primary CTA, disciplined spacing, responsive cards, accessible contrast, and consistent button states.',
    defaultEnabled: true,
    hermesSkill: 'popular-web-designs',
  },
  {
    id: 'wallet-first-flow',
    label: 'Wallet-first dApp flow',
    source: 'default',
    description:
      'Make connection, network, account state, and transaction readiness obvious before actions.',
    prompt:
      'Design around wallet state first: connect wallet, show expected network, explain account readiness, and keep read/write actions gated by clear wallet context.',
    defaultEnabled: true,
  },
  {
    id: 'risk-aware-transactions',
    label: 'Risk-aware transaction UX',
    source: 'default',
    description:
      'Isolate approvals/admin actions and make transaction risks visible without turning the page into a warning wall.',
    prompt:
      'Separate risky/admin actions from normal flows, add concise safety rails near approvals and writes, and make confirmation/verification steps explicit.',
    defaultEnabled: true,
  },

  // ── GitHub-inspired skills (user can toggle on) ─────────────────────────
  // These are curated from the most popular dApp/crypto open-source
  // projects.  Each maps to a real GitHub repo's design/UX philosophy.
  {
    id: 'uniswap-interface-pattern',
    label: 'Uniswap interface pattern',
    source: 'github',
    description:
      'Focused action card, strong token/action context, minimal distractions.',
    prompt:
      'Use a Uniswap-style interaction model: one focused primary action card, clear asset/action context, compact secondary details, and minimal scanner-like chrome.',
  },
  {
    id: 'aave-dashboard-pattern',
    label: 'Aave dashboard pattern',
    source: 'github',
    description:
      'Portfolio-style overview, risk separation, and clear market/action panels.',
    prompt:
      'Use an Aave-style app structure: dashboard overview, clear account/status metrics, action panels, and visibly separated risk/advanced zones.',
  },
  {
    id: 'rainbowkit-wallet-pattern',
    label: 'RainbowKit wallet pattern',
    source: 'github',
    description:
      'RainbowKit wallet UX: network/account clarity and friendly connection states.',
    prompt:
      'Use RainbowKit-like wallet UX: friendly connect state, readable account/network badges, wrong-network guidance, and wallet state feedback near every transaction flow.',
  },
  {
    id: 'wagmi-viem-contract-pattern',
    label: 'wagmi + viem contract pattern',
    source: 'github',
    description:
      'Predictable read/write grouping and transaction lifecycle feedback.',
    prompt:
      'Structure contract interactions like a wagmi/viem app: separate read state, write preparation, pending/success/error feedback, and post-action verification steps.',
  },
  {
    id: 'openzeppelin-security-pattern',
    label: 'OpenZeppelin security pattern',
    source: 'github',
    description:
      'Safer copy for permissions, ownership, approvals, and admin calls.',
    prompt:
      'Use OpenZeppelin-style safety language: call out ownership, roles, approvals, upgrade/admin controls, and irreversible writes in plain user-facing copy.',
  },
];

export function normalizeGenerationSkillIds(value: unknown): string[] {
  // Explicit empty array means "no generation skills" (for experiment control).
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
  const hermesSkills = Array.from(
    new Set(selected.map((skill) => skill.hermesSkill).filter((skill): skill is string => Boolean(skill))),
  );
  const lines = selected.map(
    (skill) => `- ${skill.label} (${skill.source}): ${skill.prompt}`,
  );
  if (customSkill) {
    lines.push(`- Custom user skill: ${customSkill}`);
  }

  return {
    selected,
    defaultSkills,
    hermesSkills,
    promptBlock:
      lines.join('\n') ||
      '- No additional generation skills selected. Use only the contract context and base safety/product rules.',
  };
}