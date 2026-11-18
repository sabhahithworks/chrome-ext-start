import { ALL_SITES_ORIGINS } from '@/config/app.config';

// D-q8: all-sites access is optional and granted at runtime, so the install stays warning-free.
const ALL_SITES = { origins: [...ALL_SITES_ORIGINS] };

export function hasAllSitesAccess(): Promise<boolean> {
  return browser.permissions.contains(ALL_SITES);
}

/** Must run from a user gesture (a click handler): Chrome shows its own permission prompt. */
export function requestAllSitesAccess(): Promise<boolean> {
  return browser.permissions.request(ALL_SITES);
}

/** Calls `onChange` when the user grants or removes host access (here or on the extension's details page). */
export function watchSiteAccess(onChange: () => void): () => void {
  browser.permissions.onAdded.addListener(onChange);
  browser.permissions.onRemoved.addListener(onChange);
  return () => {
    browser.permissions.onAdded.removeListener(onChange);
    browser.permissions.onRemoved.removeListener(onChange);
  };
}
