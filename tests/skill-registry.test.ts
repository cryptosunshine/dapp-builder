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

  test('dedupes selected skills and records supported categories', () => {
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
