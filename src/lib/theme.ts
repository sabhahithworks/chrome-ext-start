import type { Settings } from './storage';

const DARK_QUERY = '(prefers-color-scheme: dark)';

export function resolveTheme(pref: Settings['theme'], prefersDark: boolean): 'light' | 'dark' {
  if (pref === 'system') return prefersDark ? 'dark' : 'light';
  return pref;
}

export function applyTheme(pref: Settings['theme']): () => void {
  const root = document.documentElement;
  const media = window.matchMedia(DARK_QUERY);
  const apply = (prefersDark: boolean) => {
    root.classList.toggle('dark', resolveTheme(pref, prefersDark) === 'dark');
  };
  apply(media.matches);
  if (pref !== 'system') return () => undefined;
  const onChange = (e: MediaQueryListEvent) => {
    apply(e.matches);
  };
  media.addEventListener('change', onChange);
  return () => {
    media.removeEventListener('change', onChange);
  };
}
