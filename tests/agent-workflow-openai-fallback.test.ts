import { execFile, execFileSync } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { runAgentGeneratedDappWorkflow } from '../server/services/agent-workflow';
import type { AnalyzeContractResult, BuilderTaskInput } from '../shared/schema';

vi.mock('node:child_process', () => ({
  execFile: vi.fn(),
  execFileSync: vi.fn(),
}));

const mockedExecFile = vi.mocked(execFile);
const mockedExecFileSync = vi.mocked(execFileSync);
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

beforeEach(() => {
  mockedExecFile.mockReset();
  mockedExecFileSync.mockReset();
  mockedExecFileSync.mockImplementation(() => {
    const error = new Error('not found') as NodeJS.ErrnoException;
    error.code = 'ENOENT';
    throw error;
  });
  mockedExecFile.mockImplementation((file, _args, _options, callback) => {
    const error = new Error(`spawn ${file} ENOENT`) as NodeJS.ErrnoException;
    error.code = 'ENOENT';
    callback?.(error, '', '');
    return {} as ReturnType<typeof execFile>;
  });
});

afterEach(async () => {
  vi.unstubAllGlobals();
  await Promise.all(cleanupPaths.splice(0).map((path) => rm(path, { recursive: true, force: true })));
});

describe('agent workflow OpenAI-compatible fallback', () => {
  test('uses the submitted model API when hermes-agent is not installed', async () => {
    const rootDir = await mkdtemp(join(tmpdir(), 'agent-workflow-openai-'));
    cleanupPaths.push(rootDir);
    const responses = [
      { role: 'product-manager', title: 'Token flow', markdown: '# Token flow\n\nFocus balance and transfers.' },
      { role: 'designer', title: 'Token workspace', markdown: '# Token workspace\n\nUse an asset-focused dashboard.' },
      {
        summary: 'Generated React token dashboard.',
        files: [
          { path: 'package.json', content: '{"type":"module","scripts":{"build":"vite build"}}' },
          { path: 'index.html', content: '<div id="root"></div><script type="module" src="/src/App.jsx"></script>' },
          { path: 'src/App.jsx', content: 'export default function App(){ return <main>Generated with API fallback</main>; }' },
        ],
      },
    ];
    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: JSON.stringify(responses.shift()) } }],
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
    expect(mockedExecFileSync).toHaveBeenCalledWith('which', ['hermes-agent'], { encoding: 'utf8' });
    expect(mockedExecFile).not.toHaveBeenCalled();
    expect(fetchMock).toHaveBeenCalledTimes(3);
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
    const responses = [
      { role: 'product-manager', title: 'Token flow', markdown: '# Token flow\n\nFocus balance and transfers.' },
      { role: 'designer', title: 'Token workspace', markdown: '# Token workspace\n\nUse an asset-focused dashboard.' },
      {
        summary: 'Generated React token dashboard.',
        files: [
          { path: 'package.json', content: '{"type":"module","scripts":{"build":"vite build"}}' },
          { path: 'index.html', content: '<div id="root"></div><script type="module" src="/src/App.jsx"></script>' },
          { path: 'src/App.jsx', content: 'export default function App(){ return <main>Generated after retry</main>; }' },
        ],
      },
    ];
    const fetchMock = vi
      .fn()
      .mockRejectedValueOnce(new TypeError('fetch failed'))
      .mockImplementation(async () => ({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: JSON.stringify(responses.shift()) } }],
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
    expect(fetchMock).toHaveBeenCalledTimes(4);
  });
});
