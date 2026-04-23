import { builderTaskSchema, type BuilderTask, type BuilderTaskInput } from '../../shared/schema';

async function parseJsonResponse<T>(response: Response) {
  const payload = (await response.json()) as T;
  if (!response.ok) {
    throw new Error((payload as { message?: string })?.message || 'Request failed');
  }
  return payload;
}

export async function createTask(input: BuilderTaskInput): Promise<BuilderTask> {
  const response = await fetch('/api/tasks', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });

  const payload = await parseJsonResponse<unknown>(response);
  return builderTaskSchema.parse(payload);
}

export async function getTask(taskId: string): Promise<BuilderTask> {
  const response = await fetch(`/api/tasks/${taskId}`);
  const payload = await parseJsonResponse<unknown>(response);
  return builderTaskSchema.parse(payload);
}
