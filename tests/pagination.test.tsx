import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { renderToString } from 'react-dom/server';
import { Pagination } from '../src/client/components/ui/Pagination';
import { RowList, type RowListItem } from '../src/client/components/ui/RowList';
import { AuditTab } from '../src/client/pages/settings/AuditTab';
import { ImportWizard } from '../src/client/components/members/ImportWizard';
import { AuditLog } from '../src/shared/types';

vi.mock('../src/client/lib/api-client', () => ({
  fetchApi: vi.fn().mockResolvedValue({ ok: true }),
}));

describe('Pagination UI Component', () => {
  it('returns null when totalItems <= pageSize and hideOnSinglePage is true (default)', () => {
    const html = renderToString(
      <Pagination
        currentPage={1}
        totalItems={25}
        pageSize={25}
        onPageChange={() => {}}
      />
    );
    expect(html).toBe('');
  });

  it('renders pagination when hideOnSinglePage is false even if totalItems <= pageSize', () => {
    const html = renderToString(
      <Pagination
        currentPage={1}
        totalItems={10}
        pageSize={25}
        hideOnSinglePage={false}
        onPageChange={() => {}}
      />
    );
    expect(html).toContain('Menampilkan');
    expect(html).toContain('1–10');
    expect(html).toContain('10');
    expect(html).toContain('baris');
  });

  it('formats summary range text and uses custom itemLabel', () => {
    const html = renderToString(
      <Pagination
        currentPage={1}
        totalItems={60}
        pageSize={25}
        itemLabel="anggota"
        onPageChange={() => {}}
      />
    );
    expect(html).toContain('Menampilkan');
    expect(html).toContain('1–25');
    expect(html).toContain('60');
    expect(html).toContain('anggota');
  });

  it('formats summary range on intermediate and final pages', () => {
    const page2Html = renderToString(
      <Pagination
        currentPage={2}
        totalItems={60}
        pageSize={25}
        itemLabel="presensi"
        onPageChange={() => {}}
      />
    );
    expect(page2Html).toContain('26–50');
    expect(page2Html).toContain('presensi');

    const page3Html = renderToString(
      <Pagination
        currentPage={3}
        totalItems={60}
        pageSize={25}
        itemLabel="presensi"
        onPageChange={() => {}}
      />
    );
    expect(page3Html).toContain('51–60');
  });

  it('disables previous button on first page and enables next button', () => {
    const html = renderToString(
      <Pagination
        currentPage={1}
        totalItems={60}
        pageSize={25}
        onPageChange={() => {}}
      />
    );
    expect(html).toMatch(/<button[^>]*disabled=""[^>]*aria-label="Halaman sebelumnya"|<button[^>]*aria-label="Halaman sebelumnya"[^>]*disabled=""/);
    expect(html).not.toMatch(/<button[^>]*disabled=""[^>]*aria-label="Halaman berikutnya"|<button[^>]*aria-label="Halaman berikutnya"[^>]*disabled=""/);
  });

  it('disables next button on last page and enables previous button', () => {
    const html = renderToString(
      <Pagination
        currentPage={3}
        totalItems={60}
        pageSize={25}
        onPageChange={() => {}}
      />
    );
    expect(html).toMatch(/<button[^>]*disabled=""[^>]*aria-label="Halaman berikutnya"|<button[^>]*aria-label="Halaman berikutnya"[^>]*disabled=""/);
    expect(html).not.toMatch(/<button[^>]*disabled=""[^>]*aria-label="Halaman sebelumnya"|<button[^>]*aria-label="Halaman sebelumnya"[^>]*disabled=""/);
  });

  it('marks active page button with aria-current="page" and bg-pen-500 text-paper', () => {
    const html = renderToString(
      <Pagination
        currentPage={2}
        totalItems={60}
        pageSize={25}
        onPageChange={() => {}}
      />
    );
    expect(html).toContain('aria-current="page"');
    expect(html).toContain('bg-pen-500');
    expect(html).toContain('text-paper');
  });

  it('windows page numbers with ellipsis when totalPages > 7', () => {
    const html = renderToString(
      <Pagination
        currentPage={1}
        totalItems={250}
        pageSize={25}
        onPageChange={() => {}}
      />
    );
    expect(html).toContain('…');
    expect(html).toContain('aria-label="Halaman 1"');
    expect(html).toContain('aria-label="Halaman 2"');
    expect(html).toContain('aria-label="Halaman 5"');
    expect(html).toContain('aria-label="Halaman 10"');
  });
});

