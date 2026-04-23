import { readFile, mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { afterEach, describe, expect, test } from 'vitest';
import { createTaskStore } from '../server/services/task-store';
import type { BuilderTaskRequest, PageConfig } from '../shared/schema';

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

const pageConfig: PageConfig = {
  chainId: 71,
  rpcUrl: 'https://evmtestnet.confluxrpc.com',
  contractAddress: request.contractAddress,
  skill: 'claim-page',
  title: 'Mock Claim Page',
  sections: [],
  methods: [],
  warnings: ['This is a test warning.'],
};

describe('createTaskStore', () => {
  test('persists prompt-aligned task fields and does not save the API key', async () => {
    const dataDir = await mkdtemp(join(tmpdir(), 'dapp-builder-store-'));
    cleanupPaths.push(dataDir);

    const store = createTaskStore({ dataDir });
    const task = await store.createTask(request);

    expect(task.status).toBe('pending');
    expect(task.progress).toBe('pending');

    await store.updateTask(task.taskId, {
      status: 'success',
      progress: 'completed',
      summary: 'Claim page ready.',
      pageConfig,
      error: '',
    });

    const reloadedStore = createTaskStore({ dataDir });
    const savedTask = await reloadedStore.getTask(task.taskId);
    const rawFile = await readFile(join(dataDir, `${task.taskId}.json`), 'utf8');

    expect(savedTask?.status).toBe('success');
    expect(savedTask?.summary).toBe('Claim page ready.');
    expect(savedTask?.pageConfig?.title).toBe('Mock Claim Page');
    expect(rawFile).not.toContain('secret-api-key');
  });
});
