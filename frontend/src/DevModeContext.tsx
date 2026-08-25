import { createContext, useContext, useEffect, useState } from 'react';
import type { ReactNode } from 'react';

const STORAGE_KEY = 'skillatlas.devMode';

interface DevModeState {
  devMode: boolean;
  setDevMode: (value: boolean) => void;
}

const DevModeContext = createContext<DevModeState | null>(null);

export function DevModeProvider({ children }: { children: ReactNode }) {
  const [devMode, setDevMode] = useState(() => localStorage.getItem(STORAGE_KEY) === 'true');

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, String(devMode));
  }, [devMode]);

  return <DevModeContext.Provider value={{ devMode, setDevMode }}>{children}</DevModeContext.Provider>;
}

export function useDevMode() {
  const ctx = useContext(DevModeContext);
  if (!ctx) throw new Error('useDevMode must be used within a DevModeProvider');
  return ctx;
}
