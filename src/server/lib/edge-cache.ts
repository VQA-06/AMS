/**
 * Cloudflare Edge Cache Engine with Tag-Based Granular Invalidation
 * - Integrates with Cloudflare Workers caches.default API
 * - Provides selective tag invalidation (e.g. invalidate 'agenda' without touching 'members')
 * - Falls back cleanly to memory map in non-Cloudflare/testing environments
 */

interface CacheItem {
  response: Response;
  expiresAt: number;
  tags: string[];
}

// In-Memory fallback for test and dev environments
const memoryCache = new Map<string, CacheItem>();
const tagToUrls = new Map<string, Set<string>>();

/**
 * Safely extracts Cloudflare executionCtx without throwing "This context has no ExecutionContext"
 */
export function getSafeExecutionContext(ctxOrExecutionContext: any): any {
  if (!ctxOrExecutionContext) return undefined;
  // If it's already an ExecutionContext with waitUntil
  if (typeof ctxOrExecutionContext.waitUntil === 'function') {
    return ctxOrExecutionContext;
  }
  // If it's a Hono Context
  try {
    return ctxOrExecutionContext.executionCtx;
  } catch {
    return undefined;
  }
}

/**
 * Checks if Cloudflare caches.default API is available in global scope
 */
function getCloudflareCache(): any {
  if (typeof globalThis !== 'undefined' && (globalThis as any).caches && (globalThis as any).caches.default) {
    return (globalThis as any).caches.default;
  }
  return null;
}

// Normalizes URL cache key so localhost / domain prefix is consistent
export function getNormalizedCacheKey(url: string): string {
  try {
    if (url.startsWith('http://') || url.startsWith('https://')) {
      const parsed = new URL(url);
      return `${parsed.pathname}${parsed.search}`;
    }
    return url;
  } catch {
    return url;
  }
}

/**
 * Matches a request in Edge Cache
 */
export async function matchEdgeCache(rawUrl: string): Promise<Response | null> {
  const url = getNormalizedCacheKey(rawUrl);
  const cfCache = getCloudflareCache();
  if (cfCache) {
    try {
      const matched = await cfCache.match(rawUrl);
      if (matched) {
        return matched.clone();
      }
    } catch {
      // Fallback cleanly
    }
  }

  // Memory fallback check
  const mem = memoryCache.get(url);
  if (mem) {
    if (Date.now() < mem.expiresAt) {
      return mem.response.clone();
    }
    // Expired
    memoryCache.delete(url);
  }

  return null;
}

/**
 * Stores a response into Edge Cache with specified TTL and Tag
 */
export async function putEdgeCache(
  rawUrl: string,
  response: Response,
  ttlSeconds: number,
  tag?: string,
  executionCtx?: any
): Promise<void> {
  // Only cache successful 200 responses
  if (response.status !== 200) return;

  const url = getNormalizedCacheKey(rawUrl);
  const headers = new Headers(response.headers);
  headers.set('Cache-Control', `public, max-age=${ttlSeconds}, s-maxage=${ttlSeconds}`);
  headers.set('X-AMS-Edge-Cache', 'HIT');

  let bodyText = '';
  try {
    bodyText = await response.clone().text();
  } catch {
    // If stream is empty or unreadable
  }

  const clonedForCache = new Response(bodyText, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });

  const execCtx = getSafeExecutionContext(executionCtx);
  const cfCache = getCloudflareCache();
  if (cfCache) {
    try {
      const putPromise = cfCache.put(rawUrl, clonedForCache.clone());
      if (execCtx && typeof execCtx.waitUntil === 'function') {
        execCtx.waitUntil(putPromise);
      } else {
        await putPromise;
      }
    } catch {
      // Ignore cache put failure in non-standard runtimes
    }
  }

  // Record into tag registry and memory cache
  const cleanTag = tag || 'global';
  if (!tagToUrls.has(cleanTag)) {
    tagToUrls.set(cleanTag, new Set());
  }
  tagToUrls.get(cleanTag)!.add(url);

  memoryCache.set(url, {
    response: clonedForCache,
    expiresAt: Date.now() + ttlSeconds * 1000,
    tags: [cleanTag],
  });
}

/**
 * Granularly invalidates only the cached URLs belonging to specific tags or URL prefixes.
 * Leaves all other cached domains (e.g. members vs agenda) intact!
 */
export async function invalidateEdgeCache(tagsOrUrls: string | string[], executionCtx?: any): Promise<void> {
  const targets = Array.isArray(tagsOrUrls) ? tagsOrUrls : [tagsOrUrls];
  const execCtx = getSafeExecutionContext(executionCtx);
  const cfCache = getCloudflareCache();
  const urlsToDelete = new Set<string>();

  for (const target of targets) {
    // 1. Check if target is a registered tag
    if (tagToUrls.has(target)) {
      const urls = tagToUrls.get(target)!;
      urls.forEach((u) => urlsToDelete.add(u));
      tagToUrls.delete(target);
    }

    // 2. Check if target matches URL keys directly or as a prefix
    for (const urlKey of memoryCache.keys()) {
      if (urlKey.includes(target)) {
        urlsToDelete.add(urlKey);
      }
    }
  }

  for (const url of urlsToDelete) {
    memoryCache.delete(url);
    if (cfCache) {
      try {
        const deletePromise = cfCache.delete(url);
        if (execCtx && typeof execCtx.waitUntil === 'function') {
          execCtx.waitUntil(deletePromise);
        } else {
          await deletePromise;
        }
      } catch {
        // Ignore cache delete failures in non-standard runtimes
      }
    }
  }
}
