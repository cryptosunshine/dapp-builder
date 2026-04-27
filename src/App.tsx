import { useEffect, useMemo, useState } from 'react';
import { Link, Route, Routes, useNavigate, useParams } from 'react-router-dom';
import { BuilderForm } from './components/BuilderForm';
import { PreviewPage } from './components/PreviewPage';
import { TaskStatusCard } from './components/TaskStatusCard';
import { createTask, getTask } from './lib/api';
import { runContractMethod } from './lib/contract';
import { connectWallet, getWalletState } from './lib/wallet';
import type { BuilderTask, BuilderTaskInput, MethodRunResult, WalletState } from './types';

const initialWalletState: WalletState = {
  account: null,
  chainId: null,
  isConnecting: false,
  error: null,
};

function BuilderHome() {
  const navigate = useNavigate();
  const [task, setTask] = useState<BuilderTask | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submissionError, setSubmissionError] = useState<string | null>(null);

  const handleSubmit = async (input: BuilderTaskInput) => {
    setIsSubmitting(true);
    setSubmissionError(null);
    try {
      const nextTask = await createTask(input);
      setTask(nextTask);
      navigate(`/tasks/${nextTask.id}`);
    } catch (error) {
      setSubmissionError(error instanceof Error ? error.message : 'Failed to create task.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const workflowRows = [
    {
      name: 'ERC-20 dashboard',
      symbol: 'TOKEN',
      supplied: 'Wallet-ready',
      suppliedHint: 'Balances, transfer, approve',
      borrowed: 'Preview route',
      borrowedHint: 'Task + /app handoff',
      action: 'Open flow',
    },
    {
      name: 'NFT mint page',
      symbol: 'NFT',
      supplied: 'Mint-first',
      suppliedHint: 'Ownership and metadata',
      borrowed: 'Collection surface',
      borrowedHint: 'Primary mint CTA',
      action: 'Use template',
    },
    {
      name: 'Claim experience',
      symbol: 'CLAIM',
      supplied: 'Claimable view',
      suppliedHint: 'Balance + unlock state',
      borrowed: 'Guard-railed write path',
      borrowedHint: 'Warnings before submit',
      action: 'Explore path',
    },
  ];

  return (
    <div className="builder-aave-shell">
      <section className="builder-top-banner" aria-label="Builder announcement">
        <span>Builder V2 product mode is live for local contract launch flows.</span>
        <button type="button" className="banner-cta">TRY IT OUT HERE</button>
      </section>

      <header className="builder-app-nav" aria-label="Builder navigation">
        <div className="builder-app-nav__brand">
          <div className="builder-brand-mark">A</div>
          <div>
            <strong>AI dApp Builder</strong>
            <p>MVP protocol workspace</p>
          </div>
        </div>
        <nav className="builder-app-nav__links" aria-label="Primary">
          <a href="#market-overview">Dashboard</a>
          <a href="#builder-workspace">Launchpad</a>
          <a href="#builder-workspace">Templates</a>
          <a href="#builder-side-rail">Delivery</a>
        </nav>
        <div className="builder-app-nav__actions">
          <button type="button" className="nav-button nav-button--secondary">Bridge ABI</button>
          <button type="button" className="nav-button nav-button--secondary">Swap flow</button>
          <button type="button" className="nav-button nav-button--primary">Connect wallet</button>
        </div>
      </header>

      <section className="builder-context-header builder-context-header--elevated" id="market-overview" aria-label="Builder launchpad">
        <div className="builder-context-header__copy">
          <p className="eyebrow eyebrow--light">Launchpad mode</p>
          <div className="builder-context-header__title-row">
            <h1>Launch a wallet-ready dApp from a live contract</h1>
            <span className="context-pill">V2</span>
          </div>
          <p>
            Move from ABI upload to a shareable product surface with one guided flow: frame the user task,
            generate the page, then hand off the preview route.
          </p>
          <div className="builder-context-header__actions" role="group" aria-label="Launchpad actions">
            <a href="#generation-inputs" className="hero-link-button hero-link-button--primary">Start generation flow</a>
            <a href="#builder-workspace" className="hero-link-button hero-link-button--secondary">Review generated sections</a>
          </div>
        </div>
        <dl className="builder-context-metrics" aria-label="Builder launchpad metrics">
          <div>
            <dt>Ready flows</dt>
            <dd>4 flows</dd>
          </div>
          <div>
            <dt>Live target</dt>
            <dd>1 live chain</dd>
          </div>
          <div>
            <dt>Safety coverage</dt>
            <dd>3 guarded write paths</dd>
          </div>
        </dl>
      </section>

      <div className="page-shell page-shell--builder-home">
        <section className="builder-main-column">
          <section className="builder-workspace" id="builder-workspace" aria-label="Generated page product sections">
            <div className="builder-workspace__header">
              <div>
                <p className="eyebrow">Product framing</p>
                <h2>What ships in the generated page</h2>
              </div>
              <div className="builder-workspace__filters">
                <button type="button" className="ghost-button workspace-filter-button">All Categories</button>
                <input type="text" value="" readOnly aria-label="Search asset name, symbol, or address" placeholder="Search asset name, symbol, or address" />
              </div>
            </div>

            <article className="builder-feature-card" aria-label="Recommended launch path">
              <div className="builder-feature-card__icon">◎</div>
              <div className="builder-feature-card__copy">
                <p className="eyebrow">Recommended route</p>
                <h3>Start with the ERC-20 dashboard flow</h3>
                <p>Launch a wallet-aware token page first, then extend into staking or claim paths after validation.</p>
              </div>
              <div className="builder-feature-card__metric">
                <strong>Task-first</strong>
                <span>Preview delivery</span>
              </div>
              <div className="builder-feature-card__metric">
                <strong>3 rails</strong>
                <span>Read / write / danger</span>
              </div>
              <button type="button" className="secondary-button builder-feature-card__action">View details</button>
            </article>

            <section className="builder-market-table" aria-label="Builder workflow table">
              <div className="builder-market-table__head">
                <span>Section</span>
                <span>User-ready surface</span>
                <span>Delivery outcome</span>
                <span />
              </div>
              {workflowRows.map((row) => (
                <article key={row.name} className="builder-market-row">
                  <div className="builder-market-row__asset">
                    <div className="builder-market-row__icon">◌</div>
                    <div>
                      <h3>{row.name}</h3>
                      <p>{row.symbol}</p>
                    </div>
                  </div>
                  <div className="builder-market-row__metric">
                    <strong>{row.supplied}</strong>
                    <span>{row.suppliedHint}</span>
                  </div>
                  <div className="builder-market-row__metric">
                    <strong>{row.borrowed}</strong>
                    <span>{row.borrowedHint}</span>
                  </div>
                  <button type="button" className="ghost-button workspace-detail-button">Details</button>
                </article>
              ))}
            </section>
          </section>

          <section
            className="panel builder-form-panel builder-form-panel--light"
            id="generation-inputs"
            aria-label="Generation inputs"
          >
            <div className="builder-form-panel__header">
              <div>
                <p className="eyebrow">Generation flow</p>
                <h2>Generation inputs</h2>
              </div>
              <p>Pick the contract after the launch path is clear, then generate the task and shareable app route.</p>
            </div>
            <BuilderForm onSubmit={handleSubmit} isSubmitting={isSubmitting} />
            {submissionError && <p className="error-text">{submissionError}</p>}
          </section>
        </section>

        <aside className="builder-side-column" id="builder-side-rail">
          <section className="panel builder-side-card builder-side-card--light">
            <p className="eyebrow">Launch outcome</p>
            <h2>Task delivery</h2>
            <p>The task rail becomes the handoff surface for preview status, progress, and the shareable app link.</p>
          </section>
          <section className="panel builder-side-card builder-side-card--light">
            <p className="eyebrow">Risk isolation</p>
            <h2>Safety rails before users click</h2>
            <p>Approvals, admin methods, and high-friction writes stay separated from the primary wallet-ready path.</p>
          </section>
          <TaskStatusCard task={task} surface="builder-home" />
        </aside>
      </div>
    </div>
  );
}

function TaskPreviewRoute() {
  const { taskId } = useParams();
  const [task, setTask] = useState<BuilderTask | null>(null);
  const [walletState, setWalletState] = useState<WalletState>(initialWalletState);
  const [activeResult, setActiveResult] = useState<MethodRunResult | null>(null);
  const [pageError, setPageError] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      setWalletState(await getWalletState());
    })();
  }, []);

  useEffect(() => {
    if (!taskId) return;

    let cancelled = false;
    let timer: number | undefined;

    const fetchTask = async () => {
      try {
        const nextTask = await getTask(taskId);
        if (cancelled) return;
        setTask(nextTask);
        if (nextTask.status === 'queued' || nextTask.status === 'processing') {
          timer = window.setTimeout(fetchTask, 2000);
        }
      } catch (error) {
        if (!cancelled) {
          setPageError(error instanceof Error ? error.message : 'Failed to load task.');
        }
      }
    };

    void fetchTask();

    return () => {
      cancelled = true;
      if (timer) window.clearTimeout(timer);
    };
  }, [taskId]);

  const connect = async () => {
    setWalletState((current) => ({ ...current, isConnecting: true, error: null }));
    try {
      const nextWalletState = await connectWallet();
      setWalletState(nextWalletState);
    } catch (error) {
      setWalletState((current) => ({
        ...current,
        isConnecting: false,
        error: error instanceof Error ? error.message : 'Failed to connect wallet.',
      }));
    }
  };

  const handleRunMethod = async (method: NonNullable<BuilderTask['result']>['pageConfig']['methods'][number], formValues: Record<string, string>) => {
    if (!task?.result?.pageConfig) {
      return;
    }

    setActiveResult({ methodName: method.name, status: 'running', message: 'Running method...' });
    try {
      const result = await runContractMethod({
        pageConfig: task.result.pageConfig,
        method,
        formValues,
        walletState,
      });
      setWalletState(await getWalletState());
      setActiveResult(result);
    } catch (error) {
      setActiveResult({
        methodName: method.name,
        status: 'error',
        message: error instanceof Error ? error.message : 'Method execution failed.',
      });
    }
  };

  const body = useMemo(() => {
    if (pageError) {
      return <p className="error-text">{pageError}</p>;
    }

    if (!task) {
      return <div className="empty-state">Loading task...</div>;
    }

    return (
      <>
        <TaskStatusCard task={task} />
        {task.status === 'completed' && task.result ? (
          <PreviewPage
            task={task}
            walletState={walletState}
            onConnectWallet={connect}
            onRunMethod={handleRunMethod}
            activeResult={activeResult}
          />
        ) : task.status === 'failed' ? (
          <div className="empty-state">Task failed before a preview could be generated. Adjust the contract or inputs and submit a new task.</div>
        ) : (
          <div className="empty-state">Preview will appear when the backend finishes processing the task.</div>
        )}
      </>
    );
  }, [activeResult, pageError, task, walletState]);

  return (
    <div className="page-shell page-shell--stack">
      <Link to="/" className="back-link">
        ← Back to builder
      </Link>
      {body}
    </div>
  );
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<BuilderHome />} />
      <Route path="/tasks/:taskId" element={<TaskPreviewRoute />} />
      <Route path="/app/:taskId" element={<TaskPreviewRoute />} />
    </Routes>
  );
}
