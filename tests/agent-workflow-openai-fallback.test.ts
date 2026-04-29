import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { runAgentGeneratedDappWorkflow } from '../server/services/agent-workflow';
import type { AnalyzeContractResult, BuilderTaskInput } from '../shared/schema';

const cleanupPaths: string[] = [];

const input: BuilderTaskInput = {
  contractAddress: '0x1234567890123456789012345678901234567890',
  chain: 'conflux-espace-testnet',
  skill: 'token-dashboard',
  skills: ['token-dashboard'],
  model: 'gpt-5.4',
  apiKey: 'secret-key',
  modelConfig: {
    baseUrl: 'https://api.openai.com/v1',
    model: 'gpt-5.4',
    apiKey: 'secret-key',
  },
};

const analysis: AnalyzeContractResult = {
  contractAddress: input.contractAddress,
  contractName: 'MockToken',
  chain: 'conflux-espace-testnet',
  requestedSkill: 'token-dashboard',
  contractType: 'token',
  skillMatch: true,
  recommendedSkills: ['token-dashboard'],
  methods: [],
  dangerousMethods: [],
  warnings: [],
};

function generatedReactApp(content: string) {
  return {
    summary: 'Generated React token dashboard.',
    files: [
      { path: 'index.html', content: '<div id="root"></div><script type="module" src="/src/App.jsx"></script>' },
      { path: 'src/App.jsx', content: `import './styles.css'; export default function App(){ return <main>${content}</main>; }` },
      { path: 'src/styles.css', content: 'main { color: #111827; }' },
    ],
  };
}

beforeEach(() => {
  vi.unstubAllGlobals();
});

afterEach(async () => {
  vi.unstubAllGlobals();
  await Promise.all(cleanupPaths.splice(0).map((path) => rm(path, { recursive: true, force: true })));
});

describe('agent workflow OpenAI-compatible fallback', () => {
  test('uses the submitted model API directly when model credentials are provided', async () => {
    const rootDir = await mkdtemp(join(tmpdir(), 'agent-workflow-openai-preferred-'));
    cleanupPaths.push(rootDir);
    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => ({
        choices: [{
          message: {
            content: JSON.stringify(generatedReactApp('Generated with direct model API')),
          },
        }],
      }),
    }));
    vi.stubGlobal('fetch', fetchMock);

    const artifact = await runAgentGeneratedDappWorkflow({
      taskId: 'task-openai-preferred',
      rootDir,
      input,
      abi: [],
      analysis,
      capabilities: { kind: 'token', confidence: 0.9, primitives: [], unsupported: [] },
      normalizedSkills: { skills: ['token-dashboard'], businessSkills: ['token-dashboard'], walletSkills: [], experienceSkills: [], diagnostics: [] },
      build: false,
    });

    expect(artifact.frontendSummary).toBe('Generated React token dashboard.');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  test('sends the frontend generation request to the submitted model API', async () => {
    const rootDir = await mkdtemp(join(tmpdir(), 'agent-workflow-openai-'));
    cleanupPaths.push(rootDir);
    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => ({
        choices: [{
          message: {
            content: JSON.stringify(generatedReactApp('Generated with API fallback')),
          },
        }],
      }),
    }));
    vi.stubGlobal('fetch', fetchMock);

    const artifact = await runAgentGeneratedDappWorkflow({
      taskId: 'task-openai-fallback',
      rootDir,
      input,
      abi: [],
      analysis,
      capabilities: { kind: 'token', confidence: 0.9, primitives: [], unsupported: [] },
      normalizedSkills: { skills: ['token-dashboard'], businessSkills: ['token-dashboard'], walletSkills: [], experienceSkills: [], diagnostics: [] },
      build: false,
    });

    expect(artifact.frontendSummary).toBe('Generated React token dashboard.');
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.openai.com/v1/chat/completions',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({ Authorization: 'Bearer secret-key' }),
      }),
    );
  });

  test('retries transient model API fetch failures before failing the task', async () => {
    const rootDir = await mkdtemp(join(tmpdir(), 'agent-workflow-openai-retry-'));
    cleanupPaths.push(rootDir);
    const fetchMock = vi
      .fn()
      .mockRejectedValueOnce(new TypeError('fetch failed'))
      .mockImplementation(async () => ({
        ok: true,
        json: async () => ({
          choices: [{
            message: {
              content: JSON.stringify(generatedReactApp('Generated after retry')),
            },
          }],
        }),
      }));
    vi.stubGlobal('fetch', fetchMock);

    const artifact = await runAgentGeneratedDappWorkflow({
      taskId: 'task-openai-retry',
      rootDir,
      input,
      abi: [],
      analysis,
      capabilities: { kind: 'token', confidence: 0.9, primitives: [], unsupported: [] },
      normalizedSkills: { skills: ['token-dashboard'], businessSkills: ['token-dashboard'], walletSkills: [], experienceSkills: [], diagnostics: [] },
      build: false,
    });

    expect(artifact.frontendSummary).toBe('Generated React token dashboard.');
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
