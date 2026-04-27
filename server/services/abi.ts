import { createPublicClient, http, isAddress } from 'viem';
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

const NAME_CALL_ABI = [
  {
    type: 'function',
    name: 'name',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'string' }],
  },
] as const;

const SYMBOL_CALL_ABI = [
  {
    type: 'function',
    name: 'symbol',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'string' }],
  },
] as const;

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

function hasZeroArgViewStringMethod(abi: AbiEntry[], name: string) {
  return abi.some(
    (entry) =>
      entry.type === 'function' &&
      entry.name === name &&
      entry.stateMutability === 'view' &&
      entry.inputs.length === 0 &&
      entry.outputs.length > 0 &&
      entry.outputs[0]?.type === 'string',
  );
}

async function resolveContractNameFromChain(address: string, abi: AbiEntry[]) {
  const publicClient = createPublicClient({
    chain: undefined,
    transport: http(appConfig.confluxESpaceTestnetRpcUrl),
  });

  const name = hasZeroArgViewStringMethod(abi, 'name')
    ? await publicClient
        .readContract({
          address: address as `0x${string}`,
          abi: NAME_CALL_ABI,
          functionName: 'name',
        })
        .catch(() => undefined)
    : undefined;

  if (typeof name === 'string' && name.trim()) {
    return name.trim();
  }

  const symbol = hasZeroArgViewStringMethod(abi, 'symbol')
    ? await publicClient
        .readContract({
          address: address as `0x${string}`,
          abi: SYMBOL_CALL_ABI,
          functionName: 'symbol',
        })
        .catch(() => undefined)
    : undefined;

  if (typeof symbol === 'string' && symbol.trim()) {
    return `${symbol.trim()} Token`;
  }

  return undefined;
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
  const chainResolvedName = await resolveContractNameFromChain(address, abi).catch(() => undefined);

  return {
    abi,
    contractName:
      (typeof result?.name === 'string' ? result.name : undefined) ||
      (typeof verifyInfo?.contractName === 'string' ? verifyInfo.contractName : undefined) ||
      chainResolvedName ||
      'Unknown Contract',
    metadata: result,
  };
}
