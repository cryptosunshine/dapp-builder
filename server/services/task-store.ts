import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import {
  type BuilderTask,
  type BuilderTaskInput,
  type BuilderTaskResult,
  builderTaskInputSchema,
  builderTaskResultSchema,
  builderTaskSchema,
} from '../../shared/schema.js';

interface TaskStoreOptions {
  dataDir: string;
}

interface TaskUpdate {
  status?: BuilderTask['status'];
  result?: BuilderTaskResult;
  error?: string;
}

export function createTaskStore({ dataDir }: TaskStoreOptions) {
  const taskFilePath = (id: string) => join(dataDir, `${id}.json`);

  const ensureDataDir = async () => {
    await mkdir(dataDir, { recursive: true });
  };

  const saveTask = async (task: BuilderTask) => {
    await ensureDataDir();
    const validated = builderTaskSchema.parse(task);
    const persistedTaskId = validated.id ?? validated.taskId;
    if (!persistedTaskId) {
      throw new Error('Task is missing an id/taskId field.');
    }
    await writeFile(taskFilePath(persistedTaskId), JSON.stringify(validated, null, 2), 'utf8');
    return validated;
  };

  const getTask = async (id: string): Promise<BuilderTask | null> => {
    try {
      const content = await readFile(taskFilePath(id), 'utf8');
      return builderTaskSchema.parse(JSON.parse(content));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        return null;
      }
      throw error;
    }
  };

  const createTask = async (input: BuilderTaskInput) => {
    const parsedInput = builderTaskInputSchema.parse(input);
    const timestamp = new Date().toISOString();
    const task: BuilderTask = {
      id: randomUUID(),
      status: 'queued',
      createdAt: timestamp,
      updatedAt: timestamp,
      input: parsedInput,
    };

    return saveTask(task);
  };

  const updateTask = async (id: string, patch: TaskUpdate) => {
    const existingTask = await getTask(id);

    if (!existingTask) {
      throw new Error(`Task ${id} not found`);
    }

    const nextTask: BuilderTask = {
      ...existingTask,
      updatedAt: new Date().toISOString(),
      ...(patch.status ? { status: patch.status } : {}),
      ...(patch.error !== undefined ? { error: patch.error } : {}),
      ...(patch.result ? { result: builderTaskResultSchema.parse(patch.result) } : {}),
    };

    return saveTask(nextTask);
  };

  const listTasks = async () => {
    await ensureDataDir();
    const files = (await readdir(dataDir)).filter((file) => file.endsWith('.json'));
    const tasks = await Promise.all(
      files.map(async (file) => {
        const content = await readFile(join(dataDir, file), 'utf8');
        return builderTaskSchema.parse(JSON.parse(content));
      }),
    );
    return tasks.sort((left, right) => (right.createdAt ?? '').localeCompare(left.createdAt ?? ''));
  };

  return {
    createTask,
    updateTask,
    getTask,
    listTasks,
  };
}

export type TaskStore = ReturnType<typeof createTaskStore>;
