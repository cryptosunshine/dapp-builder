import { Router } from 'express';
import { ZodError } from 'zod';
import { builderTaskInputSchema } from '../../shared/schema.js';
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
          await taskStore.updateTask(task.id, { status: 'processing' });
          const result = await runBuilderAgent(input);
          await taskStore.updateTask(task.id, { status: 'completed', result });
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Unknown task failure';
          await taskStore.updateTask(task.id, { status: 'failed', error: message });
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
