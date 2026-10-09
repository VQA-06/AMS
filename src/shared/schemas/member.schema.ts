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
  status: z.enum(['active', 'inactive', 'candidate', 'archived']).default('active'),
  metadata: z.record(z.unknown()).optional().default({}),
});

export const memberUpdateSchema = memberSchema.partial();

export const memberImportRowSchema = z.object({
  external_id: z.string().min(1, 'Kode Anggota minimal 1 karakter').max(50).nullable().optional().or(z.literal('')),
  name: z.string().min(1, 'Nama wajib diisi').max(100),
  email: z.string().email('Email tidak valid').nullable().optional().or(z.literal('')),
  phone: z.string().nullable().optional().or(z.literal('')),
  group_name: z.string().nullable().optional().or(z.literal('')),
  division: z.string().nullable().optional().or(z.literal('')),
  status: z.enum(['active', 'inactive', 'candidate', 'archived']).default('active'),
  metadata: z.string().optional().default('{}'),
});

export type MemberInput = z.infer<typeof memberSchema>;
export type MemberUpdateInput = z.infer<typeof memberUpdateSchema>;
export type MemberImportRow = z.infer<typeof memberImportRowSchema>;

export const candidateInductionSchema = z.object({
  member_ids: z.array(z.string().min(1)).min(1, 'Pilih minimal satu calon anggota untuk dilantik'),
  archive_remaining: z.boolean().default(false),
  batch_group: z.string().optional(),
  division: z.string().optional(),
});

export const candidateBatchActionSchema = z.object({
  member_ids: z.array(z.string().min(1)).min(1, 'Pilih minimal satu anggota'),
  batch_group: z.string().optional(),
});

export const candidatePurgeSchema = z
  .object({
    member_ids: z.array(z.string().min(1)).optional(),
    all_archived: z.boolean().optional(),
  })
  .refine((d) => (d.member_ids && d.member_ids.length > 0) || d.all_archived === true, {
    message: 'Tentukan ID anggota yang akan dihapus atau aktifkan all_archived',
  });

export type CandidateInductionInput = z.infer<typeof candidateInductionSchema>;
export type CandidateBatchActionInput = z.infer<typeof candidateBatchActionSchema>;
export type CandidatePurgeInput = z.infer<typeof candidatePurgeSchema>;

export const convertGuestsToCandidatesSchema = z.object({
  guest_member_ids: z.array(z.string().min(1)).min(1, 'Pilih minimal satu peserta tamu'),
  target_group: z.string().max(50).optional(),
  target_division: z.string().max(50).optional(),
});

export type ConvertGuestsToCandidatesInput = z.infer<typeof convertGuestsToCandidatesSchema>;
