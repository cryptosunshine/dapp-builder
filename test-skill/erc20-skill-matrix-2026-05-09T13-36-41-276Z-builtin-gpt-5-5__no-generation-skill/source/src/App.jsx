import React, { useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { createPublicClient, createWalletClient, custom, formatUnits, getAddress, http, parseUnits } from 'viem';
import './styles.css';

const CONTRACT = '0x05d714465e24b7639a31eeb57d37396f889df725';
const chain = {
  id: 71,
  name: 'Conflux eSpace Testnet',
  nativeCurrency: { name: 'CFX', symbol: 'CFX', decimals: 18 },
  rpcUrls: { default: { http: ['https://evmtestnet.confluxrpc.com'] } },
  blockExplorers: { default: { name: 'ConfluxScan', url: 'https://evmtestnet.confluxscan.io' } },
};
const abi = [
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
const publicClient = createPublicClient({ chain, transport: http() });
const short = (v = '') => (v ? `${v.slice(0, 6)}...${v.slice(-4)}` : '');
const safeAddress = (v) => getAddress((v || '').trim());

function App() {
  const [account, setAccount] = useState('');
  const [meta, setMeta] = useState({ name: 'USDT0', symbol: 'USDT0', decimals: 18, supply: 0n, paused: false, owner: '' });
  const [balance, setBalance] = useState(null);
  const [lookup, setLookup] = useState({ address: '', result: '' });
  const [send, setSend] = useState({ to: '', amount: '' });
  const [approval, setApproval] = useState({ spender: '', amount: '' });
  const [allowance, setAllowance] = useState({ owner: '', spender: '', result: '' });
  const [advanced, setAdvanced] = useState({ nonceOwner: '', nonce: '', domain: '' });
  const [status, setStatus] = useState('Ready');
  const walletClient = useMemo(() => (window.ethereum ? createWalletClient({ chain, transport: custom(window.ethereum) }) : null), []);

  async function readMeta(active = account) {
    try {
      const [name, symbol, decimals, supply, paused, owner] = await Promise.all([
        publicClient.readContract({ address: CONTRACT, abi, functionName: 'name' }),
        publicClient.readContract({ address: CONTRACT, abi, functionName: 'symbol' }),
        publicClient.readContract({ address: CONTRACT, abi, functionName: 'decimals' }),
        publicClient.readContract({ address: CONTRACT, abi, functionName: 'totalSupply' }),
        publicClient.readContract({ address: CONTRACT, abi, functionName: 'paused' }).catch(() => false),
        publicClient.readContract({ address: CONTRACT, abi, functionName: 'owner' }).catch(() => ''),
      ]);
      setMeta({ name, symbol, decimals: Number(decimals), supply, paused, owner });
      if (active) {
        const b = await publicClient.readContract({ address: CONTRACT, abi, functionName: 'balanceOf', args: [active] });
        setBalance(b);
      }
    } catch (e) {
      setStatus(e.shortMessage || e.message);
    }
  }

  async function connect() {
    if (!walletClient) {
      setStatus('No injected wallet found. Open with a browser wallet.');
      return '';
    }
    try {
      const [addr] = await walletClient.requestAddresses();
      const checksum = getAddress(addr);
      setAccount(checksum);
      setAllowance((a) => ({ ...a, owner: checksum }));
      setAdvanced((a) => ({ ...a, nonceOwner: checksum }));
      setStatus('Wallet connected');
      await readMeta(checksum);
      return checksum;
    } catch (e) {
      setStatus(e.shortMessage || e.message);
      return '';
    }
  }

  async function refreshBalance(addr = account) {
    if (!addr) return;
    const b = await publicClient.readContract({ address: CONTRACT, abi, functionName: 'balanceOf', args: [addr] });
    setBalance(b);
  }

  async function sendTokens() {
    try {
      const active = account || await connect();
      if (!active) return;
      const hash = await walletClient.writeContract({ account: active, address: CONTRACT, abi, functionName: 'transfer', args: [safeAddress(send.to), parseUnits(send.amount || '0', meta.decimals)] });
      setStatus(`Transfer submitted: ${hash}`);
      await publicClient.waitForTransactionReceipt({ hash });
      setStatus('Transfer confirmed');
      refreshBalance(active);
    } catch (e) { setStatus(e.shortMessage || e.message); }
  }

  async function approveSpender() {
    try {
      const active = account || await connect();
      if (!active) return;
      const value = parseUnits(approval.amount || '0', meta.decimals);
      const hash = await walletClient.writeContract({ account: active, address: CONTRACT, abi, functionName: 'approve', args: [safeAddress(approval.spender), value] });
      setStatus(`Approval submitted: ${hash}`);
      await publicClient.waitForTransactionReceipt({ hash });
      setStatus('Approval confirmed. Review and revoke allowances you no longer need.');
    } catch (e) { setStatus(e.shortMessage || e.message); }
  }

  async function checkBalance() {
    try {
      const addr = safeAddress(lookup.address);
      const b = await publicClient.readContract({ address: CONTRACT, abi, functionName: 'balanceOf', args: [addr] });
      setLookup((x) => ({ ...x, result: `${formatUnits(b, meta.decimals)} ${meta.symbol}` }));
    } catch (e) { setStatus(e.shortMessage || e.message); }
  }

  async function checkAllowance() {
    try {
      const value = await publicClient.readContract({ address: CONTRACT, abi, functionName: 'allowance', args: [safeAddress(allowance.owner), safeAddress(allowance.spender)] });
      setAllowance((x) => ({ ...x, result: `${formatUnits(value, meta.decimals)} ${meta.symbol}` }));
    } catch (e) { setStatus(e.shortMessage || e.message); }
  }

  async function readAdvanced(kind) {
    try {
      if (kind === 'nonce') {
        const n = await publicClient.readContract({ address: CONTRACT, abi, functionName: 'nonces', args: [safeAddress(advanced.nonceOwner)] });
        setAdvanced((x) => ({ ...x, nonce: n.toString() }));
      } else {
        const d = await publicClient.readContract({ address: CONTRACT, abi, functionName: 'DOMAIN_SEPARATOR' });
        setAdvanced((x) => ({ ...x, domain: d }));
      }
    } catch (e) { setStatus(e.shortMessage || e.message); }
  }

  useEffect(() => { readMeta(); }, []);

  return <main className="shell">
    <section className="hero">
      <div>
        <span className="eyebrow">Conflux eSpace Testnet</span>
        <h1>{meta.name} token console</h1>
        <p>Send, approve, and inspect {meta.symbol} with wallet-first controls and explicit allowance safety.</p>
        <div className="contract">Contract <code>{CONTRACT}</code></div>
      </div>
      <button className="connect" onClick={connect}>{account ? short(account) : 'Connect wallet'}</button>
    </section>

    <div className="status">{status}</div>

    <section className="grid metrics">
      <div className="card"><span>Wallet balance</span><strong>{balance === null ? 'Connect wallet' : `${formatUnits(balance, meta.decimals)} ${meta.symbol}`}</strong><button onClick={() => refreshBalance()}>Refresh</button></div>
      <div className="card"><span>Total supply</span><strong>{formatUnits(meta.supply, meta.decimals)}</strong><small>{meta.symbol} · {meta.decimals} decimals</small></div>
      <div className="card"><span>Token status</span><strong className={meta.paused ? 'danger' : 'good'}>{meta.paused ? 'Paused' : 'Active'}</strong><small>Owner {meta.owner ? short(meta.owner) : 'unavailable'}</small></div>
    </section>

    <section className="grid flows">
      <div className="panel primary">
        <h2>Send {meta.symbol}</h2>
        <p>Transfer tokens from your connected wallet. Confirm the recipient and amount before signing.</p>
        <label>Recipient address<input value={send.to} onChange={(e) => setSend({ ...send, to: e.target.value })} placeholder="0x..." /></label>
        <label>Amount<input value={send.amount} onChange={(e) => setSend({ ...send, amount: e.target.value })} placeholder="0.00" inputMode="decimal" /></label>
        <button onClick={sendTokens}>Review transfer</button>
      </div>
      <div className="panel warn">
        <h2>Approve spending</h2>
        <p>Approvals let another address move your tokens. Prefer exact amounts instead of unlimited approvals.</p>
        <label>Spender address<input value={approval.spender} onChange={(e) => setApproval({ ...approval, spender: e.target.value })} placeholder="0x..." /></label>
        <label>Allowance amount<input value={approval.amount} onChange={(e) => setApproval({ ...approval, amount: e.target.value })} placeholder="0.00" inputMode="decimal" /></label>
        <button onClick={approveSpender}>Approve exact amount</button>
      </div>
    </section>

    <section className="grid tools">
      <div className="panel">
        <h2>Balance lookup</h2>
        <label>Address<input value={lookup.address} onChange={(e) => setLookup({ ...lookup, address: e.target.value })} placeholder="0x..." /></label>
        <button onClick={checkBalance}>Check balance</button>
        <output>{lookup.result}</output>
      </div>
      <div className="panel">
        <h2>Allowance check</h2>
        <label>Owner<input value={allowance.owner} onChange={(e) => setAllowance({ ...allowance, owner: e.target.value })} placeholder="0x..." /></label>
        <label>Spender<input value={allowance.spender} onChange={(e) => setAllowance({ ...allowance, spender: e.target.value })} placeholder="0x..." /></label>
        <button onClick={checkAllowance}>Check allowance</button>
        <output>{allowance.result}</output>
      </div>
      <div className="panel subdued">
        <h2>Advanced reads</h2>
        <label>Permit nonce owner<input value={advanced.nonceOwner} onChange={(e) => setAdvanced({ ...advanced, nonceOwner: e.target.value })} placeholder="0x..." /></label>
        <button onClick={() => readAdvanced('nonce')}>Read nonce</button>
        <output>{advanced.nonce}</output>
        <button onClick={() => readAdvanced('domain')}>Read domain separator</button>
        <output className="mono">{advanced.domain}</output>
      </div>
    </section>

    <section className="risk">
      <h2>Risk controls</h2>
      <p>Admin methods such as pause, unpause, transferOwnership, and renounceOwnership exist on this contract, so they are intentionally excluded from the main transaction flow.</p>
      <p>Always verify the chain is Conflux eSpace Testnet and never approve spenders you do not recognize.</p>
    </section>
  </main>;
}

createRoot(document.getElementById('root')).render(<App />);
