import { useCallback, useMemo, useState } from 'react';
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

function getResultText(result: MethodRunResult): string {
  const parts: string[] = [];
  if (result.message) parts.push(result.message);
  if (result.data !== undefined) parts.push(JSON.stringify(result.data, null, 2));
  return parts.join('\n');
}

export function MethodCard({ method, onRunMethod, activeResult }: MethodCardProps) {
  const [formValues, setFormValues] = useState<Record<string, string>>({});
  const [copied, setCopied] = useState(false);
  const isActiveMethod = activeResult?.methodName === method.name;
  const buttonLabel = useMemo(() => {
    if (method.dangerLevel === 'danger') {
      return 'Run dangerous method';
    }
    return method.label || method.name;
  }, [method.dangerLevel, method.label, method.name]);

  const handleCopy = useCallback(async () => {
    if (!activeResult) return;
    const text = getResultText(activeResult);
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard API not available — silently ignore
    }
  }, [activeResult]);

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
          <div className="result-panel__header">
            <span>{activeResult.message}</span>
            <div className="result-panel__actions">
              {activeResult.status === 'error' && (
                <button type="button" className="retry-button" onClick={() => void onRunMethod(method, formValues)} title="Retry method call">
                  Retry
                </button>
              )}
              <button type="button" className="copy-button" onClick={handleCopy} title="Copy result">
                {copied ? 'Copied!' : 'Copy result'}
              </button>
            </div>
          </div>
          {activeResult.data !== undefined ? (
            <pre>{JSON.stringify(activeResult.data, null, 2)}</pre>
          ) : activeResult.status === 'success' ? (
            <p>No structured output was returned for this call.</p>
          ) : null}
        </div>
      )}
    </article>
  );
}
