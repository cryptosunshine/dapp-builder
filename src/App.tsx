import { useEffect, useMemo, useState } from 'react';
import { Link, Route, Routes, useNavigate, useParams } from 'react-router-dom';
import { BuilderForm } from './components/BuilderForm';
import { TaskStatusCard } from './components/TaskStatusCard';
import { createTask, getTask } from './lib/api';
import type { BuilderTask, BuilderTaskInput } from './types';

type Locale = 'en' | 'zh';

const landingCopy = {
  en: {
    navLabel: 'Agentic payment navigation',
    brand: 'Agentic Payment Layer',
    nav: ['Vision', 'Execution', 'Modules', 'Builder'],
    switchLabel: '中文',
    heroEyebrow: 'AI x onchain settlement',
    heroTitle: 'Agentic Payment Layer',
    heroSubtitle: 'AI understands intent. Smart contracts hold the budget, rules, settlement, and audit trail.',
    primaryCta: 'Launch dApp Builder',
    secondaryCta: 'Explore execution layer',
    visualLabel: 'Execution visual',
    visualNodes: ['Intent', 'Budget', 'Agent', 'Contract', 'Settlement'],
    visualStatus: 'Constrained execution online',
    proof: ['Budgeted vaults', 'Agent-readable services', 'Onchain settlement'],
    visionEyebrow: 'Protocol vision',
    visionTitle: 'Smart contracts hold the budget',
    visionBody:
      'Users authorize CFX or USDT into constrained vaults. Agents can plan and execute only inside explicit spend limits, allowlists, deadlines, and confirmation rules.',
    stepsTitle: 'How agent payments become executable',
    steps: [
      ['Grant budget', 'The user defines token, allowance, deadline, service scope, and whether sensitive actions require confirmation.'],
      ['Plan execution', 'The agent reads service manifests, contract capabilities, skills, and model constraints before proposing an action path.'],
      ['Settle onchain', 'Transactions, approvals, and service receipts become verifiable execution records instead of opaque agent promises.'],
    ],
    modulesEyebrow: 'Platform modules',
    modulesTitle: 'One platform, multiple execution surfaces',
    modules: [
      ['Agent Vault', 'A budget and permission layer for CFX, USDT, and future service-specific spending policies.'],
      ['Service Adapter', 'A manifest layer for merchants, protocols, and APIs so agents understand price, inputs, risk, and settlement.'],
      ['dApp Builder', 'The first live MVP module: parse target contracts, select skills, and generate static dApp previews for users.'],
    ],
    builderEyebrow: 'MVP live module',
    builderTitle: 'dApp Builder is the first live module',
    builderBody:
      'The builder turns a target contract into a generated static dApp preview. The next research focus is how selected capabilities and model choice change the quality, interaction depth, and product feel of the generated page.',
    research: ['Skill selection', 'Agent model behavior', 'Prompt/runtime boundary', 'Generated dApp quality'],
    finalTitle: 'Start with contract-native execution. Expand into agent commerce.',
    finalBody:
      'The website tells the larger protocol story while the MVP continues to harden dApp Builder as the first concrete execution surface.',
    finalCta: 'Open dApp Builder',
  },
  zh: {
    navLabel: 'Agentic payment navigation',
    brand: 'Agentic Payment Layer',
    nav: ['愿景', '执行', '模块', 'Builder'],
    switchLabel: 'EN',
    heroEyebrow: 'AI x 链上结算',
    heroTitle: '面向 AI Agent 的链上支付与服务执行层',
    heroSubtitle: 'AI 理解意图，智能合约约束资金、规则、结算与审计记录。',
    primaryCta: '启动 dApp Builder',
    secondaryCta: '了解执行层',
    visualLabel: 'Execution visual',
    visualNodes: ['意图', '预算', 'Agent', '合约', '结算'],
    visualStatus: '受约束执行已上线',
    proof: ['预算型金库', 'Agent 可读服务', '链上结算'],
    visionEyebrow: '协议愿景',
    visionTitle: '智能合约托管预算与规则',
    visionBody:
      '用户将 CFX 或 USDT 授权到受约束的金库。Agent 只能在明确的额度、白名单、有效期和二次确认规则内规划并执行。',
    stepsTitle: 'Agent 支付如何变成可执行服务',
    steps: [
      ['授权预算', '用户定义 token、额度、有效期、服务范围，以及敏感操作是否需要再次确认。'],
      ['规划执行', 'Agent 读取服务 manifest、合约能力、skills 和模型约束，再生成可解释的执行路径。'],
      ['链上结算', '交易、授权和服务凭证成为可验证的执行记录，而不是黑盒式 agent 承诺。'],
    ],
    modulesEyebrow: '平台模块',
    modulesTitle: '一个平台，多个执行界面',
    modules: [
      ['Agent Vault', '面向 CFX、USDT 和未来服务消费策略的预算与权限层。'],
      ['Service Adapter', '面向商家、协议和 API 的 manifest 层，让 agent 理解价格、输入、风险和结算方式。'],
      ['dApp Builder', '第一个 MVP 模块：解析目标合约，选择 skill，并为用户生成静态 dApp 预览。'],
    ],
    builderEyebrow: 'MVP 模块',
    builderTitle: 'dApp Builder 是第一个可落地模块',
    builderBody:
      'Builder 会把目标合约转换成静态 dApp 预览。下一阶段重点研究 skill 选择和模型能力如何影响生成页面的质量、交互深度和产品感。',
    research: ['Skill selection', 'Agent model behavior', 'Prompt/runtime boundary', 'Generated dApp quality'],
    finalTitle: '先从链上合约执行闭环开始，再扩展到 Agent Commerce。',
    finalBody: '官网承载更大的协议叙事，MVP 继续把 dApp Builder 打磨成第一个真实可用的执行界面。',
    finalCta: '打开 dApp Builder',
  },
} as const;

