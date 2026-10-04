import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * One loader for every screen, replacing nine hand-rolled
 * `useState` + `useEffect` + `Promise.all` triads.
 *
 * The honesty contract lives here rather than in each caller:
 *
 *  - `load` returns one `PromiseSettledResult` per named section.
 *  - A *rejected* section lands in `failed` and contributes **no value**. The
 *    previous good value is kept — never an empty array, never a `0`.
 *  - A *fulfilled but empty* section is a real answer (an organisation with no
 *    events exists) and must NOT raise an alarm. Only rejection counts.
 *
 * `.catch(() => [])` is what made a total outage render as plausible zeros.
 * `Promise.allSettled` plus a named failure list is what makes it visible.
 */
export interface ResourceSectionResult {
  status: 'fulfilled' | 'rejected';
  value?: unknown;
  reason?: unknown;
}

export interface ResourceState {
  /** One value per fulfilled section, keyed by label. Last-known on failure. */
  data: Record<string, unknown>;
  loading: boolean;
  /** Rejected section labels, in declaration order. Empty means everything is live. */
  failed: string[];
  error: string | null;
}

export type ResourceLoader = (force: boolean) => Promise<[string, PromiseSettledResult<unknown>][]>;

export function useResource(load: ResourceLoader, deps: unknown[] = []): ResourceState & {
  reload: (force?: boolean) => void;
} {
  const [data, setData] = useState<Record<string, unknown>>({});
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const mounted = useRef(true);
  const loadRef = useRef(load);
  loadRef.current = load;

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const run = useCallback((force: boolean) => {
    setLoading(true);
    loadRef
      .current(force)
      .then((results) => {
        if (!mounted.current) return;
        const nextData: Record<string, unknown> = {};
        const nextFailed: string[] = [];
        for (const [label, result] of results) {
          if (result.status === 'fulfilled') {
            nextData[label] = result.value;
          } else {
            nextFailed.push(label);
          }
        }
        // Keep last-known values for failed sections; overlay fresh ones.
        setData((prev) => ({ ...prev, ...nextData }));
        setFailed(nextFailed);
        setError(nextFailed.length ? nextFailed.join(', ') : null);
        setLoading(false);
      })
      .catch((err: unknown) => {
        if (!mounted.current) return;
        setError(err instanceof Error ? err.message : String(err));
        setLoading(false);
      });
  }, []);

  useEffect(() => {
    run(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  const reload = useCallback((force = true) => run(force), [run]);

  return { data, loading, failed, error, reload };
}