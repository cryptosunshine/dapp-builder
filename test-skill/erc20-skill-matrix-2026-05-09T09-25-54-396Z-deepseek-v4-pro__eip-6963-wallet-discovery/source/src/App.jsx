import { createRoot } from 'react-dom/client';
import { useState, useEffect, useCallback } from 'react';
import { createPublicClient, createWalletClient, custom, http, getContract, formatUnits, parseUnits } from 'viem';
import './styles.css';

const CONTRACT = '0x05d714465e24b7639a31eeb57d37396f889df725';
const CHAIN_ID = 71; // conflux-espace-testnet
const CHAIN_NAME = 'Conflux eSpace Testnet';
const RPC_URL = 'https://evmtestnet.confluxrpc.com';

const abi = [
  { inputs: [], name: 'name', outputs: [{ type: 'string' }], stateMutability: 'view', type: 'function' },
  { inputs: [], name: 'symbol', outputs: [{ type: 'string' }], stateMutability: 'view', type: 'function' },
  { inputs: [], name: 'decimals', outputs: [{ type: 'uint8' }], stateMutability: 'pure', type: 'function' },
  { inputs: [], name: 'totalSupply', outputs: [{ type: 'uint256' }], stateMutability: 'view', type: 'function' },
  { inputs: [{ name: 'account', type: 'address' }], name: 'balanceOf', outputs: [{ type: 'uint256' }], stateMutability: 'view', type: 'function' },
  { inputs: [{ name: 'owner', type: 'address' }, { name: 'spender', type: 'address' }], name: 'allowance', outputs: [{ type: 'uint256' }], stateMutability: 'view', type: 'function' },
  { inputs: [{ name: 'spender', type: 'address' }, { name: 'value', type: 'uint256' }], name: 'approve', outputs: [{ type: 'bool' }], stateMutability: 'nonpayable', type: 'function' },
  { inputs: [{ name: 'from', type: 'address' }, { name: 'to', type: 'address' }, { name: 'value', type: 'uint256' }], name: 'transferFrom', outputs: [{ type: 'bool' }], stateMutability: 'nonpayable', type: 'function' },
  { inputs: [{ name: 'to', type: 'address' }, { name: 'value', type: 'uint256' }], name: 'transfer', outputs: [{ type: 'bool' }], stateMutability: 'nonpayable', type: 'function' },
  { inputs: [], name: 'owner', outputs: [{ type: 'address' }], stateMutability: 'view', type: 'function' },
  { inputs: [], name: 'paused', outputs: [{ type: 'bool' }], stateMutability: 'view', type: 'function' },
  { inputs: [], name: 'pause', outputs: [], stateMutability: 'nonpayable', type: 'function' },
  { inputs: [], name: 'unpause', outputs: [], stateMutability: 'nonpayable', type: 'function' },
  { inputs: [{ name: 'newOwner', type: 'address' }], name: 'transferOwnership', outputs: [], stateMutability: 'nonpayable', type: 'function' },
  { inputs: [], name: 'renounceOwnership', outputs: [], stateMutability: 'nonpayable', type: 'function' },
];

