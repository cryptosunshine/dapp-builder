// @vitest-environment jsdom
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, expect, test, vi } from 'vitest';
import { WalletBar } from '../src/components/WalletBar';
import { WarningBanner } from '../src/components/WarningBanner';
import { MethodCard } from '../src/components/MethodCard';
import type { WalletState, MethodRunResult } from '../src/types';
import type { PageMethod } from '../shared/schema';

// ─── WalletBar ──────────────────────────────────────────────────────────────

describe('WalletBar', () => {
  const defaultChain = 'conflux-espace-testnet' as const;

  test('shows "Not connected" when no account is connected', () => {
    const walletState: WalletState = { account: null, chainId: null, isConnecting: false };
    render(<WalletBar walletState={walletState} onConnectWallet={vi.fn()} chain={defaultChain} />);
    expect(screen.getByText('Not connected')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /connect wallet/i })).toBeInTheDocument();
  });

  test('shows the account address when connected', () => {
    const walletState: WalletState = { account: '0x1234...abcd', chainId: 71, isConnecting: false };
    render(<WalletBar walletState={walletState} onConnectWallet={vi.fn()} chain={defaultChain} />);
    expect(screen.getByText('0x1234...abcd')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /reconnect wallet/i })).toBeInTheDocument();
  });

  test('shows expected chain name', () => {
    const walletState: WalletState = { account: null, chainId: null, isConnecting: false };
    render(<WalletBar walletState={walletState} onConnectWallet={vi.fn()} chain={defaultChain} />);
    expect(screen.getByText(/Conflux eSpace Testnet/)).toBeInTheDocument();
  });

  test('shows chain warning class when chain does not match', () => {
    const walletState: WalletState = { account: '0x1234', chainId: 999, isConnecting: false };
    const { container } = render(
      <WalletBar walletState={walletState} onConnectWallet={vi.fn()} chain={defaultChain} />,
    );
    const chainEl = container.querySelector('.wallet-bar__chain');
    expect(chainEl).toBeInTheDocument();
    expect(chainEl?.className).toContain('is-warning');
  });

  test('shows ok className when chain matches', () => {
    const walletState: WalletState = { account: '0x1234', chainId: 71, isConnecting: false };
    const { container } = render(
      <WalletBar walletState={walletState} onConnectWallet={vi.fn()} chain={defaultChain} />,
    );
    const chainEl = container.querySelector('.wallet-bar__chain');
    expect(chainEl?.className).toContain('is-ok');
  });

  test('calls onConnectWallet when button is clicked', () => {
    const onConnectWallet = vi.fn();
    const walletState: WalletState = { account: null, chainId: null, isConnecting: false };
    render(<WalletBar walletState={walletState} onConnectWallet={onConnectWallet} chain={defaultChain} />);
    fireEvent.click(screen.getByRole('button', { name: /connect wallet/i }));
    expect(onConnectWallet).toHaveBeenCalledTimes(1);
  });
});

// ─── WarningBanner ──────────────────────────────────────────────────────────

describe('WarningBanner', () => {
  test('renders the warning message text', () => {
    render(<WarningBanner warning="This is a test warning." />);
    expect(screen.getByText('This is a test warning.')).toBeInTheDocument();
  });

  test('renders a warning indicator icon', () => {
    const { container } = render(<WarningBanner warning="Danger!" />);
    expect(container.querySelector('.warning-banner')).toBeInTheDocument();
    expect(container.querySelector('[aria-hidden="true"]')).toBeInTheDocument();
  });
});

// ─── MethodCard ─────────────────────────────────────────────────────────────

