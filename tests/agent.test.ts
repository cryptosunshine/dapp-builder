import { beforeEach, describe, expect, test, vi } from 'vitest';
import { runBuilderAgent } from '../server/services/agent';
import { fetchContractMetadata } from '../server/services/abi.js';
import { runAgentGeneratedDappWorkflow } from '../server/services/agent-workflow.js';
import type { AbiEntry, GeneratedAppArtifact } from '../shared/schema';

vi.mock('../server/services/abi.js', () => ({
  fetchContractMetadata: vi.fn(),
}));

vi.mock('../server/services/agent-workflow.js', () => ({
  runAgentGeneratedDappWorkflow: vi.fn(),
}));

vi.mock('../server/services/llm.js', () => ({
  enhancePageConfigWithLlm: vi.fn().mockResolvedValue(null),
}));

const mockedFetchContractMetadata = vi.mocked(fetchContractMetadata);
const mockedRunAgentGeneratedDappWorkflow = vi.mocked(runAgentGeneratedDappWorkflow);

const tokenAbi: AbiEntry[] = [
  { type: 'function', name: 'name', stateMutability: 'view', inputs: [], outputs: [{ name: '', type: 'string' }] },
  { type: 'function', name: 'balanceOf', stateMutability: 'view', inputs: [{ name: 'account', type: 'address' }], outputs: [{ name: '', type: 'uint256' }] },
  { type: 'function', name: 'transfer', stateMutability: 'nonpayable', inputs: [{ name: 'to', type: 'address' }, { name: 'amount', type: 'uint256' }], outputs: [{ name: '', type: 'bool' }] },
];

beforeEach(() => {
  mockedFetchContractMetadata.mockReset();
  mockedRunAgentGeneratedDappWorkflow.mockReset();
});

describe('runBuilderAgent', () => {
  const generatedApp: GeneratedAppArtifact = {
    taskId: 'task-agent',
    sourceDir: 'data/generated-dapps/task-agent/source',
    distDir: 'data/generated-dapps/task-agent/dist',
    previewUrl: '/generated-dapps/task-agent/dist/index.html',
    buildStatus: 'success',
    productPlan: {
      role: 'product-manager',
      title: 'Token product flow',
      markdown: '# Token product flow',
    },
    designSpec: {
      role: 'designer',
      title: 'Token dashboard design',
      markdown: '# Token dashboard design',
    },
    frontendSummary: 'Generated React token dashboard.',
    validationWarnings: [],
  };

  test('uses the multi-stage agent workflow to generate a React dApp artifact after ABI analysis', async () => {
    mockedFetchContractMetadata.mockResolvedValue({ abi: tokenAbi, contractName: 'MockToken', metadata: undefined });
    mockedRunAgentGeneratedDappWorkflow.mockResolvedValue(generatedApp);
    const progressUpdates: string[] = [];

    const result = await runBuilderAgent({
      contractAddress: '0x1234567890123456789012345678901234567890',
      chain: 'conflux-espace-testnet',
      skill: 'token-dashboard',
      model: 'gpt-5.4',
      apiKey: '',
    }, {
      taskId: 'task-agent',
      generatedAppsDir: 'data/generated-dapps',
      onProgress: (progress) => {
        progressUpdates.push(progress);
      },
    });

    expect(mockedRunAgentGeneratedDappWorkflow).toHaveBeenCalledWith(
      expect.objectContaining({
        taskId: 'task-agent',
        rootDir: 'data/generated-dapps',
        abi: tokenAbi,
        analysis: expect.objectContaining({ contractType: 'token' }),
      }),
    );
    expect(progressUpdates).toContain('fetching_abi');
    expect(progressUpdates).toContain('analyzing_contract');
    expect(result.summary).toBe('Generated React token dashboard.');
    expect(result.generatedApp?.previewUrl).toBe('/generated-dapps/task-agent/dist/index.html');
    expect(result.methods.map((method) => method.name)).toEqual(expect.arrayContaining(['balanceOf', 'transfer']));
  });

  test('passes capabilities and selected skills into the agent workflow', async () => {
    mockedFetchContractMetadata.mockResolvedValue({ abi: tokenAbi, contractName: 'MockToken', metadata: undefined });
    mockedRunAgentGeneratedDappWorkflow.mockResolvedValue(generatedApp);

    const result = await runBuilderAgent({
      contractAddress: '0x1234567890123456789012345678901234567890',
      chain: 'conflux-espace-testnet',
      skills: ['token-dashboard', 'guided-flow', 'transaction-timeline'],
      skill: 'token-dashboard',
      model: 'gpt-5.4',
      apiKey: '',
      modelConfig: {
        baseUrl: 'https://api.openai.com/v1',
        model: 'gpt-5.4',
        apiKey: '',
      },
    }, {
      taskId: 'task-agent',
      generatedAppsDir: 'data/generated-dapps',
    });

    expect(result.generatedApp?.productPlan.title).toBe('Token product flow');
    expect(mockedRunAgentGeneratedDappWorkflow).toHaveBeenCalledWith(
      expect.objectContaining({
        capabilities: expect.objectContaining({ kind: 'token' }),
        normalizedSkills: expect.objectContaining({
          skills: expect.arrayContaining(['token-dashboard', 'guided-flow', 'transaction-timeline']),
        }),
      }),
    );
  });
});
