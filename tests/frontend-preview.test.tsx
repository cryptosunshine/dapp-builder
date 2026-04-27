// @vitest-environment jsdom
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, expect, test, vi } from 'vitest';
import { PreviewPage } from '../src/components/PreviewPage';
import type { BuilderTask } from '../shared/schema';

const task: BuilderTask = {
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
    warnings: ['Skill matches claim mechanics.'],
    dangerousMethods: [
      {
        name: 'setMerkleRoot',
        label: 'Set Merkle Root',
        type: 'write',
        dangerLevel: 'danger',
        stateMutability: 'nonpayable',
        inputs: [{ name: 'root', type: 'bytes32' }],
        outputs: [],
        description: 'Administrative method.',
      },
    ],
    methods: [
      {
        name: 'claim',
        label: 'Claim',
        type: 'write',
        dangerLevel: 'warn',
        stateMutability: 'nonpayable',
        inputs: [
          { name: 'amount', type: 'uint256' },
          { name: 'proof', type: 'bytes32[]' },
        ],
        outputs: [],
        description: 'Claim tokens from the contract.',
      },
      {
        name: 'balanceOf',
        label: 'Balance Of',
        type: 'read',
        dangerLevel: 'safe',
        stateMutability: 'view',
        inputs: [{ name: 'account', type: 'address' }],
        outputs: [{ name: '', type: 'uint256' }],
        description: 'Check an account balance.',
      },
    ],
    sections: [
      {
        id: 'actions',
        title: 'Actions',
        description: 'Primary user actions',
        variant: 'actions',
        methodNames: ['claim'],
      },
    ],
    pageConfig: {
      title: 'Mock Claim Page',
      description: 'Claim your allocation',
      chain: 'conflux-espace-testnet',
      chainId: 71,
      contractAddress: '0x1234567890123456789012345678901234567890',
      contractName: 'Mock Claim',
      skill: 'claim-page',
      warnings: ['Skill matches claim mechanics.'],
      primaryActions: ['Claim tokens', 'Check wallet balance'],
      dangerousMethods: [
        {
          name: 'setMerkleRoot',
          label: 'Set Merkle Root',
          type: 'write',
          dangerLevel: 'danger',
          stateMutability: 'nonpayable',
          inputs: [{ name: 'root', type: 'bytes32' }],
          outputs: [],
          description: 'Administrative method.',
        },
      ],
      methods: [
        {
          name: 'claim',
          label: 'Claim',
          type: 'write',
          dangerLevel: 'warn',
          stateMutability: 'nonpayable',
          inputs: [
            { name: 'amount', type: 'uint256' },
            { name: 'proof', type: 'bytes32[]' },
          ],
          outputs: [],
          description: 'Claim tokens from the contract.',
        },
        {
          name: 'balanceOf',
          label: 'Balance Of',
          type: 'read',
          dangerLevel: 'safe',
          stateMutability: 'view',
          inputs: [{ name: 'account', type: 'address' }],
          outputs: [{ name: '', type: 'uint256' }],
          description: 'Check an account balance.',
        },
      ],
      sections: [
        {
          id: 'actions',
          title: 'Actions',
          description: 'Primary user actions',
          variant: 'actions',
          methodNames: ['claim', 'balanceOf'],
        },
      ],
    },
  },
};

