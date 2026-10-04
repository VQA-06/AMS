import { describe, it, expect } from 'vitest';
import {
  failedGlobalSections,
  sectionValue,
  GLOBAL_SECTIONS,
  type GlobalSectionResults,
} from '../src/client/lib/global-load-sections';

/**
 * Guards the honesty contract: a section that could not be fetched must be
 * named, never silently rendered as an empty result that reads like a real
 * count. The defect this replaces collapsed a rejection to `null` per fetch,
 * making a backend outage indistinguishable from an empty roster.
 */

const ok = <T,>(value: T): PromiseSettledResult<T> => ({ status: 'fulfilled', value });
const boom = <T,>(): PromiseSettledResult<T> => ({ status: 'rejected', reason: new Error('down') });

const results = (
  overrides: Partial<Record<keyof GlobalSectionResults, PromiseSettledResult<unknown>>>
): GlobalSectionResults =>
  ({
    members: ok({ members: [], total: 0 }),
    events: ok({ events: [] }),
    divisions: ok({ divisions: [] }),
    ...overrides,
  }) as GlobalSectionResults;

describe('failedGlobalSections', () => {
  it('reports nothing when all three sections load', () => {
    expect(failedGlobalSections(results({}))).toEqual([]);
  });

  it('does not treat a legitimately empty section as a failure', () => {
    // An organisation with no events yet is a real answer. Raising an alarm
    // here would train users to ignore the banner, which is the whole point
    // of having one.
    const html = results({
      members: ok({ members: [], total: 0 }),
      events: ok({ events: [] }),
    });
    expect(failedGlobalSections(html)).toEqual([]);
  });

  it('names the failed section using the Indonesian domain vocabulary', () => {
    expect(failedGlobalSections(results({ members: boom() }))).toEqual(['anggota']);
    expect(failedGlobalSections(results({ events: boom() }))).toEqual(['kegiatan']);
    expect(failedGlobalSections(results({ divisions: boom() }))).toEqual(['divisi']);
  });

  it('names every failed section at once, in declaration order', () => {
    const all = failedGlobalSections(results({ members: boom(), events: boom(), divisions: boom() }));
    expect(all).toEqual(['anggota', 'kegiatan', 'divisi']);
    expect(all).toHaveLength(3);
  });

  it('reports a partial outage as partial, not total', () => {
    const partial = failedGlobalSections(results({ events: boom() }));
    expect(partial).toEqual(['kegiatan']);
    expect(partial).not.toContain('anggota');
  });

  it('clears the failure list once the section recovers', () => {
    // The banner must not latch: a recovered fetch has to stop reporting.
    expect(failedGlobalSections(results({ members: boom() }))).toEqual(['anggota']);
    expect(failedGlobalSections(results({}))).toEqual([]);
  });
});

describe('sectionValue', () => {
  it('returns the projected value for a fulfilled result', () => {
    const r = ok({ members: [{ id: 'm1' }] as never, total: 1 });
    expect(sectionValue(r, (v) => v.members)).toHaveLength(1);
  });

  it('returns undefined for a rejected result so the caller keeps its last value', () => {
    // Overwriting with [] is what made the outage look like zero members.
    expect(sectionValue(boom<{ members: unknown[] }>(), (v) => v.members)).toBeUndefined();
  });

  it('propagates a genuinely empty payload instead of treating it as undefined', () => {
    const r = ok({ events: [] as never[] });
    expect(sectionValue(r, (v) => v.events)).toEqual([]);
  });
});

describe('GLOBAL_SECTIONS', () => {
  it('declares a unique endpoint per section', () => {
    const endpoints = GLOBAL_SECTIONS.map((s) => s.endpoint);
    expect(new Set(endpoints).size).toBe(endpoints.length);
  });

  it('covers every key the loader branches on', () => {
    expect(GLOBAL_SECTIONS.map((s) => s.key).sort()).toEqual(['divisions', 'events', 'members']);
  });
});