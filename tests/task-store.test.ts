import { mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { afterEach, describe, expect, test } from 'vitest';
import { createTaskStore } from '../server/services/task-store';
import type { BuilderTaskInput, PageConfig } from '../shared/schema';

const cleanupPaths: string[] = [];

afterEach(async () => {
  await Promise.all(cleanupPaths.splice(0).map((path) => rm(path, { recursive: true, force: true })));
});

const input: BuilderTaskInput = {
  contractAddress: '0x1234567890123456789012345678901234567890',
  chain: 'conflux-espace-testnet',
  skill: 'claim-page',
  model: 'gpt-5.4',
  apiKey: 'test-key',
};

const pageConfig: PageConfig = {
  title: 'Mock Claim Page',
  description: 'Claim your rewards',
  chain: 'conflux-espace-testnet',
  chainId: 71,
  contractAddress: input.contractAddress,
  contractName: 'Mock Claim',
  skill: 'claim-page',
  warnings: ['This is a test warning.'],
  dangerousMethods: [],
  methods: [],
  sections: [],
};

describe('createTaskStore', () => {
  test('persists created and updated tasks to disk', async () => {
    const dataDir = await mkdtemp(join(tmpdir(), 'dapp-builder-store-'));
    cleanupPaths.push(dataDir);

    const store = createTaskStore({ dataDir });
    const task = await store.createTask(input);

    expect(task.status).toBe('queued');

    await store.updateTask(task.id, {
      status: 'completed',
      result: {
        pageConfig,
        warnings: pageConfig.warnings,
        dangerousMethods: [],
        methods: [],
        sections: [],
      },
    });

    const reloadedStore = createTaskStore({ dataDir });
    const savedTask = await reloadedStore.getTask(task.id);

    expect(savedTask?.status).toBe('completed');
    expect(savedTask?.result?.pageConfig.title).toBe('Mock Claim Page');
  });
});
