import React, { useState, useEffect, useCallback } from 'react';
import { createRoot } from 'react-dom/client';
import { createPublicClient, createWalletClient, custom, http, parseUnits, formatUnits } from 'viem';
import './styles.css';

const CHAIN = {
  id: 71,
  name: 'Conflux eSpace Testnet',
  network: 'conflux-espace-testnet',
  nativeCurrency: { name: 'CFX', symbol: 'CFX', decimals: 18 },
  rpcUrls: {
    default: { http: ['https://evmtestnet.confluxrpc.com'] },
    public: { http: ['https://evmtestnet.confluxrpc.com'] },
  },
};

const CONTRACT = '0x05d714465e24b7639a31eeb57d37396f889df725';

const TOKEN_ABI = [
  { constant: true, inputs: [], name: 'name', outputs: [{ name: '', type: 'string' }], type: 'function' },
  { constant: true, inputs: [], name: 'symbol', outputs: [{ name: '', type: 'string' }], type: 'function' },
  { constant: true, inputs: [], name: 'decimals', outputs: [{ name: '', type: 'uint8' }], type: 'function' },
  { constant: true, inputs: [], name: 'totalSupply', outputs: [{ name: '', type: 'uint256' }], type: 'function' },
  { constant: true, inputs: [{ name: 'account', type: 'address' }], name: 'balanceOf', outputs: [{ name: '', type: 'uint256' }], type: 'function' },
  { constant: true, inputs: [{ name: 'owner', type: 'address' }, { name: 'spender', type: 'address' }], name: 'allowance', outputs: [{ name: '', type: 'uint256' }], type: 'function' },
  { constant: false, inputs: [{ name: 'to', type: 'address' }, { name: 'value', type: 'uint256' }], name: 'transfer', outputs: [{ name: '', type: 'bool' }], type: 'function' },
  { constant: false, inputs: [{ name: 'spender', type: 'address' }, { name: 'value', type: 'uint256' }], name: 'approve', outputs: [{ name: '', type: 'bool' }], type: 'function' },
  { constant: true, inputs: [], name: 'owner', outputs: [{ name: '', type: 'address' }], type: 'function' },
  { constant: false, inputs: [], name: 'pause', outputs: [], type: 'function' },
  { constant: false, inputs: [], name: 'unpause', outputs: [], type: 'function' },
  { constant: false, inputs: [], name: 'renounceOwnership', outputs: [], type: 'function' },
  { constant: false, inputs: [{ name: 'newOwner', type: 'address' }], name: 'transferOwnership', outputs: [], type: 'function' },
];

const publicClient = createPublicClient({ chain: CHAIN, transport: http() });

