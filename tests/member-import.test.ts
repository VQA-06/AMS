import { describe, it, expect } from 'vitest';
import { memberSchema, memberImportRowSchema } from '../src/shared/schemas/member.schema';

describe('Member Schema & Import Validation', () => {
  it('should validate valid member with division', () => {
    const data = {
      external_id: 'MEM-001',
      name: 'Andi Pratama',
      email: 'andi@example.com',
      phone: '08123456789',
      group_name: 'Panitia',
      division: 'Acara',
      status: 'active' as const,
    };

    const parsed = memberSchema.safeParse(data);
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.division).toBe('Acara');
      expect(parsed.data.external_id).toBe('MEM-001');
    }
  });

  it('should validate valid member without division (optional/null)', () => {
    const data = {
      external_id: 'MEM-002',
      name: 'Rina Salsabila',
      email: '',
      phone: null,
      group_name: null,
      division: null,
      status: 'active' as const,
    };

    const parsed = memberSchema.safeParse(data);
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.division).toBeNull();
      expect(parsed.data.email).toBeNull();
    }
  });

  it('should validate import row with division correctly', () => {
    const row = {
      external_id: 'M003',
      name: 'Bambang',
      email: 'bambang@test.com',
      phone: '08571234567',
      group_name: 'Staff',
      division: 'Logistik',
      status: 'active',
      metadata: '{"role":"driver"}',
    };

    const parsed = memberImportRowSchema.safeParse(row);
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.division).toBe('Logistik');
      expect(parsed.data.metadata).toBe('{"role":"driver"}');
    }
  });

  it('should reject invalid import row with bad email or missing external_id', () => {
    const badRow = {
      external_id: '',
      name: 'Bad User',
      email: 'invalid-email-format',
    };

    const parsed = memberImportRowSchema.safeParse(badRow);
    expect(parsed.success).toBe(false);
  });
});
