/**
 * Simple in-memory TTL cache
 */

interface CacheEntry<T = any> {
  data: T;
  expiresAt: number;
}

const cache = new Map<string, CacheEntry>();

/**
 * Get cached value by key
 * Returns null if not found or expired
 */
export function cacheGet<T = any>(key: string): T | null {
  const entry = cache.get(key);
  if (!entry) return null;
  
  if (entry.expiresAt < Date.now()) {
    cache.delete(key);
    return null;
  }
  
  return entry.data as T;
}

/**
 * Set cached value with TTL
 * @param key Cache key
 * @param data Data to cache
 * @param ttlMs Time to live in milliseconds
 */
export function cacheSet<T = any>(key: string, data: T, ttlMs: number): void {
  cache.set(key, {
    data,
    expiresAt: Date.now() + ttlMs,
  });
}

/**
 * Clear all cached values
 */
export function cacheClear(): void {
  cache.clear();
}

/**
 * Remove expired entries from cache
 */
export function cacheCleanup(): void {
  const now = Date.now();
  for (const [key, entry] of cache.entries()) {
    if (entry.expiresAt < now) {
      cache.delete(key);
    }
  }
}

// Run cleanup every 5 minutes
setInterval(cacheCleanup, 5 * 60 * 1000);
