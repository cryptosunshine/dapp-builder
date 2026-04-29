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

const ERC1967_IMPLEMENTATION_SLOT = '0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc';
const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';

function normalizeImplementationAddress(value: unknown) {
  if (typeof value !== 'string' || !value.startsWith('0x') || value.length < 42) {
    return undefined;
  }
  const address = `0x${value.slice(-40)}`;
  if (!isAddress(address) || address.toLowerCase() === ZERO_ADDRESS) {
    return undefined;
  }
  return address;
}

function hasCallableFunctions(abi: AbiEntry[]) {
  return abi.some((entry) => entry.type === 'function' && entry.name);
}

function looksLikeUpgradeableProxyAbi(abi: AbiEntry[]) {
  const names = new Set(abi.map((entry) => entry.name).filter(Boolean));
  return !hasCallableFunctions(abi) && (names.has('Upgraded') || names.has('AdminChanged')) && abi.some((entry) => entry.type === 'fallback');
}

function createChainClient() {
  return createPublicClient({
    chain: undefined,
    transport: http(appConfig.confluxESpaceTestnetRpcUrl),
  });
}

async function resolveErc1967ImplementationAddress(address: string) {
  const publicClient = createChainClient();
  const storage = await publicClient
    .getStorageAt({
      address: address as `0x${string}`,
      slot: ERC1967_IMPLEMENTATION_SLOT,
    })
    .catch(() => undefined);
  return normalizeImplementationAddress(storage);
}

function normalizeExplorerResult(payload: { result?: Record<string, unknown> } | Record<string, unknown>) {
  return ('result' in payload ? payload.result : payload) as Record<string, unknown> | undefined;
}

async function fetchExplorerResult(address: string) {
  const query = ABI_FIELDS.map((field) => `fields=${field}`).join('&');
  const url = `${appConfig.confluxScanBaseUrl}/v1/contract/${address}?${query}`;
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Failed to fetch contract metadata: ${response.status} ${response.statusText}`);
  }

  const payload = (await response.json()) as { result?: Record<string, unknown> } | Record<string, unknown>;
  return normalizeExplorerResult(payload);
}

function contractNameFromExplorer(result: Record<string, unknown> | undefined) {
  const verifyInfo = result?.verifyInfo as { contractName?: string } | undefined;
  return (typeof result?.name === 'string' && result.name.trim() ? result.name : undefined) ||
    (typeof verifyInfo?.contractName === 'string' && verifyInfo.contractName.trim() ? verifyInfo.contractName : undefined);
}

function normalizeMetadataResult(result: Record<string, unknown> | undefined) {
  const abi = normalizeAbi(result?.abi);
  return { abi, explorerName: contractNameFromExplorer(result), metadata: result };
}

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
  const publicClient = createChainClient();

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

  const result = await fetchExplorerResult(address);
  const normalized = normalizeMetadataResult(result);
  let abi = normalized.abi;
  let contractName = normalized.explorerName;
  let metadata = normalized.metadata;

  if (looksLikeUpgradeableProxyAbi(abi)) {
    const implementationAddress = await resolveErc1967ImplementationAddress(address);
    if (implementationAddress) {
      const implementationResult = await fetchExplorerResult(implementationAddress);
      const implementation = normalizeMetadataResult(implementationResult);
      if (hasCallableFunctions(implementation.abi)) {
        abi = implementation.abi;
        contractName = implementation.explorerName;
        metadata = {
          ...metadata,
          proxyAddress: address,
          implementationAddress,
          implementation: implementation.metadata,
        };
      }
    }
  }

  const chainResolvedName = await resolveContractNameFromChain(address, abi).catch(() => undefined);

  return {
    abi,
    contractName: contractName || chainResolvedName || 'Unknown Contract',
    metadata,
  };
}
