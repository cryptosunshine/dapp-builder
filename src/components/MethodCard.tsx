import { useMemo, useState } from 'react';
import type { AbiParameter } from '../../shared/schema';
import type { MethodRunResult, PageMethod } from '../types';

interface MethodCardProps {
  method: PageMethod;
  onRunMethod: (method: PageMethod, formValues: Record<string, string>) => void | Promise<void>;
  activeResult: MethodRunResult | null;
}

function getInputKey(input: AbiParameter, index: number) {
  return input.name?.trim() || `arg${index}`;
}

export function MethodCard({ method, onRunMethod, activeResult }: MethodCardProps) {
  const [formValues, setFormValues] = useState<Record<string, string>>({});
  const isActiveMethod = activeResult?.methodName === method.name;
  const buttonLabel = useMemo(() => {
    if (method.dangerLevel === 'danger') {
      return 'Run dangerous method';
    }
    return method.label || method.name;
  }, [method.dangerLevel, method.label, method.name]);

  return (
    <article className={`method-card danger-${method.dangerLevel}`}>
      <header className="method-card__header">
        <div>
          <h4>{method.label}</h4>
          <p>{method.description}</p>
        </div>
        <span className={`badge badge-${method.type}`}>{method.type}</span>
      </header>

      {method.inputs.length > 0 && (
        <div className="method-card__inputs">
          {method.inputs.map((input, index) => {
            const key = getInputKey(input, index);
            return (
              <label key={`${method.name}-${key}`} className="field">
                <span>{input.name || `Argument ${index + 1}`}</span>
                <input
                  value={formValues[key] ?? ''}
                  onChange={(event) => setFormValues((current) => ({ ...current, [key]: event.target.value }))}
                  placeholder={input.type}
                />
              </label>
            );
          })}
        </div>
      )}

      <div className="method-card__actions">
        <button type="button" onClick={() => void onRunMethod(method, formValues)} className="primary-button">
          {buttonLabel}
        </button>
      </div>

      {isActiveMethod && (
        <div className={`result-panel status-${activeResult.status}`}>
          {activeResult.message && <div>{activeResult.message}</div>}
          {activeResult.data !== undefined && <pre>{JSON.stringify(activeResult.data, null, 2)}</pre>}
        </div>
      )}
    </article>
  );
}
