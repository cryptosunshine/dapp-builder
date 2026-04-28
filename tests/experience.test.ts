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
