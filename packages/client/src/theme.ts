/** The user's choice. `system` follows the operating system's light or dark setting. */
export type ThemeChoice = 'system' | 'light' | 'dark';
export type Theme = 'light' | 'dark';

/** Only this display preference is kept in the browser; no HAR data or work is stored. */
export const THEME_STORAGE_KEY = 'har-comparisor-theme';

export function parseThemeChoice(value: string | null | undefined): ThemeChoice {
  return value === 'light' || value === 'dark' ? value : 'system';
}

export function resolveTheme(choice: ThemeChoice, systemPrefersDark: boolean): Theme {
  if (choice === 'system') return systemPrefersDark ? 'dark' : 'light';
  return choice;
}

export function loadThemeChoice(): ThemeChoice {
  try {
    return parseThemeChoice(localStorage.getItem(THEME_STORAGE_KEY));
  } catch {
    // Storage can be blocked (private mode, policies). Fall back to the system setting.
    return 'system';
  }
}

export function saveThemeChoice(choice: ThemeChoice): void {
  try {
    if (choice === 'system') localStorage.removeItem(THEME_STORAGE_KEY);
    else localStorage.setItem(THEME_STORAGE_KEY, choice);
  } catch {
    // Not saved; the choice still applies until the page is closed.
  }
}

export const darkQuery = () => window.matchMedia('(prefers-color-scheme: dark)');

/** Sets the theme on <html>. The stylesheet and Monaco read it from there. */
export function applyTheme(theme: Theme): void {
  document.documentElement.dataset['theme'] = theme;
}

export function currentTheme(): Theme {
  return document.documentElement.dataset['theme'] === 'dark' ? 'dark' : 'light';
}
