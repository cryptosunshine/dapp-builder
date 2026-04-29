// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, test, vi } from 'vitest';
import App from '../src/App';

vi.mock('../src/lib/api', () => ({
  createTask: vi.fn(),
  getTask: vi.fn(),
}));

describe('Builder home product layout', () => {
  test('renders a streamlined generator surface without unused navigation or framing modules', () => {
    render(
      <MemoryRouter initialEntries={['/']}>
        <App />
      </MemoryRouter>,
    );

    expect(screen.getByLabelText(/builder navigation/i)).toBeInTheDocument();
    expect(screen.getByRole('region', { name: /builder launchpad/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /launch a wallet-ready dapp from a live contract/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /start generation/i })).toHaveAttribute('href', '#generation-inputs');
    expect(screen.getByLabelText(/generation inputs/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /generate dapp preview/i })).toHaveClass('primary-button');
    expect(screen.getByRole('button', { name: /token dashboard/i })).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: /model account/i })).toHaveValue('local-hermes-agent');
    expect(screen.queryByLabelText(/builder announcement/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/product framing/i)).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /use sample contract/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /clear form/i })).not.toBeInTheDocument();
    expect(screen.getByText(/submit a contract request to generate a preview/i).closest('.status-card')).toHaveClass('status-card--builder-home');
  });
});
