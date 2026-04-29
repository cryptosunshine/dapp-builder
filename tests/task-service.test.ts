import express from 'express';
import { readFile, mkdtemp, rm } from 'node:fs/promises';
import { AddressInfo } from 'node:net';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { createTaskRouter } from '../server/routes/tasks';
import { runBuilderAgent } from '../server/services/agent.js';
import { createTaskStore } from '../server/services/task-store';
import type { BuilderTaskInput } from '../shared/schema';

vi.mock('../server/services/agent.js', () => ({
  runBuilderAgent: vi.fn(),
}));

const mockedRunBuilderAgent = vi.mocked(runBuilderAgent);
const cleanupPaths: string[] = [];

const request: BuilderTaskInput = {
  contractAddress: '0x1234567890123456789012345678901234567890',
  chain: 'conflux-espace-testnet',
  skill: 'claim-page',
  model: 'gpt-5.4',
  apiKey: 'secret-api-key',
};

beforeEach(() => {
  mockedRunBuilderAgent.mockReset();
});

afterEach(async () => {
  await Promise.all(cleanupPaths.splice(0).map((path) => rm(path, { recursive: true, force: true })));
});

async function createServer(dataDir: string) {
  const app = express();
  const taskStore = createTaskStore({ dataDir });

  app.use(express.json({ limit: '1mb' }));
  app.use('/api/tasks', createTaskRouter({ taskStore }));
  app.use((error: Error, _request: express.Request, response: express.Response, _next: express.NextFunction) => {
    response.status(500).json({ message: error.message || 'Internal server error' });
  });

  return app.listen(0);
}

async function waitForTask(baseUrl: string, taskId: string) {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const response = await fetch(`${baseUrl}/api/tasks/${taskId}`);
    const payload = await response.json();
    if (payload.status === 'completed' || payload.status === 'failed') {
      return payload;
    }
    await new Promise((resolve) => setTimeout(resolve, 20));
  }

  throw new Error('Timed out waiting for task completion.');
}

describe('task execution failure handling', () => {
  test('stores failed task output without persisting or returning the apiKey', async () => {
    const dataDir = await mkdtemp(join(tmpdir(), 'dapp-builder-task-failure-'));
    cleanupPaths.push(dataDir);
    mockedRunBuilderAgent.mockRejectedValue(new Error('agent exploded'));

    const server = await createServer(dataDir);

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
      expect(createdTask.input).not.toHaveProperty('apiKey');
      expect(JSON.stringify(createdTask)).not.toContain('secret-api-key');

      const detail = await waitForTask(baseUrl, createdTask.id);
      const rawFile = await readFile(join(dataDir, `${createdTask.id}.json`), 'utf8');

      expect(detail).toMatchObject({
        id: createdTask.id,
        status: 'failed',
        error: 'agent exploded',
      });
      expect(JSON.stringify(detail)).not.toContain('secret-api-key');
      expect(rawFile).not.toContain('secret-api-key');
    } finally {
      await new Promise<void>((resolve, reject) => {
        server.close((error) => {
          if (error) reject(error);
          else resolve();
        });
      });
    }
  });

  test('redacts command failures before storing task errors', async () => {
    const dataDir = await mkdtemp(join(tmpdir(), 'dapp-builder-task-command-failure-'));
    cleanupPaths.push(dataDir);
    mockedRunBuilderAgent.mockRejectedValue(
      new Error(
        'Command failed: /usr/local/bin/model-runner --query=Frontend agent very long prompt --api_key=secret-api-key',
      ),
    );

    const server = await createServer(dataDir);

    try {
      const address = server.address() as AddressInfo;
      const baseUrl = `http://127.0.0.1:${address.port}`;

      const createResponse = await fetch(`${baseUrl}/api/tasks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(request),
      });
      const createdTask = await createResponse.json();
      const detail = await waitForTask(baseUrl, createdTask.id);
      const rawFile = await readFile(join(dataDir, `${createdTask.id}.json`), 'utf8');

      expect(detail.error).toBe('Agent runtime command failed. Check server logs for details.');
      expect(JSON.stringify(detail)).not.toContain('secret-api-key');
      expect(JSON.stringify(detail)).not.toContain('--query=');
      expect(rawFile).not.toContain('secret-api-key');
      expect(rawFile).not.toContain('--query=');
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