function LandingHome() {
  const [locale, setLocale] = useState<Locale>('en');
  const copy = landingCopy[locale];

  return (
    <main className="protocol-site">
      <header className="protocol-nav" role="banner" aria-label={copy.navLabel}>
        <Link to="/" className="protocol-brand">
          <span className="protocol-brand__mark">A</span>
          <span>{copy.brand}</span>
        </Link>
        <nav className="protocol-nav__links" aria-label="Protocol sections">
          <a href="#vision">{copy.nav[0]}</a>
          <a href="#execution">{copy.nav[1]}</a>
          <a href="#modules">{copy.nav[2]}</a>
          <Link to="/builder">{copy.nav[3]}</Link>
        </nav>
        <button
          type="button"
          className="protocol-language-toggle"
          onClick={() => setLocale((current) => (current === 'en' ? 'zh' : 'en'))}
        >
          {copy.switchLabel}
        </button>
      </header>

      <section className="protocol-hero" aria-label="Agentic payment hero">
        <div className="protocol-hero__scene" aria-hidden="true">
          <div className="protocol-orbit protocol-orbit--outer" />
          <div className="protocol-orbit protocol-orbit--middle" />
          <div className="protocol-orbit protocol-orbit--inner" />
          <div className="protocol-pulse protocol-pulse--one" />
          <div className="protocol-pulse protocol-pulse--two" />
          <div className="protocol-pulse protocol-pulse--three" />
        </div>
        <div className="protocol-hero__copy">
          <p className="protocol-kicker">{copy.heroEyebrow}</p>
          <h1>{copy.heroTitle}</h1>
          <p>{copy.heroSubtitle}</p>
          <div className="protocol-hero__actions">
            <Link to="/builder" className="protocol-button protocol-button--primary">{copy.primaryCta}</Link>
            <a href="#execution" className="protocol-button protocol-button--secondary">{copy.secondaryCta}</a>
          </div>
        </div>
        <section className="protocol-execution-visual" aria-label={copy.visualLabel}>
          <div className="protocol-execution-visual__rail">
            {copy.visualNodes.map((node) => (
              <span key={node}>{node}</span>
            ))}
          </div>
          <div className="protocol-execution-visual__status">{copy.visualStatus}</div>
        </section>
      </section>

      <section className="protocol-proof" aria-label="Protocol proof points">
        {copy.proof.map((item) => (
          <p key={item}>{item}</p>
        ))}
      </section>

      <section className="protocol-section protocol-section--vision" id="vision">
        <div>
          <p className="protocol-kicker">{copy.visionEyebrow}</p>
          <h2>{copy.visionTitle}</h2>
        </div>
        <p>{copy.visionBody}</p>
      </section>

      <section className="protocol-section protocol-section--steps" id="execution">
        <h2>{copy.stepsTitle}</h2>
        <div className="protocol-steps">
          {copy.steps.map(([title, body], index) => (
            <article key={title} className="protocol-step">
              <span>{String(index + 1).padStart(2, '0')}</span>
              <h3>{title}</h3>
              <p>{body}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="protocol-section protocol-section--modules" id="modules">
        <div className="protocol-section__header">
          <p className="protocol-kicker">{copy.modulesEyebrow}</p>
          <h2>{copy.modulesTitle}</h2>
        </div>
        <div className="protocol-modules">
          {copy.modules.map(([title, body]) => (
            <article key={title} className="protocol-module">
              <h3>{title}</h3>
              <p>{body}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="protocol-builder-focus" id="builder">
        <div>
          <p className="protocol-kicker">{copy.builderEyebrow}</p>
          <h2>{copy.builderTitle}</h2>
          <p>{copy.builderBody}</p>
        </div>
        <ul>
          {copy.research.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </section>

      <section className="protocol-final">
        <h2>{copy.finalTitle}</h2>
        <p>{copy.finalBody}</p>
        <Link to="/builder" className="protocol-button protocol-button--primary">{copy.finalCta}</Link>
      </section>
    </main>
  );
}

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

  return (
    <div className="builder-aave-shell">
      <header className="builder-app-nav builder-app-nav--simple" aria-label="Builder navigation">
        <div className="builder-app-nav__brand">
          <div className="builder-brand-mark">A</div>
          <div>
            <strong>AI dApp Builder</strong>
          </div>
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
            Enter a contract, choose the experience goal, and generate a shareable dApp page.
          </p>
          <div className="builder-context-header__actions" role="group" aria-label="Launchpad actions">
            <a href="#generation-inputs" className="hero-link-button hero-link-button--primary">Start generation</a>
          </div>
        </div>
        <dl className="builder-context-metrics" aria-label="Builder launchpad metrics">
          <div>
            <dt>Input</dt>
            <dd>Contract</dd>
          </div>
          <div>
            <dt>Output</dt>
            <dd>dApp page</dd>
          </div>
          <div>
            <dt>Share</dt>
            <dd>Live URL</dd>
          </div>
        </dl>
      </section>

      <div className="page-shell page-shell--builder-home">
        <section className="builder-main-column">
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
              <p>Contract in, app URL out. Keep the flow short and product-ready.</p>
            </div>
            <BuilderForm onSubmit={handleSubmit} isSubmitting={isSubmitting} />
            {submissionError && <p className="error-text">{submissionError}</p>}
          </section>
        </section>

        <aside className="builder-side-column" id="builder-side-rail">
          <TaskStatusCard task={task} surface="builder-home" />
        </aside>
      </div>
    </div>
  );
}

function TaskPreviewRoute() {
  const { taskId } = useParams();
  const [task, setTask] = useState<BuilderTask | null>(null);
  const [pageError, setPageError] = useState<string | null>(null);

  useEffect(() => {
    if (!taskId) return;

    let cancelled = false;
    let timer: number | undefined;

    const fetchTask = async () => {
      try {
        const nextTask = await getTask(taskId);
        if (cancelled) return;
        setTask(nextTask);
        if (nextTask.status === 'queued' || nextTask.status === 'processing' || nextTask.status === 'pending' || nextTask.status === 'running') {
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

  const body = useMemo(() => {
    if (pageError) {
      return <p className="error-text">{pageError}</p>;
    }

    if (!task) {
      return <div className="empty-state">Loading task...</div>;
    }

    const generatedUrl = task.result?.generatedApp?.previewUrl;

    return (
      <section className="task-delivery-page" aria-label="Generation status">
        <TaskStatusCard task={task} />
        {task.status === 'completed' && generatedUrl ? (
          <div className="generated-app-launch-card">
            <p className="eyebrow">Generated app ready</p>
            <h2>Your dApp page is live</h2>
            <p>Open the generated application in a full page when you are ready to review or share it.</p>
            <a className="primary-button generated-app-launch-card__button" href={generatedUrl} target="_blank" rel="noreferrer">
              Open generated app
            </a>
          </div>
        ) : task.status === 'failed' ? (
          <div className="empty-state empty-state--preview-error">Task failed before an app could be generated. Adjust the contract or inputs and submit a new task.</div>
        ) : (
          <div className="empty-state empty-state--preview-waiting">Generation is running. The app link will appear here when the backend finishes.</div>
        )}
      </section>
    );
  }, [pageError, task]);

  return (
    <div className="page-shell page-shell--stack">
      <Link to="/builder" className="back-link">
        ← Back to builder
      </Link>
      {body}
    </div>
  );
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<LandingHome />} />
      <Route path="/builder" element={<BuilderHome />} />
      <Route path="/tasks/:taskId" element={<TaskPreviewRoute />} />
      <Route path="/app/:taskId" element={<TaskPreviewRoute />} />
    </Routes>
  );
}
