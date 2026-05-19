import React, { useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { createPublicClient, createWalletClient, custom, formatUnits, http, isAddress, parseUnits } from 'viem';
import './styles.css';

const CONTRACT = '0x05d714465e24b7639a31eeb57d37396f889df725';
const CHAIN = {
  id: 71,
  name: 'Conflux eSpace Testnet',
  nativeCurrency: { name: 'CFX', symbol: 'CFX', decimals: 18 },
  rpcUrls: { default: { http: ['https://evmtestnet.confluxrpc.com'] } },
  blockExplorers: { default: { name: 'ConfluxScan', url: 'https://evmtestnet.confluxscan.io' } },
};
const ABI = [
  { type: 'function', name: 'name', stateMutability: 'view', inputs: [], outputs: [{ type: 'string' }] },
  { type: 'function', name: 'symbol', stateMutability: 'view', inputs: [], outputs: [{ type: 'string' }] },
  { type: 'function', name: 'decimals', stateMutability: 'pure', inputs: [], outputs: [{ type: 'uint8' }] },
  { type: 'function', name: 'totalSupply', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint256' }] },
  { type: 'function', name: 'balanceOf', stateMutability: 'view', inputs: [{ name: 'account', type: 'address' }], outputs: [{ type: 'uint256' }] },
  { type: 'function', name: 'allowance', stateMutability: 'view', inputs: [{ name: 'owner', type: 'address' }, { name: 'spender', type: 'address' }], outputs: [{ type: 'uint256' }] },
  { type: 'function', name: 'approve', stateMutability: 'nonpayable', inputs: [{ name: 'spender', type: 'address' }, { name: 'value', type: 'uint256' }], outputs: [{ type: 'bool' }] },
  { type: 'function', name: 'transfer', stateMutability: 'nonpayable', inputs: [{ name: 'to', type: 'address' }, { name: 'value', type: 'uint256' }], outputs: [{ type: 'bool' }] },
  { type: 'function', name: 'paused', stateMutability: 'view', inputs: [], outputs: [{ type: 'bool' }] },
  { type: 'function', name: 'owner', stateMutability: 'view', inputs: [], outputs: [{ type: 'address' }] },
  { type: 'function', name: 'nonces', stateMutability: 'view', inputs: [{ name: 'owner', type: 'address' }], outputs: [{ type: 'uint256' }] },
  { type: 'function', name: 'DOMAIN_SEPARATOR', stateMutability: 'view', inputs: [], outputs: [{ type: 'bytes32' }] },
];

const publicClient = createPublicClient({ chain: CHAIN, transport: http() });
const short = (v) => (v ? `${v.slice(0, 6)}…${v.slice(-4)}` : '');
const clean = (v) => (v || '').trim();

function App() {
  const [account, setAccount] = useState('');
  const [token, setToken] = useState({ name: 'USDT0', symbol: 'USDT0', decimals: 18, totalSupply: 0n, paused: false, owner: '' });
  const [balance, setBalance] = useState(0n);
  const [status, setStatus] = useState('Ready');
  const [txHash, setTxHash] = useState('');
  const [sendTo, setSendTo] = useState('');
  const [sendAmount, setSendAmount] = useState('');
  const [spender, setSpender] = useState('');
  const [approveAmount, setApproveAmount] = useState('');
  const [allowOwner, setAllowOwner] = useState('');
  const [allowSpender, setAllowSpender] = useState('');
  const [allowance, setAllowance] = useState(null);
  const [lookupAddress, setLookupAddress] = useState('');
  const [lookupBalance, setLookupBalance] = useState(null);
  const [nonce, setNonce] = useState(null);
  const [domain, setDomain] = useState('');

  const formattedBalance = useMemo(() => formatUnits(balance, token.decimals), [balance, token.decimals]);
  const formattedSupply = useMemo(() => formatUnits(token.totalSupply, token.decimals), [token.totalSupply, token.decimals]);

  async function loadToken(addr = account) {
    try {
      const [name, symbol, decimals, totalSupply, paused, owner, domainSeparator] = await Promise.all([
        publicClient.readContract({ address: CONTRACT, abi: ABI, functionName: 'name' }).catch(() => 'USDT0'),
        publicClient.readContract({ address: CONTRACT, abi: ABI, functionName: 'symbol' }).catch(() => 'USDT0'),
        publicClient.readContract({ address: CONTRACT, abi: ABI, functionName: 'decimals' }).catch(() => 18),
        publicClient.readContract({ address: CONTRACT, abi: ABI, functionName: 'totalSupply' }).catch(() => 0n),
        publicClient.readContract({ address: CONTRACT, abi: ABI, functionName: 'paused' }).catch(() => false),
        publicClient.readContract({ address: CONTRACT, abi: ABI, functionName: 'owner' }).catch(() => ''),
        publicClient.readContract({ address: CONTRACT, abi: ABI, functionName: 'DOMAIN_SEPARATOR' }).catch(() => ''),
      ]);
      setToken({ name, symbol, decimals: Number(decimals), totalSupply, paused, owner });
      setDomain(domainSeparator);
      if (addr) {
        const [bal, n] = await Promise.all([
          publicClient.readContract({ address: CONTRACT, abi: ABI, functionName: 'balanceOf', args: [addr] }),
          publicClient.readContract({ address: CONTRACT, abi: ABI, functionName: 'nonces', args: [addr] }).catch(() => null),
        ]);
        setBalance(bal);
        setNonce(n);
      }
      setStatus('Token data refreshed');
    } catch (err) {
      setStatus(err.shortMessage || err.message || 'Could not load token data');
    }
  }

  async function connect() {
    if (!window.ethereum) return setStatus('No injected wallet found');
    try {
      const [addr] = await window.ethereum.request({ method: 'eth_requestAccounts' });
      setAccount(addr);
      setAllowOwner(addr);
      await loadToken(addr);
    } catch (err) {
      setStatus(err.message || 'Wallet connection rejected');
    }
  }

  async function ensureWallet() {
    if (!window.ethereum) throw new Error('No injected wallet found');
    const [addr] = account ? [account] : await window.ethereum.request({ method: 'eth_requestAccounts' });
    const walletClient = createWalletClient({ account: addr, chain: CHAIN, transport: custom(window.ethereum) });
    try { await walletClient.switchChain({ id: CHAIN.id }); } catch (_) {}
    if (!account) setAccount(addr);
    return walletClient;
  }

  async function writeToken(functionName, args, success) {
    setTxHash('');
    setStatus('Waiting for wallet confirmation…');
    try {
      const walletClient = await ensureWallet();
      const hash = await walletClient.writeContract({ address: CONTRACT, abi: ABI, functionName, args });
      setTxHash(hash);
      setStatus('Transaction submitted. Refresh after confirmation.');
      setTimeout(() => loadToken(account), 3500);
      if (success) success(hash);
    } catch (err) {
      setStatus(err.shortMessage || err.message || 'Transaction failed');
    }
  }

  function amountToUnits(value) {
    if (!value || Number(value) < 0) throw new Error('Enter a positive amount');
    return parseUnits(value, token.decimals);
  }

  async function sendTokens(e) {
    e.preventDefault();
    if (!isAddress(clean(sendTo))) return setStatus('Enter a valid recipient address');
    let units;
    try { units = amountToUnits(sendAmount); } catch (err) { return setStatus(err.message); }
    await writeToken('transfer', [clean(sendTo), units]);
  }

  async function approveSpender(e) {
    e.preventDefault();
    if (!isAddress(clean(spender))) return setStatus('Enter a valid spender address');
    let units;
    try { units = amountToUnits(approveAmount); } catch (err) { return setStatus(err.message); }
    await writeToken('approve', [clean(spender), units]);
  }

  async function checkAllowance(e) {
    e.preventDefault();
    if (!isAddress(clean(allowOwner)) || !isAddress(clean(allowSpender))) return setStatus('Enter valid owner and spender addresses');
    try {
      const value = await publicClient.readContract({ address: CONTRACT, abi: ABI, functionName: 'allowance', args: [clean(allowOwner), clean(allowSpender)] });
      setAllowance(value);
      setStatus('Allowance checked');
    } catch (err) { setStatus(err.shortMessage || err.message || 'Allowance lookup failed'); }
  }

  async function lookup(e) {
    e.preventDefault();
    if (!isAddress(clean(lookupAddress))) return setStatus('Enter a valid address');
    try {
      const value = await publicClient.readContract({ address: CONTRACT, abi: ABI, functionName: 'balanceOf', args: [clean(lookupAddress)] });
      setLookupBalance(value);
      setStatus('Balance lookup complete');
    } catch (err) { setStatus(err.shortMessage || err.message || 'Balance lookup failed'); }
  }

  useEffect(() => { loadToken(); }, []);

  return <main className="shell">
    <section className="hero">
      <div>
        <p className="eyebrow">Conflux eSpace Testnet · ERC20</p>
        <h1>{token.name} token console</h1>
        <p className="sub">A wallet-first workspace for balance, sends, approvals and allowance checks on the USDT0 contract.</p>
        <div className="meta"><span>{CONTRACT}</span><span className={token.paused ? 'bad' : 'good'}>{token.paused ? 'Paused' : 'Transfers active'}</span></div>
      </div>
      <div className="walletCard">
        <span>Connected wallet</span>
        <strong>{account ? short(account) : 'Not connected'}</strong>
        <button onClick={connect}>{account ? 'Refresh wallet' : 'Connect wallet'}</button>
      </div>
    </section>

    <section className="grid stats">
      <div className="card big"><span>Your balance</span><strong>{account ? formattedBalance : 'Connect to view'} {token.symbol}</strong><button onClick={() => loadToken(account)}>Refresh</button></div>
      <div className="card"><span>Total supply</span><strong>{formattedSupply}</strong><small>{token.symbol} · {token.decimals} decimals</small></div>
      <div className="card"><span>Owner</span><strong>{token.owner ? short(token.owner) : 'Unknown'}</strong><small>Admin functions detected but kept out of primary flow.</small></div>
    </section>

    <section className="grid flows">
      <form className="panel" onSubmit={sendTokens}>
        <div className="panelHead"><span>Primary action</span><h2>Send {token.symbol}</h2></div>
        <label>Recipient address<input value={sendTo} onChange={(e) => setSendTo(e.target.value)} placeholder="0x…" /></label>
        <label>Amount<input value={sendAmount} onChange={(e) => setSendAmount(e.target.value)} placeholder="0.00" inputMode="decimal" /></label>
        <button className="primary" disabled={!account || token.paused}>Send tokens</button>
        <p className="note">Check the recipient carefully. Transfers cannot be reversed.</p>
      </form>

      <form className="panel" onSubmit={approveSpender}>
        <div className="panelHead"><span>Approval safety</span><h2>Approve spender</h2></div>
        <label>Spender address<input value={spender} onChange={(e) => setSpender(e.target.value)} placeholder="0x…" /></label>
        <label>Allowance amount<input value={approveAmount} onChange={(e) => setApproveAmount(e.target.value)} placeholder="Use 0 to revoke" inputMode="decimal" /></label>
        <button className="primary warn" disabled={!account}>Approve</button>
        <p className="note">Approve only apps you trust. Set amount to 0 to revoke a spender.</p>
      </form>
    </section>

    <section className="grid tools">
      <form className="card" onSubmit={checkAllowance}>
        <h3>Allowance check</h3>
        <input value={allowOwner} onChange={(e) => setAllowOwner(e.target.value)} placeholder="Owner address" />
        <input value={allowSpender} onChange={(e) => setAllowSpender(e.target.value)} placeholder="Spender address" />
        <button>Check allowance</button>
        {allowance !== null && <strong>{formatUnits(allowance, token.decimals)} {token.symbol}</strong>}
      </form>
      <form className="card" onSubmit={lookup}>
        <h3>Address balance</h3>
        <input value={lookupAddress} onChange={(e) => setLookupAddress(e.target.value)} placeholder="Wallet or contract address" />
        <button>Lookup balance</button>
        {lookupBalance !== null && <strong>{formatUnits(lookupBalance, token.decimals)} {token.symbol}</strong>}
      </form>
      <div className="card advanced">
        <h3>Advanced token facts</h3>
        <p><span>Wallet nonce</span><b>{nonce === null ? 'Connect wallet' : nonce.toString()}</b></p>
        <p><span>Permit domain</span><b>{domain ? short(domain) : 'Unavailable'}</b></p>
        <p><span>Risk methods</span><b>pause · unpause · ownership</b></p>
      </div>
    </section>

    <footer className="status"><span>{status}</span>{txHash && <a href={`${CHAIN.blockExplorers.default.url}/tx/${txHash}`} target="_blank" rel="noreferrer">View transaction</a>}</footer>
  </main>;
}

createRoot(document.getElementById('root')).render(<App />);
