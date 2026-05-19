import React, { useState, useEffect, useCallback, useRef } from 'react';
import { createRoot } from 'react-dom/client';
import { createPublicClient, http, formatUnits, parseUnits, getAddress } from 'viem';
import './styles.css';

const CONTRACT = '0x05d714465e24b7639a31eeb57d37396f889df725';
const CHAIN_ID = 71;
const CHAIN_HEX = '0x47';
const CHAIN_NAME = 'Conflux eSpace Testnet';
const RPC_URL = 'https://evmtestnet.confluxrpc.com';
const EXPLORER = 'https://evmtestnet.confluxscan.io';

const ERC20_ABI = [
  { type:'function', name:'name', stateMutability:'view', inputs:[], outputs:[{type:'string'}] },
  { type:'function', name:'symbol', stateMutability:'view', inputs:[], outputs:[{type:'string'}] },
  { type:'function', name:'decimals', stateMutability:'pure', inputs:[], outputs:[{type:'uint8'}] },
  { type:'function', name:'totalSupply', stateMutability:'view', inputs:[], outputs:[{type:'uint256'}] },
  { type:'function', name:'balanceOf', stateMutability:'view', inputs:[{name:'account',type:'address'}], outputs:[{type:'uint256'}] },
  { type:'function', name:'transfer', stateMutability:'nonpayable', inputs:[{name:'to',type:'address'},{name:'value',type:'uint256'}], outputs:[{type:'bool'}] },
  { type:'function', name:'approve', stateMutability:'nonpayable', inputs:[{name:'spender',type:'address'},{name:'value',type:'uint256'}], outputs:[{type:'bool'}] },
  { type:'function', name:'allowance', stateMutability:'view', inputs:[{name:'owner',type:'address'},{name:'spender',type:'address'}], outputs:[{type:'uint256'}] },
  { type:'function', name:'transferFrom', stateMutability:'nonpayable', inputs:[{name:'from',type:'address'},{name:'to',type:'address'},{name:'value',type:'uint256'}], outputs:[{type:'bool'}] },
  { type:'function', name:'burn', stateMutability:'nonpayable', inputs:[{name:'value',type:'uint256'}], outputs:[] },
  { type:'function', name:'burnFrom', stateMutability:'nonpayable', inputs:[{name:'account',type:'address'},{name:'value',type:'uint256'}], outputs:[] },
  { type:'function', name:'owner', stateMutability:'view', inputs:[], outputs:[{type:'address'}] },
  { type:'function', name:'paused', stateMutability:'view', inputs:[], outputs:[{type:'bool'}] },
  { type:'function', name:'pause', stateMutability:'nonpayable', inputs:[], outputs:[] },
  { type:'function', name:'unpause', stateMutability:'nonpayable', inputs:[], outputs:[] },
  { type:'function', name:'transferOwnership', stateMutability:'nonpayable', inputs:[{name:'newOwner',type:'address'}], outputs:[] },
  { type:'function', name:'renounceOwnership', stateMutability:'nonpayable', inputs:[], outputs:[] },
  { type:'function', name:'mint', stateMutability:'nonpayable', inputs:[{name:'to',type:'address'},{name:'amount',type:'uint256'}], outputs:[] },
];

const publicClient = createPublicClient({ chain: { id: CHAIN_ID, name: CHAIN_NAME, nativeCurrency: { name:'CFX', symbol:'CFX', decimals:18 }, rpcUrls: { default: { http: [RPC_URL] } } }, transport: http(RPC_URL) });

const readContract = (functionName, args = []) => publicClient.readContract({ address: CONTRACT, abi: ERC20_ABI, functionName, args });

const shortAddr = (a) => a ? `${a.slice(0,6)}...${a.slice(-4)}` : '';