describe('PreviewPage', () => {
  test('renders warnings and method labels from pageConfig', () => {
    render(
      <PreviewPage
        task={task}
        walletState={{ account: null, chainId: null, isConnecting: false }}
        onConnectWallet={vi.fn()}
        onRunMethod={vi.fn()}
        activeResult={null}
      />,
    );

    expect(screen.getByText('Mock Claim Page')).toBeInTheDocument();
    expect(screen.getByText('Skill matches claim mechanics.')).toBeInTheDocument();
    expect(screen.getByText('Actions')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /claim/i })).toBeInTheDocument();
    expect(screen.getByText(/set merkle root/i)).toBeInTheDocument();
  });

  test('renders primary action chips when productized pageConfig supplies them', () => {
    render(
      <PreviewPage
        task={task}
        walletState={{ account: null, chainId: null, isConnecting: false }}
        onConnectWallet={vi.fn()}
        onRunMethod={vi.fn()}
        activeResult={null}
      />,
    );

    expect(screen.getByText('Top actions')).toBeInTheDocument();
    expect(screen.getByText('Claim tokens')).toBeInTheDocument();
    expect(screen.getByText('Check wallet balance')).toBeInTheDocument();
  });

  test('shows empty state when pageConfig is missing', () => {
    const taskNoConfig: BuilderTask = {
      id: 'task-2',
      status: 'running',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      input: {
        contractAddress: '0x1234567890123456789012345678901234567890',
        chain: 'conflux-espace-testnet',
        skill: 'token-dashboard',
        model: 'gpt-5.4',
        apiKey: 'test',
      },
    };

    render(
      <PreviewPage
        task={taskNoConfig}
        walletState={{ account: null, chainId: null, isConnecting: false }}
        onConnectWallet={vi.fn()}
        onRunMethod={vi.fn()}
        activeResult={null}
      />,
    );

    expect(screen.getByText(/no pageconfig/i)).toBeInTheDocument();
  });

  test('displays chain metadata in hero card meta section', () => {
    render(
      <PreviewPage
        task={task}
        walletState={{ account: null, chainId: null, isConnecting: false }}
        onConnectWallet={vi.fn()}
        onRunMethod={vi.fn()}
        activeResult={null}
      />,
    );

    // The hero card meta should show the chain name with ID
    expect(screen.getByText(/Chain:.*Conflux eSpace Testnet.*ID: 71/)).toBeInTheDocument();
  });

  test('renders fallback danger zone section for dangerousMethods', () => {
    render(
      <PreviewPage
        task={task}
        walletState={{ account: null, chainId: null, isConnecting: false }}
        onConnectWallet={vi.fn()}
        onRunMethod={vi.fn()}
        activeResult={null}
      />,
    );

    expect(screen.getByText('Danger zone')).toBeInTheDocument();
    expect(screen.getByText(/administrative or risky/i)).toBeInTheDocument();
    expect(screen.getByText(/set merkle root/i)).toBeInTheDocument();
  });

  test('filters method cards by selected method type', () => {
    render(
      <PreviewPage
        task={task}
        walletState={{ account: null, chainId: null, isConnecting: false }}
        onConnectWallet={vi.fn()}
        onRunMethod={vi.fn()}
        activeResult={null}
      />,
    );

    expect(screen.getByRole('button', { name: /claim/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /balance of/i })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /read methods/i }));

    expect(screen.getByRole('button', { name: /balance of/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /claim/i })).not.toBeInTheDocument();
    expect(screen.queryByText(/set merkle root/i)).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /write methods/i }));

    expect(screen.getByRole('button', { name: /claim/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /balance of/i })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /run dangerous method/i })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /danger methods/i }));

    expect(screen.queryByRole('button', { name: /claim/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /balance of/i })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /run dangerous method/i })).toBeInTheDocument();
  });

  test('marks the active filter button with aria-pressed', () => {
    render(
      <PreviewPage
        task={task}
        walletState={{ account: null, chainId: null, isConnecting: false }}
        onConnectWallet={vi.fn()}
        onRunMethod={vi.fn()}
        activeResult={null}
      />,
    );

    const allButton = screen.getByRole('button', { name: /all methods/i });
    const dangerButton = screen.getByRole('button', { name: /danger methods/i });

    expect(allButton).toHaveAttribute('aria-pressed', 'true');
    expect(dangerButton).toHaveAttribute('aria-pressed', 'false');

    fireEvent.click(dangerButton);

    expect(dangerButton).toHaveAttribute('aria-pressed', 'true');
    expect(allButton).toHaveAttribute('aria-pressed', 'false');
  });

  test('shows method count badges on filter buttons', () => {
    render(
      <PreviewPage
        task={task}
        walletState={{ account: null, chainId: null, isConnecting: false }}
        onConnectWallet={vi.fn()}
        onRunMethod={vi.fn()}
        activeResult={null}
      />,
    );

    // The test data has: 1 danger (setMerkleRoot), 2 write (claim + setMerkleRoot), 1 read (balanceOf) = 3 total
    expect(screen.getByRole('button', { name: /all methods.*3/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /read methods.*1/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /write methods.*2/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /danger methods.*1/i })).toBeInTheDocument();
  });

  test('renders token overview as a wallet asset panel when balanceOf exists', () => {
    const tokenTask: BuilderTask = {
      ...task,
      input: { ...task.input, skill: 'token-dashboard' },
      result: {
        ...task.result!,
        pageConfig: {
          ...task.result!.pageConfig!,
          skill: 'token-dashboard',
          sections: [
            {
              id: 'token-overview',
              title: 'Token overview',
              description: 'Track your wallet position before taking action.',
              variant: 'overview',
              methodNames: ['balanceOf'],
            },
          ],
        },
      },
    };

    render(
      <PreviewPage
        task={tokenTask}
        walletState={{ account: '0x1111111111111111111111111111111111111111', chainId: 71, isConnecting: false }}
        onConnectWallet={vi.fn()}
        onRunMethod={vi.fn()}
        activeResult={null}
      />,
    );

    expect(screen.getByText('Wallet balance')).toBeInTheDocument();
    expect(screen.getByText(/ready for 0x1111…1111/i)).toBeInTheDocument();
    expect(screen.getByText(/wallet ready on conflux espace testnet/i)).toBeInTheDocument();
    expect(screen.getByText(/token contract 0x1234…7890/i)).toBeInTheDocument();
    expect(screen.getByText(/use balance of to check holdings before transfers or approvals/i)).toBeInTheDocument();
    expect(screen.getByText(/rerun balance of after switching wallets or completing a token action/i)).toBeInTheDocument();
  });

  test('warns when the connected wallet is on the wrong chain in the token asset panel', () => {
    const tokenTask: BuilderTask = {
      ...task,
      input: { ...task.input, skill: 'token-dashboard' },
      result: {
        ...task.result!,
        pageConfig: {
          ...task.result!.pageConfig!,
          skill: 'token-dashboard',
          sections: [
            {
              id: 'token-overview',
              title: 'Token overview',
              description: 'Track your wallet position before taking action.',
              variant: 'overview',
              methodNames: ['balanceOf'],
            },
          ],
        },
      },
    };

    render(
      <PreviewPage
        task={tokenTask}
        walletState={{ account: '0x1111111111111111111111111111111111111111', chainId: 1, isConnecting: false }}
        onConnectWallet={vi.fn()}
        onRunMethod={vi.fn()}
        activeResult={null}
      />,
    );

    expect(screen.getByText(/wallet is connected to chain id 1/i)).toBeInTheDocument();
    expect(screen.getByText(/switch wallet to conflux espace testnet before checking balances, sending, or approving/i)).toBeInTheDocument();
  });

  test('renders an approval safety rail for ERC20 approval sections', () => {
    const tokenTask: BuilderTask = {
      ...task,
      input: { ...task.input, skill: 'token-dashboard' },
      result: {
        ...task.result!,
        pageConfig: {
          ...task.result!.pageConfig!,
          skill: 'token-dashboard',
          methods: [
            ...task.result!.pageConfig!.methods,
            {
              name: 'approve',
              label: 'Approve',
              type: 'write',
              dangerLevel: 'warn',
              stateMutability: 'nonpayable',
              inputs: [
                { name: 'spender', type: 'address' },
                { name: 'amount', type: 'uint256' },
              ],
              outputs: [{ name: '', type: 'bool' }],
              description: 'Allow another address to spend your tokens.',
            },
          ],
          sections: [
            {
              id: 'token-approvals',
              title: 'Approvals & spender safety',
              description: 'Review and control token spending approvals.',
              variant: 'actions',
              methodNames: ['approve'],
            },
          ],
        },
      },
    };

    render(
      <PreviewPage
        task={tokenTask}
        walletState={{ account: null, chainId: null, isConnecting: false }}
        onConnectWallet={vi.fn()}
        onRunMethod={vi.fn()}
        activeResult={null}
      />,
    );

    expect(screen.getByText('Approval safety')).toBeInTheDocument();
    expect(screen.getByText(/approve only spenders you trust/i)).toBeInTheDocument();
    expect(screen.getByText(/double-check the spender address before approving/i)).toBeInTheDocument();
    expect(screen.getByText(/run allowance for the spender before approving/i)).toBeInTheDocument();
    expect(screen.getByText(/start with the exact allowance this app needs/i)).toBeInTheDocument();
    expect(screen.getByText(/if the token rejects allowance increases, reset that spender to 0 first/i)).toBeInTheDocument();
    expect(screen.getByText(/revoke by setting the allowance back to 0/i)).toBeInTheDocument();
    expect(screen.getByText('Revoke path')).toBeInTheDocument();
    expect(screen.getByText(/use the same spender and submit approve with amount 0/i)).toBeInTheDocument();
    expect(screen.getByText(/rerun allowance to confirm it reads 0/i)).toBeInTheDocument();
    expect(screen.getByText(/after approving, rerun allowance to confirm the new spending limit/i)).toBeInTheDocument();
  });

  test('renders a transfer helper rail for ERC20 send sections', () => {
    const tokenTask: BuilderTask = {
      ...task,
      input: { ...task.input, skill: 'token-dashboard' },
      result: {
        ...task.result!,
        pageConfig: {
          ...task.result!.pageConfig!,
          skill: 'token-dashboard',
          methods: [
            ...task.result!.pageConfig!.methods,
            {
              name: 'transfer',
              label: 'Send tokens',
              type: 'write',
              dangerLevel: 'safe',
              stateMutability: 'nonpayable',
              inputs: [
                { name: 'recipient', type: 'address' },
                { name: 'amount', type: 'uint256' },
              ],
              outputs: [{ name: '', type: 'bool' }],
              description: 'Transfer tokens to another wallet.',
            },
          ],
          sections: [
            {
              id: 'send-tokens',
              title: 'Send tokens',
              description: 'Move tokens to another wallet.',
              variant: 'actions',
              methodNames: ['transfer'],
            },
          ],
        },
      },
    };

    render(
      <PreviewPage
        task={tokenTask}
        walletState={{ account: '0x1111111111111111111111111111111111111111', chainId: 71, isConnecting: false }}
        onConnectWallet={vi.fn()}
        onRunMethod={vi.fn()}
        activeResult={null}
      />,
    );

    expect(screen.getByText('Transfer checklist')).toBeInTheDocument();
    expect(screen.getByText(/confirm the recipient address and token amount/i)).toBeInTheDocument();
    expect(screen.getByText(/only send to addresses you control or have verified/i)).toBeInTheDocument();
    expect(screen.getByText(/use the token decimals shown by the app before entering amount/i)).toBeInTheDocument();
    expect(screen.getByText(/send a small test amount first/i)).toBeInTheDocument();
    expect(screen.getByText(/token transfers cannot be reversed/i)).toBeInTheDocument();
    expect(screen.getByText(/after sending, rerun balance of for sender and recipient/i)).toBeInTheDocument();
    expect(screen.getByText(/make sure the wallet network matches conflux espace testnet/i)).toBeInTheDocument();
    expect(screen.getByText(/connected wallet will pay gas/i)).toBeInTheDocument();
  });

  test('keeps ERC20 advanced token actions collapsed until the user opens them', () => {
    const tokenTask: BuilderTask = {
      ...task,
      input: { ...task.input, skill: 'token-dashboard' },
      result: {
        ...task.result!,
        pageConfig: {
          ...task.result!.pageConfig!,
          skill: 'token-dashboard',
          methods: [
            ...task.result!.pageConfig!.methods,
            {
              name: 'transferFrom',
              label: 'Transfer From',
              type: 'write',
              dangerLevel: 'warn',
              stateMutability: 'nonpayable',
              inputs: [
                { name: 'from', type: 'address' },
                { name: 'to', type: 'address' },
                { name: 'amount', type: 'uint256' },
              ],
              outputs: [{ name: '', type: 'bool' }],
              description: 'Move approved tokens from another wallet.',
            },
          ],
          sections: [
            {
              id: 'advanced-token-actions',
              title: 'Advanced token actions',
              description: 'Less common token actions for power users.',
              variant: 'actions',
              methodNames: ['transferFrom'],
            },
          ],
        },
      },
    };

    render(
      <PreviewPage
        task={tokenTask}
        walletState={{ account: '0x1111111111111111111111111111111111111111', chainId: 71, isConnecting: false }}
        onConnectWallet={vi.fn()}
        onRunMethod={vi.fn()}
        activeResult={null}
      />,
    );

    expect(screen.getByText('Advanced token actions')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /transfer from/i })).not.toBeInTheDocument();

    fireEvent.click(screen.getByText('Advanced token actions'));

    expect(screen.getByRole('button', { name: /transfer from/i })).toBeInTheDocument();
  });

  test('does not render empty description paragraph when description is empty string', () => {
    const taskEmptyDesc: BuilderTask = {
      id: 'task-3',
      status: 'completed',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      input: {
        contractAddress: '0x1234567890123456789012345678901234567890',
        chain: 'conflux-espace-testnet',
        skill: 'staking-page',
        model: 'gpt-5.4',
        apiKey: 'test',
      },
      result: {
        warnings: [],
        dangerousMethods: [],
        methods: [{
          name: 'earned',
          label: 'Earned',
          type: 'read',
          dangerLevel: 'safe',
          stateMutability: 'view',
          inputs: [{ name: 'account', type: 'address' }],
          outputs: [{ name: '', type: 'uint256' }],
          description: 'Check earned rewards.',
        }],
        sections: [{
          id: 'read-methods',
          title: 'Read methods',
          description: '',
          variant: 'read',
          methodNames: ['earned'],
        }],
        pageConfig: {
          title: 'Staking Dashboard',
          description: '',
          chain: 'conflux-espace-testnet',
          chainId: 71,
          contractAddress: '0x1234567890123456789012345678901234567890',
          contractName: 'Staking',
          skill: 'staking-page',
          warnings: [],
          dangerousMethods: [],
          methods: [{
            name: 'earned',
            label: 'Earned',
            type: 'read',
            dangerLevel: 'safe',
            stateMutability: 'view',
            inputs: [{ name: 'account', type: 'address' }],
            outputs: [{ name: '', type: 'uint256' }],
            description: 'Check earned rewards.',
          }],
          sections: [{
            id: 'read-methods',
            title: 'Read methods',
            description: '',
            variant: 'read',
            methodNames: ['earned'],
          }],
        },
      },
    };

    render(
      <PreviewPage
        task={taskEmptyDesc}
        walletState={{ account: null, chainId: null, isConnecting: false }}
        onConnectWallet={vi.fn()}
        onRunMethod={vi.fn()}
        activeResult={null}
      />,
    );

    // The title should be visible
    expect(screen.getByText('Staking Dashboard')).toBeInTheDocument();
    // But no empty <p> for description — query for a lone <p> with no text
    // actually just verify the empty string doesn't produce a visible element
    const descriptionParagraph = screen.queryByText('', { selector: 'p' });
    expect(descriptionParagraph).not.toBeInTheDocument();
  });
});
