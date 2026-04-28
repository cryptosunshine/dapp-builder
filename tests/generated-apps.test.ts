import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, test } from 'vitest';
import { createGeneratedAppArtifact } from '../server/services/generated-apps';

const cleanupPaths: string[] = [];

afterEach(async () => {
  await Promise.all(cleanupPaths.splice(0).map((path) => rm(path, { recursive: true, force: true })));
});

const validFiles = [
  { path: 'package.json', content: '{"type":"module","scripts":{"build":"vite build"}}' },
  { path: 'index.html', content: '<div id="root"></div><script type="module" src="/src/App.jsx"></script>' },
  { path: 'src/App.jsx', content: 'export default function App(){ return <main>Agent generated dApp</main>; }' },
  { path: 'src/styles.css', content: 'main { color: #111827; }' },
];

describe('generated app artifacts', () => {
  test('writes agent generated source into a task directory and returns preview metadata without building when disabled', async () => {
    const rootDir = await mkdtemp(join(tmpdir(), 'generated-dapps-'));
    cleanupPaths.push(rootDir);

    const artifact = await createGeneratedAppArtifact({
      taskId: 'task-safe',
      rootDir,
      files: validFiles,
      productPlan: { role: 'product-manager', title: 'Token flow', markdown: '# Token flow' },
      designSpec: { role: 'designer', title: 'Token design', markdown: '# Token design' },
      apiKey: 'secret-key',
      build: false,
    });

    expect(artifact.previewUrl).toBe('/generated-dapps/task-safe/dist/index.html');
    expect(artifact.buildStatus).toBe('skipped');
    expect(await readFile(join(rootDir, 'task-safe/source/src/App.jsx'), 'utf8')).toContain('Agent generated dApp');
    await expect(readFile(join(rootDir, 'task-safe/source/src/App.jsx'), 'utf8')).resolves.not.toContain('secret-key');
  });

  test('rejects path traversal and missing required React entry files', async () => {
    const rootDir = await mkdtemp(join(tmpdir(), 'generated-dapps-'));
    cleanupPaths.push(rootDir);

    await expect(createGeneratedAppArtifact({
      taskId: 'task-bad-path',
      rootDir,
      files: [{ path: '../escape.txt', content: 'bad' }, ...validFiles],
      productPlan: { role: 'product-manager', title: 'Token flow', markdown: '# Token flow' },
      designSpec: { role: 'designer', title: 'Token design', markdown: '# Token design' },
      build: false,
    })).rejects.toThrow(/unsafe generated file path/i);

    await expect(createGeneratedAppArtifact({
      taskId: 'task-missing-entry',
      rootDir,
      files: validFiles.filter((file) => file.path !== 'src/App.jsx'),
      productPlan: { role: 'product-manager', title: 'Token flow', markdown: '# Token flow' },
      designSpec: { role: 'designer', title: 'Token design', markdown: '# Token design' },
      build: false,
    })).rejects.toThrow(/missing required generated app files/i);
  });
});
