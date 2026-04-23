// @vitest-environment jsdom
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, test, vi } from 'vitest';
import App from '../src/App';

vi.mock('../src/lib/api', () => ({
  createTask: vi.fn(),
  getTask: vi.fn(async () => ({
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
  })),
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
    render(
      <MemoryRouter initialEntries={['/app/task-1']}>
        <App />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByText('Alias Preview Page')).toBeInTheDocument();
    });
  });
});
