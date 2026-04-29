import { access, cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, resolve, sep } from 'node:path';
import { build as viteBuild } from 'vite';
import {
  generatedAppArtifactSchema,
  type AgentDocument,
  type GeneratedAppArtifact,
  type GeneratedAppFile,
} from '../../shared/schema.js';
import { appConfig } from '../config.js';

const requiredGeneratedFiles = new Set(['index.html', 'src/App.jsx']);
const agentManagedFiles = new Set(['index.html', 'src/App.jsx', 'src/styles.css']);
const backendManagedFiles = new Set(['package.json', 'vite.config.js']);
let generatedAppBuildQueue: Promise<unknown> = Promise.resolve();

interface CreateGeneratedAppArtifactInput {
  taskId: string;
  rootDir: string;
  files: GeneratedAppFile[];
  productPlan: AgentDocument;
  designSpec: AgentDocument;
  frontendSummary?: string;
  apiKey?: string;
  build?: boolean;
  generationMode?: GeneratedAppArtifact['generationMode'];
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

function assertAllowedFile(path: string) {
  if (!agentManagedFiles.has(path) && !backendManagedFiles.has(path)) {
    throw new Error(`Unsupported generated app file: ${path}`);
  }
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
    const { normalized, absolutePath } = assertSafePath(sourceDir, file.path);
    if (!agentManagedFiles.has(normalized)) {
      continue;
    }
    await mkdir(dirname(absolutePath), { recursive: true });
    await writeFile(absolutePath, file.content, 'utf8');
  }

  const managedFiles = [
    {
      path: 'package.json',
      content: JSON.stringify({
        type: 'module',
        scripts: { build: 'vite build' },
        dependencies: {
          '@vitejs/plugin-react': '^4.4.1',
          vite: '^6.3.5',
          react: '^18.3.1',
          'react-dom': '^18.3.1',
          viem: '^2.31.4',
        },
      }, null, 2),
    },
    {
      path: 'vite.config.js',
      content: "import { defineConfig } from 'vite';\n\nexport default defineConfig({\n  base: './',\n});\n",
    },
  ];

  for (const file of managedFiles) {
    const { absolutePath } = assertSafePath(sourceDir, file.path);
    await writeFile(absolutePath, file.content, 'utf8');
  }
}

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number, label: string): Promise<T> {
  let timeout: NodeJS.Timeout | undefined;
  const timeoutPromise = new Promise<never>((_resolve, reject) => {
    timeout = setTimeout(() => reject(new Error(`${label} timed out after ${timeoutMs}ms.`)), timeoutMs);
  });

  try {
    return await Promise.race([promise, timeoutPromise]);
  } finally {
    if (timeout) clearTimeout(timeout);
  }
}

async function runQueuedGeneratedAppBuild<T>(operation: () => Promise<T>): Promise<T> {
  const run = generatedAppBuildQueue.then(operation, operation);
  generatedAppBuildQueue = run.catch(() => undefined);
  return run;
}

async function validateBuiltAssets(distDir: string) {
  const htmlPath = resolve(distDir, 'index.html');
  const html = await readFile(htmlPath, 'utf8');
  const assetRefs = [...html.matchAll(/\b(?:src|href)="([^"]+)"/g)].map((match) => match[1]);

  for (const assetRef of assetRefs) {
    if (/^(?:https?:|data:|blob:|#|mailto:)/i.test(assetRef)) {
      continue;
    }
    if (assetRef.startsWith('/')) {
      throw new Error(`Built app references an absolute asset path: ${assetRef}`);
    }

    const normalized = normalizeGeneratedPath(assetRef.replace(/^\.\//, ''));
    if (!normalized || normalized.startsWith('../') || normalized.includes('/../')) {
      throw new Error(`Built app references an unsafe asset path: ${assetRef}`);
    }

    await access(resolve(distDir, normalized));
  }
}

async function buildGeneratedApp(sourceDir: string, distDir: string) {
  const buildOutputDir = resolve(sourceDir, 'dist');
  await rm(buildOutputDir, { recursive: true, force: true });
  await rm(distDir, { recursive: true, force: true });
  await runQueuedGeneratedAppBuild(async () => {
    const previousCwd = process.cwd();
    process.chdir(sourceDir);
    try {
      await withTimeout(
        viteBuild({
          root: '.',
          base: './',
          configFile: false,
          publicDir: false,
          logLevel: 'silent',
          build: {
            outDir: 'dist',
            emptyOutDir: true,
          },
        }),
        appConfig.generatedAppBuildTimeoutMs,
        'Generated app build',
      );
    } finally {
      process.chdir(previousCwd);
    }
  });
  await mkdir(dirname(distDir), { recursive: true });
  await cp(buildOutputDir, distDir, { recursive: true });
  await rm(buildOutputDir, { recursive: true, force: true });
  await validateBuiltAssets(distDir);
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
  generationMode = 'agent',
}: CreateGeneratedAppArtifactInput): Promise<GeneratedAppArtifact> {
  const taskDir = resolve(rootDir, taskId);
  const sourceDir = resolve(taskDir, 'source');
  const distDir = resolve(taskDir, 'dist');
  for (const file of files) {
    const { normalized } = assertSafePath(sourceDir, file.path);
    assertAllowedFile(normalized);
  }
  assertRequiredFiles(files);
  assertNoSecrets(files, apiKey);

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
    generationMode,
    productPlan,
    designSpec,
    frontendSummary,
    validationWarnings: [],
  });
}
