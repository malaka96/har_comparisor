import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import './styles.css';
import { applyTheme, darkQuery, loadThemeChoice, resolveTheme } from './theme';

// Before the first render, so the page never flashes in the wrong theme.
applyTheme(resolveTheme(loadThemeChoice(), darkQuery().matches));

const root = document.getElementById('root');
if (!root) throw new Error('Root element not found');

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
