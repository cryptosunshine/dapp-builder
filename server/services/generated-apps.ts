import { execFile } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve, sep } from 'node:path';
import { promisify } from 'node:util';
import {
  generatedAppArtifactSchema,
  type AgentDocument,
  type GeneratedAppArtifact,
  type GeneratedAppFile,
} from '../../shared/schema.js';

const execFileAsync = promisify(execFile);
const requiredGeneratedFiles = new Set(['package.json', 'index.html', 'src/App.jsx']);

interface CreateGeneratedAppArtifactInput {
  taskId: string;
  rootDir: string;
  files: GeneratedAppFile[];
  productPlan: AgentDocument;
  designSpec: AgentDocument;
  frontendSummary?: string;
  apiKey?: string;
  build?: boolean;
}

function normalizeGeneratedPath(path: string) {
  return path.replace(/\\/g, '/').replace(/^\/+/, '');
}

function assertSafePath(sourceDir: string, filePath: string) {
  const normalized = normalizeGeneratedPath(filePath);
  if (!normalized || normalized.includes('\0') || normalized.startsWith('../') || normalized === '..' || normalized.includes('/../')) {
    throw new Error(`Unsafe generated file path: ${filePath}`);
  }

  const absolutePath = resolve(sourceDir, normalized);
  if (absolutePath !== sourceDir && !absolutePath.startsWith(`${sourceDir}${sep}`)) {
    throw new Error(`Unsafe generated file path: ${filePath}`);
  }
  return { normalized, absolutePath };
}

function assertRequiredFiles(files: GeneratedAppFile[]) {
  const paths = new Set(files.map((file) => normalizeGeneratedPath(file.path)));
  const missing = [...requiredGeneratedFiles].filter((path) => !paths.has(path));
  if (missing.length > 0) {
    throw new Error(`Missing required generated app files: ${missing.join(', ')}`);
  }
}

function assertNoSecrets(files: GeneratedAppFile[], apiKey?: string) {
  const forbidden = [
    apiKey,
    'OPENAI_API_KEY',
    'HERMES_API_KEY',
    'RELAYER_API_KEY',
  ].filter((value): value is string => Boolean(value && value.trim().length > 0));

  for (const file of files) {
    for (const value of forbidden) {
      if (file.content.includes(value)) {
        throw new Error(`Generated app file ${file.path} contains a forbidden secret value.`);
      }
    }
  }
}

async function writeGeneratedAppSource(sourceDir: string, files: GeneratedAppFile[]) {
  await mkdir(sourceDir, { recursive: true });
  for (const file of files) {
    const { absolutePath } = assertSafePath(sourceDir, file.path);
    await mkdir(dirname(absolutePath), { recursive: true });
    await writeFile(absolutePath, file.content, 'utf8');
  }
}

async function buildGeneratedApp(sourceDir: string, distDir: string) {
  const viteBin = resolve(process.cwd(), 'node_modules/vite/bin/vite.js');
  await mkdir(distDir, { recursive: true });
  await execFileAsync(process.execPath, [
    viteBin,
    'build',
    '--root',
    sourceDir,
    '--outDir',
    distDir,
    '--emptyOutDir',
  ], {
    cwd: process.cwd(),
    timeout: 120_000,
    maxBuffer: 2_000_000,
  });
}

export async function createGeneratedAppArtifact({
  taskId,
  rootDir,
  files,
  productPlan,
  designSpec,
  frontendSummary = '',
  apiKey,
  build = true,
}: CreateGeneratedAppArtifactInput): Promise<GeneratedAppArtifact> {
  assertRequiredFiles(files);
  assertNoSecrets(files, apiKey);

  const taskDir = resolve(rootDir, taskId);
  const sourceDir = resolve(taskDir, 'source');
  const distDir = resolve(taskDir, 'dist');
  for (const file of files) {
    assertSafePath(sourceDir, file.path);
  }

  await writeGeneratedAppSource(sourceDir, files);
  let buildStatus: GeneratedAppArtifact['buildStatus'] = 'skipped';
  if (build) {
    await buildGeneratedApp(sourceDir, distDir);
    buildStatus = 'success';
  }

  return generatedAppArtifactSchema.parse({
    taskId,
    sourceDir,
    distDir,
    previewUrl: `/generated-dapps/${taskId}/dist/index.html`,
    buildStatus,
    productPlan,
    designSpec,
    frontendSummary,
    validationWarnings: [],
  });
}
