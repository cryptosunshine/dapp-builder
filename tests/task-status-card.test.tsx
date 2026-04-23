// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { describe, expect, test } from 'vitest';
import { TaskStatusCard } from '../src/components/TaskStatusCard';
import type { BuilderTask } from '../shared/schema';

const task: BuilderTask = {
  id: 'task-42',
  status: 'processing',
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  input: {
    contractAddress: '0x1234567890123456789012345678901234567890',
    chain: 'conflux-espace-testnet',
    skill: 'claim-page',
    model: 'gpt-5.4',
    apiKey: 'test-key',
  },
};

describe('TaskStatusCard', () => {
  test('renders a shareable preview link for the /app task alias', () => {
    render(<TaskStatusCard task={task} />);

    const link = screen.getByRole('link', { name: /open shareable preview/i });

    expect(link).toHaveAttribute('href', '/app/task-42');
  });

  test('does not render a raw task json link that could expose sensitive fields', () => {
    render(<TaskStatusCard task={task} />);

    expect(screen.queryByRole('link', { name: /open task json/i })).not.toBeInTheDocument();
  });
});
