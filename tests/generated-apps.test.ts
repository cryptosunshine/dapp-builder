import { access, mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, test } from 'vitest';
import { createGeneratedAppArtifact } from '../server/services/generated-apps';

const cleanupPaths: string[] = [];

afterEach(async () => {
  await Promise.all(cleanupPaths.splice(0).map((path) => rm(path, { recursive: true, force: true })));
});

const validFiles = [
  { path: 'index.html', content: '<div id="root"></div><script type="module" src="/src/App.jsx"></script>' },
  { path: 'src/App.jsx', content: "import './styles.css'; export default function App(){ return <main>Agent generated dApp</main>; }" },
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
    expect(artifact.generationMode).toBe('agent');
    expect(await readFile(join(rootDir, 'task-safe/source/src/App.jsx'), 'utf8')).toContain('Agent generated dApp');
    expect(await readFile(join(rootDir, 'task-safe/source/package.json'), 'utf8')).toContain('"vite build"');
    expect(await readFile(join(rootDir, 'task-safe/source/vite.config.js'), 'utf8')).toContain("base: './'");
    await expect(readFile(join(rootDir, 'task-safe/source/src/App.jsx'), 'utf8')).resolves.not.toContain('secret-key');
  });

  test('builds generated React source with relative dist asset paths', async () => {
    const rootDir = await mkdtemp(join(tmpdir(), 'generated-dapps-'));
    cleanupPaths.push(rootDir);

    const artifact = await createGeneratedAppArtifact({
      taskId: 'task-build',
      rootDir,
      files: [
        ...validFiles,
        { path: 'package.json', content: '{"scripts":{"postinstall":"echo should-not-run"}}' },
        { path: 'vite.config.js', content: 'export default { base: "/" }' },
      ],
      productPlan: { role: 'product-manager', title: 'Token flow', markdown: '# Token flow' },
      designSpec: { role: 'designer', title: 'Token design', markdown: '# Token design' },
      build: true,
    });

    const distIndex = await readFile(join(rootDir, 'task-build/dist/index.html'), 'utf8');
    const assetPath = distIndex.match(/(?:src|href)="(\.\/assets\/[^"]+)"/)?.[1];

    expect(artifact.buildStatus).toBe('success');
    expect(distIndex).not.toContain('"/assets/');
    expect(assetPath).toBeTruthy();
    await expect(access(join(rootDir, 'task-build/dist', assetPath!.replace(/^\.\//, '')))).resolves.toBeUndefined();
    await expect(readFile(join(rootDir, 'task-build/source/package.json'), 'utf8')).resolves.not.toContain('postinstall');
    await expect(readFile(join(rootDir, 'task-build/source/vite.config.js'), 'utf8')).resolves.toContain("base: './'");
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
