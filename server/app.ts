import express from 'express';
import { createTaskRouter } from './routes/tasks.js';
import { appConfig } from './config.js';
import { createTaskStore } from './services/task-store.js';

export function createApp() {
  const app = express();
  const taskStore = createTaskStore({ dataDir: appConfig.dataDir });

  app.use(express.json({ limit: '1mb' }));
  app.use('/generated-dapps', express.static(appConfig.generatedDappsDir));

  app.get('/api/health', (_request, response) => {
    response.json({ ok: true });
  });

  app.use('/api/tasks', createTaskRouter({ taskStore }));

  app.use((error: Error, _request: express.Request, response: express.Response, _next: express.NextFunction) => {
    response.status(500).json({ message: error.message || 'Internal server error' });
  });

  return app;
}
