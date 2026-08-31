import { useState } from 'react';
import { NavLink } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import { healthOptions } from './queries.ts';
import AppRoutes from './routes.tsx';
import { useDevMode } from './DevModeContext.tsx';
import StartupScreen from './components/StartupScreen.tsx';
import InfoIcon from './components/InfoIcon.tsx';

const TOGGLE_SEEN_KEY = 'skillatlas.devToggleSeen';

export default function App() {
  const { data, isPending, isError } = useQuery(healthOptions);
  const connected: boolean | null = isPending ? null : isError ? false : !!data?.connected;
  const { devMode, setDevMode } = useDevMode();
  const [toggleSeen, setToggleSeen] = useState(() => localStorage.getItem(TOGGLE_SEEN_KEY) === 'true');

  function handleToggleDevMode() {
    setDevMode(!devMode);
    if (!toggleSeen) {
      localStorage.setItem(TOGGLE_SEEN_KEY, 'true');
      setToggleSeen(true);
    }
  }

  if (connected === null) {
    return <StartupScreen />;
  }

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
            <InfoIcon
              ariaLabel="Dev info toggle: when on, each page shows the raw Cypher query behind its results."
              tooltip="When on, each page shows the raw Cypher query behind its results."
            />
          </div>
        </div>
      </nav>
      <main className="main">
        <AppRoutes />
      </main>
    </div>
  );
}
