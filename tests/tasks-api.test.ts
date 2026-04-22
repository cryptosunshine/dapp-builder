import { mkdtemp, rm } from 'node:fs/promises';
import { AddressInfo } from 'node:net';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { afterEach, describe, expect, test } from 'vitest';
import { createApp } from '../server/app';
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
  skill: 'token-dashboard',
  model: 'gpt-5.4',
  apiKey: 'secret-api-key',
};

const agentResult: AgentRunResult = {
  summary: 'Token dashboard ready.',
  contractAnalysis: {
    contractType: 'token',
    recommendedSkill: 'token-dashboard',
    readMethods: [],
    writeMethods: [],
    dangerousMethods: [],
    warnings: ['Wallet connection required.'],
  },
  pageConfig: {
    chainId: 71,
    rpcUrl: 'https://evmtestnet.confluxrpc.com',
    contractAddress: request.contractAddress,
    skill: 'token-dashboard',
    title: 'Mock Token Dashboard',
    sections: [],
    methods: [],
    warnings: ['Wallet connection required.'],
  },
  status: 'success',
  error: '',
};

async function waitForTask(baseUrl: string, taskId: string) {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const response = await fetch(`${baseUrl}/api/tasks/${taskId}`);
    const payload = await response.json();
    if (payload.status === 'success' || payload.status === 'failed') {
      return payload;
    }
    await new Promise((resolve) => setTimeout(resolve, 20));
  }

  throw new Error('Timed out waiting for task completion.');
}

describe('tasks API', () => {
  test('returns prompt-aligned create/detail payloads', async () => {
    const dataDir = await mkdtemp(join(tmpdir(), 'dapp-builder-api-'));
    cleanupPaths.push(dataDir);

    const taskService = createTaskService({
      taskStore: createTaskStore({ dataDir }),
      agentRunner: async (_request, context) => {
        await context.onProgress('fetching_abi');
        await context.onProgress('analyzing_contract');
        await context.onProgress('generating_page_config');
        return agentResult;
      },
    });

    const app = createApp({ taskService });
    const server = app.listen(0);

    try {
      const address = server.address() as AddressInfo;
      const baseUrl = `http://127.0.0.1:${address.port}`;

      const createResponse = await fetch(`${baseUrl}/api/tasks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(request),
      });
      const createdTask = await createResponse.json();

      expect(createResponse.status).toBe(202);
      expect(createdTask).toEqual({
        taskId: expect.any(String),
        status: 'pending',
      });

      const detail = await waitForTask(baseUrl, createdTask.taskId);
      expect(detail).toMatchObject({
        taskId: createdTask.taskId,
        status: 'success',
        progress: 'completed',
        summary: 'Token dashboard ready.',
        pageConfig: {
          title: 'Mock Token Dashboard',
          chainId: 71,
        },
        error: '',
      });
      expect(JSON.stringify(detail)).not.toContain('secret-api-key');
    } finally {
      await new Promise<void>((resolve, reject) => {
        server.close((error) => {
          if (error) reject(error);
          else resolve();
        });
      });
    }
  });
});
