import { beforeEach, describe, expect, test, vi } from 'vitest';

const { readContractMock, getStorageAtMock, createPublicClientMock, httpMock } = vi.hoisted(() => {
  const readContractMock = vi.fn();
  const getStorageAtMock = vi.fn();
  return {
    readContractMock,
    getStorageAtMock,
    createPublicClientMock: vi.fn(() => ({ readContract: readContractMock, getStorageAt: getStorageAtMock })),
    httpMock: vi.fn((url: string) => ({ url })),
  };

  test('uses ERC1967 implementation ABI when explorer returns only proxy fallback ABI', async () => {
    const proxyAbi = [
      { type: 'event', name: 'AdminChanged', inputs: [], outputs: [] },
      { type: 'event', name: 'Upgraded', inputs: [{ name: 'implementation', type: 'address' }], outputs: [] },
      { type: 'fallback', stateMutability: 'payable', inputs: [], outputs: [] },
    ];
    const tokenAbi = [
      { type: 'function', name: 'balanceOf', stateMutability: 'view', inputs: [{ name: 'account', type: 'address' }], outputs: [{ name: '', type: 'uint256' }] },
      { type: 'function', name: 'transfer', stateMutability: 'nonpayable', inputs: [{ name: 'to', type: 'address' }, { name: 'amount', type: 'uint256' }], outputs: [{ name: '', type: 'bool' }] },
      { type: 'function', name: 'approve', stateMutability: 'nonpayable', inputs: [{ name: 'spender', type: 'address' }, { name: 'amount', type: 'uint256' }], outputs: [{ name: '', type: 'bool' }] },
      { type: 'function', name: 'allowance', stateMutability: 'view', inputs: [{ name: 'owner', type: 'address' }, { name: 'spender', type: 'address' }], outputs: [{ name: '', type: 'uint256' }] },
      { type: 'function', name: 'symbol', stateMutability: 'view', inputs: [], outputs: [{ name: '', type: 'string' }] },
    ];
    const implementationAddress = '0x1111111111111111111111111111111111111111';
    const storage = `0x${'0'.repeat(24)}${implementationAddress.slice(2)}`;
    const fetchMock = vi.fn(async (url: string) => ({
      ok: true,
      json: async () => url.includes(implementationAddress)
        ? { result: { name: 'Faucet USDT', abi: JSON.stringify(tokenAbi), verifyInfo: { contractName: 'FaucetUSDT' } } }
        : { result: { name: '', abi: JSON.stringify(proxyAbi), verifyInfo: { contractName: 'TransparentUpgradeableProxy' } } },
    }));
    vi.stubGlobal('fetch', fetchMock);
    getStorageAtMock.mockResolvedValue(storage);
    readContractMock.mockResolvedValue('Faucet USDT');

    const result = await fetchContractMetadata('0x05d714465e24b7639a31eeb57d37396f889df725');

    expect(result.abi.map((entry) => entry.name)).toEqual(expect.arrayContaining(['balanceOf', 'transfer', 'approve', 'allowance']));
    expect(result.contractName).toBe('Faucet USDT');
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(getStorageAtMock).toHaveBeenCalledWith(expect.objectContaining({
      address: '0x05d714465e24b7639a31eeb57d37396f889df725',
    }));
  });

});

