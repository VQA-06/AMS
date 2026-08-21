import { z } from 'zod';

export const eventSchema = z.object({
  name: z
    .string({ required_error: 'Nama kegiatan/event wajib diisi' })
    .min(1, 'Nama kegiatan tidak boleh kosong')
    .max(150, 'Nama kegiatan maksimal 150 karakter')
    .trim(),
  description: z
    .string()
    .nullish()
    .or(z.literal(''))
    .transform((val) => (val && val.trim() !== '' ? val.trim() : null)),
  location_name: z
    .string()
    .nullish()
    .or(z.literal(''))
    .transform((val) => (val && val.trim() !== '' ? val.trim() : null)),
  starts_at: z
    .string()
    .nullish()
    .or(z.literal(''))
    .transform((val) => (val && val.trim() !== '' ? val.trim() : null)),
  ends_at: z
    .string()
    .nullish()
    .or(z.literal(''))
    .transform((val) => (val && val.trim() !== '' ? val.trim() : null)),
  qr_policy: z.enum(['event_only', 'universal_allowed']).default('universal_allowed'),
  status: z.enum(['draft', 'active', 'closed', 'archived']).default('draft'),
  session_modes: z
    .union([z.array(z.enum(['CHECKIN', 'CHECKOUT', 'BREAK_OUT', 'BREAK_IN'])), z.string()])
    .default(['CHECKIN'])
    .transform((val) => (Array.isArray(val) ? JSON.stringify(val) : val)),
  allow_manual_attendance: z
    .union([z.boolean(), z.number()])
    .default(false)
    .transform((v) => (v ? 1 : 0)),
  grace_minutes: z.coerce.number().int().min(0).default(30),
});

export const eventUpdateSchema = eventSchema.partial();

export type EventInput = z.infer<typeof eventSchema>;
export type EventUpdateInput = z.infer<typeof eventUpdateSchema>;
