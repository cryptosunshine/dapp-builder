// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
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
});
