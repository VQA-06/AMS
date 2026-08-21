import { Admin, Role, Status } from '@/shared/types';

export class AdminRepository {
  constructor(private db: D1Database) {}

  async findByEmail(email: string): Promise<Admin | null> {
    const res = await this.db
      .prepare(
        `SELECT a.*, m.external_id as member_external_id, m.division as member_division
         FROM admins a
         LEFT JOIN members m ON a.member_id = m.id
         WHERE a.email = ? LIMIT 1`
      )
      .bind(email.toLowerCase().trim())
      .first<Admin>();
    return res ?? null;
  }

  async findById(id: string): Promise<Admin | null> {
    const res = await this.db
      .prepare(
        `SELECT a.*, m.external_id as member_external_id, m.division as member_division
         FROM admins a
         LEFT JOIN members m ON a.member_id = m.id
         WHERE a.id = ? LIMIT 1`
      )
      .bind(id)
      .first<Admin>();
    return res ?? null;
  }

  async findByMemberId(memberId: string): Promise<Admin | null> {
    const res = await this.db
      .prepare(
        `SELECT a.*, m.external_id as member_external_id, m.division as member_division
         FROM admins a
         LEFT JOIN members m ON a.member_id = m.id
         WHERE a.member_id = ? LIMIT 1`
      )
      .bind(memberId)
      .first<Admin>();
    return res ?? null;
  }

  async list(): Promise<Admin[]> {
    const res = await this.db
      .prepare(
        `SELECT a.id, a.member_id, a.email, a.name, a.role, a.status, a.created_at, a.updated_at,
                m.external_id as member_external_id, m.division as member_division
         FROM admins a
         LEFT JOIN members m ON a.member_id = m.id
         ORDER BY a.created_at DESC`
      )
      .all<Admin>();
    return res.results ?? [];
  }

  async count(): Promise<number> {
    const res = await this.db
      .prepare('SELECT COUNT(*) as count FROM admins')
      .first<{ count: number }>();
    return res?.count ?? 0;
  }

  async create(admin: {
    id?: string;
    member_id?: string | null;
    email: string;
    name: string;
    role: Role;
    status?: Status;
    password_hash?: string;
  }): Promise<Admin> {
    const id = admin.id || `adm_${crypto.randomUUID().replace(/-/g, '').slice(0, 16)}`;
    const status = admin.status || 'active';
    const passwordHash = admin.password_hash || null;
    const memberId = admin.member_id || null;

    await this.db
      .prepare(
        `INSERT INTO admins (id, member_id, email, name, role, status, password_hash, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))`
      )
      .bind(id, memberId, admin.email.toLowerCase().trim(), admin.name.trim(), admin.role, status, passwordHash)
      .run();

    const created = await this.findById(id);
    if (!created) throw new Error('Failed to create admin');
    return created;
  }

  async update(
    id: string,
    data: Partial<{
      name: string;
      email: string;
      role: Role;
      status: Status;
      password_hash: string;
    }>
  ): Promise<Admin | null> {
    const fields: string[] = [];
    const values: (string | number)[] = [];

    if (data.name !== undefined) {
      fields.push('name = ?');
      values.push(data.name.trim());
    }
    if (data.email !== undefined) {
      fields.push('email = ?');
      values.push(data.email.toLowerCase().trim());
    }
    if (data.role !== undefined) {
      fields.push('role = ?');
      values.push(data.role);
    }
    if (data.status !== undefined) {
      fields.push('status = ?');
      values.push(data.status);
    }
    if (data.password_hash !== undefined) {
      fields.push('password_hash = ?');
      values.push(data.password_hash);
    }

    if (fields.length === 0) return this.findById(id);

    fields.push("updated_at = datetime('now')");
    values.push(id);

    await this.db
      .prepare(`UPDATE admins SET ${fields.join(', ')} WHERE id = ?`)
      .bind(...values)
      .run();

    return this.findById(id);
  }

  async delete(id: string): Promise<boolean> {
    await this.db.batch([
      this.db.prepare('UPDATE audit_logs SET admin_id = NULL WHERE admin_id = ?').bind(id),
      this.db.prepare('UPDATE attendances SET operator_id = NULL WHERE operator_id = ?').bind(id),
      this.db.prepare('UPDATE scan_attempts SET operator_id = NULL WHERE operator_id = ?').bind(id),
      this.db.prepare('UPDATE qr_tokens SET created_by = NULL WHERE created_by = ?').bind(id),
      this.db.prepare('UPDATE import_jobs SET created_by = NULL WHERE created_by = ?').bind(id),
      this.db.prepare('DELETE FROM admins WHERE id = ?').bind(id),
    ]);
    return true;
  }

  async deactivateByMemberId(memberId: string): Promise<boolean> {
    const res = await this.db
      .prepare("UPDATE admins SET status = 'inactive', updated_at = datetime('now') WHERE member_id = ?")
      .bind(memberId)
      .run();
    return res.success;
  }

  async deleteByMemberId(memberId: string): Promise<boolean> {
    const admin = await this.findByMemberId(memberId);
    if (!admin) return false;
    return this.delete(admin.id);
  }
}
