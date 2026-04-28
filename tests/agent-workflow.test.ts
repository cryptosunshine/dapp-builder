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
  test('runs PM, designer, and frontend agent stages in order and stores the generated React app', async () => {
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
        if (stage === 'product_planning') {
          return { role: 'product-manager', title: 'Token flow', markdown: '# Token flow\n\nUse balance, transfer, and approvals.' };
        }
        if (stage === 'experience_design') {
          return { role: 'designer', title: 'Token dashboard design', markdown: '# Token dashboard design\n\nAave-like asset workspace.' };
        }
        return {
          summary: 'Generated React token dashboard.',
          files: [
            { path: 'package.json', content: '{"type":"module","scripts":{"build":"vite build"}}' },
            { path: 'index.html', content: '<div id="root"></div><script type="module" src="/src/App.jsx"></script>' },
            { path: 'src/App.jsx', content: 'export default function App(){ return <main>Agent token dashboard</main>; }' },
          ],
        };
      },
    });

    expect(seenStages).toEqual(['product_planning', 'experience_design', 'frontend_generation']);
    expect(progress).toHaveBeenCalledWith('product_planning', expect.any(String));
    expect(progress).toHaveBeenCalledWith('experience_design', expect.any(String));
    expect(progress).toHaveBeenCalledWith('frontend_generation', expect.any(String));
    expect(progress).toHaveBeenCalledWith('validating_generated_app', expect.any(String));
    expect(artifact.previewUrl).toBe('/generated-dapps/task-agent/dist/index.html');
    expect(artifact.productPlan.markdown).toContain('balance');
    expect(artifact.designSpec.markdown).toContain('Aave-like');
  });

  test('accepts non-json PM and designer markdown so agent formatting drift does not fail the task', async () => {
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
      invokeAgent: async ({ stage }) => {
        if (stage === 'product_planning') {
          return '# Token PM flow\n\nThis token page should focus on balance, transfer, and approval tasks.';
        }
        if (stage === 'experience_design') {
          return 'Design direction: a focused asset workspace with action tabs and a clear risk rail.';
        }
        return '```json\n{"summary":"Generated React token dashboard.","files":[{"path":"package.json","content":"{\\"type\\":\\"module\\",\\"scripts\\":{\\"build\\":\\"vite build\\"}}"},{"path":"index.html","content":"<div id=\\"root\\"></div><script type=\\"module\\" src=\\"/src/App.jsx\\"></script>"},{"path":"src/App.jsx","content":"export default function App(){ return <main>Agent token dashboard</main>; }"}]}\n```';
      },
    });

    expect(artifact.productPlan.markdown).toContain('Token PM flow');
    expect(artifact.designSpec.markdown).toContain('asset workspace');
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
        if (stage === 'product_planning') {
          return '# Token PM flow\n\n'.concat('Use product flows, not scans. '.repeat(3000));
        }
        if (stage === 'experience_design') {
          return '# Token design\n\n'.concat('Use a calm asset workspace. '.repeat(3000));
        }
        return {
          summary: 'Generated React token dashboard.',
          files: [
            { path: 'package.json', content: '{"type":"module","scripts":{"build":"vite build"}}' },
            { path: 'index.html', content: '<div id="root"></div><script type="module" src="/src/App.jsx"></script>' },
            { path: 'src/App.jsx', content: 'export default function App(){ return <main>Agent token dashboard</main>; }' },
          ],
        };
      },
    });

    expect(Math.max(...promptLengths)).toBeLessThan(18_000);
  });
});
