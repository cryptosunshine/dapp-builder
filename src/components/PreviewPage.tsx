import { useMemo, useState } from 'react';
import type { BuilderTask, MethodRunResult, PageMethod, WalletState } from '../types';
import { getChainMeta } from '../lib/chains';
import { MethodCard } from './MethodCard';
import { WalletBar } from './WalletBar';
import { WarningBanner } from './WarningBanner';

interface PreviewPageProps {
  task: BuilderTask;
  walletState: WalletState;
  onConnectWallet: () => void | Promise<void>;
  onRunMethod: (method: PageMethod, formValues: Record<string, string>) => void | Promise<void>;
  activeResult: MethodRunResult | null;
}

export function PreviewPage({ task, walletState, onConnectWallet, onRunMethod, activeResult }: PreviewPageProps) {
  const pageConfig = task.result?.pageConfig;
  const [methodFilter, setMethodFilter] = useState<'all' | 'read' | 'write' | 'danger'>('all');
  const [expandedAdvancedSections, setExpandedAdvancedSections] = useState<Record<string, boolean>>({});

  if (!pageConfig) {
    return <div className="empty-state">No pageConfig is available yet for this task.</div>;
  }

  const methodMap = new Map<string, PageMethod>();
  [...pageConfig.methods, ...pageConfig.dangerousMethods].forEach((method) => methodMap.set(method.name, method));

  const sections = [...pageConfig.sections];
  const primaryActions = pageConfig.primaryActions ?? [];
  if (pageConfig.dangerousMethods.length > 0 && !sections.some((section) => section.variant === 'danger')) {
    sections.push({
      id: 'danger-zone-fallback',
      title: 'Danger zone',
      description: 'Administrative or risky methods detected by the backend.',
      variant: 'danger',
      methodNames: pageConfig.dangerousMethods.map((method) => method.name),
    });
  }

  const methodCounts = useMemo(() => {
    const all = methodMap.size;
    const read = [...methodMap.values()].filter((m) => m.type === 'read').length;
    const write = [...methodMap.values()].filter((m) => m.type === 'write').length;
    const danger = [...methodMap.values()].filter((m) => m.dangerLevel === 'danger').length;
    return { all, read, write, danger };
  }, [methodMap]);

  const filteredMethodMap = useMemo(() => {
    return new Map(
      [...methodMap.entries()].filter(([, method]) => {
        if (methodFilter === 'all') return true;
        if (methodFilter === 'danger') return method.dangerLevel === 'danger';
        return method.type === methodFilter;
      }),
    );
  }, [methodFilter, methodMap]);

  const filterButtons = [
    { value: 'all' as const, label: `All methods (${methodCounts.all})` },
    { value: 'read' as const, label: `Read methods (${methodCounts.read})` },
    { value: 'write' as const, label: `Write methods (${methodCounts.write})` },
    { value: 'danger' as const, label: `Danger methods (${methodCounts.danger})` },
  ];
  const hasBalanceLookup = pageConfig.skill === 'token-dashboard' && methodMap.has('balanceOf');
  const chainMeta = getChainMeta(pageConfig.chain);
  const walletLabel = walletState.account
    ? `Ready for ${walletState.account.slice(0, 6)}…${walletState.account.slice(-4)}`
    : 'Connect wallet to check your token balance.';
  const walletReadinessLabel = walletState.account
    ? `Wallet ready on ${chainMeta.chainName}. Run Balance Of before sending or approving.`
    : `Connect a wallet on ${chainMeta.chainName} to read your live token position.`;
  const shortenedContractAddress = `${pageConfig.contractAddress.slice(0, 6)}…${pageConfig.contractAddress.slice(-4)}`;

  return (
    <div className="preview-page">
      <header className="hero-card">
        <div>
          <p className="eyebrow">AI dApp Builder Preview</p>
          <h1>{pageConfig.title}</h1>
          {pageConfig.description && <p>{pageConfig.description}</p>}
        </div>
        <div className="hero-card__meta">
          <div>Skill: {pageConfig.skill}</div>
          <div>Chain: {getChainMeta(pageConfig.chain).chainName} (ID: {pageConfig.chainId})</div>
          <div>Contract: {pageConfig.contractAddress}</div>
        </div>
      </header>

      <WalletBar walletState={walletState} onConnectWallet={onConnectWallet} chain={pageConfig.chain} />

      {pageConfig.warnings.length > 0 && (
        <section className="stack-section">
          {pageConfig.warnings.map((warning) => (
            <WarningBanner key={warning} warning={warning} />
          ))}
        </section>
      )}

      {primaryActions.length > 0 && (
        <section className="stack-section">
          <div className="preview-section quick-actions-panel">
            <header>
              <h2>Top actions</h2>
              <p>The fastest ways a normal user is likely to use this dApp.</p>
            </header>
            <div className="button-row">
              {primaryActions.map((action) => (
                <span key={action} className="secondary-button quick-action-chip">
                  {action}
                </span>
              ))}
            </div>
          </div>
        </section>
      )}

      <section className="stack-section">
        <div className="button-row">
          {filterButtons.map((filterButton) => (
            <button
              key={filterButton.value}
              type="button"
              aria-pressed={methodFilter === filterButton.value}
              className={methodFilter === filterButton.value ? 'primary-button' : 'secondary-button'}
              onClick={() => setMethodFilter(filterButton.value)}
            >
              {filterButton.label}
            </button>
          ))}
        </div>
      </section>

      <div className="section-grid">
        {sections.map((section) => {
          const sectionMethods = section.methodNames
            .map((methodName) => filteredMethodMap.get(methodName))
            .filter((method): method is PageMethod => Boolean(method));

          const hasApprovalFlow =
            pageConfig.skill === 'token-dashboard' &&
            sectionMethods.some((method) => ['approve', 'allowance'].includes(method.name.toLowerCase()));
          const hasTransferFlow =
            pageConfig.skill === 'token-dashboard' &&
            sectionMethods.some((method) => ['transfer', 'transferfrom'].includes(method.name.toLowerCase()));

          const isAdvancedTokenSection =
            pageConfig.skill === 'token-dashboard' &&
            (section.id.toLowerCase().includes('advanced') || section.title.toLowerCase().includes('advanced'));

          const sectionBody = (
            <>
              {hasApprovalFlow && (
                <aside className="approval-safety-rail" aria-label="Approval safety">
                  <strong>Approval safety</strong>
                  <span>Approve only spenders you trust, and avoid unlimited allowances unless you mean it.</span>
                  <small>Double-check the spender address before approving; a wrong spender can drain the allowance.</small>
                  <small>Run Allowance for the spender before approving so you know the current exposure.</small>
                  <small>Start with the exact allowance this app needs; increase later only if intentional.</small>
                  <small>Revoke by setting the allowance back to 0 before changing wallets or after finishing an app.</small>
                  <div className="approval-revoke-path">
                    <strong>Revoke path</strong>
                    <span>Use the same spender and submit Approve with amount 0.</span>
                    <small>Rerun Allowance to confirm it reads 0 before trusting the revoke.</small>
                  </div>
                </aside>
              )}

              {hasTransferFlow && (
                <aside className="transfer-helper-rail" aria-label="Transfer checklist">
                  <strong>Transfer checklist</strong>
                  <span>Confirm the recipient address and token amount before signing.</span>
                  <small>Only send to addresses you control or have verified.</small>
                  <small>Use the token decimals shown by the app before entering amount.</small>
                  <small>Send a small test amount first when using a new token or recipient.</small>
                  <small>Token transfers cannot be reversed after confirmation.</small>
                  <small>Make sure the wallet network matches {chainMeta.chainName} before signing.</small>
                  <small>Your connected wallet will pay gas and send from the active account.</small>
                </aside>
              )}

              {section.variant === 'overview' ? (
                <div className="overview-card">
                  <div>
                    <strong>Contract name</strong>
                    <span>{pageConfig.contractName}</span>
                  </div>
                  <div>
                    <strong>Chain ID</strong>
                    <span>{pageConfig.chainId}</span>
                  </div>
                  {hasBalanceLookup && (
                    <div className="asset-card">
                      <strong>Wallet balance</strong>
                      <span>{walletLabel}</span>
                      <small className="asset-card__readiness">{walletReadinessLabel}</small>
                      <small>Token contract {shortenedContractAddress}</small>
                      <small>Use Balance Of to check holdings before transfers or approvals.</small>
                    </div>
                  )}
                </div>
              ) : (
                <div className="method-grid">
                  {sectionMethods.map((method) => (
                    <MethodCard
                      key={method.name}
                      method={method}
                      onRunMethod={onRunMethod}
                      activeResult={activeResult}
                      walletAccount={walletState.account}
                    />
                  ))}
                  {sectionMethods.length === 0 && <div className="empty-state">No methods in this section.</div>}
                </div>
              )}
            </>
          );

          if (isAdvancedTokenSection) {
            const isExpanded = Boolean(expandedAdvancedSections[section.id]);

            return (
              <details
                key={section.id}
                className={`preview-section variant-${section.variant} advanced-actions-panel`}
                open={isExpanded}
              >
                <summary
                  onClick={(event) => {
                    event.preventDefault();
                    setExpandedAdvancedSections((current) => ({ ...current, [section.id]: !current[section.id] }));
                  }}
                >
                  <span>
                    <strong>{section.title}</strong>
                    {section.description && <small>{section.description}</small>}
                  </span>
                </summary>
                {isExpanded && sectionBody}
              </details>
            );
          }

          return (
            <section key={section.id} className={`preview-section variant-${section.variant}`}>
              <header>
                <h2>{section.title}</h2>
                {section.description && <p>{section.description}</p>}
              </header>
              {sectionBody}
            </section>
          );
        })}
      </div>
    </div>
  );
}
