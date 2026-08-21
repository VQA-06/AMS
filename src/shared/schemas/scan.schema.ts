import { z } from 'zod';

export const scanRequestSchema = z.object({
  eventId: z.string({ required_error: 'Event ID wajib diisi' }).min(1),
  qr: z.string({ required_error: 'String QR Token wajib diisi' }).min(1),
  sessionType: z
    .enum(['CHECKIN', 'CHECKOUT', 'BREAK_OUT', 'BREAK_IN'])
    .default('CHECKIN'),
  stationId: z.string().nullish().transform((v) => (v ? v.trim() : null)),
});

export const manualAttendanceSchema = z.object({
  member_id: z.string().min(1, 'Member wajib dipilih'),
  session_type: z
    .enum(['CHECKIN', 'CHECKOUT', 'BREAK_OUT', 'BREAK_IN'])
    .default('CHECKIN'),
  station_id: z.string().nullish(),
  reason: z.string().min(3, 'Alasan pencatatan manual wajib diisi (minimal 3 karakter)'),
});

export type ScanRequest = z.infer<typeof scanRequestSchema>;
export type ManualAttendanceInput = z.infer<typeof manualAttendanceSchema>;
