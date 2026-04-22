import { describe, expect, test } from 'vitest';
import { analyzeContract } from '../server/services/analyzer';
import { buildPageConfig } from '../server/services/page-config';
import type { AbiEntry } from '../shared/schema';

const stakingAbi: AbiEntry[] = [
  { type: 'function', name: 'stake', stateMutability: 'nonpayable', inputs: [{ name: 'amount', type: 'uint256' }], outputs: [] },
  { type: 'function', name: 'unstake', stateMutability: 'nonpayable', inputs: [{ name: 'amount', type: 'uint256' }], outputs: [] },
  { type: 'function', name: 'claimRewards', stateMutability: 'nonpayable', inputs: [], outputs: [] },
  { type: 'function', name: 'earned', stateMutability: 'view', inputs: [{ name: 'account', type: 'address' }], outputs: [{ name: '', type: 'uint256' }] },
  { type: 'function', name: 'upgradeTo', stateMutability: 'nonpayable', inputs: [{ name: 'implementation', type: 'address' }], outputs: [] },
];

describe('buildPageConfig', () => {
  test('groups useful read/action/danger sections for a staking page', () => {
    const analysis = analyzeContract({
      abi: stakingAbi,
      contractAddress: '0x1234567890123456789012345678901234567890',
      contractName: 'Mock Staking',
      chain: 'conflux-espace-testnet',
      requestedSkill: 'staking-page',
    });

    const pageConfig = buildPageConfig(analysis);

    expect(pageConfig.skill).toBe('staking-page');
    expect(pageConfig.methods.map((method) => method.name)).toEqual(
      expect.arrayContaining(['stake', 'unstake', 'claimRewards', 'earned']),
    );
    expect(pageConfig.sections.map((section) => section.title)).toEqual(
      expect.arrayContaining(['Overview', 'Read data', 'Actions', 'Danger zone']),
    );
    expect(pageConfig.dangerousMethods.map((method) => method.name)).toContain('upgradeTo');
    expect(pageConfig.methods.find((method) => method.name === 'stake')?.label).toMatch(/stake/i);
  });
});
