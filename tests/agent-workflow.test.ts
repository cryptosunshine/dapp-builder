import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, test, vi } from 'vitest';
import { runAgentGeneratedDappWorkflow } from '../server/services/agent-workflow';
import type { AbiEntry, AnalyzeContractResult, BuilderTaskInput } from '../shared/schema';

const cleanupPaths: string[] = [];

afterEach(async () => {
  await Promise.all(cleanupPaths.splice(0).map((path) => rm(path, { recursive: true, force: true })));
});

const input: BuilderTaskInput = {
  contractAddress: '0x1234567890123456789012345678901234567890',
  chain: 'conflux-espace-testnet',
  skill: 'token-dashboard',
  skills: ['token-dashboard'],
  model: 'gpt-5.4',
  apiKey: 'secret-key',
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

describe('agent generated dApp workflow', () => {
  test('runs a single frontend agent stage and stores the generated React app', async () => {
    const rootDir = await mkdtemp(join(tmpdir(), 'agent-workflow-'));
    cleanupPaths.push(rootDir);
    const seenStages: string[] = [];
    const progress = vi.fn();

    const artifact = await runAgentGeneratedDappWorkflow({
      taskId: 'task-agent',
      rootDir,
      input,
      abi: [],
      analysis,
      capabilities: { kind: 'token', confidence: 0.9, primitives: [], unsupported: [] },
      normalizedSkills: { skills: ['token-dashboard'], businessSkills: ['token-dashboard'], walletSkills: [], experienceSkills: [], diagnostics: [] },
      onProgress: progress,
      build: false,
      invokeAgent: async ({ stage }) => {
        seenStages.push(stage);
        return {
          summary: 'Generated React token dashboard.',
          files: [
            { path: 'index.html', content: '<div id="root"></div><script type="module" src="/src/App.jsx"></script>' },
            { path: 'src/App.jsx', content: "import './styles.css'; export default function App(){ return <main>Agent token dashboard</main>; }" },
            { path: 'src/styles.css', content: 'main { color: #111827; }' },
          ],
        };
      },
    });

    expect(seenStages).toEqual(['frontend_generation']);
    expect(progress).not.toHaveBeenCalledWith('product_planning', expect.any(String));
    expect(progress).not.toHaveBeenCalledWith('experience_design', expect.any(String));
    expect(progress).toHaveBeenCalledWith('frontend_generation', expect.any(String));
    expect(progress).toHaveBeenCalledWith('validating_generated_app', expect.any(String));
    expect(artifact.previewUrl).toBe('/generated-dapps/task-agent/dist/index.html');
    expect(artifact.generationMode).toBe('agent');
    expect(artifact.productPlan.markdown).toContain('Direct frontend generation');
    expect(artifact.designSpec.markdown).toContain('MVP interface');
  });

  test('accepts fenced JSON frontend output', async () => {
    const rootDir = await mkdtemp(join(tmpdir(), 'agent-workflow-'));
    cleanupPaths.push(rootDir);

    const artifact = await runAgentGeneratedDappWorkflow({
      taskId: 'task-agent-markdown',
      rootDir,
      input,
      abi: [],
      analysis,
      capabilities: { kind: 'token', confidence: 0.9, primitives: [], unsupported: [] },
      normalizedSkills: { skills: ['token-dashboard'], businessSkills: ['token-dashboard'], walletSkills: [], experienceSkills: [], diagnostics: [] },
      build: false,
      invokeAgent: async ({ prompt }) => {
        expect(prompt).toContain('src/styles.css');
        expect(prompt).toContain('Do not include package.json');
        return '```json\n{"summary":"Generated React token dashboard.","files":[{"path":"index.html","content":"<div id=\\"root\\"></div><script type=\\"module\\" src=\\"/src/App.jsx\\"></script>"},{"path":"src/App.jsx","content":"import \\"./styles.css\\"; export default function App(){ return <main>Agent token dashboard</main>; }"},{"path":"src/styles.css","content":"main { color: #111827; }"}]}\n```';
      },
    });

    expect(artifact.frontendSummary).toBe('Generated React token dashboard.');
  });

  test('keeps agent prompts small for the MVP generation path', async () => {
    const rootDir = await mkdtemp(join(tmpdir(), 'agent-workflow-'));
    cleanupPaths.push(rootDir);
    const largeAbi: AbiEntry[] = Array.from({ length: 500 }, (_, index) => ({
      type: 'function',
      name: `method${index}`,
      stateMutability: index % 3 === 0 ? 'view' : 'nonpayable',
      inputs: [
        { name: 'account', type: 'address' },
        { name: 'amount', type: 'uint256' },
      ],
      outputs: [{ name: '', type: 'uint256' }],
    }));
    const promptLengths: number[] = [];

    await runAgentGeneratedDappWorkflow({
      taskId: 'task-large-prompt',
      rootDir,
      input,
      abi: largeAbi,
      analysis: {
        ...analysis,
        methods: largeAbi.map((entry) => ({
          name: entry.name!,
          label: entry.name!,
          type: entry.stateMutability === 'view' ? 'read' : 'write',
          dangerLevel: 'safe',
          stateMutability: entry.stateMutability!,
          inputs: entry.inputs,
          outputs: entry.outputs,
          description: `Generated method ${entry.name}`,
        })),
      },
      capabilities: {
        kind: 'token',
        confidence: 0.9,
        primitives: Array.from({ length: 120 }, (_, index) => ({
          id: `primitive-${index}`,
          label: `Primitive ${index}`,
          description: `Primitive ${index} description`,
          methodNames: [`method${index}`],
          required: false,
        })),
        unsupported: Array.from({ length: 80 }, (_, index) => `Unsupported capability ${index}`),
      },
      normalizedSkills: { skills: ['token-dashboard'], businessSkills: ['token-dashboard'], walletSkills: [], experienceSkills: [], diagnostics: [] },
      build: false,
      invokeAgent: async ({ stage, prompt }) => {
        promptLengths.push(prompt.length);
        expect(stage).toBe('frontend_generation');
        return {
          summary: 'Generated React token dashboard.',
          files: [
            { path: 'index.html', content: '<div id="root"></div><script type="module" src="/src/App.jsx"></script>' },
            { path: 'src/App.jsx', content: "import './styles.css'; export default function App(){ return <main>Agent token dashboard</main>; }" },
            { path: 'src/styles.css', content: 'main { color: #111827; }' },
          ],
        };
      },
    });

    expect(promptLengths).toHaveLength(1);
    expect(Math.max(...promptLengths)).toBeLessThan(18_000);
  });

  test('falls back to a deterministic React app when the frontend agent times out', async () => {
    const rootDir = await mkdtemp(join(process.cwd(), '.agent-workflow-frontend-fallback-'));
    cleanupPaths.push(rootDir);
    const seenStages: string[] = [];

    const artifact = await runAgentGeneratedDappWorkflow({
      taskId: 'task-frontend-fallback',
      rootDir,
      input,
      abi: [],
      analysis: {
        ...analysis,
        contractType: 'nft',
        methods: [
          {
            name: 'safeMint',
            label: 'Safe Mint',
            type: 'write',
            dangerLevel: 'warn',
            stateMutability: 'nonpayable',
            inputs: [{ name: 'to', type: 'address' }],
            outputs: [],
            description: 'Mint from the collection.',
          },
          {
            name: 'ownerOf',
            label: 'Owner Of',
            type: 'read',
            dangerLevel: 'safe',
            stateMutability: 'view',
            inputs: [{ name: 'tokenId', type: 'uint256' }],
            outputs: [{ name: '', type: 'address' }],
            description: 'Check token ownership.',
          },
        ],
      },
      capabilities: { kind: 'nft', confidence: 1, primitives: [], unsupported: [] },
      normalizedSkills: { skills: ['nft-mint-experience'], businessSkills: ['nft-mint-experience'], walletSkills: [], experienceSkills: [], diagnostics: [] },
      build: true,
      invokeAgent: async ({ stage }) => {
        seenStages.push(stage);
        const error = new Error('This operation was aborted');
        error.name = 'AbortError';
        throw error;
      },
    });

    expect(seenStages).toEqual(['frontend_generation']);
    expect(artifact.frontendSummary).toContain('fallback');
    expect(artifact.buildStatus).toBe('success');
    expect(artifact.generationMode).toBe('fallback');
    expect(artifact.productPlan.markdown).toContain('Direct frontend generation');
    expect(artifact.designSpec.markdown).toContain('MVP interface');
  });
});
