import { describe, expect, test } from 'vitest';
import { analyzeContract } from '../server/services/analyzer';
import type { AbiEntry } from '../shared/schema';

const erc20Abi: AbiEntry[] = [
  { type: 'function', name: 'name', stateMutability: 'view', inputs: [], outputs: [{ name: '', type: 'string' }] },
  { type: 'function', name: 'symbol', stateMutability: 'view', inputs: [], outputs: [{ name: '', type: 'string' }] },
  { type: 'function', name: 'decimals', stateMutability: 'view', inputs: [], outputs: [{ name: '', type: 'uint8' }] },
  { type: 'function', name: 'totalSupply', stateMutability: 'view', inputs: [], outputs: [{ name: '', type: 'uint256' }] },
  { type: 'function', name: 'balanceOf', stateMutability: 'view', inputs: [{ name: 'account', type: 'address' }], outputs: [{ name: '', type: 'uint256' }] },
  { type: 'function', name: 'transfer', stateMutability: 'nonpayable', inputs: [{ name: 'to', type: 'address' }, { name: 'amount', type: 'uint256' }], outputs: [{ name: '', type: 'bool' }] },
  { type: 'function', name: 'approve', stateMutability: 'nonpayable', inputs: [{ name: 'spender', type: 'address' }, { name: 'amount', type: 'uint256' }], outputs: [{ name: '', type: 'bool' }] },
  { type: 'function', name: 'pause', stateMutability: 'nonpayable', inputs: [], outputs: [] },
];

const nftMintAbi: AbiEntry[] = [
  { type: 'function', name: 'ownerOf', stateMutability: 'view', inputs: [{ name: 'tokenId', type: 'uint256' }], outputs: [{ name: '', type: 'address' }] },
  { type: 'function', name: 'tokenURI', stateMutability: 'view', inputs: [{ name: 'tokenId', type: 'uint256' }], outputs: [{ name: '', type: 'string' }] },
  { type: 'function', name: 'mint', stateMutability: 'payable', inputs: [{ name: 'amount', type: 'uint256' }], outputs: [] },
  { type: 'function', name: 'safeMint', stateMutability: 'nonpayable', inputs: [{ name: 'to', type: 'address' }], outputs: [] },
];

const claimAbi: AbiEntry[] = [
  { type: 'function', name: 'claim', stateMutability: 'nonpayable', inputs: [{ name: 'amount', type: 'uint256' }, { name: 'proof', type: 'bytes32[]' }], outputs: [] },
  { type: 'function', name: 'isClaimed', stateMutability: 'view', inputs: [{ name: 'account', type: 'address' }], outputs: [{ name: '', type: 'bool' }] },
  { type: 'function', name: 'setMerkleRoot', stateMutability: 'nonpayable', inputs: [{ name: 'root', type: 'bytes32' }], outputs: [] },
];

const stakingAbi: AbiEntry[] = [
  { type: 'function', name: 'stake', stateMutability: 'nonpayable', inputs: [{ name: 'amount', type: 'uint256' }], outputs: [] },
  { type: 'function', name: 'unstake', stateMutability: 'nonpayable', inputs: [{ name: 'amount', type: 'uint256' }], outputs: [] },
  { type: 'function', name: 'claimRewards', stateMutability: 'nonpayable', inputs: [], outputs: [] },
  { type: 'function', name: 'earned', stateMutability: 'view', inputs: [{ name: 'account', type: 'address' }], outputs: [{ name: '', type: 'uint256' }] },
  { type: 'function', name: 'upgradeTo', stateMutability: 'nonpayable', inputs: [{ name: 'implementation', type: 'address' }], outputs: [] },
];

describe('analyzeContract', () => {
  test('matches token-dashboard for ERC20-like contracts', () => {
    const analysis = analyzeContract({
      abi: erc20Abi,
      contractAddress: '0x1234567890123456789012345678901234567890',
      contractName: 'Mock Token',
      chain: 'conflux-espace-testnet',
      requestedSkill: 'token-dashboard',
    });

    expect(analysis.contractType).toBe('token');
    expect(analysis.skillMatch).toBe(true);
    expect(analysis.recommendedSkills).toContain('token-dashboard');
    expect(analysis.dangerousMethods.map((method) => method.name)).toContain('pause');
  });

  test('matches nft-mint-page for mintable NFT contracts', () => {
    const analysis = analyzeContract({
      abi: nftMintAbi,
      contractAddress: '0x1234567890123456789012345678901234567890',
      contractName: 'Mock NFT',
      chain: 'conflux-espace-testnet',
      requestedSkill: 'nft-mint-page',
    });

    expect(analysis.contractType).toBe('nft');
    expect(analysis.skillMatch).toBe(true);
    expect(analysis.recommendedSkills).toContain('nft-mint-page');
    expect(analysis.methods.find((method) => method.name === 'mint')?.category).toBe('mint');
  });

  test('matches claim-page and flags admin claim controls', () => {
    const analysis = analyzeContract({
      abi: claimAbi,
      contractAddress: '0x1234567890123456789012345678901234567890',
      contractName: 'Mock Claim',
      chain: 'conflux-espace-testnet',
      requestedSkill: 'claim-page',
    });

    expect(analysis.contractType).toBe('claim');
    expect(analysis.skillMatch).toBe(true);
    expect(analysis.recommendedSkills).toContain('claim-page');
    expect(analysis.dangerousMethods.map((method) => method.name)).toContain('setMerkleRoot');
  });

  test('matches staking-page and detects upgrade methods as dangerous', () => {
    const analysis = analyzeContract({
      abi: stakingAbi,
      contractAddress: '0x1234567890123456789012345678901234567890',
      contractName: 'Mock Staking',
      chain: 'conflux-espace-testnet',
      requestedSkill: 'staking-page',
    });

    expect(analysis.contractType).toBe('staking');
    expect(analysis.skillMatch).toBe(true);
    expect(analysis.recommendedSkills).toContain('staking-page');
    expect(analysis.dangerousMethods.map((method) => method.name)).toContain('upgradeTo');
  });

  test('returns a mismatch warning when requested skill does not fit the ABI', () => {
    const analysis = analyzeContract({
      abi: erc20Abi,
      contractAddress: '0x1234567890123456789012345678901234567890',
      contractName: 'Mock Token',
      chain: 'conflux-espace-testnet',
      requestedSkill: 'claim-page',
    });

    expect(analysis.skillMatch).toBe(false);
    expect(analysis.warnings.join(' ')).toMatch(/skill/i);
    expect(analysis.recommendedSkills).toContain('token-dashboard');
  });
});
