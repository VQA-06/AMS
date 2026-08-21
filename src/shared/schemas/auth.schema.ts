import { z } from 'zod';

export const adminCreateFromMemberSchema = z.object({
  member_id: z.string().min(1, 'Pilih anggota terlebih dahulu'),
  role: z.enum(['owner', 'admin', 'operator', 'auditor']),
  password: z.string().min(6, 'Password minimal 6 karakter'),
});

export const adminUpdateSchema = z.object({
  role: z.enum(['owner', 'admin', 'operator', 'auditor']).optional(),
  status: z.enum(['active', 'inactive']).optional(),
  password: z.string().min(6, 'Password baru minimal 6 karakter').optional(),
});

export const qrLoginSchema = z.object({
  qr: z.string().min(5, 'QR Code token wajib diisi'),
});

export const adminCreateSchema = z.object({
  email: z.string().email('Format email tidak valid').trim().toLowerCase(),
  name: z.string().min(1, 'Nama admin wajib diisi').trim(),
  role: z.enum(['owner', 'admin', 'operator', 'auditor']),
  status: z.enum(['active', 'inactive']).default('active'),
  password: z.string().min(6, 'Password minimal 6 karakter').optional(),
});

export const loginSchema = z.object({
  email: z.string().min(1, 'Email atau username wajib diisi').trim().toLowerCase(),
  password: z.string().min(1, 'Password wajib diisi'),
});

export const profileUpdateSchema = z.object({
  name: z.string().min(2, 'Nama minimal 2 karakter').optional(),
  email: z.string().email('Format email tidak valid').optional(),
  current_password: z.string().optional(),
  new_password: z.string().min(6, 'Password baru minimal 6 karakter').optional(),
});

export type AdminCreateFromMemberInput = z.infer<typeof adminCreateFromMemberSchema>;
export type AdminUpdateInput = z.infer<typeof adminUpdateSchema>;
export type QrLoginInput = z.infer<typeof qrLoginSchema>;
export type AdminCreateInput = z.infer<typeof adminCreateSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type ProfileUpdateInput = z.infer<typeof profileUpdateSchema>;
