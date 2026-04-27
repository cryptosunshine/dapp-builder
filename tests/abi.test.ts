import { beforeEach, describe, expect, test, vi } from 'vitest';

const { readContractMock, createPublicClientMock, httpMock } = vi.hoisted(() => {
  const readContractMock = vi.fn();
  return {
    readContractMock,
    createPublicClientMock: vi.fn(() => ({ readContract: readContractMock })),
    httpMock: vi.fn((url: string) => ({ url })),
  };
});

vi.mock('viem', async () => {
  const actual = await vi.importActual<typeof import('viem')>('viem');
  return {
    ...actual,
    createPublicClient: createPublicClientMock,
    http: httpMock,
  };
});

import { fetchContractMetadata } from '../server/services/abi';

describe('fetchContractMetadata', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    readContractMock.mockReset();
    createPublicClientMock.mockClear();
    httpMock.mockClear();
  });

  test('falls back to onchain name() when explorer metadata has no contract name', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          result: {
            name: '',
            verifyInfo: {},
            abi: JSON.stringify([
              {
                type: 'function',
                name: 'name',
                stateMutability: 'view',
                inputs: [],
                outputs: [{ name: '', type: 'string' }],
              },
            ]),
          },
        }),
      }),
    );
    readContractMock.mockResolvedValue('Faucet USDT');

    const result = await fetchContractMetadata('0x7d682e65efc5c13bf4e394b8f376c48e6bae0355');

    expect(result.contractName).toBe('Faucet USDT');
    expect(createPublicClientMock).toHaveBeenCalledTimes(1);
    expect(httpMock).toHaveBeenCalledTimes(1);
    expect(readContractMock).toHaveBeenCalledWith(
      expect.objectContaining({
        address: '0x7d682e65efc5c13bf4e394b8f376c48e6bae0355',
        functionName: 'name',
      }),
    );
  });
});
