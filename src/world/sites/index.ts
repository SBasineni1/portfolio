import { basecamp } from './basecamp';
import { desert } from './desert';
import { plains } from './plains';
import { snowfield } from './snowfield';
import { station } from './station';
import type { LaunchSite } from './types';

export type { LaunchSite } from './types';

export const SITES: readonly LaunchSite[] = [desert, plains, snowfield, basecamp, station];

const STORAGE_KEY = 'launch-site';

function stored(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

/** Remember the site so the next visit launches somewhere else. */
export function rememberSite(site: LaunchSite): void {
  try {
    localStorage.setItem(STORAGE_KEY, site.id);
  } catch {
    // Storage can be blocked; the pick is a nicety, not state.
  }
}

/**
 * `?site=<id>` wins (QA and shared links). Otherwise a random site that is
 * not the one this browser launched from last time.
 */
export function pickSite(): LaunchSite {
  const requested = new URLSearchParams(location.search).get('site');
  const named = SITES.find((site) => site.id === requested);
  if (named) return named;
  const last = stored();
  const pool = SITES.filter((site) => site.id !== last);
  return pool[Math.floor(Math.random() * pool.length)] ?? desert;
}

export function siteIndex(site: LaunchSite): number {
  return SITES.indexOf(site);
}
