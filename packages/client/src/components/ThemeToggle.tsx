import { useEffect, useState } from 'react';
import {
  applyTheme,
  darkQuery,
  loadThemeChoice,
  resolveTheme,
  saveThemeChoice,
  type ThemeChoice,
} from '../theme';

/** Light, dark, or the system setting. Changes apply at once, including open editors. */
export function ThemeToggle() {
  const [choice, setChoice] = useState<ThemeChoice>(loadThemeChoice);

  useEffect(() => {
    const query = darkQuery();
    const apply = () => applyTheme(resolveTheme(choice, query.matches));
    apply();
    if (choice !== 'system') return;
    // Follow the operating system when it switches while the page is open.
    query.addEventListener('change', apply);
    return () => query.removeEventListener('change', apply);
  }, [choice]);

  return (
    <label className="theme-toggle" title="Color theme">
      Theme
      <select
        aria-label="Theme"
        value={choice}
        onChange={(event) => {
          const next = event.target.value as ThemeChoice;
          saveThemeChoice(next);
          setChoice(next);
        }}
      >
        <option value="system">System</option>
        <option value="light">Light</option>
        <option value="dark">Dark</option>
      </select>
    </label>
  );
}
