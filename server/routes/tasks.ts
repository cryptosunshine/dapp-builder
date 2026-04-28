import { Router } from 'express';
import { ZodError } from 'zod';
import { builderTaskInputSchema } from '../../shared/schema.js';
import { appConfig } from '../config.js';
import { runBuilderAgent } from '../services/agent.js';
import type { TaskStore } from '../services/task-store.js';

interface CreateTaskRouterOptions {
  taskStore: TaskStore;
}

export function createTaskRouter({ taskStore }: CreateTaskRouterOptions) {
  const router = Router();

  router.get('/', async (_request, response, next) => {
    try {
      const tasks = await taskStore.listTasks();
      response.json(tasks);
    } catch (error) {
      next(error);
    }
  });

  router.post('/', async (request, response, next) => {
    try {
      const input = builderTaskInputSchema.parse(request.body);
      const task = await taskStore.createTask(input);

      void (async () => {
        try {
          const taskId = task.id ?? task.taskId;
          if (!taskId) {
            throw new Error('Created task is missing an id/taskId field.');
          }
          await taskStore.updateTask(taskId, {
            status: 'processing',
            progress: 'fetching_abi',
            summary: 'Fetching contract ABI and metadata from ConfluxScan.',
          });
          const result = await runBuilderAgent(input, {
            taskId,
            generatedAppsDir: appConfig.generatedDappsDir,
            onProgress: async (progress, summary) => {
              await taskStore.updateTask(taskId, { progress, summary });
            },
          });
          await taskStore.updateTask(taskId, {
            status: 'completed',
            progress: 'completed',
            summary: result.summary,
            result,
          });
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Unknown task failure';
          const taskId = task.id ?? task.taskId;
          if (taskId) {
            await taskStore.updateTask(taskId, { status: 'failed', error: message });
          }
        }
      })();

      response.status(202).json(task);
    } catch (error) {
      if (error instanceof ZodError) {
        response.status(400).json({ message: 'Invalid task input', issues: error.issues });
        return;
      }
      next(error);
    }
  });

  router.get('/:taskId', async (request, response, next) => {
    try {
      const task = await taskStore.getTask(request.params.taskId);
      if (!task) {
        response.status(404).json({ message: 'Task not found' });
        return;
      }
      response.json(task);
    } catch (error) {
      next(error);
    }
  });

  return router;
}
