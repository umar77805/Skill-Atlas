import { useEffect, useState } from 'react';

const SLOW_THRESHOLD_MS = 9000;

export default function StartupScreen() {
  const [slow, setSlow] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setSlow(true), SLOW_THRESHOLD_MS);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="startup-screen" role="status" aria-live="polite">
      <svg className="startup-graphic" viewBox="0 0 120 80" width="120" height="80" aria-hidden="true">
        <g className="startup-lines">
          <line x1="60" y1="40" x2="20" y2="15" />
          <line x1="60" y1="40" x2="100" y2="15" />
          <line x1="60" y1="40" x2="20" y2="65" />
          <line x1="60" y1="40" x2="100" y2="65" />
        </g>
        <circle className="startup-node n0" cx="60" cy="40" r="7" />
        <circle className="startup-node n1" cx="20" cy="15" r="5" />
        <circle className="startup-node n2" cx="100" cy="15" r="5" />
        <circle className="startup-node n3" cx="20" cy="65" r="5" />
        <circle className="startup-node n4" cx="100" cy="65" r="5" />
      </svg>
      <div className="startup-text">loading...</div>
      {slow && (
        <div className="startup-subtext">
          Still waking up the server, this can take up to a minute…
        </div>
      )}
    </div>
  );
}
