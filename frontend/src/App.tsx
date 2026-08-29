import { useEffect, useState } from 'react';
import { NavLink } from 'react-router';
import { api } from './api.ts';
import AppRoutes from './routes.tsx';
import { useDevMode } from './DevModeContext.tsx';

const TOGGLE_SEEN_KEY = 'skillatlas.devToggleSeen';

export default function App() {
  const [connected, setConnected] = useState<boolean | null>(null); // null = checking
  const { devMode, setDevMode } = useDevMode();
  const [toggleSeen, setToggleSeen] = useState(() => localStorage.getItem(TOGGLE_SEEN_KEY) === 'true');

  function handleToggleDevMode() {
    setDevMode(!devMode);
    if (!toggleSeen) {
      localStorage.setItem(TOGGLE_SEEN_KEY, 'true');
      setToggleSeen(true);
    }
  }

  useEffect(() => {
    let cancelled = false;
    api.health()
      .then((r) => !cancelled && setConnected(!!r.connected))
      .catch(() => !cancelled && setConnected(false));
    return () => { cancelled = true; };
  }, []);

  return (
    <div className="shell">
      <nav className="nav-rail">
        <div className="brand">
          <div className="brand-mark">Skill<span>Atlas</span></div>
          <div className="brand-sub">Career graph · CognoDB</div>
        </div>
        <div className="nav-links">
          <NavLink to="/" end className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}>
            <span className="idx">01</span> Atlas
          </NavLink>
          <NavLink to="/path" className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}>
            <span className="idx">02</span> Path Finder
          </NavLink>
          <NavLink to="/insights" className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}>
            <span className="idx">03</span> Insights
          </NavLink>
        </div>
        <div className="nav-footer">
          <div>
            <span className={`status-dot ${connected ? 'on' : connected === false ? 'off' : ''}`} />
            {connected === null ? 'Checking database…' : connected ? 'CognoDB connected' : 'CognoDB unreachable'}
          </div>
          <div className="dev-toggle-row">
            <button
              type="button"
              className={`toggle-chip${devMode ? ' on' : ''}${!toggleSeen ? ' pulse' : ''}`}
              onClick={handleToggleDevMode}
              aria-pressed={devMode}
            >
              Dev info: {devMode ? 'On' : 'Off'}
            </button>
            <span
              className="info-icon"
              tabIndex={0}
              role="img"
              aria-label="Dev info toggle: when on, each page shows the raw Cypher query behind its results."
              data-tooltip="When on, each page shows the raw Cypher query behind its results."
            >
              i
            </span>
          </div>
        </div>
      </nav>
      <main className="main">
        <AppRoutes />
      </main>
    </div>
  );
}
