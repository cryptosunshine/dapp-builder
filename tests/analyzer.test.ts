import { describe, expect, test } from 'vitest';
import { analyzeContract } from '../server/services/analyzer';
import type { AbiEntry } from '../shared/schema';

const erc20Abi: AbiEntry[] = [
  { type: 'function', name: 'name', stateMutability: 'view', inputs: [], outputs: [{ name: '', type: 'string' }] },
  { type: 'function', name: 'symbol', stateMutability: 'view', inputs: [], outputs: [{ name: '', type: 'string' }] },
  { type: 'function', name: 'decimals', stateMutability: 'view', inputs: [], outputs: [{ name: '', type: 'uint8' }] },
  { type: 'function', name: 'totalSupply', stateMutability: 'view', inputs: [], outputs: [{ name: '', type: 'uint256' }] },
  { type: 'function', name: 'balanceOf', stateMutability: 'view', inputs: [{ name: 'account', type: 'address' }], outputs: [{ name: '', type: 'uint256' }] },
  { type: 'function', name: 'allowance', stateMutability: 'view', inputs: [{ name: 'owner', type: 'address' }, { name: 'spender', type: 'address' }], outputs: [{ name: '', type: 'uint256' }] },
  { type: 'function', name: 'transfer', stateMutability: 'nonpayable', inputs: [{ name: 'to', type: 'address' }, { name: 'amount', type: 'uint256' }], outputs: [{ name: '', type: 'bool' }] },
  { type: 'function', name: 'approve', stateMutability: 'nonpayable', inputs: [{ name: 'spender', type: 'address' }, { name: 'amount', type: 'uint256' }], outputs: [{ name: '', type: 'bool' }] },
  { type: 'function', name: 'pause', stateMutability: 'nonpayable', inputs: [], outputs: [] },
];

const nftMintAbi: AbiEntry[] = [
  { type: 'function', name: 'totalSupply', stateMutability: 'view', inputs: [], outputs: [{ name: '', type: 'uint256' }] },
  { type: 'function', name: 'ownerOf', stateMutability: 'view', inputs: [{ name: 'tokenId', type: 'uint256' }], outputs: [{ name: '', type: 'address' }] },
  { type: 'function', name: 'tokenURI', stateMutability: 'view', inputs: [{ name: 'tokenId', type: 'uint256' }], outputs: [{ name: '', type: 'string' }] },
  { type: 'function', name: 'mint', stateMutability: 'payable', inputs: [{ name: 'amount', type: 'uint256' }], outputs: [] },
];

const unknownAbi: AbiEntry[] = [
  { type: 'function', name: 'foo', stateMutability: 'view', inputs: [], outputs: [{ name: '', type: 'uint256' }] },
  { type: 'function', name: 'bar', stateMutability: 'nonpayable', inputs: [{ name: 'value', type: 'uint256' }], outputs: [] },
];

describe('analyzeContract', () => {
  test('separates read/write/dangerous methods and recommends token-dashboard for ERC20-like contracts', () => {
    const analysis = analyzeContract({
      abi: erc20Abi,
      contractAddress: '0x1234567890123456789012345678901234567890',
      contractName: 'Mock Token',
      chain: 'conflux-espace-testnet',
      requestedSkill: 'token-dashboard',
    });

    expect(analysis.contractType).toBe('token');
    expect(analysis.recommendedSkill).toBe('token-dashboard');
    expect(analysis.readMethods.map((method) => method.name)).toEqual(
      expect.arrayContaining(['name', 'symbol', 'decimals', 'totalSupply', 'balanceOf', 'allowance']),
    );
    expect(analysis.writeMethods.map((method) => method.name)).toEqual(
      expect.arrayContaining(['transfer', 'approve']),
    );
    expect(analysis.dangerousMethods.map((method) => method.name)).toContain('pause');
  });

  test('recommends nft-mint-page for mintable NFT contracts', () => {
    const analysis = analyzeContract({
      abi: nftMintAbi,
      contractAddress: '0x1234567890123456789012345678901234567890',
      contractName: 'Mock NFT',
      chain: 'conflux-espace-testnet',
      requestedSkill: 'nft-mint-page',
    });

    expect(analysis.contractType).toBe('nft');
    expect(analysis.recommendedSkill).toBe('nft-mint-page');
    expect(analysis.writeMethods.find((method) => method.name === 'mint')?.category).toBe('mint');
  });

  test('returns unknown when the ABI does not match a supported skill', () => {
    const analysis = analyzeContract({
      abi: unknownAbi,
      contractAddress: '0x1234567890123456789012345678901234567890',
      contractName: 'Mystery Contract',
      chain: 'conflux-espace-testnet',
      requestedSkill: 'claim-page',
    });

    expect(analysis.contractType).toBe('unknown');
    expect(analysis.recommendedSkill).toBe('unknown');
    expect(analysis.warnings.join(' ')).toMatch(/unknown|supported/i);
  });
});
