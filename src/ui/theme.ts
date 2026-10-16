import type { Theme } from '../state/store';
export const THEME_KEY = 'flowcanvas.theme.v1';
export function readTheme(): Theme {
  try {
    const saved = localStorage.getItem(THEME_KEY);
    if (saved === null) return 'dark';
    return saved === 'dark' || saved === 'light' || saved === 'system' ? saved : 'system';
  } catch {
    return 'system';
  } // Optional preference only; no workflow data is stored here.
}
export function applyTheme(theme: Theme): void {
  const resolved =
    theme === 'system'
      ? matchMedia('(prefers-color-scheme: dark)').matches
        ? 'dark'
        : 'light'
      : theme;
  document.documentElement.dataset.theme = resolved;
}