/* ── EIP-6963 hook ── */
function useEIP6963() {
  const [providers, setProviders] = useState([]);
  useEffect(() => {
    const handler = (e) => {
      setProviders(prev => {
        if (prev.find(p => p.info.uuid === e.detail.info.uuid)) return prev;
        return [...prev, e.detail];
      });
    };
    window.addEventListener('eip6963:announceProvider', handler);
    window.dispatchEvent(new Event('eip6963:requestProvider'));
    return () => window.removeEventListener('eip6963:announceProvider', handler);
  }, []);
  return providers;
}

/* ── Toast ── */
function Toast({ message, type, onClose }) {
  useEffect(() => { const t = setTimeout(onClose, 4500); return () => clearTimeout(t); }, [onClose]);
  return <div className={`toast toast-${type}`}>{message}<button className="toast-close" onClick={onClose}>×</button></div>;
}

/* ── Wallet Picker Modal ── */
function WalletPickerModal({ providers, onSelect, onClose, legacyConnect }) {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3>Connect Wallet</h3>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>
        <div className="modal-body">
          <p className="eip6963-explainer">
            This dApp uses <strong>EIP-6963</strong> to discover all wallets installed in your browser — no guessing which extension injected <code>window.ethereum</code>.
          </p>
          {providers.length > 0 && (
            <div className="wallet-list">
              <p className="wallet-list-label">Discovered wallets:</p>
              {providers.map(p => (
                <button key={p.info.uuid} className="wallet-option" onClick={() => onSelect(p)}>
                  {p.info.icon && <img src={p.info.icon} alt="" className="wallet-icon" />}
                  <div className="wallet-option-info">
                    <span className="wallet-name">{p.info.name}</span>
                    <span className="wallet-rdns">{p.info.rdns}</span>
                  </div>
                  <span className="wallet-arrow">→</span>
                </button>
              ))}
            </div>
          )}
          {providers.length === 0 && (
            <div className="no-wallets">
              <p>No EIP-6963 wallets detected.</p>
            </div>
          )}
          {window.ethereum && (
            <button className="wallet-option wallet-option-legacy" onClick={legacyConnect}>
              <div className="wallet-icon-placeholder">🦊</div>
              <div className="wallet-option-info">
                <span className="wallet-name">Browser Wallet (Legacy)</span>
                <span className="wallet-rdns">window.ethereum</span>
              </div>
              <span className="wallet-arrow">→</span>
            </button>
          )}
          {providers.length === 0 && !window.ethereum && (
            <p className="install-hint">Install a wallet extension like MetaMask or Fluent to get started.</p>
          )}
        </div>
      </div>
    </div>
  );
}

/* ── Transaction Status ── */
function TxStatus({ hash, label }) {
  if (!hash) return null;
  return (
    <div className="tx-status">
      <span className="tx-check">✓</span>
      <span>{label || 'Transaction sent'}</span>
      <a href={`${EXPLORER}/tx/${hash}`} target="_blank" rel="noreferrer" className="tx-link">View on Explorer ↗</a>
    </div>
  );
}

