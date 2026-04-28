import type { ExperienceComponent, MethodRunResult, PageMethod, WalletState } from '../types';
import type { DiscoveredWallet } from '../lib/wallet';
import { MethodCard } from './MethodCard';
import { WalletBar } from './WalletBar';
import { WarningBanner } from './WarningBanner';

interface Props {
  component: ExperienceComponent;
  methodMap: Map<string, PageMethod>;
  walletState: WalletState;
  onConnectWallet: () => void | Promise<void>;
  onRunMethod: (method: PageMethod, formValues: Record<string, string>) => void | Promise<void>;
  activeResult: MethodRunResult | null;
  wallets?: DiscoveredWallet[];
}

export function ExperienceComponentView({ component, methodMap, walletState, onConnectWallet, onRunMethod, activeResult, wallets }: Props) {
  const methods = component.methodNames
    .map((methodName) => methodMap.get(methodName))
    .filter((method): method is PageMethod => Boolean(method));
  const displayMethods = methods.length === 1 && ['action', 'lookup', 'metric'].includes(component.type)
    ? [{ ...methods[0], label: component.title }]
    : methods;

  if (component.type === 'hero') {
    return (
      <header className="hero-card experience-hero">
        <div>
          <p className="eyebrow">Generated dApp Experience</p>
          <h1>{component.title}</h1>
          {component.description && <p>{component.description}</p>}
        </div>
      </header>
    );
  }

  if (component.type === 'wallet') {
    return (
      <section className="preview-section">
        <header>
          <h2>{component.title}</h2>
          {component.description && <p>{component.description}</p>}
        </header>
        <WalletBar walletState={walletState} onConnectWallet={onConnectWallet} chain="conflux-espace-testnet" wallets={wallets} />
      </section>
    );
  }

  if (component.type === 'risk') {
    return (
      <section className="preview-section variant-danger">
        <header>
          <h2>{component.title}</h2>
          {component.description && <p>{component.description}</p>}
        </header>
        {component.warnings.map((warning) => <WarningBanner key={warning} warning={warning} />)}
        <div className="method-grid">
          {methods.map((method) => <MethodCard key={method.name} method={method} onRunMethod={onRunMethod} activeResult={activeResult} />)}
        </div>
      </section>
    );
  }

  if (component.type === 'explorerLink') {
    return (
      <section className="preview-section">
        <header>
          <h2>{component.title}</h2>
          {component.description && <p>{component.description}</p>}
        </header>
        {component.href && <a className="secondary-button" href={component.href} target="_blank" rel="noreferrer">{component.title}</a>}
      </section>
    );
  }

  if (component.type === 'timeline') {
    return (
      <section className="preview-section">
        <header>
          <h2>{component.title}</h2>
          {component.description && <p>{component.description}</p>}
        </header>
        <div className="timeline-box">{activeResult?.message ?? 'No transaction submitted in this session.'}</div>
      </section>
    );
  }

  if (component.type === 'unsupported') {
    return (
      <section className="preview-section">
        <header>
          <h2>{component.title}</h2>
          {component.description && <p>{component.description}</p>}
        </header>
      </section>
    );
  }

  return (
    <section className="preview-section">
      <header>
        <h2>{component.title}</h2>
        {component.description && <p>{component.description}</p>}
      </header>
      <div className="method-grid">
        {displayMethods.map((method) => <MethodCard key={method.name} method={method} onRunMethod={onRunMethod} activeResult={activeResult} />)}
        {displayMethods.length === 0 && <div className="empty-state">This component has no runnable methods.</div>}
      </div>
    </section>
  );
}
