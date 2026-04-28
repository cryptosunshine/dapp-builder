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

const tokenAbi: AbiEntry[] = [
  { type: 'function', name: 'name', stateMutability: 'view', inputs: [], outputs: [{ name: '', type: 'string' }] },
  { type: 'function', name: 'symbol', stateMutability: 'view', inputs: [], outputs: [{ name: '', type: 'string' }] },
  { type: 'function', name: 'balanceOf', stateMutability: 'view', inputs: [{ name: 'account', type: 'address' }], outputs: [{ name: '', type: 'uint256' }] },
  { type: 'function', name: 'allowance', stateMutability: 'view', inputs: [{ name: 'owner', type: 'address' }, { name: 'spender', type: 'address' }], outputs: [{ name: '', type: 'uint256' }] },
  { type: 'function', name: 'transfer', stateMutability: 'nonpayable', inputs: [{ name: 'to', type: 'address' }, { name: 'amount', type: 'uint256' }], outputs: [{ name: '', type: 'bool' }] },
  { type: 'function', name: 'approve', stateMutability: 'nonpayable', inputs: [{ name: 'spender', type: 'address' }, { name: 'amount', type: 'uint256' }], outputs: [{ name: '', type: 'bool' }] },
  { type: 'function', name: 'transferFrom', stateMutability: 'nonpayable', inputs: [{ name: 'from', type: 'address' }, { name: 'to', type: 'address' }, { name: 'amount', type: 'uint256' }], outputs: [{ name: '', type: 'bool' }] },
  { type: 'function', name: 'pause', stateMutability: 'nonpayable', inputs: [], outputs: [] },
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

  test('builds token-first primary actions for ERC20-like contracts instead of a generic method dump', () => {
    const analysis = analyzeContract({
      abi: tokenAbi,
      contractAddress: '0x1234567890123456789012345678901234567890',
      contractName: 'Mock Token',
      chain: 'conflux-espace-testnet',
      requestedSkill: 'token-dashboard',
    });

    const pageConfig = buildPageConfig(analysis);

    expect(pageConfig.primaryActions).toEqual([
      'Check wallet balance',
      'Transfer tokens',
      'Review approvals',
      'Revoke approval',
    ]);
    expect(pageConfig.sections.map((section) => section.title)).toEqual(
      expect.arrayContaining(['Token overview', 'Your wallet', 'Send tokens', 'Approvals & spender safety', 'Advanced token actions']),
    );
    const advancedActions = pageConfig.sections.find((section) => section.title === 'Advanced token actions');
    expect(advancedActions?.methodNames).toContain('transferFrom');
    expect(pageConfig.dangerousMethods.map((method) => method.name)).toContain('pause');
  });
});
