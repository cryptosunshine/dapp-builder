import { isAddress } from 'viem';
import { abiEntrySchema, type AbiEntry } from '../../shared/schema.js';
import { appConfig } from '../config.js';

const ABI_FIELDS = [
  'name',
  'iconUrl',
  'sponsor',
  'admin',
  'from',
  'website',
  'transactionHash',
  'cfxTransferCount',
  'erc20TransferCount',
  'erc721TransferCount',
  'erc1155TransferCount',
  'stakingBalance',
  'sourceCode',
  'abi',
  'isRegistered',
  'verifyInfo',
];

function normalizeAbi(rawAbi: unknown): AbiEntry[] {
  if (rawAbi == null || rawAbi === '') {
    throw new Error('Contract ABI is unavailable.');
  }

  let parsed: unknown;
  try {
    parsed = typeof rawAbi === 'string' ? JSON.parse(rawAbi) : rawAbi;
  } catch {
    throw new Error('Contract ABI is unavailable.');
  }

  if (!Array.isArray(parsed)) {
    throw new Error('Contract ABI is unavailable.');
  }

  return parsed.map((entry) => abiEntrySchema.parse(entry));
}

export async function fetchContractMetadata(address: string) {
  if (!isAddress(address)) {
    throw new Error('Invalid contract address.');
  }

  const query = ABI_FIELDS.map((field) => `fields=${field}`).join('&');
  const url = `${appConfig.confluxScanBaseUrl}/v1/contract/${address}?${query}`;
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Failed to fetch contract metadata: ${response.status} ${response.statusText}`);
  }

  const payload = (await response.json()) as { result?: Record<string, unknown> } | Record<string, unknown>;
  const result = ('result' in payload ? payload.result : payload) as Record<string, unknown> | undefined;
  const abi = normalizeAbi(result?.abi);
  const verifyInfo = result?.verifyInfo as { contractName?: string } | undefined;

  return {
    abi,
    contractName:
      (typeof result?.name === 'string' ? result.name : undefined) ||
      (typeof verifyInfo?.contractName === 'string' ? verifyInfo.contractName : undefined) ||
      'Unknown Contract',
    metadata: result,
  };
}