function App() {
  const [account, setAccount] = useState(null);
  const [chainId, setChainId] = useState(null);
  const [tokenInfo, setTokenInfo] = useState({ name: '', symbol: '', decimals: 18, totalSupply: '0' });
  const [balance, setBalance] = useState('0');
  const [owner, setOwner] = useState(null);

  // UI state
  const [toAddress, setToAddress] = useState('');
  const [transferAmount, setTransferAmount] = useState('');
  const [spender, setSpender] = useState('');
  const [approveAmount, setApproveAmount] = useState('');
  const [allowanceOwner, setAllowanceOwner] = useState('');
  const [allowanceSpender, setAllowanceSpender] = useState('');
  const [allowance, setAllowance] = useState(null);
  const [showAdmin, setShowAdmin] = useState(false);
  const [newOwner, setNewOwner] = useState('');
  const [txHash, setTxHash] = useState('');
  const [error, setError] = useState('');

  const isOwner = account && owner && account.toLowerCase() === owner.toLowerCase();

  const fetchTokenInfo = useCallback(async () => {
    try {
      const [name, symbol, decimals, totalSupply, contractOwner] = await Promise.all([
        publicClient.readContract({ address: CONTRACT, abi: TOKEN_ABI, functionName: 'name' }),
        publicClient.readContract({ address: CONTRACT, abi: TOKEN_ABI, functionName: 'symbol' }),
        publicClient.readContract({ address: CONTRACT, abi: TOKEN_ABI, functionName: 'decimals' }),
        publicClient.readContract({ address: CONTRACT, abi: TOKEN_ABI, functionName: 'totalSupply' }),
        publicClient.readContract({ address: CONTRACT, abi: TOKEN_ABI, functionName: 'owner' }),
      ]);
      setTokenInfo({ name, symbol, decimals, totalSupply: totalSupply.toString() });
      setOwner(contractOwner);
    } catch (e) {
      console.error(e);
    }
  }, []);

  const fetchBalance = useCallback(async () => {
    if (!account) return;
    try {
      const bal = await publicClient.readContract({ address: CONTRACT, abi: TOKEN_ABI, functionName: 'balanceOf', args: [account] });
      setBalance(bal.toString());
    } catch (e) {
      console.error(e);
    }
  }, [account]);

  useEffect(() => {
    fetchTokenInfo();
  }, [fetchTokenInfo]);

  useEffect(() => {
    fetchBalance();
  }, [fetchBalance]);

  const connectWallet = async () => {
    if (!window.ethereum) {
      setError('No wallet found. Please install MetaMask.');
      return;
    }
    try {
      const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
      const chain = await window.ethereum.request({ method: 'eth_chainId' });
      setAccount(accounts[0]);
      setChainId(parseInt(chain, 16));
      if (parseInt(chain, 16) !== CHAIN.id) {
        try {
          await window.ethereum.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: '0x' + CHAIN.id.toString(16) }] });
        } catch (e) {
          setError('Please switch to Conflux eSpace Testnet.');
        }
      }
      window.ethereum.on('accountsChanged', ([acc]) => { setAccount(acc); });
      window.ethereum.on('chainChanged', (cid) => { setChainId(parseInt(cid, 16)); });
    } catch (e) {
      setError('Connection failed.');
    }
  };

  const getWalletClient = () => {
    return createWalletClient({ chain: CHAIN, transport: custom(window.ethereum) });
  };

  const handleTransfer = async () => {
    setError('');
    setTxHash('');
    try {
      const amount = parseUnits(transferAmount, tokenInfo.decimals);
      const wallet = getWalletClient();
      const hash = await wallet.writeContract({
        address: CONTRACT,
        abi: TOKEN_ABI,
        functionName: 'transfer',
        args: [toAddress, amount],
        account,
      });
      setTxHash(hash);
      fetchBalance();
    } catch (e) {
      setError(e.shortMessage || e.message);
    }
  };

  const handleCheckAllowance = async () => {
    if (!allowanceOwner || !allowanceSpender) return;
    try {
      const res = await publicClient.readContract({ address: CONTRACT, abi: TOKEN_ABI, functionName: 'allowance', args: [allowanceOwner, allowanceSpender] });
      setAllowance(res.toString());
    } catch (e) {
      setError(e.shortMessage || e.message);
    }
  };

  const handleApprove = async () => {
    setError('');
    setTxHash('');
    try {
      const amount = parseUnits(approveAmount, tokenInfo.decimals);
      const wallet = getWalletClient();
      const hash = await wallet.writeContract({
        address: CONTRACT,
        abi: TOKEN_ABI,
        functionName: 'approve',
        args: [spender, amount],
        account,
      });
      setTxHash(hash);
    } catch (e) {
      setError(e.shortMessage || e.message);
    }
  };

  const adminAction = async (method, args = []) => {
    if (!isOwner) return setError('Only contract owner can perform this action.');
    setError('');
    setTxHash('');
    try {
      const wallet = getWalletClient();
      const hash = await wallet.writeContract({ address: CONTRACT, abi: TOKEN_ABI, functionName: method, args, account });
      setTxHash(hash);
    } catch (e) {
      setError(e.shortMessage || e.message);
    }
  };

  const formatToken = (value) => formatUnits(BigInt(value || '0'), tokenInfo.decimals);

  return (
    <div className="container">
      <header>
        <h1>🪙 {tokenInfo.name || 'USDT0'} <span className="symbol">{tokenInfo.symbol}</span></h1>
        <p className="chain-badge">Conflux eSpace Testnet</p>
      </header>

      <div className="card">
        {!account ? (
          <button className="btn primary" onClick={connectWallet}>Connect Wallet</button>
        ) : (
          <>
            <div className="wallet-row">
              <span className="address">{account.slice(0,6)}...{account.slice(-4)}</span>
              <span className="balance">{formatToken(balance)} {tokenInfo.symbol}</span>
            </div>
            {chainId !== CHAIN.id && <p className="warning">⚠️ Wrong network. Switch to Conflux eSpace Testnet.</p>}
          </>
        )}
      </div>

      {account && (
        <>
          <div className="card">
            <h2>Send {tokenInfo.symbol}</h2>
            <div className="form-group">
              <input placeholder="Recipient address" value={toAddress} onChange={e => setToAddress(e.target.value)} />
              <input placeholder="Amount" type="number" value={transferAmount} onChange={e => setTransferAmount(e.target.value)} />
              <button className="btn" onClick={handleTransfer}>Transfer</button>
            </div>
          </div>

          <div className="card">
            <h2>Approval</h2>
            <div className="form-group">
              <input placeholder="Spender address" value={spender} onChange={e => setSpender(e.target.value)} />
              <input placeholder="Amount" type="number" value={approveAmount} onChange={e => setApproveAmount(e.target.value)} />
              <button className="btn" onClick={handleApprove}>Approve</button>
            </div>

            <h3>Check Allowance</h3>
            <div className="form-group">
              <input placeholder="Owner" value={allowanceOwner} onChange={e => setAllowanceOwner(e.target.value)} />
              <input placeholder="Spender" value={allowanceSpender} onChange={e => setAllowanceSpender(e.target.value)} />
              <button className="btn small" onClick={handleCheckAllowance}>Check</button>
              {allowance !== null && <p>Allowance: {formatToken(allowance)} {tokenInfo.symbol}</p>}
            </div>
          </div>

          {isOwner && (
            <div className="card admin">
              <h2 onClick={() => setShowAdmin(!showAdmin)} style={{cursor:'pointer'}}>⚙️ Admin Panel {showAdmin ? '▲' : '▼'}</h2>
              {showAdmin && (
                <>
                  <p className="danger-note">These actions affect the entire contract. Proceed with extreme caution.</p>
                  <div className="admin-actions">
                    <button className="btn danger" onClick={() => adminAction('pause')}>Pause</button>
                    <button className="btn danger" onClick={() => adminAction('unpause')}>Unpause</button>
                    <button className="btn danger" onClick={() => adminAction('renounceOwnership')} title="Irreversible!">Renounce Ownership</button>
                    <div className="form-group">
                      <input placeholder="New owner" value={newOwner} onChange={e => setNewOwner(e.target.value)} />
                      <button className="btn danger" onClick={() => adminAction('transferOwnership', [newOwner])}>Transfer Ownership</button>
                    </div>
                  </div>
                </>
              )}
            </div>
          )}

          <div className="card info">
            <p>Total Supply: {formatToken(tokenInfo.totalSupply)} {tokenInfo.symbol}</p>
            <p>Decimals: {tokenInfo.decimals}</p>
            <p>Contract Owner: {owner?.slice(0,6)}...{owner?.slice(-4)}</p>
          </div>
        </>
      )}

      {error && <div className="error-card">{error}</div>}
      {txHash && <div className="success-card">Transaction: <a href={`https://evmtestnet.confluxscan.io/tx/${txHash}`} target="_blank" rel="noopener noreferrer">{txHash.slice(0,10)}...{txHash.slice(-8)}</a></div>}
      <p className="safety-note">🔒 Always verify token addresses and approval amounts. This dapp never holds your private keys.</p>
    </div>
  );
}

createRoot(document.getElementById('root')).render(<App />);