vi.mock('viem', async () => {
  const actual = await vi.importActual<typeof import('viem')>('viem');
  return {
    ...actual,
    createPublicClient: createPublicClientMock,
    http: httpMock,
  };

  test('uses ERC1967 implementation ABI when explorer returns only proxy fallback ABI', async () => {
    const proxyAbi = [
      { type: 'event', name: 'AdminChanged', inputs: [], outputs: [] },
      { type: 'event', name: 'Upgraded', inputs: [{ name: 'implementation', type: 'address' }], outputs: [] },
      { type: 'fallback', stateMutability: 'payable', inputs: [], outputs: [] },
    ];
    const tokenAbi = [
      { type: 'function', name: 'balanceOf', stateMutability: 'view', inputs: [{ name: 'account', type: 'address' }], outputs: [{ name: '', type: 'uint256' }] },
      { type: 'function', name: 'transfer', stateMutability: 'nonpayable', inputs: [{ name: 'to', type: 'address' }, { name: 'amount', type: 'uint256' }], outputs: [{ name: '', type: 'bool' }] },
      { type: 'function', name: 'approve', stateMutability: 'nonpayable', inputs: [{ name: 'spender', type: 'address' }, { name: 'amount', type: 'uint256' }], outputs: [{ name: '', type: 'bool' }] },
      { type: 'function', name: 'allowance', stateMutability: 'view', inputs: [{ name: 'owner', type: 'address' }, { name: 'spender', type: 'address' }], outputs: [{ name: '', type: 'uint256' }] },
      { type: 'function', name: 'symbol', stateMutability: 'view', inputs: [], outputs: [{ name: '', type: 'string' }] },
    ];
    const implementationAddress = '0x1111111111111111111111111111111111111111';
    const storage = `0x${'0'.repeat(24)}${implementationAddress.slice(2)}`;
    const fetchMock = vi.fn(async (url: string) => ({
      ok: true,
      json: async () => url.includes(implementationAddress)
        ? { result: { name: 'Faucet USDT', abi: JSON.stringify(tokenAbi), verifyInfo: { contractName: 'FaucetUSDT' } } }
        : { result: { name: '', abi: JSON.stringify(proxyAbi), verifyInfo: { contractName: 'TransparentUpgradeableProxy' } } },
    }));
    vi.stubGlobal('fetch', fetchMock);
    getStorageAtMock.mockResolvedValue(storage);
    readContractMock.mockResolvedValue('Faucet USDT');

    const result = await fetchContractMetadata('0x05d714465e24b7639a31eeb57d37396f889df725');

    expect(result.abi.map((entry) => entry.name)).toEqual(expect.arrayContaining(['balanceOf', 'transfer', 'approve', 'allowance']));
    expect(result.contractName).toBe('Faucet USDT');
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(getStorageAtMock).toHaveBeenCalledWith(expect.objectContaining({
      address: '0x05d714465e24b7639a31eeb57d37396f889df725',
    }));
  });

});

import { fetchContractMetadata } from '../server/services/abi';

describe('fetchContractMetadata', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    readContractMock.mockReset();
    getStorageAtMock.mockReset();
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

  test('uses ERC1967 implementation ABI when explorer returns only proxy fallback ABI', async () => {
    const proxyAbi = [
      { type: 'event', name: 'AdminChanged', inputs: [], outputs: [] },
      { type: 'event', name: 'Upgraded', inputs: [{ name: 'implementation', type: 'address' }], outputs: [] },
      { type: 'fallback', stateMutability: 'payable', inputs: [], outputs: [] },
    ];
    const tokenAbi = [
      { type: 'function', name: 'balanceOf', stateMutability: 'view', inputs: [{ name: 'account', type: 'address' }], outputs: [{ name: '', type: 'uint256' }] },
      { type: 'function', name: 'transfer', stateMutability: 'nonpayable', inputs: [{ name: 'to', type: 'address' }, { name: 'amount', type: 'uint256' }], outputs: [{ name: '', type: 'bool' }] },
      { type: 'function', name: 'approve', stateMutability: 'nonpayable', inputs: [{ name: 'spender', type: 'address' }, { name: 'amount', type: 'uint256' }], outputs: [{ name: '', type: 'bool' }] },
      { type: 'function', name: 'allowance', stateMutability: 'view', inputs: [{ name: 'owner', type: 'address' }, { name: 'spender', type: 'address' }], outputs: [{ name: '', type: 'uint256' }] },
      { type: 'function', name: 'symbol', stateMutability: 'view', inputs: [], outputs: [{ name: '', type: 'string' }] },
    ];
    const implementationAddress = '0x1111111111111111111111111111111111111111';
    const storage = `0x${'0'.repeat(24)}${implementationAddress.slice(2)}`;
    const fetchMock = vi.fn(async (url: string) => ({
      ok: true,
      json: async () => url.includes(implementationAddress)
        ? { result: { name: 'Faucet USDT', abi: JSON.stringify(tokenAbi), verifyInfo: { contractName: 'FaucetUSDT' } } }
        : { result: { name: '', abi: JSON.stringify(proxyAbi), verifyInfo: { contractName: 'TransparentUpgradeableProxy' } } },
    }));
    vi.stubGlobal('fetch', fetchMock);
    getStorageAtMock.mockResolvedValue(storage);
    readContractMock.mockResolvedValue('Faucet USDT');

    const result = await fetchContractMetadata('0x05d714465e24b7639a31eeb57d37396f889df725');

    expect(result.abi.map((entry) => entry.name)).toEqual(expect.arrayContaining(['balanceOf', 'transfer', 'approve', 'allowance']));
    expect(result.contractName).toBe('Faucet USDT');
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(getStorageAtMock).toHaveBeenCalledWith(expect.objectContaining({
      address: '0x05d714465e24b7639a31eeb57d37396f889df725',
    }));
  });

});
