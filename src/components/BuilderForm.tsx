import { useState, useMemo } from 'react';
import type { BuilderTaskInput } from '../types';
import { getChainMeta } from '../lib/chains';

interface BuilderFormProps {
  onSubmit: (input: BuilderTaskInput) => void | Promise<void>;
  isSubmitting: boolean;
}

const initialState: BuilderTaskInput = {
  contractAddress: '',
  chain: 'conflux-espace-testnet',
  skill: 'token-dashboard',
  model: 'gpt-5.4',
  apiKey: '',
};

const sampleContractAddress = '0x1234567890123456789012345678901234567890';

const validAddressRe = /^0x[a-fA-F0-9]{40}$/;

const skillDescriptions: Record<BuilderTaskInput['skill'], string> = {
  'token-dashboard': 'View token balances, transfer tokens, approve spending (ERC20)',
  'nft-mint-page': 'Mint NFTs, check ownership, view metadata',
  'claim-page': 'Claim tokens and check claimable amounts',
  'staking-page': 'Stake/unstake tokens and track your rewards',
};

function addressHint(address: string): { text: string; className: string } | null {
  if (address.length === 0) return null;
  if (validAddressRe.test(address)) {
    return { text: '✓ Valid address', className: 'hint-ok' };
  }
  if (address.startsWith('0x') && address.length < 42) {
    return { text: 'Address too short — expected 42 chars (0x + 40 hex)', className: 'hint-warn' };
  }
  return { text: 'Address must start with 0x followed by 40 hex characters', className: 'hint-warn' };
}

function isAddressInvalid(value: string): boolean {
  return value.length > 0 && !validAddressRe.test(value);
}

export function BuilderForm({ onSubmit, isSubmitting }: BuilderFormProps) {
  const [formState, setFormState] = useState<BuilderTaskInput>(initialState);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [showChainTooltip, setShowChainTooltip] = useState(false);

  const validation = useMemo(() => addressHint(formState.contractAddress), [formState.contractAddress]);
  const chainMeta = useMemo(() => getChainMeta(formState.chain), [formState.chain]);

  return (
    <form
      className="builder-form"
      onSubmit={(event) => {
        event.preventDefault();
        setSubmitError(null);
        const addr = formState.contractAddress;
        if (addr.length === 0 || isAddressInvalid(addr)) {
          setSubmitError('Please enter a valid contract address (0x + 40 hex characters)');
          return;
        }
        void onSubmit(formState);
      }}
    >
      <div className="form-grid">
        <label className="field field-full">
          <span>Contract address</span>
          <input
            value={formState.contractAddress}
            onChange={(event) => setFormState((current) => ({ ...current, contractAddress: event.target.value.trim() }))}
            placeholder="0x..."
            required
          />
          {validation && <span className={`field-hint ${validation.className}`}>{validation.text}</span>}
        </label>

        <label className="field">
          <span>Chain</span>
          <div className="tooltip-anchor">
            <select
              value={formState.chain}
              onChange={(event) => setFormState((current) => ({ ...current, chain: event.target.value as BuilderTaskInput['chain'] }))}
              onMouseEnter={() => setShowChainTooltip(true)}
              onMouseLeave={() => setShowChainTooltip(false)}
              onFocus={() => setShowChainTooltip(true)}
              onBlur={() => setShowChainTooltip(false)}
            >
              <option value="conflux-espace-testnet">Conflux eSpace Testnet</option>
            </select>
            {showChainTooltip && (
              <div className="tooltip-bubble" role="tooltip">
                <div className="tooltip-row">Chain ID: {chainMeta.chainId}</div>
                <div className="tooltip-row">RPC: {chainMeta.rpcUrl}</div>
                <div className="tooltip-row">Currency: {chainMeta.nativeCurrency.symbol}</div>
              </div>
            )}
          </div>
        </label>

        <label className="field">
          <span>Skill</span>
          <select
            value={formState.skill}
            onChange={(event) => setFormState((current) => ({ ...current, skill: event.target.value as BuilderTaskInput['skill'] }))}
          >
            <option value="token-dashboard">token-dashboard</option>
            <option value="nft-mint-page">nft-mint-page</option>
            <option value="claim-page">claim-page</option>
            <option value="staking-page">staking-page</option>
          </select>
          <span className="field-hint">{skillDescriptions[formState.skill]}</span>
        </label>

        <label className="field">
          <span>Model</span>
          <input
            value={formState.model}
            onChange={(event) => setFormState((current) => ({ ...current, model: event.target.value }))}
            placeholder="gpt-5.4"
            required
          />
        </label>

        <div className="field field-full">
          <label htmlFor="api-key-input">API key</label>
          <input
            id="api-key-input"
            aria-describedby="api-key-hint"
            value={formState.apiKey}
            onChange={(event) => setFormState((current) => ({ ...current, apiKey: event.target.value }))}
            placeholder="Optional for now, but wired for future prompt enhancement"
          />
          <span id="api-key-hint" className="field-hint">
            Blank API key uses deterministic ABI-only generation. Model is only used to polish labels when an API key is provided.
          </span>
        </div>
      </div>

      <div className="button-row">
        {submitError && <span className="field-hint hint-warn submit-error">{submitError}</span>}
        <button
          type="button"
          className="secondary-button"
          onClick={() => setFormState((current) => ({ ...current, contractAddress: sampleContractAddress }))}
        >
          Use sample contract
        </button>

        <button
          type="button"
          className="ghost-button"
          onClick={() => { setFormState(structuredClone(initialState)); setSubmitError(null); }}
        >
          Clear form
        </button>

        <button type="submit" className="primary-button" disabled={isSubmitting}>
          {isSubmitting ? 'Creating task...' : 'Generate dApp preview'}
        </button>
      </div>
    </form>
  );
}
