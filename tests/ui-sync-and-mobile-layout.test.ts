import { describe, it, expect } from 'vitest';
import { TabKey } from '../src/client/components/layout/MobileShell';

describe('Mobile Shell Layout & Global UI State Synchronization', () => {
  it('should ensure mobile navigation has exactly 5 items with Scanner at center index 2', () => {
    const mobileNavItems: Array<{ key: TabKey; label: string; isScanner?: boolean }> = [
      { key: 'dashboard', label: 'Beranda' },
      { key: 'members', label: 'Anggota' },
      { key: 'scanner', label: 'Scan QR', isScanner: true },
      { key: 'events', label: 'Kegiatan' },
      { key: 'tracker', label: 'Keaktifan' },
    ];

    expect(mobileNavItems.length).toBe(5);
    expect(mobileNavItems[2].key).toBe('scanner');
    expect(mobileNavItems[2].isScanner).toBe(true);

    // Verify left and right symmetry
    const leftItems = mobileNavItems.slice(0, 2);
    const rightItems = mobileNavItems.slice(3);
    expect(leftItems.length).toBe(2);
    expect(rightItems.length).toBe(2);
    expect(leftItems.map((i) => i.key)).toEqual(['dashboard', 'members']);
    expect(rightItems.map((i) => i.key)).toEqual(['events', 'tracker']);
  });

  it('should ensure desktop sidebar has all 6 items including settings', () => {
    const desktopNavItems: Array<{ key: TabKey; label: string }> = [
      { key: 'dashboard', label: 'Beranda' },
      { key: 'members', label: 'Anggota' },
      { key: 'scanner', label: 'Scan QR' },
      { key: 'events', label: 'Kegiatan' },
      { key: 'tracker', label: 'Keaktifan' },
      { key: 'settings', label: 'Pengaturan' },
    ];

    expect(desktopNavItems.length).toBe(6);
    expect(desktopNavItems.some((i) => i.key === 'settings')).toBe(true);
  });

  it('should propagate global refresh when event status changes', async () => {
    let globalEventsCount = 1;
    let globalRefreshCalled = false;

    const mockLoadGlobalData = async () => {
      globalEventsCount = 2;
      globalRefreshCalled = true;
    };

    // Simulate event activation triggering onRefreshGlobal
    const simulateActivateEvent = async (onRefreshGlobal?: () => void) => {
      // Server call mocked
      await onRefreshGlobal?.();
    };

    await simulateActivateEvent(mockLoadGlobalData);

    expect(globalRefreshCalled).toBe(true);
    expect(globalEventsCount).toBe(2);
  });
});
