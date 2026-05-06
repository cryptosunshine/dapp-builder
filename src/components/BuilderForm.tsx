import { useMemo, useState } from 'react';
import type { BuilderTaskInput, SkillName } from '../types';
import { defaultGenerationSkillIds, generationSkillCatalog } from '../../shared/generation-skills';
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
  agentSkills: [...defaultGenerationSkillIds],
  customAgentSkill: '',
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
const defaultAgentSkillOptions = generationSkillCatalog.filter((skill) => skill.source === 'default');
const githubAgentSkillOptions = generationSkillCatalog.filter((skill) => skill.source === 'github');

function toggleAgentSkill(current: BuilderTaskInput, skillId: string): BuilderTaskInput {
  const currentSkills = current.agentSkills ?? [...defaultGenerationSkillIds];
  const nextSkills = currentSkills.includes(skillId)
    ? currentSkills.filter((id) => id !== skillId)
    : [...currentSkills, skillId];
  return {
    ...current,
    agentSkills: nextSkills.length > 0 ? nextSkills : [...defaultGenerationSkillIds],
  };
}

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
            <div className="select-shell">
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
            </div>
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

        <fieldset className="field field-full skill-fieldset agent-skill-fieldset">
          <legend>Generation skills</legend>
          <div className="skill-section-label">Default skills loaded for every dApp</div>
          <div className="agent-skill-list" aria-label="Default generation skills">
            {defaultAgentSkillOptions.map((skill) => (
              <div className="agent-skill-card agent-skill-card--default" key={skill.id}>
                <strong>{skill.label}</strong>
                <span>{skill.description}</span>
              </div>
            ))}
          </div>

          <div className="skill-section-label">Optional GitHub-inspired skills</div>
          <div className="agent-skill-list" aria-label="Optional GitHub-inspired skills">
            {githubAgentSkillOptions.map((skill) => {
              const isSelected = (formState.agentSkills ?? []).includes(skill.id);
              return (
                <button
                  key={skill.id}
                  type="button"
                  className={`agent-skill-card agent-skill-card--button${isSelected ? ' agent-skill-card--selected' : ''}`}
                  aria-pressed={isSelected}
                  onClick={() => setFormState((current) => toggleAgentSkill(current, skill.id))}
                >
                  <span className="agent-skill-card__status">{isSelected ? 'Selected' : '+ Add'}</span>
                  <strong>{skill.label}</strong>
                  <span>{skill.description}</span>
                </button>
              );
            })}
          </div>
          <label className="field custom-agent-skill-field" htmlFor="custom-agent-skill">
            <span>Custom skill</span>
            <textarea
              id="custom-agent-skill"
              value={formState.customAgentSkill ?? ''}
              onChange={(event) => setFormState((current) => ({ ...current, customAgentSkill: event.target.value }))}
              placeholder="Example: make the generated page feel like a DeFi portfolio app with a compact trading ticket."
              rows={3}
            />
          </label>
          <span className="field-hint">Changing these skills changes the generator prompt. Installed Hermes skills are loaded when available; custom text is injected as generation guidance.</span>
        </fieldset>

        <label className="field field-full">
          <span>Model account</span>
          <div className="select-shell">
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
          </div>
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
