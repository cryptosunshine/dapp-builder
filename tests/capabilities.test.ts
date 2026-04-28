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
