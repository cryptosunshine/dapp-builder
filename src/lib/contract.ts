import { createPublicClient, createWalletClient, custom, http } from 'viem';
import type { AbiParameter } from '../../shared/schema';
import type { MethodRunResult, PageConfig, PageMethod, WalletState } from '../types';
import { confluxESpaceTestnet } from './chains';
import { ensureConfluxESpaceTestnet, getEthereumProvider, getWalletState } from './wallet';

function getInputKey(input: AbiParameter, index: number) {
  return input.name?.trim() || `arg${index}`;
}

function coerceScalar(type: string, rawValue: string): unknown {
  if (type.startsWith('uint') || type.startsWith('int')) {
    return BigInt(rawValue);
  }
  if (type === 'bool') {
    return ['true', '1', 'yes', 'y'].includes(rawValue.trim().toLowerCase());
  }
  if (type.startsWith('bytes')) {
    return rawValue as `0x${string}`;
  }
  if (type === 'address') {
    return rawValue as `0x${string}`;
  }
  return rawValue;
}

function coerceValue(type: string, rawValue: string): unknown {
  if (type.endsWith('[]')) {
    const innerType = type.slice(0, -2);
    const values = rawValue.trim().startsWith('[')
      ? (JSON.parse(rawValue) as unknown[]).map((value) => String(value))
      : rawValue
          .split(',')
          .map((value) => value.trim())
          .filter(Boolean);
    return values.map((value) => coerceScalar(innerType, value));
  }
  return coerceScalar(type, rawValue);
}

function serializeResult(value: unknown): unknown {
  if (typeof value === 'bigint') {
    return value.toString();
  }
  if (Array.isArray(value)) {
    return value.map(serializeResult);
  }
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value as Record<string, unknown>).map(([key, entry]) => [key, serializeResult(entry)]));
  }
  return value;
}

function methodToAbi(method: PageMethod) {
  return [
    {
      type: 'function',
      name: method.name,
      stateMutability: method.stateMutability,
      inputs: method.inputs,
      outputs: method.outputs,
    },
  ] as const;
}

export async function runContractMethod({
  pageConfig,
  method,
  formValues,
  walletState,
}: {
  pageConfig: PageConfig;
  method: PageMethod;
  formValues: Record<string, string>;
  walletState: WalletState;
}): Promise<MethodRunResult> {
  const args = method.inputs.map((input, index) => coerceValue(input.type, formValues[getInputKey(input, index)] ?? ''));
  const publicClient = createPublicClient({
    chain: undefined,
    transport: http(confluxESpaceTestnet.rpcUrl),
  });

  if (method.type === 'read') {
    const result = await publicClient.readContract({
      address: pageConfig.contractAddress as `0x${string}`,
      abi: methodToAbi(method),
      functionName: method.name,
      args,
    });

    return {
      methodName: method.name,
      status: 'success',
      data: serializeResult(result),
      message: 'Read completed successfully.',
    };
  }

  if (!walletState.account) {
    throw new Error('Connect a wallet before sending transactions.');
  }

  if (walletState.chainId !== pageConfig.chainId) {
    await ensureConfluxESpaceTestnet();
  }

  const refreshedWalletState = await getWalletState();
  if (refreshedWalletState.chainId !== pageConfig.chainId) {
    throw new Error('Wallet is not connected to Conflux eSpace Testnet.');
  }

  const walletClient = createWalletClient({
    transport: custom(getEthereumProvider()),
  });

  const hash = await walletClient.writeContract({
    account: refreshedWalletState.account as `0x${string}`,
    address: pageConfig.contractAddress as `0x${string}`,
    abi: methodToAbi(method),
    functionName: method.name,
    args,
  });

  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  return {
    methodName: method.name,
    status: 'success',
    data: serializeResult(receipt),
    message: `Transaction confirmed: ${receipt.transactionHash}`,
  };
}
