import { useState } from 'react';
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

export function BuilderForm({ onSubmit, isSubmitting }: BuilderFormProps) {
  const [formState, setFormState] = useState<BuilderTaskInput>(initialState);

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

        <button type="submit" className="primary-button" disabled={isSubmitting}>
          {isSubmitting ? 'Creating task...' : 'Generate dApp preview'}
        </button>
      </div>
    </form>
  );
}
