import { afterEach, describe, expect, test, vi } from 'vitest';
import { analyzeContract } from '../server/services/analyzer';
import { enhancePageConfigWithLlm } from '../server/services/llm';
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

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('enhancePageConfigWithLlm', () => {
  test('preserves deterministic warnings and sections when the LLM tries to blank them out', async () => {
    const analysis = analyzeContract({
      abi: stakingAbi,
      contractAddress: '0x1234567890123456789012345678901234567890',
      contractName: 'Mock Staking',
      chain: 'conflux-espace-testnet',
      requestedSkill: 'staking-page',
    });
    const basePageConfig = buildPageConfig(analysis);

    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          choices: [
            {
              message: {
                content: JSON.stringify({
                  title: 'Sharper staking console',
                  description: 'LLM-polished copy',
                  warnings: [],
                  sections: [],
                }),
              },
            },
          ],
        }),
      }),
    );

    const enhancedPageConfig = await enhancePageConfigWithLlm({
      apiKey: 'test-key',
      model: 'gpt-4.1-mini',
      analysis,
      pageConfig: basePageConfig,
    });

    expect(enhancedPageConfig).not.toBeNull();
    expect(enhancedPageConfig?.title).toBe('Sharper staking console');
    expect(enhancedPageConfig?.description).toBe('LLM-polished copy');
    expect(enhancedPageConfig?.warnings).toEqual(basePageConfig.warnings);
    expect(enhancedPageConfig?.sections).toEqual(basePageConfig.sections);
  });
});
