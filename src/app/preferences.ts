/**
 * Page level preferences shared by the toolbar and the inline script in
 * index.html (which applies the saved theme before the first paint).
 * Storage can be missing or throw (private windows, blocked cookies), so
 * every access is guarded and the page still works without it.
 */
export type ThemeChoice = 'system' | 'light' | 'dark';

export const THEME_STORAGE_KEY = 'orders-demo-theme';

export function readTheme(storage: () => Storage | null): ThemeChoice {
  try {
    const value = storage()?.getItem(THEME_STORAGE_KEY);
    return value === 'light' || value === 'dark' ? value : 'system';
  } catch {
    return 'system';
  }
}

/** Sets data-theme on <html> ("system" removes it) and remembers the choice when possible. */
export function applyTheme(root: HTMLElement, storage: () => Storage | null, theme: ThemeChoice): void {
  if (theme === 'system') {
    root.removeAttribute('data-theme');
  } else {
    root.setAttribute('data-theme', theme);
  }
  try {
    if (theme === 'system') {
      storage()?.removeItem(THEME_STORAGE_KEY);
    } else {
      storage()?.setItem(THEME_STORAGE_KEY, theme);
    }
  } catch {
    // Not persisted: the choice still applies to this page view.
  }
}

/** Boundaries start on with ?boundaries=on, so the guide can link straight to that view. */
export function boundariesFromUrl(search: string): boolean {
  return new URLSearchParams(search).get('boundaries') === 'on';
}

export function applyBoundaries(root: HTMLElement, on: boolean): void {
  root.toggleAttribute('data-boundaries', on);
}
