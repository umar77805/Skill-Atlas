import type { ReactNode } from 'react';
import { useDevMode } from '../DevModeContext.tsx';

export default function DevInfo({ children }: { children: ReactNode }) {
  const { devMode } = useDevMode();
  if (!devMode) return null;

  return (
    <div className="dev-info">
      <div className="dev-info-badge">DEV</div>
      {children}
    </div>
  );
}
