import { describe, it, expect } from 'vitest';
import {
  settleSections,
  loaderErrorMessage,
  type ResourceLoader,
} from '@/client/lib/useResource';

/**
 * Guards the honesty contract that used to live in `global-load-sections`:
 * a section that could not be fetched must be named, never silently rendered
 * as an empty result that reads like a real count. The defect this replaces
 * collapsed a rejection to `null` per fetch, making a backend outage
 * indistinguishable from an empty roster.
 *
 * `settleSections` is tested directly rather than through the hook: this
 * project runs Vitest without a DOM, and `renderToString` never fires
 * effects, so a mounted hook would assert nothing.
 */

const ok = (value: unknown): PromiseSettledResult<unknown> => ({ status: 'fulfilled', value });
const boom = (): PromiseSettledResult<unknown> => ({ status: 'rejected', reason: new Error('down') });

const threeSections = (overrides: Partial<Record<string, PromiseSettledResult<unknown>>>) =>
  [
    ['anggota', overrides.anggota ?? ok([{ id: 'm1' }])],
    ['kegiatan', overrides.kegiatan ?? ok([{ id: 'e1' }])],
    ['divisi', overrides.divisi ?? ok(['Engineering'])],
  ] as [string, PromiseSettledResult<unknown>][];

describe('settleSections', () => {
  it('keeps one value per fulfilled section', () => {
    const settled = settleSections(threeSections({}));

    expect(settled.failed).toEqual([]);
    expect(settled.error).toBeNull();
    expect(settled.data.anggota).toEqual([{ id: 'm1' }]);
    expect(settled.data.kegiatan).toEqual([{ id: 'e1' }]);
    expect(settled.data.divisi).toEqual(['Engineering']);
  });

  it('does not treat a legitimately empty section as a failure', () => {
    // An organisation with no events yet is a real answer. Raising an alarm
    // here would train users to ignore the banner, which is the whole point
    // of having one.
    const settled = settleSections(threeSections({ anggota: ok([]), kegiatan: ok([]), divisi: ok([]) }));

    expect(settled.failed).toEqual([]);
    expect(settled.error).toBeNull();
    expect(settled.data.kegiatan).toEqual([]);
  });

  it('names a rejected section and contributes no value for it', () => {
    const settled = settleSections(threeSections({ anggota: boom() }));

    expect(settled.failed).toEqual(['anggota']);
    expect(settled.error).toContain('anggota');
    // The key must be absent, not an empty array — an empty array here would
    // render as "zero members", which is the lie this contract prevents.
    expect('anggota' in settled.data).toBe(false);
    expect(settled.data.kegiatan).toEqual([{ id: 'e1' }]);
  });

  it('names every rejected section at once, in declaration order', () => {
    const settled = settleSections(threeSections({ anggota: boom(), kegiatan: boom(), divisi: boom() }));

    expect(settled.failed).toEqual(['anggota', 'kegiatan', 'divisi']);
    expect(settled.error).toBe('anggota, kegiatan, divisi');
  });

  it('keeps the last-known value when a section that had loaded fails again', () => {
    // Refreshing and losing a section must not blank the screen; the banner
    // tells the user the value may be stale, which is honest, whereas an
    // empty list with no banner looks like the record was deleted.
    const previous = { anggota: [{ id: 'm1' }] };
    const settled = settleSections([['anggota', boom()]], previous);

    expect(settled.failed).toEqual(['anggota']);
    expect(settled.data.anggota).toEqual([{ id: 'm1' }]);
  });

  it('clears a failure once the section loads again', () => {
    const previous = settleSections(threeSections({ kegiatan: boom() })).data;
    const settled = settleSections(threeSections({}), previous);

    expect(settled.failed).toEqual([]);
    expect(settled.error).toBeNull();
  });

  it('reports a null section value as a fulfilled section, not a failure', () => {
    // `ok(null)` is a real answer from an endpoint that has no row yet.
    const settled = settleSections([['kegiatan', ok(null)]]);

    expect(settled.failed).toEqual([]);
    expect(settled.data.kegiatan).toBeNull();
  });
});

describe('loaderErrorMessage', () => {
  it('uses an Error message when the loader threw one', () => {
    expect(loaderErrorMessage(new Error('batas jaringan terlampaui'))).toBe('batas jaringan terlampaui');
  });

  it('stringifies a non-Error rejection rather than rendering "undefined"', () => {
    expect(loaderErrorMessage('timeout')).toBe('timeout');
    expect(loaderErrorMessage(503)).toBe('503');
  });
});

describe('ResourceLoader contract', () => {
  it('carries one PromiseSettledResult per labelled section', async () => {
    // The loader shape is the half of the contract the pages actually depend
    // on: labels in Indonesian, and every entry already settled.
    const load: ResourceLoader = async (force) => {
      expect(force).toBe(false);
      return threeSections({ anggota: boom(), kegiatan: ok([{ id: 'e1' }]) });
    };

    const settled = settleSections(await load(false));

    expect(settled.failed).toEqual(['anggota']);
    expect(settled.data.kegiatan).toEqual([{ id: 'e1' }]);
  });
});