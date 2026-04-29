import { readFile, mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { afterEach, describe, expect, test } from 'vitest';
import { createTaskStore } from '../server/services/task-store';
import type { BuilderTaskInput } from '../shared/schema';

const cleanupPaths: string[] = [];

afterEach(async () => {
  await Promise.all(cleanupPaths.splice(0).map((path) => rm(path, { recursive: true, force: true })));
});

const request: BuilderTaskInput = {
  contractAddress: '0x1234567890123456789012345678901234567890',
  chain: 'conflux-espace-testnet',
  skill: 'claim-page',
  model: 'gpt-5.4',
  apiKey: 'secret-api-key',
};

describe('createTaskStore', () => {
  test('redacts the API key from created, loaded, listed, and persisted tasks', async () => {
    const dataDir = await mkdtemp(join(tmpdir(), 'dapp-builder-store-'));
    cleanupPaths.push(dataDir);

    const store = createTaskStore({ dataDir });
    const task = await store.createTask(request);
    const taskId = task.id;

    expect(taskId).toEqual(expect.any(String));
    expect(task.status).toBe('queued');
    expect(task.input).not.toHaveProperty('apiKey');
    expect(JSON.stringify(task)).not.toContain('secret-api-key');

    const savedTask = await store.getTask(taskId!);
    const listedTasks = await store.listTasks();
    const rawFile = await readFile(join(dataDir, `${taskId}.json`), 'utf8');

    expect(savedTask?.input).not.toHaveProperty('apiKey');
    expect(JSON.stringify(listedTasks)).not.toContain('secret-api-key');
    expect(rawFile).not.toContain('secret-api-key');
  });

  test('does not persist modelConfig apiKey', async () => {
    const dataDir = await mkdtemp(join(tmpdir(), 'dapp-builder-store-'));
    cleanupPaths.push(dataDir);

    const store = createTaskStore({ dataDir });
    const task = await store.createTask({
      contractAddress: '0x1234567890123456789012345678901234567890',
      chain: 'conflux-espace-testnet',
      skills: ['auto', 'explorer-links'],
      skill: 'auto',
      model: 'gpt-5.4',
      apiKey: 'legacy-secret',
      modelConfig: {
        baseUrl: 'https://api.openai.com/v1',
        model: 'gpt-5.4',
        apiKey: 'model-secret',
      },
    });

    const persisted = await store.getTask(task.id!);
    expect(JSON.stringify(persisted)).not.toContain('model-secret');
    expect(JSON.stringify(persisted)).not.toContain('legacy-secret');
    expect(persisted?.input).toMatchObject({
      skills: ['auto', 'explorer-links'],
      modelConfig: { baseUrl: 'https://api.openai.com/v1', model: 'gpt-5.4' },
    });
  });

  test('persists generation progress and summary updates', async () => {
    const dataDir = await mkdtemp(join(tmpdir(), 'dapp-builder-store-'));
    cleanupPaths.push(dataDir);

    const store = createTaskStore({ dataDir });
    const task = await store.createTask(request);

    await store.updateTask(task.id!, {
      status: 'processing',
      progress: 'frontend_generation',
      summary: 'Frontend agent is generating the React dApp source.',
    });

    const persisted = await store.getTask(task.id!);
    expect(persisted).toMatchObject({
      status: 'processing',
      progress: 'frontend_generation',
      summary: 'Frontend agent is generating the React dApp source.',
    });
  });
});
