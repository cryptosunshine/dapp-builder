import { useMemo, useState } from 'react';
import type { BuilderTaskInput, SkillName } from '../types';
import { getChainMeta } from '../lib/chains';

interface BuilderFormProps {
  onSubmit: (input: BuilderTaskInput) => void | Promise<void>;
  isSubmitting: boolean;
}

const initialState: BuilderTaskInput = {
  contractAddress: '',
  chain: 'conflux-espace-testnet',
  skills: ['auto', 'injected-wallet', 'guided-flow', 'risk-explainer'],
  skill: 'auto',
  model: 'current-hermes-model',
  apiKey: '',
  modelConfig: {
    providerId: 'local-hermes-agent',
    baseUrl: 'http://localhost',
    model: 'current-hermes-model',
    apiKey: '',
  },
};


const validAddressRe = /^0x[a-fA-F0-9]{40}$/;

const primarySkillOptions = [
  ['auto', 'Auto route', 'Let the builder choose the best product flow.'],
  ['token-dashboard', 'Token dashboard', 'Balances, transfers, approvals, and safety rails.'],
  ['nft-mint-experience', 'NFT mint', 'Mint-first page with ownership and collection context.'],
  ['voting-participation', 'Voting', 'Proposal review and guided voting actions.'],
] as const;

const modelAccounts = [
  {
    id: 'local-hermes-agent',
    label: 'Built-in generator',
    baseUrl: 'http://localhost',
    model: 'current-hermes-model',
  },
] as const;

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

const supportingSkills: SkillName[] = ['injected-wallet', 'guided-flow', 'risk-explainer'];

function selectPrimarySkill(current: BuilderTaskInput, skill: SkillName): BuilderTaskInput {
  const skills = skill === 'auto' ? ['auto', ...supportingSkills] : [skill, ...supportingSkills];
  return {
    ...current,
    skills,
    skill,
  };
}

export function BuilderForm({ onSubmit, isSubmitting }: BuilderFormProps) {
  const [formState, setFormState] = useState<BuilderTaskInput>(initialState);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [showChainTooltip, setShowChainTooltip] = useState(false);

  const validation = useMemo(() => addressHint(formState.contractAddress), [formState.contractAddress]);
  const chainMeta = useMemo(() => getChainMeta(formState.chain), [formState.chain]);
  const isCustomModel = formState.modelConfig?.providerId === 'custom';
  const isHermesModel = formState.modelConfig?.providerId === 'local-hermes-agent';

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

        <fieldset className="field field-full skill-fieldset">
          <legend>Experience goal</legend>
          <div className="skill-choice-grid">
            {primarySkillOptions.map(([skill, label, description]) => {
              const isSelected = formState.skill === skill;
              return (
                <button
                  key={skill}
                  type="button"
                  className={`skill-choice${isSelected ? ' skill-choice--selected' : ''}`}
                  aria-pressed={isSelected}
                  onClick={() => setFormState((current) => selectPrimarySkill(current, skill))}
                >
                  <strong>{label}</strong>
                  <span>{description}</span>
                </button>
              );
            })}
          </div>
          <span className="field-hint">Wallet connection, guided flow, and safety copy are included automatically.</span>
        </fieldset>

        <label className="field field-full">
          <span>Model account</span>
          <select
            value={formState.modelConfig?.providerId ?? 'custom'}
            onChange={(event) => {
              const providerId = event.target.value;
              const account = modelAccounts.find((entry) => entry.id === providerId);
              setFormState((current) => ({
                ...current,
                model: account?.model ?? current.modelConfig?.model ?? 'gpt-5.4',
                apiKey: '',
                modelConfig: account
                  ? { providerId: account.id, baseUrl: account.baseUrl, model: account.model, apiKey: '' }
                  : {
                      providerId: 'custom',
                      baseUrl: current.modelConfig?.baseUrl ?? 'https://api.openai.com/v1',
                      model: current.modelConfig?.model ?? current.model ?? 'gpt-5.4',
                      apiKey: current.modelConfig?.apiKey ?? '',
                    },
              }));
            }}
          >
            {modelAccounts.map((account) => (
              <option key={account.id} value={account.id}>{account.label}</option>
            ))}
            <option value="custom">Custom API</option>
          </select>
          <span className="field-hint">
            {isHermesModel
              ? 'Default generator. Choose Custom API only if you want to use your own model endpoint.'
              : 'Custom API keys are used only for this generation task and are not persisted.'}
          </span>
        </label>

        {isCustomModel && (
          <>
            <label className="field">
              <span>Base URL</span>
              <input
                value={formState.modelConfig?.baseUrl ?? ''}
                onChange={(event) => setFormState((current) => ({
                  ...current,
                  modelConfig: {
                    providerId: 'custom',
                    baseUrl: event.target.value,
                    model: current.modelConfig?.model ?? current.model ?? 'gpt-5.4',
                    apiKey: current.modelConfig?.apiKey ?? '',
                  },
                }))}
                placeholder="https://api.openai.com/v1"
              />
            </label>

            <label className="field">
              <span>Model</span>
              <input
                value={formState.modelConfig?.model ?? ''}
                onChange={(event) => setFormState((current) => ({
                  ...current,
                  model: event.target.value,
                  modelConfig: {
                    providerId: 'custom',
                    baseUrl: current.modelConfig?.baseUrl ?? 'https://api.openai.com/v1',
                    model: event.target.value,
                    apiKey: current.modelConfig?.apiKey ?? '',
                  },
                }))}
                placeholder="gpt-5.4"
              />
            </label>

            <div className="field field-full">
              <label htmlFor="api-key-input">API key</label>
              <input
                id="api-key-input"
                aria-describedby="api-key-hint"
                value={formState.modelConfig?.apiKey ?? ''}
                onChange={(event) => setFormState((current) => ({
                  ...current,
                  apiKey: event.target.value,
                  modelConfig: {
                    providerId: 'custom',
                    baseUrl: current.modelConfig?.baseUrl ?? 'https://api.openai.com/v1',
                    model: current.modelConfig?.model ?? current.model ?? 'gpt-5.4',
                    apiKey: event.target.value,
                  },
                }))}
                placeholder="sk-..."
              />
              <span id="api-key-hint" className="field-hint">
                Custom keys are used only for this generation task and are not persisted.
              </span>
            </div>
          </>
        )}
      </div>

      <div className="button-row">
        {submitError && <span className="field-hint hint-warn submit-error">{submitError}</span>}
        <button type="submit" className="primary-button" disabled={isSubmitting}>
          {isSubmitting ? 'Creating task...' : 'Generate dApp preview'}
        </button>
      </div>
    </form>
  );
}
