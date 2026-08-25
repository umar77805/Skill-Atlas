interface LoadingBlockProps {
  label?: string;
}

export function LoadingBlock({ label = 'Loading…' }: LoadingBlockProps) {
  return (
    <div className="state-block">
      <div className="state-title">{label}</div>
      <div>Reading the graph.</div>
    </div>
  );
}

interface ErrorBlockProps {
  message?: string | null;
  onRetry?: () => void;
}

export function ErrorBlock({ message, onRetry }: ErrorBlockProps) {
  return (
    <div className="state-block error">
      <div className="state-title">Couldn't load that</div>
      <div>{message || 'Something went wrong talking to the API.'}</div>
      {onRetry && (
        <button className="retry-btn" onClick={onRetry}>Try again</button>
      )}
    </div>
  );
}

interface EmptyBlockProps {
  title?: string;
  hint?: string;
}

export function EmptyBlock({ title = 'Nothing here yet', hint }: EmptyBlockProps) {
  return (
    <div className="state-block">
      <div className="state-title">{title}</div>
      {hint && <div>{hint}</div>}
    </div>
  );
}
