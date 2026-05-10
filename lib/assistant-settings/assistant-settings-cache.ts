import type { AssistantSettings } from './types';

/**
 * In-process TTL cache for assistant settings, keyed by user ID.
 *
 * Because this runs inside a serverless function process we cannot share state
 * across instances — but within a single warm instance this avoids a DB round-trip
 * on every chat turn for the same user. Cache busting happens immediately on any
 * write so stale data is never served.
 */

const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

type CacheEntry = {
  settings: AssistantSettings;
  fetchedAt: number;
};

const cache = new Map<string, CacheEntry>();

/**
 * Returns cached settings for a user if still fresh, otherwise `null`.
 */
export function getCachedAssistantSettings(userId: string): AssistantSettings | null {
  const entry = cache.get(userId);
  if (!entry) return null;
  if (Date.now() - entry.fetchedAt > CACHE_TTL_MS) {
    cache.delete(userId);
    return null;
  }
  return entry.settings;
}

/**
 * Stores fresh settings in the cache for a user.
 */
export function setCachedAssistantSettings(userId: string, settings: AssistantSettings): void {
  cache.set(userId, { settings, fetchedAt: Date.now() });
}

/**
 * Removes the cached entry for a user immediately (call after any write).
 */
export function bustAssistantSettingsCache(userId: string): void {
  cache.delete(userId);
}
