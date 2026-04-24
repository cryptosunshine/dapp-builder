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

  if (!pageConfig) {
    return <div className="empty-state">No pageConfig is available yet for this task.</div>;
  }

  const methodMap = new Map<string, PageMethod>();
  [...pageConfig.methods, ...pageConfig.dangerousMethods].forEach((method) => methodMap.set(method.name, method));

  const sections = [...pageConfig.sections];
  if (pageConfig.dangerousMethods.length > 0 && !sections.some((section) => section.variant === 'danger')) {
    sections.push({
      id: 'danger-zone-fallback',
      title: 'Danger zone',
      description: 'Administrative or risky methods detected by the backend.',
      variant: 'danger',
      methodNames: pageConfig.dangerousMethods.map((method) => method.name),
    });
  }

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

      <div className="section-grid">
        {sections.map((section) => {
          const sectionMethods = section.methodNames
            .map((methodName) => methodMap.get(methodName))
            .filter((method): method is PageMethod => Boolean(method));

          return (
            <section key={section.id} className={`preview-section variant-${section.variant}`}>
              <header>
                <h2>{section.title}</h2>
                {section.description && <p>{section.description}</p>}
              </header>

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
                </div>
              ) : (
                <div className="method-grid">
                  {sectionMethods.map((method) => (
                    <MethodCard
                      key={method.name}
                      method={method}
                      onRunMethod={onRunMethod}
                      activeResult={activeResult}
                    />
                  ))}
                  {sectionMethods.length === 0 && <div className="empty-state">No methods in this section.</div>}
                </div>
              )}
            </section>
          );
        })}
      </div>
    </div>
  );
}
