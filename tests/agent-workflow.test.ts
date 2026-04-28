import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, test, vi } from 'vitest';
import { runAgentGeneratedDappWorkflow } from '../server/services/agent-workflow';
import type { AnalyzeContractResult, BuilderTaskInput } from '../shared/schema';

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
});
