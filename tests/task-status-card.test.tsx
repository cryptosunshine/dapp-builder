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
  test('renders a builder-home surface variant when requested', () => {
    render(<TaskStatusCard task={null} surface="builder-home" />);

    expect(screen.getByText(/submit a contract request to generate a preview/i).closest('.status-card')).toHaveClass('status-card--builder-home');
  });

  test('renders a shareable preview link for the /app task alias', () => {
    render(<TaskStatusCard task={task} />);

    const link = screen.getByRole('link', { name: /open shareable preview/i });

    expect(link).toHaveAttribute('href', '/app/task-42');
  });

  test('renders task progress and summary details for in-flight tasks', () => {
    render(
      <TaskStatusCard
        task={{
          ...task,
          progress: 'fetching_abi',
          summary: 'Fetching contract ABI from ConfluxScan.',
        }}
      />,
    );

    expect(screen.getByText('Task task-42').closest('.status-card')).toHaveClass('status-card--task-preview');
    expect(screen.getByText('Stage: fetching_abi')).toBeInTheDocument();
    expect(screen.getByText('Fetching contract ABI from ConfluxScan.')).toBeInTheDocument();
  });

  test('renders a compact generation stepper with the current generation stage highlighted', () => {
    render(
      <TaskStatusCard
        task={{
          ...task,
          progress: 'frontend_generation',
          summary: 'Frontend agent is generating the React dApp source.',
        }}
      />,
    );

    expect(screen.getByLabelText(/dapp generation progress/i)).toBeInTheDocument();
    expect(screen.queryByText('Product plan')).not.toBeInTheDocument();
    expect(screen.queryByText('Design')).not.toBeInTheDocument();
    expect(screen.getByText('React app')).toHaveAttribute('aria-current', 'step');
    expect(screen.getByText('Build preview')).toBeInTheDocument();
    expect(screen.getByText('Done')).toBeInTheDocument();
  });

  test('does not render a raw task json link that could expose sensitive fields', () => {
    render(<TaskStatusCard task={task} />);

    expect(screen.queryByRole('link', { name: /open task json/i })).not.toBeInTheDocument();
  });

  test('renders a restart link for failed tasks', () => {
    render(
      <TaskStatusCard
        task={{
          ...task,
          status: 'failed',
          error: 'ABI lookup failed.',
        }}
      />,
    );

    const restartLink = screen.getByRole('link', { name: /start a new task/i });

    expect(restartLink).toHaveAttribute('href', '/');
    expect(screen.queryByRole('link', { name: /open shareable preview/i })).not.toBeInTheDocument();
  });
});
