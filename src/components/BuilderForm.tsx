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
  model: 'gpt-5.4',
  apiKey: '',
  modelConfig: {
    baseUrl: 'https://api.openai.com/v1',
    model: 'gpt-5.4',
    apiKey: '',
  },
};

const sampleContractAddress = '0x1234567890123456789012345678901234567890';

const validAddressRe = /^0x[a-fA-F0-9]{40}$/;

const skillGroups = [
  {
    title: 'Business direction',
    skills: [
      ['auto', 'Auto'],
      ['token-dashboard', 'Token dashboard'],
      ['nft-mint-experience', 'NFT mint experience'],
      ['voting-participation', 'Voting participation'],
    ],
  },
  {
    title: 'Wallet',
    skills: [
      ['injected-wallet', 'Injected wallet'],
      ['eip-6963-wallet-discovery', 'EIP-6963 wallet discovery'],
      ['chain-switching', 'Chain switching'],
    ],
  },
  {
    title: 'Experience',
    skills: [
      ['guided-flow', 'Guided flow'],
      ['transaction-timeline', 'Transaction timeline'],
      ['risk-explainer', 'Risk explainer'],
      ['explorer-links', 'Explorer links'],
    ],
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

function toggleSkill(current: BuilderTaskInput, skill: SkillName): BuilderTaskInput {
  const skills = current.skills.includes(skill)
    ? current.skills.filter((entry) => entry !== skill)
    : [...current.skills, skill];

  return {
    ...current,
    skills,
    skill: skills[0] ?? 'auto',
  };
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

        <fieldset className="field field-full skill-fieldset">
          <legend>Skills</legend>
          {skillGroups.map((group) => (
            <div key={group.title} className="skill-group">
              <strong>{group.title}</strong>
              <div className="skill-grid">
                {group.skills.map(([skill, label]) => (
                  <label key={skill} className="checkbox-option">
                    <input
                      type="checkbox"
                      checked={formState.skills.includes(skill)}
                      onChange={() => setFormState((current) => toggleSkill(current, skill))}
                    />
                    <span>{label}</span>
                  </label>
                ))}
              </div>
            </div>
          ))}
        </fieldset>

        <label className="field">
          <span>Base URL</span>
          <input
            value={formState.modelConfig?.baseUrl ?? ''}
            onChange={(event) => setFormState((current) => ({
              ...current,
              modelConfig: {
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
                baseUrl: current.modelConfig?.baseUrl ?? 'https://api.openai.com/v1',
                model: current.modelConfig?.model ?? current.model ?? 'gpt-5.4',
                apiKey: event.target.value,
              },
            }))}
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
          className="secondary-button"
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
