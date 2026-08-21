import { z } from 'zod';

export const memberSchema = z.object({
  external_id: z
    .string()
    .min(1, 'Kode Anggota minimal 1 karakter')
    .max(50, 'Kode Anggota maksimal 50 karakter')
    .regex(/^[A-Za-z0-9-_]+$/, 'Kode Anggota hanya boleh huruf, angka, tanda hubung (-), atau garis bawah (_)')
    .optional(),
  name: z.string().min(1, 'Nama anggota wajib diisi').max(100, 'Nama anggota maksimal 100 karakter').trim(),
  email: z
    .string()
    .email('Format email tidak valid')
    .nullish()
    .or(z.literal(''))
    .transform((val) => (val && val.trim() !== '' ? val.trim() : null)),
  phone: z
    .string()
    .max(20, 'Nomor telepon maksimal 20 karakter')
    .nullish()
    .or(z.literal(''))
    .transform((val) => (val && val.trim() !== '' ? val.trim() : null)),
  group_name: z
    .string()
    .max(50, 'Nama grup maksimal 50 karakter')
    .nullish()
    .or(z.literal(''))
    .transform((val) => (val && val.trim() !== '' ? val.trim() : null)),
  division: z
    .string()
    .max(50, 'Nama divisi maksimal 50 karakter')
    .nullish()
    .or(z.literal(''))
    .transform((val) => (val && val.trim() !== '' ? val.trim() : null)),
  status: z.enum(['active', 'inactive']).default('active'),
  metadata: z.record(z.unknown()).optional().default({}),
});

export const memberUpdateSchema = memberSchema.partial();

export const memberImportRowSchema = z.object({
  external_id: z.string().min(1, 'Kode Anggota wajib diisi').max(50),
  name: z.string().min(1, 'Nama wajib diisi').max(100),
  email: z.string().email('Email tidak valid').nullable().optional().or(z.literal('')),
  phone: z.string().nullable().optional().or(z.literal('')),
  group_name: z.string().nullable().optional().or(z.literal('')),
  division: z.string().nullable().optional().or(z.literal('')),
  status: z.enum(['active', 'inactive']).default('active'),
  metadata: z.string().optional().default('{}'),
});

export type MemberInput = z.infer<typeof memberSchema>;
export type MemberUpdateInput = z.infer<typeof memberUpdateSchema>;
export type MemberImportRow = z.infer<typeof memberImportRowSchema>;
