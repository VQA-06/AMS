import { z } from 'zod';

export const qrGenerateSchema = z.object({
  member_ids: z
    .array(z.string().min(1))
    .min(1, 'Pilih minimal satu anggota untuk membuat QR'),
  scope: z.enum(['universal', 'event'], {
    required_error: 'Scope QR wajib dipilih (universal atau event)',
  }),
  event_id: z
    .string()
    .nullish()
    .or(z.literal(''))
    .transform((val) => (val && val.trim() !== '' ? val.trim() : null)),
  valid_from: z
    .string()
    .optional()
    .default(() => new Date().toISOString()),
  expires_at: z.string({
    required_error: 'Waktu kedaluwarsa QR wajib ditentukan',
  }),
  max_uses: z.coerce
    .number()
    .int()
    .positive('Batas pemakaian minimal 1')
    .nullish(),
  note: z
    .string()
    .nullish()
    .transform((val) => (val && val.trim() !== '' ? val.trim() : null)),
}).refine(
  (data) => {
    if (data.scope === 'event' && !data.event_id) {
      return false;
    }
    if (data.scope === 'universal' && data.event_id) {
      return false;
    }
    return true;
  },
  {
    message:
      'QR scope "event" wajib menyertakan event_id, sedangkan scope "universal" tidak boleh memiliki event_id',
    path: ['event_id'],
  }
);

export type QrGenerateInput = z.infer<typeof qrGenerateSchema>;
