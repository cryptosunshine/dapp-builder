import { getChainMeta } from '../lib/chains';
import type { ChainKey, WalletState } from '../types';

interface WalletBarProps {
  walletState: WalletState;
  onConnectWallet: () => void | Promise<void>;
  chain: ChainKey;
  wallets?: Array<{ id: string; name: string; icon?: string }>;
}

export function WalletBar({ walletState, onConnectWallet, chain, wallets }: WalletBarProps) {
  const chainMeta = getChainMeta(chain);
  const connectedToExpectedChain = walletState.chainId === chainMeta.chainId;

  return (
    <div className="wallet-bar">
      <div>
        <div className="wallet-bar__label">Wallet</div>
        <div className="wallet-bar__value">
          {walletState.account ? walletState.account : 'Not connected'}
        </div>
        <div className={`wallet-bar__chain ${connectedToExpectedChain ? 'is-ok' : 'is-warning'}`}>
          Expected network: {chainMeta.chainName}
        </div>
        {wallets && wallets.length > 0 && (
          <div className="wallet-options">
            {wallets.map((wallet) => (
              <span key={wallet.id} className="wallet-chip">{wallet.name}</span>
            ))}
          </div>
        )}
      </div>
      <button type="button" onClick={() => void onConnectWallet()} className="primary-button">
        {walletState.account ? 'Reconnect wallet' : 'Connect wallet'}
      </button>
    </div>
  );
}