/* ── Main App ── */
function App() {
  const eip6963Providers = useEIP6963();
  const [showWalletModal, setShowWalletModal] = useState(false);
  const [connectedProvider, setConnectedProvider] = useState(null);
  const [walletInfo, setWalletInfo] = useState(null);
  const [account, setAccount] = useState(null);
  const [chainId, setChainId] = useState(null);
  const [wrongChain, setWrongChain] = useState(false);

  const [tokenMeta, setTokenMeta] = useState({ name: '', symbol: '', decimals: 6, totalSupply: '0', owner: '', paused: false });
  const [balance, setBalance] = useState(null);
  const [toast, setToast] = useState(null);
  const [loading, setLoading] = useState({});

  /* Transfer */
  const [transferTo, setTransferTo] = useState('');
  const [transferAmt, setTransferAmt] = useState('');
  const [transferHash, setTransferHash] = useState(null);

  /* Approve */
  const [approveSpender, setApproveSpender] = useState('');
  const [approveAmt, setApproveAmt] = useState('');
  const [approveHash, setApproveHash] = useState(null);

  /* Allowance */
  const [allowOwner, setAllowOwner] = useState('');
  const [allowSpender, setAllowSpender] = useState('');
  const [allowResult, setAllowResult] = useState(null);

  /* Balance lookup */
  const [lookupAddr, setLookupAddr] = useState('');
  const [lookupResult, setLookupResult] = useState(null);

  /* Burn */
  const [burnAmt, setBurnAmt] = useState('');
  const [burnHash, setBurnHash] = useState(null);

  /* Active tab */
  const [activeTab, setActiveTab] = useState('send');

  /* Admin */
  const [showAdmin, setShowAdmin] = useState(false);
  const [adminHash, setAdminHash] = useState(null);
  const [newOwnerAddr, setNewOwnerAddr] = useState('');

  const showToast = (message, type = 'info') => setToast({ message, type });

  /* Fetch token metadata */
  const fetchMeta = useCallback(async () => {
    try {
      const [name, symbol, decimals, totalSupply, owner, paused] = await Promise.all([
        readContract('name'), readContract('symbol'), readContract('decimals'),
        readContract('totalSupply'), readContract('owner'), readContract('paused')
      ]);
      setTokenMeta({ name, symbol, decimals: Number(decimals), totalSupply: formatUnits(totalSupply, Number(decimals)), owner, paused });
    } catch (e) { console.error('meta fetch failed', e); }
  }, []);

  const fetchBalance = useCallback(async () => {
    if (!account) return;
    try {
      const bal = await readContract('balanceOf', [account]);
      setBalance(formatUnits(bal, tokenMeta.decimals));
    } catch (e) { console.error('balance fetch failed', e); }
  }, [account, tokenMeta.decimals]);

  useEffect(() => { fetchMeta(); }, [fetchMeta]);
  useEffect(() => { fetchBalance(); }, [fetchBalance]);

  /* Connect via EIP-6963 */
  const connectWallet = async (providerDetail) => {
    try {
      const provider = providerDetail.provider;
      const accounts = await provider.request({ method: 'eth_requestAccounts' });
      const cid = await provider.request({ method: 'eth_chainId' });
      setConnectedProvider(provider);
      setWalletInfo(providerDetail.info);
      setAccount(getAddress(accounts[0]));
      const cidNum = parseInt(cid, 16);
      setChainId(cidNum);
      setWrongChain(cidNum !== CHAIN_ID);
      setShowWalletModal(false);
      showToast(`Connected via ${providerDetail.info.name}`, 'success');

      provider.on && provider.on('accountsChanged', (accs) => {
        if (accs.length === 0) { setAccount(null); setBalance(null); }
        else setAccount(getAddress(accs[0]));
      });
      provider.on && provider.on('chainChanged', (c) => {
        const n = parseInt(c, 16);
        setChainId(n);
        setWrongChain(n !== CHAIN_ID);
      });
    } catch (e) {
      showToast(e?.message || 'Connection failed', 'error');
    }
  };

  /* Legacy connect */
  const legacyConnect = async () => {
    try {
      const provider = window.ethereum;
      const accounts = await provider.request({ method: 'eth_requestAccounts' });
      const cid = await provider.request({ method: 'eth_chainId' });
      setConnectedProvider(provider);
      setWalletInfo({ name: 'Browser Wallet', rdns: 'window.ethereum', uuid: 'legacy' });
      setAccount(getAddress(accounts[0]));
      const cidNum = parseInt(cid, 16);
      setChainId(cidNum);
      setWrongChain(cidNum !== CHAIN_ID);
      setShowWalletModal(false);
      showToast('Connected via Browser Wallet', 'success');

      provider.on && provider.on('accountsChanged', (accs) => {
        if (accs.length === 0) { setAccount(null); setBalance(null); }
        else setAccount(getAddress(accs[0]));
      });
      provider.on && provider.on('chainChanged', (c) => {
        const n = parseInt(c, 16);
        setChainId(n);
        setWrongChain(n !== CHAIN_ID);
      });
    } catch (e) {
      showToast(e?.message || 'Connection failed', 'error');
    }
  };

  const switchChain = async () => {
    if (!connectedProvider) return;
    try {
      await connectedProvider.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: CHAIN_HEX }] });
    } catch (e) {
      if (e.code === 4902) {
        await connectedProvider.request({ method: 'wallet_addEthereumChain', params: [{ chainId: CHAIN_HEX, chainName: CHAIN_NAME, rpcUrls: [RPC_URL], nativeCurrency: { name: 'CFX', symbol: 'CFX', decimals: 18 } }] });
      } else {
        showToast(e?.message || 'Switch failed', 'error');
      }
    }
  };

  const disconnect = () => {
    setConnectedProvider(null); setWalletInfo(null); setAccount(null); setChainId(null); setWrongChain(false); setBalance(null);
    showToast('Disconnected', 'info');
  };

  /* Send TX helper */
  const sendTx = async (functionName, args, key) => {
    if (!connectedProvider || !account) { showToast('Connect wallet first', 'error'); return null; }
    if (wrongChain) { showToast('Switch to Conflux eSpace Testnet first', 'error'); return null; }
    setLoading(l => ({ ...l, [key]: true }));
    try {
      const { encodeFunctionData } = await import('viem');
      const data = encodeFunctionData({ abi: ERC20_ABI, functionName, args });
      const hash = await connectedProvider.request({ method: 'eth_sendTransaction', params: [{ from: account, to: CONTRACT, data }] });
      showToast('Transaction sent!', 'success');
      setLoading(l => ({ ...l, [key]: false }));
      setTimeout(() => { fetchBalance(); fetchMeta(); }, 5000);
      return hash;
    } catch (e) {
      showToast(e?.message?.slice(0, 120) || 'Transaction failed', 'error');
      setLoading(l => ({ ...l, [key]: false }));
      return null;
    }
  };

  const handleTransfer = async () => {
    try { getAddress(transferTo); } catch { showToast('Invalid recipient address', 'error'); return; }
    if (!transferAmt || Number(transferAmt) <= 0) { showToast('Enter a valid amount', 'error'); return; }
    const hash = await sendTx('transfer', [transferTo, parseUnits(transferAmt, tokenMeta.decimals)], 'transfer');
    if (hash) setTransferHash(hash);
  };

  const handleApprove = async () => {
    try { getAddress(approveSpender); } catch { showToast('Invalid spender address', 'error'); return; }
    if (!approveAmt || Number(approveAmt) < 0) { showToast('Enter a valid amount', 'error'); return; }
    const hash = await sendTx('approve', [approveSpender, parseUnits(approveAmt, tokenMeta.decimals)], 'approve');
    if (hash) setApproveHash(hash);
  };

  const handleAllowanceCheck = async () => {
    try { getAddress(allowOwner); getAddress(allowSpender); } catch { showToast('Invalid address', 'error'); return; }
    setLoading(l => ({ ...l, allowance: true }));
    try {
      const result = await readContract('allowance', [allowOwner, allowSpender]);
      setAllowResult(formatUnits(result, tokenMeta.decimals));
    } catch (e) { showToast('Failed to read allowance', 'error'); }
    setLoading(l => ({ ...l, allowance: false }));
  };

  const handleBalanceLookup = async () => {
    try { getAddress(lookupAddr); } catch { showToast('Invalid address', 'error'); return; }
    setLoading(l => ({ ...l, lookup: true }));
    try {
      const result = await readContract('balanceOf', [lookupAddr]);
      setLookupResult(formatUnits(result, tokenMeta.decimals));
    } catch (e) { showToast('Failed to read balance', 'error'); }
    setLoading(l => ({ ...l, lookup: false }));
  };

  const handleBurn = async () => {
    if (!burnAmt || Number(burnAmt) <= 0) { showToast('Enter a valid amount', 'error'); return; }
    const hash = await sendTx('burn', [parseUnits(burnAmt, tokenMeta.decimals)], 'burn');
    if (hash) setBurnHash(hash);
  };

  const isOwner = account && tokenMeta.owner && account.toLowerCase() === tokenMeta.owner.toLowerCase();

  return (
    <div className="app-wrapper">
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
      {showWalletModal && <WalletPickerModal providers={eip6963Providers} onSelect={connectWallet} onClose={() => setShowWalletModal(false)} legacyConnect={legacyConnect} />}

      {/* Header */}
      <header className="app-header">
        <div className="header-left">
          <span className="header-logo">💰</span>
          <div>
            <h1 className="header-title">{tokenMeta.name || 'USDT0'}</h1>
            <span className="header-chain">{CHAIN_NAME}</span>
          </div>
        </div>
        <div className="header-right">
          {account ? (
            <div className="wallet-connected-badge">
              {walletInfo?.icon && <img src={walletInfo.icon} alt="" className="badge-icon" />}
              <div className="badge-info">
                <span className="badge-name">{walletInfo?.name}</span>
                <span className="badge-addr">{shortAddr(account)}</span>
              </div>
              {wrongChain && <button className="btn btn-warning btn-sm" onClick={switchChain}>Switch Network</button>}
              <button className="btn btn-ghost btn-sm" onClick={disconnect}>Disconnect</button>
            </div>
          ) : (
            <button className="btn btn-primary" onClick={() => setShowWalletModal(true)}>Connect Wallet</button>
          )}
        </div>
      </header>

      <main className="main-content">
        {/* Token overview cards */}
        <section className="token-overview">
          <div className="overview-card">
            <span className="overview-label">Symbol</span>
            <span className="overview-value">{tokenMeta.symbol || '—'}</span>
          </div>
          <div className="overview-card">
            <span className="overview-label">Decimals</span>
            <span className="overview-value">{tokenMeta.decimals}</span>
          </div>
          <div className="overview-card">
            <span className="overview-label">Total Supply</span>
            <span className="overview-value overview-value-sm">{Number(tokenMeta.totalSupply).toLocaleString(undefined, { maximumFractionDigits: 2 })}</span>
          </div>
          <div className="overview-card">
            <span className="overview-label">Status</span>
            <span className={`overview-value ${tokenMeta.paused ? 'text-danger' : 'text-success'}`}>{tokenMeta.paused ? '⏸ Paused' : '● Active'}</span>
          </div>
        </section>

        {/* Wallet balance hero */}
        {account && !wrongChain && (
          <section className="balance-hero">
            <span className="balance-label">Your Balance</span>
            <span className="balance-value">{balance !== null ? `${Number(balance).toLocaleString(undefined, { maximumFractionDigits: 6 })} ${tokenMeta.symbol}` : '...'}</span>
            <button className="btn btn-ghost btn-sm" onClick={fetchBalance}>↻ Refresh</button>
          </section>
        )}

        {/* Prompt to connect */}
        {!account && (
          <section className="connect-prompt">
            <div className="connect-prompt-inner">
              <h2>Welcome to {tokenMeta.name || 'USDT0'}</h2>
              <p>Connect your wallet to send tokens, manage approvals, and more.</p>
              <div className="eip6963-badge">
                <span className="eip6963-dot" />
                <span>EIP-6963 Multi-Wallet Discovery Enabled</span>
              </div>
              <p className="eip6963-note">Your browser wallets are automatically detected — choose the one you prefer when connecting.</p>
              <button className="btn btn-primary btn-lg" onClick={() => setShowWalletModal(true)}>Connect Wallet</button>
            </div>
          </section>
        )}

        {/* Wrong chain banner */}
        {account && wrongChain && (
          <section className="wrong-chain-banner">
            <p>⚠ You're on chain {chainId}. Please switch to <strong>{CHAIN_NAME}</strong> (chain {CHAIN_ID}).</p>
            <button className="btn btn-warning" onClick={switchChain}>Switch Network</button>
          </section>
        )}

        {/* Main actions */}
        {account && !wrongChain && (
          <>
            <div className="tabs">
              {[['send', 'Send'], ['approve', 'Approve'], ['lookup', 'Lookup'], ['advanced', 'Advanced']].map(([key, label]) => (
                <button key={key} className={`tab ${activeTab === key ? 'tab-active' : ''}`} onClick={() => setActiveTab(key)}>{label}</button>
              ))}
            </div>

            <section className="tab-panel">
              {/* Send */}
              {activeTab === 'send' && (
                <div className="action-card">
                  <h3>Send {tokenMeta.symbol}</h3>
                  <p className="action-desc">Transfer tokens to another address on {CHAIN_NAME}.</p>
                  <div className="form-group">
                    <label>Recipient Address</label>
                    <input className="input" placeholder="0x..." value={transferTo} onChange={e => setTransferTo(e.target.value)} />
                  </div>
                  <div className="form-group">
                    <label>Amount ({tokenMeta.symbol})</label>
                    <input className="input" type="number" placeholder="0.00" min="0" step="any" value={transferAmt} onChange={e => setTransferAmt(e.target.value)} />
                  </div>
                  <div className="safety-note">⚠ Double-check the recipient address. Token transfers are irreversible.</div>
                  <button className="btn btn-primary btn-block" disabled={loading.transfer} onClick={handleTransfer}>{loading.transfer ? 'Sending...' : `Send ${tokenMeta.symbol}`}</button>
                  <TxStatus hash={transferHash} label="Transfer sent" />
                </div>
              )}

              {/* Approve */}
              {activeTab === 'approve' && (
                <div className="action-card">
                  <h3>Approve Spending</h3>
                  <p className="action-desc">Allow a contract or address to spend your {tokenMeta.symbol} up to a specific amount.</p>
                  <div className="form-group">
                    <label>Spender Address</label>
                    <input className="input" placeholder="0x..." value={approveSpender} onChange={e => setApproveSpender(e.target.value)} />
                  </div>
                  <div className="form-group">
                    <label>Allowance Amount ({tokenMeta.symbol})</label>
                    <input className="input" type="number" placeholder="0.00" min="0" step="any" value={approveAmt} onChange={e => setApproveAmt(e.target.value)} />
                  </div>
                  <div className="safety-note">⚠ Be careful approving large amounts. Only approve contracts you trust. Set to 0 to revoke.</div>
                  <button className="btn btn-primary btn-block" disabled={loading.approve} onClick={handleApprove}>{loading.approve ? 'Approving...' : 'Approve'}</button>
                  <TxStatus hash={approveHash} label="Approval sent" />

                  <hr className="divider" />
                  <h4>Check Allowance</h4>
                  <div className="form-row">
                    <div className="form-group form-group-half">
                      <label>Owner</label>
                      <input className="input" placeholder="0x..." value={allowOwner} onChange={e => setAllowOwner(e.target.value)} />
                    </div>
                    <div className="form-group form-group-half">
                      <label>Spender</label>
                      <input className="input" placeholder="0x..." value={allowSpender} onChange={e => setAllowSpender(e.target.value)} />
                    </div>
                  </div>
                  <button className="btn btn-secondary" disabled={loading.allowance} onClick={handleAllowanceCheck}>{loading.allowance ? 'Checking...' : 'Check Allowance'}</button>
                  {allowResult !== null && <div className="result-box">Allowance: <strong>{Number(allowResult).toLocaleString()} {tokenMeta.symbol}</strong></div>}
                </div>
              )}

              {/* Lookup */}
              {activeTab === 'lookup' && (
                <div className="action-card">
                  <h3>Balance Lookup</h3>
                  <p className="action-desc">Check the {tokenMeta.symbol} balance of any address.</p>
                  <div className="form-group">
                    <label>Address</label>
                    <input className="input" placeholder="0x..." value={lookupAddr} onChange={e => setLookupAddr(e.target.value)} />
                  </div>
                  <button className="btn btn-secondary" disabled={loading.lookup} onClick={handleBalanceLookup}>{loading.lookup ? 'Checking...' : 'Look Up Balance'}</button>
                  {lookupResult !== null && <div className="result-box">Balance: <strong>{Number(lookupResult).toLocaleString()} {tokenMeta.symbol}</strong></div>}
                </div>
              )}

              {/* Advanced */}
              {activeTab === 'advanced' && (
                <div className="action-card">
                  <h3>Burn Tokens</h3>
                  <p className="action-desc">Permanently destroy your own {tokenMeta.symbol} tokens.</p>
                  <div className="form-group">
                    <label>Amount to Burn</label>
                    <input className="input" type="number" placeholder="0.00" min="0" step="any" value={burnAmt} onChange={e => setBurnAmt(e.target.value)} />
                  </div>
                  <div className="safety-note danger-note">🔥 Burned tokens are permanently destroyed and cannot be recovered.</div>
                  <button className="btn btn-danger" disabled={loading.burn} onClick={handleBurn}>{loading.burn ? 'Burning...' : 'Burn Tokens'}</button>
                  <TxStatus hash={burnHash} label="Burn confirmed" />

                  <hr className="divider" />
                  <h4>Contract Info</h4>
                  <div className="info-row"><span>Contract</span><a href={`${EXPLORER}/address/${CONTRACT}`} target="_blank" rel="noreferrer" className="mono-link">{shortAddr(CONTRACT)}</a></div>
                  <div className="info-row"><span>Owner</span><span className="mono">{shortAddr(tokenMeta.owner)}</span></div>
                </div>
              )}
            </section>

            {/* Admin panel - only visible to contract owner */}
            {isOwner && (
              <section className="admin-section">
                <button className="admin-toggle" onClick={() => setShowAdmin(!showAdmin)}>
                  {showAdmin ? '▾' : '▸'} Admin Panel {!showAdmin && <span className="admin-badge">Owner</span>}
                </button>
                {showAdmin && (
                  <div className="admin-panel">
                    <div className="safety-note danger-note">⚠ These are administrative functions. Use with extreme caution.</div>
                    <div className="admin-actions">
                      <button className="btn btn-danger btn-sm" disabled={loading.pause} onClick={async () => {
                        const h = await sendTx(tokenMeta.paused ? 'unpause' : 'pause', [], 'pause');
                        if (h) setAdminHash(h);
                      }}>{tokenMeta.paused ? 'Unpause Contract' : 'Pause Contract'}</button>

                      <div className="form-group">
                        <label>Transfer Ownership To</label>
                        <div className="input-row">
                          <input className="input" placeholder="0x..." value={newOwnerAddr} onChange={e => setNewOwnerAddr(e.target.value)} />
                          <button className="btn btn-danger btn-sm" disabled={loading.transferOwner} onClick={async () => {
                            try { getAddress(newOwnerAddr); } catch { showToast('Invalid address', 'error'); return; }
                            const h = await sendTx('transferOwnership', [newOwnerAddr], 'transferOwner');
                            if (h) setAdminHash(h);
                          }}>Transfer</button>
                        </div>
                      </div>
                    </div>
                    <TxStatus hash={adminHash} label="Admin action sent" />
                  </div>
                )}
              </section>
            )}
          </>
        )}
      </main>

      <footer className="app-footer">
        <span>Contract: <a href={`${EXPLORER}/address/${CONTRACT}`} target="_blank" rel="noreferrer">{shortAddr(CONTRACT)}</a></span>
        <span>{CHAIN_NAME}</span>
      </footer>
    </div>
  );
}

createRoot(document.getElementById('root')).render(<App />);
