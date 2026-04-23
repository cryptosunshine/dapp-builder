import type { ChainKey } from '../types';

export const confluxESpaceTestnet = {
  key: 'conflux-espace-testnet' as ChainKey,
  chainId: 71,
  chainName: 'Conflux eSpace Testnet',
  rpcUrl: 'https://evmtestnet.confluxrpc.com',
  blockExplorerUrl: 'https://evmtestnet.confluxscan.org',
  nativeCurrency: {
    name: 'Conflux',
    symbol: 'CFX',
    decimals: 18,
  },
};

export const chainRegistry: Record<ChainKey, typeof confluxESpaceTestnet> = {
  'conflux-espace-testnet': confluxESpaceTestnet,
};

export function getChainMeta(chain: ChainKey) {
  return chainRegistry[chain];
}
