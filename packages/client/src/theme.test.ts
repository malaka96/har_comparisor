import { describe, expect, it } from 'vitest';
import { parseThemeChoice, resolveTheme } from './theme';

describe('theme', () => {
  it('reads a stored choice and falls back to the system setting', () => {
    expect(parseThemeChoice('dark')).toBe('dark');
    expect(parseThemeChoice('light')).toBe('light');
    expect(parseThemeChoice(null)).toBe('system');
    expect(parseThemeChoice('purple')).toBe('system');
  });

  it('follows the system only when the choice is system', () => {
    expect(resolveTheme('system', true)).toBe('dark');
    expect(resolveTheme('system', false)).toBe('light');
    expect(resolveTheme('light', true)).toBe('light');
    expect(resolveTheme('dark', false)).toBe('dark');
  });
});
