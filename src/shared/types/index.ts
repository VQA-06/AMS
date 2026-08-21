export type Role = 'owner' | 'admin' | 'operator' | 'auditor';
export type Status = 'active' | 'inactive';
export type EventStatus = 'draft' | 'active' | 'closed' | 'archived';
export type QrPolicy = 'event_only' | 'universal_allowed';
export type QrScope = 'universal' | 'event';
export type SessionType = 'CHECKIN' | 'CHECKOUT' | 'BREAK_OUT' | 'BREAK_IN';
export type ScanResult = 'success' | 'failed';

export interface Admin {
  id: string;
  member_id?: string | null;
  email: string;
  name: string;
  role: Role;
  status: Status;
  password_hash?: string;
  created_at: string;
  updated_at: string;
  member_external_id?: string | null;
  member_division?: string | null;
}

export interface Member {
  id: string;
  external_id: string;
  name: string;
  email: string | null;
  phone: string | null;
  group_name: string | null;
  division: string | null; // Kolom divisi opsional
  status: Status;
  metadata: Record<string, unknown> | string;
  created_at: string;
  updated_at: string;
}

export interface Event {
  id: string;
  name: string;
  description: string | null;
  location_name: string | null;
  starts_at: string | null;
  ends_at: string | null;
  qr_policy: QrPolicy;
  status: EventStatus;
  session_modes: SessionType[] | string;
  allow_manual_attendance: number | boolean;
  grace_minutes: number;
  created_at: string;
  updated_at: string;
  // Aggregated analytics fields
  attendance_count?: number;
  checkin_count?: number;
  checkout_count?: number;
  guest_count?: number;
  member_count?: number;
}

export interface QrToken {
  id: string;
  jti: string;
  member_id: string;
  event_id: string | null;
  scope: QrScope;
  valid_from: string;
  expires_at: string;
  max_uses: number | null;
  uses_count: number;
  revoked_at: string | null;
  created_by: string | null;
  note: string | null;
  created_at: string;
  qr_token?: string | null;
  // Joined fields for display
  member_name?: string;
  member_external_id?: string;
  member_division?: string | null;
  event_name?: string | null;
}

export interface Attendance {
  id: string;
  event_id: string;
  member_id: string;
  qr_token_id: string;
  session_type: SessionType;
  scanned_at: string;
  station_id: string | null;
  operator_id: string | null;
  is_manual: number | boolean;
  meta: Record<string, unknown> | string;
  // Joined fields
  member_name?: string;
  member_external_id?: string;
  member_division?: string | null;
  member_group?: string | null;
  event_name?: string;
  operator_name?: string;
}

export interface ScanAttempt {
  id: string;
  event_id: string | null;
  token_jti: string | null;
  member_id: string | null;
  result: ScanResult;
  reason: string | null;
  station_id: string | null;
  operator_id: string | null;
  created_at: string;
}

export interface ImportJob {
  id: string;
  entity: string;
  format: 'csv' | 'json';
  file_name: string | null;
  r2_key: string | null;
  mode: 'create' | 'update' | 'upsert';
  status: 'pending' | 'processing' | 'completed' | 'failed';
  stats: Record<string, number> | string;
  error_report_key: string | null;
  created_by: string | null;
  created_at: string;
  finished_at: string | null;
}

export interface AuditLog {
  id: string;
  admin_id: string | null;
  action: string;
  entity_type: string | null;
  entity_id: string | null;
  meta: Record<string, unknown> | string;
  created_at: string;
  admin_name?: string;
  admin_email?: string;
}

export type ActivityTier = 'highly_active' | 'active' | 'inactive';

export interface MemberActivityEntry {
  member_id: string;
  member_name: string;
  member_external_id: string;
  member_division: string | null;
  member_group: string | null;
  status: Status;
  total_events_attended: number;
  total_checkins: number;
  attendance_rate: number; // Persentase kehadiran (%)
  activity_tier: ActivityTier; // 'highly_active' | 'active' | 'inactive'
  last_attended_at: string | null;
}

export interface MemberActivitySummary {
  total_members: number;
  total_events: number;
  highly_active_count: number;
  active_count: number;
  inactive_count: number;
  average_attendance_rate: number;
}

export interface ApiResponse<T = unknown> {
  ok: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: unknown;
  };
}