describe('RowList Pagination Integration', () => {
  const createMockItems = (count: number): RowListItem[] =>
    Array.from({ length: count }, (_, i) => ({
      id: `item-${i + 1}`,
      title: `Item Title ${i + 1}`,
      meta: `Meta info for item ${i + 1}`,
      leading: String(i + 1).padStart(2, '0'),
    }));

  it('renders only the first 25 items on page 1 when dataset has 60 items', () => {
    const items = createMockItems(60);
    const html = renderToString(
      <RowList
        items={items}
        itemLabel="anggota"
        selectable={true}
        onToggleAll={vi.fn()}
      />
    );

    // Items 1 through 25 should be in DOM
    expect(html).toContain('Item Title 1');
    expect(html).toContain('Item Title 25');
    // Item 26 should not be in DOM on page 1
    expect(html).not.toContain('Item Title 26');

    // Selection header reflects total item count
    expect(html).toContain('Pilih semua (60 anggota)');

    // Pagination summary
    expect(html).toContain('Menampilkan');
    expect(html).toContain('1–25');
    expect(html).toContain('60');
    expect(html).toContain('anggota');
  });

  it('renders items 26 to 50 when page=2 is provided', () => {
    const items = createMockItems(60);
    const html = renderToString(
      <RowList
        items={items}
        itemLabel="anggota"
        page={2}
      />
    );

    expect(html).not.toContain('Item Title 25');
    expect(html).toContain('Item Title 26');
    expect(html).toContain('Item Title 50');
    expect(html).not.toContain('Item Title 51');

    expect(html).toContain('26–50');
  });

  it('renders all items and hides pagination when dataset has <= 25 items', () => {
    const items = createMockItems(15);
    const html = renderToString(
      <RowList
        items={items}
        itemLabel="anggota"
      />
    );

    expect(html).toContain('Item Title 1');
    expect(html).toContain('Item Title 15');
    expect(html).not.toContain('Navigasi halaman');
  });

  it('renders all items without pagination when paginated={false}', () => {
    const items = createMockItems(60);
    const html = renderToString(
      <RowList
        items={items}
        paginated={false}
      />
    );

    expect(html).toContain('Item Title 1');
    expect(html).toContain('Item Title 60');
    expect(html).not.toContain('Navigasi halaman');
  });
});

describe('AuditTab Pagination Integration', () => {
  const createMockLogs = (count: number): AuditLog[] =>
    Array.from({ length: count }, (_, i) => ({
      id: `log-${i + 1}`,
      action: `MEMBER_UPDATE_${i + 1}`,
      entity_type: 'member',
      entity_id: `mem-${i + 1}`,
      admin_id: 'adm_1',
      admin_name: 'Admin User',
      admin_email: 'admin@example.com',
      meta: { field: `test-${i + 1}` },
      created_at: new Date(2026, 0, 1, 10, i).toISOString(),
    }));
  it('renders 25 rows and pagination controls when dataset has 35 logs', () => {
    const logs = createMockLogs(35);
    const html = renderToString(<AuditTab logs={logs} />);

    expect(html).toContain('MEMBER_UPDATE_1');
    expect(html).toContain('MEMBER_UPDATE_25');
    expect(html).not.toContain('MEMBER_UPDATE_26');

    expect(html).toContain('Menampilkan');
    expect(html).toContain('1–25');
    expect(html).toContain('35');
    expect(html).toContain('log');
  });

  it('renders all rows and hides pagination when dataset has <= 25 logs', () => {
    const logs = createMockLogs(10);
    const html = renderToString(<AuditTab logs={logs} />);

    expect(html).toContain('MEMBER_UPDATE_1');
    expect(html).toContain('MEMBER_UPDATE_10');
    expect(html).not.toContain('Navigasi halaman');
  });
});
