import express from 'express';
import { mkdtemp, rm } from 'node:fs/promises';
import { AddressInfo } from 'node:net';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { createTaskRouter } from '../server/routes/tasks';
import { runBuilderAgent } from '../server/services/agent.js';
import { createTaskStore } from '../server/services/task-store';
import type { BuilderTaskInput, BuilderTaskResult } from '../shared/schema';

vi.mock('../server/services/agent.js', () => ({
  runBuilderAgent: vi.fn(),
}));

const mockedRunBuilderAgent = vi.mocked(runBuilderAgent);
const cleanupPaths: string[] = [];

const request: BuilderTaskInput = {
  contractAddress: '0x1234567890123456789012345678901234567890',
  chain: 'conflux-espace-testnet',
  skill: 'token-dashboard',
  model: 'gpt-5.4',
  apiKey: 'secret-api-key',
};

const agentResult: BuilderTaskResult = {
  warnings: ['Wallet connection required.'],
  dangerousMethods: [],
  methods: [],
  sections: [],
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
  analysis: {
    contractType: 'token',
    skillMatch: true,
    recommendedSkills: ['token-dashboard'],
  },
  error: '',
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

describe('tasks API', () => {
  test('returns sanitized task payloads without leaking the submitted apiKey', async () => {
    const dataDir = await mkdtemp(join(tmpdir(), 'dapp-builder-api-'));
    cleanupPaths.push(dataDir);
    mockedRunBuilderAgent.mockResolvedValue(agentResult);

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
      expect(createdTask.id).toEqual(expect.any(String));
      expect(createdTask.status).toBe('queued');
      expect(createdTask.input).not.toHaveProperty('apiKey');
      expect(JSON.stringify(createdTask)).not.toContain('secret-api-key');

      const detail = await waitForTask(baseUrl, createdTask.id);

      expect(detail).toMatchObject({
        id: createdTask.id,
        status: 'completed',
        result: {
          pageConfig: {
            title: 'Mock Token Dashboard',
            chainId: 71,
          },
        },
      });
      expect(JSON.stringify(detail)).not.toContain('secret-api-key');
      expect(mockedRunBuilderAgent).toHaveBeenCalledWith(
        expect.objectContaining({ apiKey: 'secret-api-key' }),
      );
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
