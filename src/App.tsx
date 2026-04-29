import { useEffect, useMemo, useState } from 'react';
import { Link, Route, Routes, useNavigate, useParams } from 'react-router-dom';
import { BuilderForm } from './components/BuilderForm';
import { TaskStatusCard } from './components/TaskStatusCard';
import { createTask, getTask } from './lib/api';
import type { BuilderTask, BuilderTaskInput } from './types';

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
            <p>Generate a wallet-ready app from a contract</p>
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
