// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, test, vi } from 'vitest';
import App from '../src/App';

vi.mock('../src/lib/api', () => ({
  createTask: vi.fn(),
  getTask: vi.fn(),
}));

vi.mock('../src/lib/wallet', () => ({
  connectWallet: vi.fn(async () => ({ account: null, chainId: null, isConnecting: false, error: null })),
  getWalletState: vi.fn(async () => ({ account: null, chainId: null, isConnecting: false, error: null })),
}));

vi.mock('../src/lib/contract', () => ({
  runContractMethod: vi.fn(),
}));

describe('Builder home product layout', () => {
  test('renders an Aave-style dashboard shell instead of a plain tool form', () => {
    render(
      <MemoryRouter initialEntries={['/']}>
        <App />
      </MemoryRouter>,
    );

    expect(screen.getByLabelText(/builder announcement/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/builder navigation/i)).toBeInTheDocument();
    expect(screen.getByRole('region', { name: /builder launchpad/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /launch a wallet-ready dapp from a live contract/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/builder launchpad metrics/i)).toBeInTheDocument();
    expect(screen.getByRole('group', { name: /launchpad actions/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /start generation flow/i })).toHaveAttribute('href', '#generation-inputs');
    expect(screen.getByRole('link', { name: /review generated sections/i })).toHaveAttribute('href', '#builder-workspace');
    expect(screen.getByRole('heading', { name: /what ships in the generated page/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/recommended launch path/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/builder workflow table/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/generation inputs/i)).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /generation inputs/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /task delivery/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /safety rails before users click/i })).toBeInTheDocument();
    expect(screen.getByRole('region', { name: /builder launchpad/i })).toHaveClass('builder-context-header--elevated');
    expect(screen.getByText(/submit a contract request to generate a preview/i).closest('.status-card')).toHaveClass('status-card--builder-home');
  });
});
