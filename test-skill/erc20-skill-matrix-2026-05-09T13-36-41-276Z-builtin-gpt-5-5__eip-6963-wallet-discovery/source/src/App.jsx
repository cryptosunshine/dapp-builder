import React, { useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { createPublicClient, createWalletClient, custom, defineChain, formatUnits, getAddress, http, isAddress, parseUnits } from 'viem';
import './styles.css';

const CONTRACT = '0x05d714465e24b7639a31eeb57d37396f889df725';
const espaceTestnet = defineChain({
  id: 71,
  name: 'Conflux eSpace Testnet',
  nativeCurrency: { name: 'Conflux', symbol: 'CFX', decimals: 18 },
  rpcUrls: { default: { http: ['https://evmtestnet.confluxrpc.com'] } },
  blockExplorers: { default: { name: 'ConfluxScan', url: 'https://evmtestnet.confluxscan.org' } },
});
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
const publicClient = createPublicClient({ chain: espaceTestnet, transport: http() });
const short = (v) => (v ? `${v.slice(0, 6)}…${v.slice(-4)}` : '—');

function App() {
  const [providers, setProviders] = useState([]);
  const [selected, setSelected] = useState(null);
  const [account, setAccount] = useState('');
  const [chainId, setChainId] = useState('');
  const [meta, setMeta] = useState({ name: 'USDT0', symbol: 'USDT0', decimals: 18, totalSupply: 0n, paused: false, owner: '' });
  const [walletBalance, setWalletBalance] = useState(null);
  const [lookup, setLookup] = useState({ address: '', result: '' });
  const [send, setSend] = useState({ to: '', amount: '' });
  const [allowance, setAllowance] = useState({ owner: '', spender: '', result: '' });
  const [approve, setApprove] = useState({ spender: '', amount: '' });
  const [advanced, setAdvanced] = useState({ nonceOwner: '', nonce: '', domain: '' });
  const [status, setStatus] = useState('Ready');

  const walletClient = useMemo(() => selected ? createWalletClient({ chain: espaceTestnet, transport: custom(selected.provider) }) : null, [selected]);

  useEffect(() => {
    const found = [];
    const add = (event) => {
      const info = event.detail.info;
      if (!found.some((p) => p.info.uuid === info.uuid)) {
        found.push(event.detail);
        setProviders([...found]);
        if (!selected) setSelected(event.detail);
      }
    };
    window.addEventListener('eip6963:announceProvider', add);
    window.dispatchEvent(new Event('eip6963:requestProvider'));
    if (window.ethereum) {
      const fallback = { info: { uuid: 'injected', name: 'Injected wallet', icon: '' }, provider: window.ethereum };
      found.push(fallback); setProviders([fallback]); setSelected(fallback);
    }
    return () => window.removeEventListener('eip6963:announceProvider', add);
  }, []);

  async function readToken() {
    try {
      const [name, symbol, decimals, totalSupply, paused, owner] = await Promise.all([
        publicClient.readContract({ address: CONTRACT, abi: ABI, functionName: 'name' }),
        publicClient.readContract({ address: CONTRACT, abi: ABI, functionName: 'symbol' }),
        publicClient.readContract({ address: CONTRACT, abi: ABI, functionName: 'decimals' }),
        publicClient.readContract({ address: CONTRACT, abi: ABI, functionName: 'totalSupply' }),
        publicClient.readContract({ address: CONTRACT, abi: ABI, functionName: 'paused' }).catch(() => false),
        publicClient.readContract({ address: CONTRACT, abi: ABI, functionName: 'owner' }).catch(() => ''),
      ]);
      setMeta({ name, symbol, decimals, totalSupply, paused, owner });
    } catch (e) { setStatus(e.shortMessage || e.message); }
  }
  useEffect(() => { readToken(); }, []);

  async function refreshBalance(addr = account) {
    if (!addr) return;
    const bal = await publicClient.readContract({ address: CONTRACT, abi: ABI, functionName: 'balanceOf', args: [getAddress(addr)] });
    setWalletBalance(bal);
  }

  async function connect(p = selected) {
    if (!p) return setStatus('No EIP-6963 wallet provider found');
    try {
      const accounts = await p.provider.request({ method: 'eth_requestAccounts' });
      const id = await p.provider.request({ method: 'eth_chainId' });
      setSelected(p); setAccount(accounts[0]); setChainId(id); setAllowance((a) => ({ ...a, owner: accounts[0] })); setLookup((l) => ({ ...l, address: accounts[0] }));
      await refreshBalance(accounts[0]); setStatus(`Connected ${p.info.name}`);
      p.provider.on?.('accountsChanged', (xs) => { setAccount(xs[0] || ''); if (xs[0]) refreshBalance(xs[0]); });
      p.provider.on?.('chainChanged', setChainId);
    } catch (e) { setStatus(e.shortMessage || e.message); }
  }

  async function switchNetwork() {
    if (!selected) return;
    try {
      await selected.provider.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: '0x47' }] });
    } catch (e) {
      setStatus('Switch wallet to Conflux eSpace Testnet (chain 71)');
    }
  }

  const amountToRaw = (v) => parseUnits(v || '0', meta.decimals);
  const fmt = (v) => v === null || v === undefined || v === '' ? '—' : `${formatUnits(BigInt(v), meta.decimals)} ${meta.symbol}`;

  async function doLookup() {
    if (!isAddress(lookup.address)) return setStatus('Enter a valid address');
    const bal = await publicClient.readContract({ address: CONTRACT, abi: ABI, functionName: 'balanceOf', args: [getAddress(lookup.address)] });
    setLookup({ ...lookup, result: fmt(bal) });
  }
  async function doAllowance() {
    if (!isAddress(allowance.owner) || !isAddress(allowance.spender)) return setStatus('Owner and spender must be valid addresses');
    const res = await publicClient.readContract({ address: CONTRACT, abi: ABI, functionName: 'allowance', args: [getAddress(allowance.owner), getAddress(allowance.spender)] });
    setAllowance({ ...allowance, result: fmt(res) });
  }
  async function sendTx(kind) {
    if (!walletClient || !account) return setStatus('Connect a wallet first');
    try {
      setStatus('Confirm in wallet…');
      const fn = kind === 'transfer' ? 'transfer' : 'approve';
      const args = kind === 'transfer' ? [getAddress(send.to), amountToRaw(send.amount)] : [getAddress(approve.spender), amountToRaw(approve.amount)];
      const hash = await walletClient.writeContract({ account: getAddress(account), address: CONTRACT, abi: ABI, functionName: fn, args });
      setStatus(`Transaction submitted: ${hash}`); await refreshBalance();
    } catch (e) { setStatus(e.shortMessage || e.message); }
  }
  async function readAdvanced() {
    const tasks = [publicClient.readContract({ address: CONTRACT, abi: ABI, functionName: 'DOMAIN_SEPARATOR' })];
    if (isAddress(advanced.nonceOwner)) tasks.push(publicClient.readContract({ address: CONTRACT, abi: ABI, functionName: 'nonces', args: [getAddress(advanced.nonceOwner)] }));
    const [domain, nonce] = await Promise.all(tasks);
    setAdvanced({ ...advanced, domain, nonce: nonce?.toString?.() || advanced.nonce });
  }

  return <main>
    <section className="hero">
      <div><p className="eyebrow">EIP-6963 wallet-ready token console</p><h1>{meta.name} <span>{meta.symbol}</span></h1><p>Connect with any discovered browser wallet, review network/account state, then use focused ERC20 flows for balances, transfers, and approvals.</p></div>
      <div className="contract"><b>Contract</b><code>{CONTRACT}</code><span className={meta.paused ? 'pill warn' : 'pill ok'}>{meta.paused ? 'Paused' : 'Active'}</span></div>
    </section>

    <section className="grid two">
      <div className="card wallet"><div className="cardHead"><h2>Wallet discovery</h2><span>{providers.length} provider{providers.length === 1 ? '' : 's'}</span></div><p>EIP-6963 lets multiple wallets announce themselves without fighting over one injected provider.</p>
        <div className="providers">{providers.map((p) => <button key={p.info.uuid} className={selected?.info.uuid === p.info.uuid ? 'provider selected' : 'provider'} onClick={() => connect(p)}>{p.info.icon && <img src={p.info.icon} />}<b>{p.info.name}</b><small>{selected?.info.uuid === p.info.uuid ? 'Selected' : 'Connect'}</small></button>)}</div>
        <div className="state"><span>Account <b>{short(account)}</b></span><span>Network <b>{chainId ? `${parseInt(chainId, 16)}${chainId === '0x47' ? ' ✓' : ''}` : '—'}</b></span><span>Provider <b>{selected?.info.name || 'None'}</b></span></div>
        {chainId && chainId !== '0x47' && <button onClick={switchNetwork} className="secondary">Switch to Conflux eSpace Testnet</button>}
      </div>
      <div className="card balance"><div className="cardHead"><h2>Your balance</h2><button onClick={() => refreshBalance()} disabled={!account}>Refresh</button></div><div className="big">{fmt(walletBalance)}</div><div className="metrics"><span>Total supply<b>{fmt(meta.totalSupply)}</b></span><span>Decimals<b>{meta.decimals}</b></span><span>Owner<b>{short(meta.owner)}</b></span></div></div>
    </section>

    <section className="grid two">
      <div className="card"><h2>Send tokens</h2><p className="note">Transfers move {meta.symbol} from your connected account. Verify recipient carefully.</p><label>Recipient<input value={send.to} onChange={(e) => setSend({ ...send, to: e.target.value })} placeholder="0x…" /></label><label>Amount<input value={send.amount} onChange={(e) => setSend({ ...send, amount: e.target.value })} placeholder="0.00" /></label><button className="primary" onClick={() => sendTx('transfer')}>Send {meta.symbol}</button></div>
      <div className="card"><h2>Approval safety</h2><p className="note warnText">Approvals let a spender move tokens later. Prefer exact amounts over unlimited approvals.</p><label>Spender<input value={approve.spender} onChange={(e) => setApprove({ ...approve, spender: e.target.value })} placeholder="0x…" /></label><label>Amount<input value={approve.amount} onChange={(e) => setApprove({ ...approve, amount: e.target.value })} placeholder="0.00" /></label><button className="primary" onClick={() => sendTx('approve')}>Approve exact amount</button></div>
    </section>

    <section className="grid two">
      <div className="card"><h2>Balance lookup</h2><label>Address<input value={lookup.address} onChange={(e) => setLookup({ ...lookup, address: e.target.value })} placeholder="0x…" /></label><button onClick={doLookup}>Check balance</button><div className="result">{lookup.result || 'No lookup yet'}</div></div>
      <div className="card"><h2>Allowance check</h2><label>Owner<input value={allowance.owner} onChange={(e) => setAllowance({ ...allowance, owner: e.target.value })} placeholder="0x…" /></label><label>Spender<input value={allowance.spender} onChange={(e) => setAllowance({ ...allowance, spender: e.target.value })} placeholder="0x…" /></label><button onClick={doAllowance}>Check allowance</button><div className="result">{allowance.result || 'No allowance checked'}</div></div>
    </section>

    <section className="card advanced"><div><h2>Advanced token reads</h2><p>Compact access to non-primary safe reads. Administrative write methods are intentionally not surfaced.</p></div><label>Nonce owner<input value={advanced.nonceOwner} onChange={(e) => setAdvanced({ ...advanced, nonceOwner: e.target.value })} placeholder="0x…" /></label><button onClick={readAdvanced}>Read domain / nonce</button><div className="mono">DOMAIN_SEPARATOR: {advanced.domain || '—'}<br />Nonce: {advanced.nonce || '—'}</div></section>
    <footer><span>{status}</span><a href={`https://evmtestnet.confluxscan.org/address/${CONTRACT}`} target="_blank">View on explorer</a></footer>
  </main>;
}

createRoot(document.getElementById('root')).render(<App />);
