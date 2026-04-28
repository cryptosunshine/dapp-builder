import { confluxESpaceTestnet } from './chains';
import type { WalletState } from '../types';

declare global {
  interface Window {
    ethereum?: {
      request: (request: { method: string; params?: unknown[] }) => Promise<any>;
    };
  }
}

export interface DiscoveredWallet {
  id: string;
  name: string;
  icon?: string;
  provider?: unknown;
}

export function getEthereumProvider() {
  if (typeof window === 'undefined' || !window.ethereum) {
    throw new Error('No EVM wallet detected. Install MetaMask or another injected wallet.');
  }
  return window.ethereum;
}

function chainIdToHex(chainId: number) {
  return `0x${chainId.toString(16)}`;
}

export async function getWalletState(): Promise<WalletState> {
  try {
    const ethereum = getEthereumProvider();
    const accounts = (await ethereum.request({ method: 'eth_accounts' })) as string[];
    const chainIdHex = (await ethereum.request({ method: 'eth_chainId' })) as string;
    return {
      account: accounts[0] ?? null,
      chainId: Number(chainIdHex),
      isConnecting: false,
      error: null,
    };
  } catch (error) {
    return {
      account: null,
      chainId: null,
      isConnecting: false,
      error: error instanceof Error ? error.message : 'Failed to read wallet state.',
    };
  }
}

export async function connectWallet(): Promise<WalletState> {
  const ethereum = getEthereumProvider();
  const accounts = (await ethereum.request({ method: 'eth_requestAccounts' })) as string[];
  const chainIdHex = (await ethereum.request({ method: 'eth_chainId' })) as string;
  return {
    account: accounts[0] ?? null,
    chainId: Number(chainIdHex),
    isConnecting: false,
    error: null,
  };
}

export async function ensureConfluxESpaceTestnet() {
  const ethereum = getEthereumProvider();
  const targetChainIdHex = chainIdToHex(confluxESpaceTestnet.chainId);

  try {
    await ethereum.request({
      method: 'wallet_switchEthereumChain',
      params: [{ chainId: targetChainIdHex }],
    });
  } catch (error: any) {
    if (error?.code !== 4902) {
      throw error;
    }

    await ethereum.request({
      method: 'wallet_addEthereumChain',
      params: [
        {
          chainId: targetChainIdHex,
          chainName: confluxESpaceTestnet.chainName,
          rpcUrls: [confluxESpaceTestnet.rpcUrl],
          blockExplorerUrls: [confluxESpaceTestnet.blockExplorerUrl],
          nativeCurrency: confluxESpaceTestnet.nativeCurrency,
        },
      ],
    });
  }
}

export async function discoverEip6963Wallets(timeoutMs = 300): Promise<DiscoveredWallet[]> {
  if (typeof window === 'undefined') return [];
  const wallets = new Map<string, DiscoveredWallet>();

  function onAnnounce(event: Event) {
    const detail = (event as CustomEvent).detail as {
      info?: { uuid?: string; rdns?: string; name?: string; icon?: string };
      provider?: unknown;
    };
    const id = detail.info?.rdns ?? detail.info?.uuid ?? detail.info?.name;
    if (!id || !detail.info?.name) return;
    wallets.set(id, { id, name: detail.info.name, icon: detail.info.icon, provider: detail.provider });
  }

  window.addEventListener('eip6963:announceProvider', onAnnounce);
  window.dispatchEvent(new Event('eip6963:requestProvider'));
  await new Promise((resolve) => window.setTimeout(resolve, timeoutMs));
  window.removeEventListener('eip6963:announceProvider', onAnnounce);

  return [...wallets.values()];
}
