import { afterEach, describe, expect, test, vi } from 'vitest';
import { fetchContractMetadata } from '../server/services/abi';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('fetchContractMetadata', () => {
  test('throws a clear error when ConfluxScan returns no ABI', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          result: {
            name: 'Missing ABI Contract',
          },
        }),
      }),
    );

    await expect(fetchContractMetadata('0x1234567890123456789012345678901234567890')).rejects.toThrow(
      'Contract ABI is unavailable.',
    );
  });
});
