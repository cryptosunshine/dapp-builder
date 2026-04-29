import type { BuilderTask } from '../types';

const generationSteps = [
  { progress: 'fetching_abi', label: 'ABI' },
  { progress: 'frontend_generation', label: 'React app' },
  { progress: 'validating_generated_app', label: 'Build preview' },
  { progress: 'completed', label: 'Done' },
] as const;

function stepIndexForProgress(progress: BuilderTask['progress'] | undefined) {
  if (progress === 'fetching_abi' || progress === 'analyzing_contract') return 0;
  const stepIndex = generationSteps.findIndex((step) => step.progress === progress);
  return Math.max(0, stepIndex);
}

export function TaskStatusCard({ task, surface = 'default' }: { task: BuilderTask | null; surface?: 'default' | 'builder-home' }) {
  const surfaceClassName = surface === 'builder-home' ? ' status-card--builder-home' : ' status-card--task-preview';

  if (!task) {
    return (
      <div className={`status-card${surfaceClassName}`}>
        <h3>No task yet</h3>
        <p>Submit a contract request to generate a preview.</p>
      </div>
    );
  }

  const previewHref = task.id && task.status !== 'failed' ? `/app/${task.id}` : null;
  const currentStepIndex = stepIndexForProgress(task.progress);

  return (
    <div className={`status-card status-${task.status}${surfaceClassName}`}>
      <h3>Task {task.id}</h3>
      <p>Status: {task.status}</p>
      {task.progress && <p>Stage: {task.progress}</p>}
      {task.summary && <p>{task.summary}</p>}
      <ol className="generation-stepper" aria-label="dApp generation progress">
        {generationSteps.map((step, index) => {
          const isCurrent = index === currentStepIndex && task.status !== 'completed';
          const isDone = task.status === 'completed' || index < currentStepIndex;
          return (
            <li
              key={step.progress}
              className={`generation-stepper__item${isCurrent ? ' is-current' : ''}${isDone ? ' is-done' : ''}`}
            >
              <span className="generation-stepper__dot" aria-hidden="true" />
              <span aria-current={isCurrent ? 'step' : undefined}>{step.label}</span>
            </li>
          );
        })}
      </ol>
      {previewHref && (
        <p>
          <a href={previewHref}>Open shareable preview</a>
        </p>
      )}
      {task.status === 'failed' && (
        <p>
          <a href="/">Start a new task</a>
        </p>
      )}
      {task.error && <p className="error-text">{task.error}</p>}
      {task.result?.analysis && (
        <div className="status-card__details">
          <div>Contract type: {task.result.analysis.contractType}</div>
          <div>Skill match: {task.result.analysis.skillMatch ? 'yes' : 'no'}</div>
          <div>Recommended skills: {task.result.analysis.recommendedSkills.join(', ') || 'none'}</div>
        </div>
      )}
    </div>
  );
}
