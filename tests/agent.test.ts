import { beforeEach, describe, expect, test, vi } from 'vitest';
import { runBuilderAgent } from '../server/services/agent';
import { fetchContractMetadata } from '../server/services/abi.js';
import { runHermesAgentGeneration } from '../server/services/hermes-agent.js';
import type { AgentRunResult, AbiEntry } from '../shared/schema';

vi.mock('../server/services/abi.js', () => ({
  fetchContractMetadata: vi.fn(),
}));

vi.mock('../server/services/hermes-agent.js', () => ({
  runHermesAgentGeneration: vi.fn(),
}));

vi.mock('../server/services/llm.js', () => ({
  enhancePageConfigWithLlm: vi.fn().mockResolvedValue(null),
}));

const mockedFetchContractMetadata = vi.mocked(fetchContractMetadata);
const mockedRunHermesAgentGeneration = vi.mocked(runHermesAgentGeneration);

const tokenAbi: AbiEntry[] = [
  { type: 'function', name: 'name', stateMutability: 'view', inputs: [], outputs: [{ name: '', type: 'string' }] },
  { type: 'function', name: 'balanceOf', stateMutability: 'view', inputs: [{ name: 'account', type: 'address' }], outputs: [{ name: '', type: 'uint256' }] },
  { type: 'function', name: 'transfer', stateMutability: 'nonpayable', inputs: [{ name: 'to', type: 'address' }, { name: 'amount', type: 'uint256' }], outputs: [{ name: '', type: 'bool' }] },
];

beforeEach(() => {
  mockedFetchContractMetadata.mockReset();
  mockedRunHermesAgentGeneration.mockReset();
});

describe('runBuilderAgent', () => {
  test('uses hermes-agent generated page output after deterministic ABI analysis', async () => {
    mockedFetchContractMetadata.mockResolvedValue({ abi: tokenAbi, contractName: 'MockToken', metadata: undefined });
    mockedRunHermesAgentGeneration.mockImplementation(async ({ deterministicPageConfig }): Promise<AgentRunResult> => ({
      summary: 'Hermes generated the final dApp page.',
      contractAnalysis: {
        contractType: 'token',
        recommendedSkill: 'token-dashboard',
        readMethods: [],
        writeMethods: [],
        dangerousMethods: [],
        warnings: deterministicPageConfig.warnings,
      },
      pageConfig: {
        ...deterministicPageConfig,
        title: 'Hermes Generated Token App',
        description: 'Real agent generated page output',
      },
      status: 'success',
      error: '',
    }));

    const result = await runBuilderAgent({
      contractAddress: '0x1234567890123456789012345678901234567890',
      chain: 'conflux-espace-testnet',
      skill: 'token-dashboard',
      model: 'gpt-5.4',
      apiKey: '',
    });

    expect(mockedRunHermesAgentGeneration).toHaveBeenCalledWith(
      expect.objectContaining({
        abi: tokenAbi,
        deterministicPageConfig: expect.objectContaining({ title: expect.any(String) }),
      }),
    );
    expect(result.summary).toBe('Hermes generated the final dApp page.');
    expect(result.pageConfig.title).toBe('Hermes Generated Token App');
    expect(result.pageConfig.description).toBe('Real agent generated page output');
    expect(result.methods.map((method) => method.name)).toEqual(expect.arrayContaining(['balanceOf', 'transfer']));
  });
});
