import { mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { afterEach, describe, expect, test, vi } from 'vitest';
import { createTaskService } from '../server/services/task-service';
import { createTaskStore } from '../server/services/task-store';
import type { AgentRunResult, BuilderTaskRequest } from '../shared/schema';

const cleanupPaths: string[] = [];

afterEach(async () => {
  await Promise.all(cleanupPaths.splice(0).map((path) => rm(path, { recursive: true, force: true })));
});

const request: BuilderTaskRequest = {
  contractAddress: '0x1234567890123456789012345678901234567890',
  chainId: 71,
  skill: 'claim-page',
  model: 'gpt-5.4',
  apiKey: 'secret-api-key',
};

const agentResult: AgentRunResult = {
  summary: 'Claim page ready.',
  contractAnalysis: {
    contractType: 'claim',
    recommendedSkill: 'claim-page',
    readMethods: [],
    writeMethods: [],
    dangerousMethods: [{
      name: 'setMerkleRoot',
      label: 'Set Merkle Root',
      type: 'write',
      dangerLevel: 'danger',
      stateMutability: 'nonpayable',
      inputs: [{ name: 'root', type: 'bytes32' }],
      outputs: [],
      description: 'Administrative method.',
    }],
    warnings: ['Admin method detected.'],
  },
  pageConfig: {
    chainId: 71,
    rpcUrl: 'https://evmtestnet.confluxrpc.com',
    contractAddress: request.contractAddress,
    skill: 'claim-page',
    title: 'Mock Claim Page',
    sections: [],
    methods: [],
    warnings: ['Admin method detected.'],
  },
  status: 'success',
  error: '',
};

describe('createTaskService', () => {
  test('creates pending tasks and stores success output after staged execution', async () => {
    const dataDir = await mkdtemp(join(tmpdir(), 'dapp-builder-task-service-'));
    cleanupPaths.push(dataDir);

    const taskStore = createTaskStore({ dataDir });
    const agentRunner = vi.fn(async (_request, context) => {
      await context.onProgress('fetching_abi');
      await context.onProgress('analyzing_contract');
      await context.onProgress('generating_page_config');
      return agentResult;
    });

    const taskService = createTaskService({ taskStore, agentRunner });
    const createdTask = await taskService.createTask(request);

    expect(createdTask).toEqual({
      taskId: expect.any(String),
      status: 'pending',
    });

    await taskService.runTask(createdTask.taskId, request);

    const detail = await taskService.getTask(createdTask.taskId);
    expect(detail).toMatchObject({
      taskId: createdTask.taskId,
      status: 'success',
      progress: 'completed',
      summary: 'Claim page ready.',
      pageConfig: {
        title: 'Mock Claim Page',
      },
      error: '',
    });
    expect(agentRunner).toHaveBeenCalledWith(
      expect.objectContaining({ apiKey: 'secret-api-key' }),
      expect.objectContaining({ onProgress: expect.any(Function) }),
    );
  });
});
