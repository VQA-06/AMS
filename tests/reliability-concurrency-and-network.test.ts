import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { fetchApi, ApiError } from '../src/client/lib/api-client';
import { AttendanceRepository } from '../src/server/repositories/attendance.repo';

describe('Reliability, Concurrency & Network Resiliency Tests', () => {
  describe('Frontend Resilient HTTP Client (api-client)', () => {
    const originalFetch = globalThis.fetch;

    afterEach(() => {
      globalThis.fetch = originalFetch;
      vi.restoreAllMocks();
    });

    it('should successfully return data on clean 200 response', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => ({ ok: true, data: { status: 'healthy' } }),
      } as any);

      const data = await fetchApi<{ status: string }>('/api/health');
      expect(data).toEqual({ status: 'healthy' });
    });

    it('should throw ApiError with NETWORK_TIMEOUT on AbortError', async () => {
      globalThis.fetch = vi.fn().mockImplementation(() => {
        const err = new Error('The operation was aborted');
        err.name = 'AbortError';
        return Promise.reject(err);
      });

      await expect(
        fetchApi('/api/slow-endpoint', { timeoutMs: 50, retries: 0 })
      ).rejects.toThrowError(ApiError);

      try {
        await fetchApi('/api/slow-endpoint', { timeoutMs: 50, retries: 0 });
      } catch (e: any) {
        expect(e.code).toBe('NETWORK_TIMEOUT');
        expect(e.message).toContain('Batas waktu');
      }
    });

    it('should throw ApiError with NETWORK_OFFLINE on connection drop when offline', async () => {
      const originalOnLine = typeof navigator !== 'undefined' ? navigator.onLine : true;
      try {
        Object.defineProperty(globalThis.navigator, 'onLine', { value: false, configurable: true });
        globalThis.fetch = vi.fn().mockImplementation(() => {
          const err = new TypeError('Failed to fetch');
          return Promise.reject(err);
        });

        await fetchApi('/api/data', { retries: 0 });
      } catch (e: any) {
        expect(e instanceof ApiError).toBe(true);
        expect(e.code).toBe('NETWORK_OFFLINE');
        expect(e.message).toContain('Koneksi internet terputus');
      } finally {
        Object.defineProperty(globalThis.navigator, 'onLine', { value: originalOnLine, configurable: true });
      }
    });

    it('should throw ApiError with NETWORK_ERROR on unexpected network exception', async () => {
      const originalOnLine = typeof navigator !== 'undefined' ? navigator.onLine : true;
      try {
        Object.defineProperty(globalThis.navigator, 'onLine', { value: true, configurable: true });
        globalThis.fetch = vi.fn().mockImplementation(() => {
          const err = new TypeError('Failed to fetch');
          return Promise.reject(err);
        });

        await fetchApi('/api/data', { retries: 0 });
      } catch (e: any) {
        expect(e instanceof ApiError).toBe(true);
        expect(e.code).toBe('NETWORK_ERROR');
      } finally {
        Object.defineProperty(globalThis.navigator, 'onLine', { value: originalOnLine, configurable: true });
      }
    });

    it('should auto-retry idempotent GET requests once on transient network glitch', async () => {
      let callCount = 0;
      globalThis.fetch = vi.fn().mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          const err = new TypeError('Failed to fetch');
          return Promise.reject(err);
        }
        return Promise.resolve({
          ok: true,
          headers: new Headers({ 'content-type': 'application/json' }),
          json: async () => ({ ok: true, data: { success: true } }),
        });
      });

      const res = await fetchApi<{ success: boolean }>('/api/get-with-retry', { retries: 1 });
      expect(callCount).toBe(2);
      expect(res.success).toBe(true);
    });
  });

  describe('Backend Atomic Concurrency & Race Condition Defense', () => {
    it('should prepare atomic batch statements for attendance recording with max_uses protection', async () => {
      const mockBatch = vi.fn().mockResolvedValue([]);
      const preparedStatements: string[] = [];

      const mockDb = {
        prepare: vi.fn().mockImplementation((sql: string) => {
          preparedStatements.push(sql);
          return {
            bind: vi.fn().mockReturnThis(),
          };
        }),
        batch: mockBatch,
      } as any;

      const repo = new AttendanceRepository(mockDb);

      await repo.recordScanAtomic({
        attendanceId: 'att_123',
        eventId: 'evt_123',
        memberId: 'mem_123',
        qrTokenId: 'tok_123',
        sessionType: 'CHECKIN',
        tokenJti: 'jti_123',
      });

      expect(mockDb.prepare).toHaveBeenCalledTimes(3);
      expect(mockBatch).toHaveBeenCalledTimes(1);

      // Verify token update SQL contains atomic max_uses check
      const tokenUpdateSql = preparedStatements.find((s) => s.includes('UPDATE qr_tokens'));
      expect(tokenUpdateSql).toBeDefined();
      expect(tokenUpdateSql).toContain('max_uses IS NULL OR uses_count < max_uses');
    });
  });
});