describe('MethodCard', () => {
  const readMethod: PageMethod = {
    name: 'balanceOf',
    label: 'Balance Of',
    type: 'read',
    dangerLevel: 'safe',
    stateMutability: 'view',
    inputs: [{ name: 'owner', type: 'address' }],
    outputs: [{ name: '', type: 'uint256' }],
    description: 'Check the token balance of an address.',
  };

  const writeMethod: PageMethod = {
    name: 'transfer',
    label: 'Transfer',
    type: 'write',
    dangerLevel: 'warn',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'to', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    outputs: [],
    description: 'Transfer tokens to another address.',
  };

  const dangerMethod: PageMethod = {
    name: 'renounceOwnership',
    label: 'Renounce Ownership',
    type: 'write',
    dangerLevel: 'danger',
    stateMutability: 'nonpayable',
    inputs: [],
    outputs: [],
    description: 'Renounce contract ownership.',
  };

  test('renders method label and description', () => {
    render(<MethodCard method={readMethod} onRunMethod={vi.fn()} activeResult={null} />);
    expect(screen.getByRole('heading', { name: /balance of/i })).toBeInTheDocument();
    expect(screen.getByText('Check the token balance of an address.')).toBeInTheDocument();
  });

  test('shows type badge (read/write)', () => {
    render(<MethodCard method={readMethod} onRunMethod={vi.fn()} activeResult={null} />);
    expect(screen.getByText('read')).toBeInTheDocument();
  });

  test('renders input fields when the method has inputs', () => {
    render(<MethodCard method={readMethod} onRunMethod={vi.fn()} activeResult={null} />);
    const ownerInput = screen.getByPlaceholderText('address');
    expect(ownerInput).toBeInTheDocument();
    // label rendered from input name
    expect(screen.getByText('owner')).toBeInTheDocument();
  });

  test('renders input fields for multiple args with positional fallback names', () => {
    const method: PageMethod = {
      name: 'addUser',
      label: 'Add User',
      type: 'write',
      dangerLevel: 'warn',
      stateMutability: 'nonpayable',
      inputs: [
        { name: '', type: 'address' },
        { name: '', type: 'uint256' },
      ],
      outputs: [],
      description: 'Add a user.',
    };
    render(<MethodCard method={method} onRunMethod={vi.fn()} activeResult={null} />);
    expect(screen.getByText('Argument 1')).toBeInTheDocument();
    expect(screen.getByText('Argument 2')).toBeInTheDocument();
  });

  test('shows "Run dangerous method" button label for danger methods', () => {
    render(<MethodCard method={dangerMethod} onRunMethod={vi.fn()} activeResult={null} />);
    expect(screen.getByRole('button', { name: /run dangerous method/i })).toBeInTheDocument();
  });

  test('shows method label as button text for non-danger methods', () => {
    render(<MethodCard method={readMethod} onRunMethod={vi.fn()} activeResult={null} />);
    expect(screen.getByRole('button', { name: /balance of/i })).toBeInTheDocument();
  });

  test('does not show result panel when activeResult is null', () => {
    const { container } = render(<MethodCard method={readMethod} onRunMethod={vi.fn()} activeResult={null} />);
    expect(container.querySelector('.result-panel')).not.toBeInTheDocument();
  });

  test('shows result panel when activeResult matches method name', () => {
    const activeResult: MethodRunResult = {
      methodName: 'balanceOf',
      status: 'success',
      message: 'Call succeeded',
      data: { value: '100' },
    };
    const { container } = render(
      <MethodCard method={readMethod} onRunMethod={vi.fn()} activeResult={activeResult} />,
    );
    const panel = container.querySelector('.result-panel');
    expect(panel).toBeInTheDocument();
    expect(screen.getByText('Call succeeded')).toBeInTheDocument();
    expect(screen.getByText(/100/)).toBeInTheDocument();
  });

  test('does not show result panel when activeResult is for a different method', () => {
    const activeResult: MethodRunResult = {
      methodName: 'transfer',
      status: 'success',
      message: 'Transferred!',
    };
    const { container } = render(
      <MethodCard method={readMethod} onRunMethod={vi.fn()} activeResult={activeResult} />,
    );
    expect(container.querySelector('.result-panel')).not.toBeInTheDocument();
  });

  test('calls onRunMethod with method and form values when button clicked', () => {
    const onRunMethod = vi.fn();
    render(<MethodCard method={readMethod} onRunMethod={onRunMethod} activeResult={null} />);
    fireEvent.click(screen.getByRole('button', { name: /balance of/i }));
    // formValues starts as {} only keys for touched inputs appear
    expect(onRunMethod).toHaveBeenCalledWith(readMethod, {});
  });

  test('passes input form values when calling onRunMethod', () => {
    const onRunMethod = vi.fn();
    render(<MethodCard method={writeMethod} onRunMethod={onRunMethod} activeResult={null} />);
    const toInput = screen.getByPlaceholderText('address');
    fireEvent.change(toInput, { target: { value: '0xTARGET' } });
    fireEvent.click(screen.getByRole('button', { name: /transfer/i }));
    // Only touched inputs appear in formValues (amount was never typed into)
    expect(onRunMethod).toHaveBeenCalledWith(writeMethod, { to: '0xTARGET' });
  });

  test('applies danger CSS class for danger-level methods', () => {
    const { container } = render(<MethodCard method={dangerMethod} onRunMethod={vi.fn()} activeResult={null} />);
    const article = container.querySelector('.method-card');
    expect(article?.className).toContain('danger-danger');
  });
});
