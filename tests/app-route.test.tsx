// @vitest-environment jsdom
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, test, vi } from 'vitest';
import App from '../src/App';

const { mockedGetTask } = vi.hoisted(() => ({
  mockedGetTask: vi.fn(),
}));

const completedTask = {
  id: 'task-1',
  status: 'completed',
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  input: {
    contractAddress: '0x1234567890123456789012345678901234567890',
    chain: 'conflux-espace-testnet',
    skill: 'claim-page',
    model: 'gpt-5.4',
    apiKey: 'test-key',
  },
  result: {
    warnings: ['Preview route alias test.'],
    dangerousMethods: [],
    methods: [],
    sections: [],
    pageConfig: {
      title: 'Alias Preview Page',
      description: 'Preview route alias should render this page.',
      chain: 'conflux-espace-testnet',
      chainId: 71,
      contractAddress: '0x1234567890123456789012345678901234567890',
      contractName: 'Alias Contract',
      skill: 'claim-page',
      warnings: ['Preview route alias test.'],
      dangerousMethods: [],
      methods: [],
      sections: [],
    },
  },
};

vi.mock('../src/lib/api', () => ({
  createTask: vi.fn(),
  getTask: mockedGetTask,
}));

vi.mock('../src/lib/wallet', () => ({
  connectWallet: vi.fn(async () => ({ account: null, chainId: null, isConnecting: false, error: null })),
  getWalletState: vi.fn(async () => ({ account: null, chainId: null, isConnecting: false, error: null })),
}));

vi.mock('../src/lib/contract', () => ({
  runContractMethod: vi.fn(),
}));

describe('App route aliases', () => {
  test('renders the task preview page on /app/:taskId', async () => {
    mockedGetTask.mockResolvedValueOnce(completedTask);

    render(
      <MemoryRouter initialEntries={['/app/task-1']}>
        <App />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByText('Alias Preview Page')).toBeInTheDocument();
    });
  });

  test('renders a failure-specific task detail state instead of a waiting message', async () => {
    mockedGetTask.mockResolvedValueOnce({
      id: 'task-failed',
      status: 'failed',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      input: completedTask.input,
      summary: 'ABI lookup failed before page generation.',
      error: 'ConfluxScan ABI lookup failed.',
    });

    render(
      <MemoryRouter initialEntries={['/app/task-failed']}>
        <App />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByText(/task failed before a preview could be generated/i)).toBeInTheDocument();
    });

    expect(screen.getByText(/adjust the contract or inputs and submit a new task/i)).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /open shareable preview/i })).not.toBeInTheDocument();
    expect(screen.queryByText(/preview will appear when the backend finishes processing the task/i)).not.toBeInTheDocument();
  });

  test('renders a readable waiting state while the generated app is still processing', async () => {
    mockedGetTask.mockResolvedValueOnce({
      id: 'task-processing',
      status: 'processing',
      progress: 'product_planning',
      summary: 'PM agent is designing the product flow.',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      input: completedTask.input,
    });

    render(
      <MemoryRouter initialEntries={['/app/task-processing']}>
        <App />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByText(/preview will appear when the backend finishes processing the task/i)).toBeInTheDocument();
    });

    expect(screen.getByText(/preview will appear when the backend finishes processing the task/i).closest('.empty-state')).toHaveClass(
      'empty-state--preview-waiting',
    );
    expect(screen.queryByTitle('Agent generated dApp preview')).not.toBeInTheDocument();
  });
});
