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

/** What every screen reads: the loaded sections, what is still loading, and what failed. */
export interface ResourceHandle extends ResourceState {
  reload: (force?: boolean) => void;
}

/** The loaded sections, after one loader pass has settled. */
export interface SettledResource {
  data: Record<string, unknown>;
  failed: string[];
  error: string | null;
}

/**
 * Folds one loader pass into the next state.
 *
 * Exported separately from the hook because this is where the honesty
 * contract actually lives, and it is a pure function: it can be tested
 * without mounting React, which the test runner here cannot do.
 *
 * `previous` supplies last-known values. A rejected section contributes
 * neither a key nor a value, so a screen that reads `data.anggota` for a
 * failed section finds `undefined` — the shape that forces the caller to
 * consult `failed` instead of rendering a confident empty list.
 */
export function settleSections(
  results: readonly (readonly [string, PromiseSettledResult<unknown>])[],
  previous: Record<string, unknown> = {}
): SettledResource {
  const data: Record<string, unknown> = { ...previous };
  const failed: string[] = [];

  for (const [label, result] of results) {
    if (result.status === 'fulfilled') {
      data[label] = result.value;
    } else {
      failed.push(label);
    }
  }

  return { data, failed, error: failed.length ? failed.join(', ') : null };
}

/** The message for a loader that rejected outright, rather than per section. */
export function loaderErrorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

export function useResource(load: ResourceLoader, deps: unknown[] = []): ResourceHandle {
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
        const settled = settleSections(results);
        setData((prev) => settled.data);
        setFailed(settled.failed);
        setError(settled.error);
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