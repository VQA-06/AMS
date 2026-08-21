/**
 * Cloudflare D1 Helper Utilities
 * Mitigates D1 limits:
 * - Max 100 bound parameters per query
 * - Safe chunking for batch operations
 */

export const D1_MAX_SAFE_PARAM_CHUNK = 50;

/**
 * Splits an array into chunks of a given size to comply with D1's 100 bound parameter limit.
 */
export function chunkArray<T>(items: T[], size: number = D1_MAX_SAFE_PARAM_CHUNK): T[][] {
  if (!items || items.length === 0) return [];
  const chunkSize = Math.max(1, Math.min(size, D1_MAX_SAFE_PARAM_CHUNK));
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += chunkSize) {
    chunks.push(items.slice(i, i + chunkSize));
  }
  return chunks;
}
