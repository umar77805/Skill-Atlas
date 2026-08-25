import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router';
import App from './App.tsx';
import { DevModeProvider } from './DevModeContext.tsx';
import './styles.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <DevModeProvider>
        <App />
      </DevModeProvider>
    </BrowserRouter>
  </StrictMode>
);
