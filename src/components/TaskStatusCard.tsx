import type { BuilderTask } from '../types';

export function TaskStatusCard({ task, surface = 'default' }: { task: BuilderTask | null; surface?: 'default' | 'builder-home' }) {
  const surfaceClassName = surface === 'builder-home' ? ' status-card--builder-home' : '';

  if (!task) {
    return (
      <div className={`status-card${surfaceClassName}`}>
        <h3>No task yet</h3>
        <p>Submit a contract request to generate a preview.</p>
      </div>
    );
  }

  const previewHref = task.id && task.status !== 'failed' ? `/app/${task.id}` : null;

  return (
    <div className={`status-card status-${task.status}${surfaceClassName}`}>
      <h3>Task {task.id}</h3>
      <p>Status: {task.status}</p>
      {task.progress && <p>Stage: {task.progress}</p>}
      {task.summary && <p>{task.summary}</p>}
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
