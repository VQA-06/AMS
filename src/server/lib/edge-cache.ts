/**
 * Cloudflare Edge Cache Engine with Tag-Based Granular Invalidation
 * - Integrates with Cloudflare Workers caches.default API
 * - Provides selective tag invalidation (e.g. invalidate 'agenda' without touching 'members')
 * - Stores serializable plain payloads to prevent cross-request I/O runtime restrictions
 * - Safely handles absolute/relative URLs to prevent "TypeError: Invalid URL"
 */

interface SerializedCacheItem {
  bodyText: string;
  status: number;
  statusText: string;
  headers: [string, string][];
  expiresAt: number;
  tags: string[];
}

// In-Memory fallback for test and dev environments (stores serializable data, NOT live Response streams)
const memoryCache = new Map<string, SerializedCacheItem>();
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

/**
 * Normalizes URL cache key so localhost / domain prefix is consistent
 */
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
 * Ensures an absolute URL string for Cloudflare Cache API
 */
export function toAbsoluteUrls(target: string): string[] {
  if (target.startsWith('http://') || target.startsWith('https://')) {
    return [target];
  }

  const cleanPath = target.startsWith('/') ? target : `/${target}`;
  return [
    `https://ams.humanone.workers.dev${cleanPath}`,
  ];
}

/**
 * Matches a request in Edge Cache
 */
export async function matchEdgeCache(rawUrl: string): Promise<Response | null> {
  const url = getNormalizedCacheKey(rawUrl);
  const cfCache = getCloudflareCache();
  if (cfCache && typeof cfCache.match === 'function') {
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
      // Construct a fresh Response in the current request context (avoids cross-request I/O stream locks)
      return new Response(mem.bodyText, {
        status: mem.status,
        statusText: mem.statusText,
        headers: new Headers(mem.headers),
      });
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

  // Serializable headers array
  const headersArray: [string, string][] = [];
  headers.forEach((val, key) => headersArray.push([key, val]));

  const execCtx = getSafeExecutionContext(executionCtx);
  const cfCache = getCloudflareCache();
  if (cfCache && typeof cfCache.put === 'function') {
    try {
      const clonedForCache = new Response(bodyText, {
        status: response.status,
        statusText: response.statusText,
        headers,
      });

      const putPromise = cfCache.put(rawUrl, clonedForCache).catch(() => false);
      if (execCtx && typeof execCtx.waitUntil === 'function') {
        execCtx.waitUntil(putPromise);
      } else {
        await putPromise;
      }
    } catch {
      // Ignore cache put failure in non-standard runtimes
    }
  }

  // Record both rawUrl and normalized path into tag registry
  const cleanTag = tag || 'global';
  if (!tagToUrls.has(cleanTag)) {
    tagToUrls.set(cleanTag, new Set());
  }
  tagToUrls.get(cleanTag)!.add(rawUrl);
  tagToUrls.get(cleanTag)!.add(url);

  // Store serializable item in memoryCache (safe across requests)
  memoryCache.set(url, {
    bodyText,
    status: response.status,
    statusText: response.statusText,
    headers: headersArray,
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
  const memoryKeysToDelete = new Set<string>();
  const cfUrlsToDelete = new Set<string>();

  for (const target of targets) {
    // 1. Check if target is a registered tag
    if (tagToUrls.has(target)) {
      const urls = tagToUrls.get(target)!;
      urls.forEach((u) => {
        memoryKeysToDelete.add(getNormalizedCacheKey(u));
        toAbsoluteUrls(u).forEach((absUrl) => cfUrlsToDelete.add(absUrl));
      });
      tagToUrls.delete(target);
    }

    // 2. Check if target matches URL keys directly or as a prefix
    for (const urlKey of memoryCache.keys()) {
      if (urlKey.includes(target)) {
        memoryKeysToDelete.add(urlKey);
        toAbsoluteUrls(urlKey).forEach((absUrl) => cfUrlsToDelete.add(absUrl));
      }
    }

    // 3. Add direct target as potential URLs
    toAbsoluteUrls(target).forEach((absUrl) => cfUrlsToDelete.add(absUrl));
    memoryKeysToDelete.add(getNormalizedCacheKey(target));
  }

  // Clear memory cache entries
  for (const key of memoryKeysToDelete) {
    memoryCache.delete(key);
  }

  // Clear Cloudflare edge cache entries safely with catch handlers (prevents unhandled rejection logs)
  if (cfCache && typeof cfCache.delete === 'function') {
    for (const url of cfUrlsToDelete) {
      try {
        const safeDeletePromise = cfCache.delete(url).catch(() => false);
        if (execCtx && typeof execCtx.waitUntil === 'function') {
          execCtx.waitUntil(safeDeletePromise);
        } else {
          await safeDeletePromise;
        }
      } catch {
        // Safe fallback - never throw or break request flow
      }
    }
  }
}
