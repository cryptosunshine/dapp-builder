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
    generatedApp: {
      taskId: 'task-1',
      sourceDir: '/tmp/task-1/source',
      distDir: '/tmp/task-1/dist',
      previewUrl: '/generated-dapps/task-1/dist/index.html',
      buildStatus: 'success',
      generationMode: 'hermes',
      productPlan: { role: 'product-manager', title: 'Plan', markdown: 'Plan' },
      designSpec: { role: 'designer', title: 'Design', markdown: 'Design' },
      frontendSummary: 'Generated app ready.',
      validationWarnings: [],
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
  test('renders generation status and a generated app launch button on /app/:taskId', async () => {
    mockedGetTask.mockResolvedValueOnce(completedTask);

    render(
      <MemoryRouter initialEntries={['/app/task-1']}>
        <App />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /your dapp page is live/i })).toBeInTheDocument();
    });
    expect(screen.getByRole('link', { name: /open generated app/i })).toHaveAttribute(
      'href',
      '/generated-dapps/task-1/dist/index.html',
    );
    expect(screen.queryByText('Alias Preview Page')).not.toBeInTheDocument();
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
      expect(screen.getByText(/task failed before an app could be generated/i)).toBeInTheDocument();
    });

    expect(screen.getByText(/adjust the contract or inputs and submit a new task/i)).toBeInTheDocument();
    expect(screen.getByText(/task failed before an app could be generated/i).closest('.empty-state')).toHaveClass('empty-state--preview-error');
    expect(screen.queryByRole('link', { name: /open shareable preview/i })).not.toBeInTheDocument();
    expect(screen.queryByText(/generation is running. the app link will appear here when the backend finishes/i)).not.toBeInTheDocument();
  });

  test('renders a readable waiting state while the generated app is still processing', async () => {
    mockedGetTask.mockResolvedValueOnce({
      id: 'task-processing',
      status: 'processing',
      progress: 'frontend_generation',
      summary: 'Frontend agent is generating the React dApp source.',
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
      expect(screen.getByText(/generation is running. the app link will appear here when the backend finishes/i)).toBeInTheDocument();
    });

    expect(screen.getByText(/generation is running. the app link will appear here when the backend finishes/i).closest('.empty-state')).toHaveClass(
      'empty-state--preview-waiting',
    );
    expect(screen.queryByRole('link', { name: /open generated app/i })).not.toBeInTheDocument();
  });
});
