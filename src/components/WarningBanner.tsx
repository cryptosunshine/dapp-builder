export function WarningBanner({ warning }: { warning: string }) {
  return (
    <div className="warning-banner">
      <span aria-hidden="true">⚠ </span>
      <span>{warning}</span>
    </div>
  );
}
