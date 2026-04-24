import { useState, useMemo } from 'react';
import type { BuilderTaskInput } from '../types';

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

export function BuilderForm({ onSubmit, isSubmitting }: BuilderFormProps) {
  const [formState, setFormState] = useState<BuilderTaskInput>(initialState);

  const validation = useMemo(() => addressHint(formState.contractAddress), [formState.contractAddress]);

  return (
    <form
      className="builder-form"
      onSubmit={(event) => {
        event.preventDefault();
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
          <select
            value={formState.chain}
            onChange={(event) => setFormState((current) => ({ ...current, chain: event.target.value as BuilderTaskInput['chain'] }))}
          >
            <option value="conflux-espace-testnet">Conflux eSpace Testnet</option>
          </select>
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

        <label className="field field-full">
          <span>API key</span>
          <input
            value={formState.apiKey}
            onChange={(event) => setFormState((current) => ({ ...current, apiKey: event.target.value }))}
            placeholder="Optional for now, but wired for future prompt enhancement"
          />
        </label>
      </div>

      <div className="button-row">
        <button
          type="button"
          className="secondary-button"
          onClick={() => setFormState((current) => ({ ...current, contractAddress: sampleContractAddress }))}
        >
          Use sample contract
        </button>

        <button
          type="button"
          className="secondary-button"
          onClick={() => setFormState(structuredClone(initialState))}
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
