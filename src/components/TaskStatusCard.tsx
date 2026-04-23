import type { BuilderTask } from '../types';

export function TaskStatusCard({ task }: { task: BuilderTask | null }) {
  if (!task) {
    return (
      <div className="status-card">
        <h3>No task yet</h3>
        <p>Submit a contract request to generate a preview.</p>
      </div>
    );
  }

  return (
    <div className={`status-card status-${task.status}`}>
      <h3>Task {task.id}</h3>
      <p>Status: {task.status}</p>
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