function App() {
  const [providers, setProviders] = useState([]);
  const [selectedProvider, setSelectedProvider] = useState(null);
  const [account, setAccount] = useState('');
  const [chainId, setChainId] = useState(null);
  const [publicClient, setPublicClient] = useState(null);
  const [walletClient, setWalletClient] = useState(null);

  const [tokenInfo, setTokenInfo] = useState({ name: '', symbol: '', decimals: 18, totalSupply: 0n });
  const [balance, setBalance] = useState(0n);
  const [allowanceData, setAllowanceData] = useState({ spender: '', amount: 0n });
  const [txStatus, setTxStatus] = useState('');
  const [isOwner, setIsOwner] = useState(false);
  const [paused, setPaused] = useState(false);

  // Format helpers
  const fmt = (amount) => formatUnits(amount, tokenInfo.decimals);
  const toWei = (value) => parseUnits(value || '0', tokenInfo.decimals);

  // EIP-6963 discovery
  useEffect(() => {
    const handleAnnounce = (event) => {
      const { info, provider } = event.detail;
      setProviders((prev) => {
        if (prev.find((p) => p.info.uuid === info.uuid)) return prev;
        return [...prev, { info, provider }];
      });
    };
    window.addEventListener('eip6963:announceProvider', handleAnnounce);
    window.dispatchEvent(new Event('eip6963:requestProvider'));
    return () => window.removeEventListener('eip6963:announceProvider', handleAnnounce);
  }, []);

  // Setup clients after connection
  const connectWallet = useCallback(async (providerInfo) => {
    const provider = providerInfo.provider;
    try {
      const accounts = await provider.request({ method: 'eth_requestAccounts' });
      const chainIdHex = await provider.request({ method: 'eth_chainId' });
      const currentChainId = parseInt(chainIdHex, 16);
      setSelectedProvider(providerInfo);
      setAccount(accounts[0]);
      setChainId(currentChainId);
      const transport = custom(provider);
      setPublicClient(createPublicClient({ transport, chain: { id: CHAIN_ID, name: CHAIN_NAME, rpcUrls: { default: { http: [RPC_URL] } } } }));
      setWalletClient(createWalletClient({ transport, chain: { id: CHAIN_ID, name: CHAIN_NAME }, account: accounts[0] }));
    } catch (e) {
      console.error('Connection failed', e);
      setTxStatus('error: Connection rejected or failed.');
    }
  }, []);

  // Switch chain helper
  const switchChain = async () => {
    if (!selectedProvider) return;
    try {
      await selectedProvider.provider.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: '0x' + CHAIN_ID.toString(16) }] });
    } catch (switchError) {
      if (switchError.code === 4902) {
        await selectedProvider.provider.request({
          method: 'wallet_addEthereumChain',
          params: [{ chainId: '0x' + CHAIN_ID.toString(16), chainName: CHAIN_NAME, rpcUrls: [RPC_URL], nativeCurrency: { name: 'CFX', symbol: 'CFX', decimals: 18 } }]
        });
      }
    }
  };

  useEffect(() => {
    if (!publicClient || !account) return;
    const contract = getContract({ address: CONTRACT, abi, client: { public: publicClient, wallet: walletClient } });
    (async () => {
      try {
        const [name, symbol, decimals, total, bal, pausedVal, ownerAddr] = await Promise.all([
          contract.read.name(),
          contract.read.symbol(),
          contract.read.decimals(),
          contract.read.totalSupply(),
          contract.read.balanceOf([account]),
          contract.read.paused(),
          contract.read.owner(),
        ]);
        setTokenInfo({ name, symbol, decimals: Number(decimals), totalSupply: total });
        setBalance(bal);
        setPaused(pausedVal);
        setIsOwner(ownerAddr.toLowerCase() === account.toLowerCase());
      } catch (e) { console.error(e); }
    })();
  }, [publicClient, account]);

  const handleTransfer = async (e) => {
    e.preventDefault();
    const to = e.target.to.value;
    const amount = e.target.amount.value;
    if (!to || !amount) return;
    setTxStatus('pending');
    try {
      const hash = await walletClient.writeContract({ address: CONTRACT, abi, functionName: 'transfer', args: [to, toWei(amount)], account, chain: null });
      setTxStatus(`success: TX sent: ${hash}`);
    } catch (err) {
      setTxStatus(`error: ${err.message.slice(0,100)}`);
    }
  };

  const handleApprove = async (e) => {
    e.preventDefault();
    const spender = e.target.spender.value;
    const amount = e.target.amount.value;
    if (!spender || !amount) return;
    setTxStatus('pending');
    try {
      const hash = await walletClient.writeContract({ address: CONTRACT, abi, functionName: 'approve', args: [spender, toWei(amount)], account, chain: null });
      setTxStatus(`success: Approval sent: ${hash}`);
    } catch (err) {
      setTxStatus(`error: ${err.message.slice(0,100)}`);
    }
  };

  const checkAllowance = async (e) => {
    e.preventDefault();
    const owner = e.target.owner.value;
    const spender = e.target.spender.value;
    if (!owner || !spender) return;
    try {
      const amt = await publicClient.readContract({ address: CONTRACT, abi, functionName: 'allowance', args: [owner, spender] });
      setAllowanceData({ spender, amount: amt });
    } catch (err) {
      setAllowanceData({ spender, amount: 0n });
    }
  };

  const adminAction = async (funcName, args = []) => {
    setTxStatus('pending');
    try {
      const hash = await walletClient.writeContract({ address: CONTRACT, abi, functionName: funcName, args, account, chain: null });
      setTxStatus(`success: Admin action ${funcName}: ${hash}`);
    } catch (err) {
      setTxStatus(`error: ${err.message.slice(0,100)}`);
    }
  };

  return (
    <div>
      <h1 style={{ marginBottom: '1rem' }}>💎 USDT0 Dashboard</h1>
      <div className="card">
        <h2>🔌 Connect Wallet (EIP-6963)</h2>
        <p style={{ fontSize: '0.9rem', color: '#94a3b8', marginBottom: '1rem' }}>
          This dApp uses EIP-6963 to discover all injected wallet providers. If a wallet is not listed, ensure it's installed and enabled.
        </p>
        {providers.length === 0 && <div className="tx-status pending">No wallets detected. Install a browser wallet like MetaMask, Rabby, or Coinbase Wallet.</div>}
        <div className="wallet-picker">
          {providers.map((p) => (
            <div key={p.info.uuid} className="wallet-card" onClick={() => connectWallet(p)}>
              {p.info.icon && <img src={p.info.icon} alt={p.info.name} />}
              <div>{p.info.name}</div>
            </div>
          ))}
        </div>

        {account && (
          <div style={{ marginTop: '1rem' }}>
            <div className="info-row"><span>Account:</span> <span className="accent">{account.slice(0,6)}...{account.slice(-4)}</span></div>
            <div className="info-row"><span>Network:</span> <span className={chainId === CHAIN_ID ? 'accent' : 'danger-text'}>{chainId ? `${chainId} (${CHAIN_ID === chainId ? 'Correct' : 'Wrong! Expected ' + CHAIN_NAME})` : 'Unknown'}</span></div>
            {chainId !== CHAIN_ID && <button className="btn btn-warn" onClick={switchChain} style={{margin:'0.5rem 0'}}>Switch to {CHAIN_NAME}</button>}
            {paused && <div className="tx-status pending">⚠️ Token contract is paused. Transfers may be restricted.</div>}
          </div>
        )}
      </div>

      {account && publicClient && (
        <>
          <div className="card">
            <h2>📊 Token Info</h2>
            <div className="info-row"><span>Name:</span> <span>{tokenInfo.name || '...'}</span></div>
            <div className="info-row"><span>Symbol:</span> <span>{tokenInfo.symbol || '...'}</span></div>
            <div className="info-row"><span>Decimals:</span> <span>{tokenInfo.decimals}</span></div>
            <div className="info-row"><span>Total Supply:</span> <span>{fmt(tokenInfo.totalSupply)} {tokenInfo.symbol}</span></div>
            <div className="info-row"><span>Your Balance:</span> <span className="accent">{fmt(balance)} {tokenInfo.symbol}</span></div>
          </div>

          <div className="card">
            <h2>💸 Transfer Tokens</h2>
            <form onSubmit={handleTransfer}>
              <label className="label">Recipient Address</label>
              <input className="input" name="to" placeholder="0x..." required/>
              <label className="label">Amount ({tokenInfo.symbol})</label>
              <input className="input" name="amount" placeholder="0.0" required/>
              <button className="btn" type="submit">Send</button>
            </form>
          </div>

          <div className="card">
            <h2>🔐 Approve Spender</h2>
            <form onSubmit={handleApprove}>
              <label className="label">Spender Address</label>
              <input className="input" name="spender" placeholder="0x..." required/>
              <label className="label">Amount ({tokenInfo.symbol})</label>
              <input className="input" name="amount" placeholder="0.0" required/>
              <button className="btn" type="submit">Approve</button>
            </form>
          </div>

          <div className="card">
            <h2>🔍 Check Allowance</h2>
            <form onSubmit={checkAllowance}>
              <label className="label">Owner Address</label>
              <input className="input" name="owner" placeholder="0x..." required/>
              <label className="label">Spender Address</label>
              <input className="input" name="spender" placeholder="0x..." required/>
              <button className="btn" type="submit">Check</button>
            </form>
            {allowanceData.spender && (
              <div className="info-row" style={{ marginTop: '1rem' }}>
                <span>Allowance:</span>
                <span className="accent">{fmt(allowanceData.amount)} {tokenInfo.symbol}</span>
              </div>
            )}
          </div>

          {isOwner && (
            <details className="card collapsible">
              <summary>⚠️ Admin Panel (Owner Only)</summary>
              <div style={{ marginTop: '0.8rem' }}>
                <p className="warn-text" style={{ fontSize: '0.85rem' }}>These functions can pause transfers, change ownership, or renounce ownership. Use with extreme caution.</p>
                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginTop: '0.8rem' }}>
                  <button className="btn btn-warn" onClick={() => adminAction('pause')}>Pause</button>
                  <button className="btn btn-warn" onClick={() => adminAction('unpause')}>Unpause</button>
                  <button className="btn btn-danger" onClick={() => adminAction('transferOwnership', [prompt('New owner address:')])}>Transfer Ownership</button>
                  <button className="btn btn-danger" onClick={() => adminAction('renounceOwnership')}>Renounce Ownership</button>
                </div>
              </div>
            </details>
          )}
        </>
      )}

      {txStatus && (
        <div className={`tx-status ${txStatus.startsWith('success') ? 'success' : txStatus.startsWith('error') ? 'error' : 'pending'}`}>
          {txStatus.replace('success: ','').replace('error: ','')}
        </div>
      )}
    </div>
  );
}

createRoot(document.getElementById('root')).render(<App />);