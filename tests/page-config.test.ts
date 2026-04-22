import { describe, expect, test } from 'vitest';
import { analyzeContract } from '../server/services/analyzer';
import { buildPageConfig } from '../server/services/page-config';
import type { AbiEntry } from '../shared/schema';

const stakingAbi: AbiEntry[] = [
  { type: 'function', name: 'stake', stateMutability: 'nonpayable', inputs: [{ name: 'amount', type: 'uint256' }], outputs: [] },
  { type: 'function', name: 'unstake', stateMutability: 'nonpayable', inputs: [{ name: 'amount', type: 'uint256' }], outputs: [] },
  { type: 'function', name: 'claim', stateMutability: 'nonpayable', inputs: [], outputs: [] },
  { type: 'function', name: 'earned', stateMutability: 'view', inputs: [{ name: 'account', type: 'address' }], outputs: [{ name: '', type: 'uint256' }] },
  { type: 'function', name: 'rewardRate', stateMutability: 'view', inputs: [], outputs: [{ name: '', type: 'uint256' }] },
  { type: 'function', name: 'upgradeTo', stateMutability: 'nonpayable', inputs: [{ name: 'implementation', type: 'address' }], outputs: [] },
];

describe('buildPageConfig', () => {
  test('builds read/write sections, keeps rpcUrl metadata, and does not expose dangerous admin methods', () => {
    const analysis = analyzeContract({
      abi: stakingAbi,
      contractAddress: '0x1234567890123456789012345678901234567890',
      contractName: 'Mock Staking',
      chain: 'conflux-espace-testnet',
      requestedSkill: 'staking-page',
    });

    const pageConfig = buildPageConfig(analysis);

    expect(pageConfig.skill).toBe('staking-page');
    expect(pageConfig.chainId).toBe(71);
    expect(pageConfig.rpcUrl).toBe('https://evmtestnet.confluxrpc.com');
    expect(pageConfig.methods.map((method) => method.name)).toEqual(
      expect.arrayContaining(['earned', 'rewardRate', 'stake', 'unstake', 'claim']),
    );
    expect(pageConfig.methods.map((method) => method.name)).not.toContain('upgradeTo');
    expect(pageConfig.sections.map((section) => section.title)).toEqual(
      expect.arrayContaining(['Overview', 'Read methods', 'Write methods']),
    );
    expect(pageConfig.warnings.join(' ')).toMatch(/wallet|network|danger/i);
  });
});
