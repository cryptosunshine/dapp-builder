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

  return (
    <div className="page-shell">
      <section className="panel">
        <p className="eyebrow">AI dApp Builder MVP</p>
        <h1>Generate a dynamic dApp preview from an ABI</h1>
        <p>
          Submit a Conflux eSpace Testnet contract, choose an MVP skill, and let the backend build a
          task-driven pageConfig for the frontend preview.
        </p>
        <BuilderForm onSubmit={handleSubmit} isSubmitting={isSubmitting} />
        {submissionError && <p className="error-text">{submissionError}</p>}
      </section>
      <TaskStatusCard task={task} />
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
    </Routes>
  );
}
