// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, test, vi } from 'vitest';
import App from '../src/App';

vi.mock('../src/lib/api', () => ({
  createTask: vi.fn(),
  getTask: vi.fn(),
}));

describe('Builder home product layout', () => {
  test('renders the protocol landing page with bilingual product narrative', async () => {
    const user = userEvent.setup();

    render(
      <MemoryRouter initialEntries={['/']}>
        <App />
      </MemoryRouter>,
    );

    expect(screen.getByRole('banner', { name: /agentic payment navigation/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /agentic payment layer/i })).toBeInTheDocument();
    expect(screen.getByText(/ai understands intent/i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /launch dapp builder/i })).toHaveAttribute('href', '/builder');
    expect(screen.getByRole('region', { name: /execution visual/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /smart contracts hold the budget/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /dapp builder is the first live module/i })).toBeInTheDocument();
    expect(screen.getByText(/skill selection/i)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /中文/i }));

    expect(screen.getByRole('heading', { name: /面向 ai agent 的链上支付与服务执行层/i })).toBeInTheDocument();
    expect(screen.getByText(/ai 理解意图/i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /启动 dapp builder/i })).toHaveAttribute('href', '/builder');
  });

  test('renders a streamlined generator surface without unused navigation or framing modules on /builder', () => {
    render(
      <MemoryRouter initialEntries={['/builder']}>
        <App />
      </MemoryRouter>,
    );

    expect(screen.getByLabelText(/builder navigation/i)).toBeInTheDocument();
    expect(screen.queryByText(/generate a wallet-ready app from a contract/i)).not.toBeInTheDocument();
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
