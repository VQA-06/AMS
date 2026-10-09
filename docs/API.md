# AMS REST API Specification

Dokumentasi lengkap antarmuka pemrograman aplikasi (**REST API**) untuk Sistem Manajemen Presensi Terpadu (**AMS**).

---

## 1. Konvensi Global & Standar Komunikasi

### Base URL
```
Production: https://ams.ccunbaja.web.id/api
Development: http://localhost:5173/api (Vite) atau http://127.0.0.1:8787/api (Wrangler)
```

### Global Request Headers

| Header | Wajib | Keterangan |
|---|---|---|
| `Content-Type` | Ya (untuk `POST`/`PUT`/`PATCH`) | Wajib bernilai `application/json; charset=utf-8` |
| `Authorization` | Opsional | Format `Bearer <session_token>` (jika tidak menggunakan HTTP-only cookie) |
| `X-CSRF-Token` | Ya (pada browser) | Diperlukan pada operasi mutasi saat menggunakan session cookie |

### Format Respon Standar (Envelope)

Semua *endpoint* mengembalikan struktur JSON konsisten berdasar tipe `ApiResponse<T>`:

**Respon Sukses (2xx):**
```json
{
  "ok": true,
  "data": { ... }
}
```

**Respon Gagal (4xx / 5xx):**
```json
{
  "ok": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Deskripsi kesalahan yang manusiawi dan aman.",
    "details": { ... }
  }
}
```

### Matriks Hak Akses (Role-Based Access Control)

| Role | Deskripsi | Izin Utama |
|---|---|---|
| `owner` | Pemilik & Super Admin Utama | Akses penuh sistem, manajemen akun tim, penghapusan permanen data |
| `admin` | Administrator Panitia | Manajemen data anggota, kegiatan, QR token, dan konversi tamu |
| `operator` | Petugas Lapangan / Operator Scanner | Memindai QR presensi, merekam absensi manual, melihat daftar hadir |
| `auditor` | Pengawas Independen / Pimpinan | Melihat audit log (email tersensor), ekspor rekapitulasi data |

---

## 2. Modul Autentikasi & Manajemen Tim (`/api/auth`)

### 2.1. Get Current Session Profile
Mendapatkan data admin yang sedang masuk dari *session token*.

- **Metode**: `GET /api/auth/me`
- **Autentikasi**: Wajib (Semua Peran)
- **Respon Sukses (200 OK)**:
```json
{
  "ok": true,
  "data": {
    "admin": {
      "id": "adm_01hqz8x...",
      "email": "ketua@ams.ccunbaja.web.id",
      "name": "Budi Santoso",
      "role": "owner",
      "status": "active"
    }
  }
}
```

### 2.2. Password Authentication Login
Masuk menggunakan kredensial email/external_id dan kata sandi dengan perlindungan *rate limiting*.

- **Metode**: `POST /api/auth/login`
- **Autentikasi**: Publik (Rate Limited: Max 10 attempts / 15 mins)
- **Request Body**:
```json
{
  "email": "ketua@ams.ccunbaja.web.id",
  "password": "SuperSecretPassword123!"
}
```
- **Respon Sukses (200 OK)**:
```json
{
  "ok": true,
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6...",
    "admin": {
      "id": "adm_01hqz8x...",
      "name": "Budi Santoso",
      "role": "owner"
    }
  }
}
```

### 2.3. Universal QR Fast Login
Masuk instan menggunakan *scan* Universal Pass QR khusus untuk anggota yang memiliki tautan akun tim.

- **Metode**: `POST /api/auth/login-qr`
- **Autentikasi**: Publik (Rate Limited: Max 10 attempts / 15 mins)
- **Request Body**:
```json
{
  "qr_token": "eyBhbGciOiAiZGlyIiwgImVuYyI6ICJBMjU2R0NNI..."
}
```

### 2.4. Update Profile
Memperbarui nama, email, atau kata sandi admin yang sedang aktif.

- **Metode**: `PATCH /api/auth/profile`
- **Autentikasi**: Wajib (Semua Peran)
- **Request Body**:
```json
{
  "name": "Budi Santoso, S.Kom",
  "email": "budi.santoso@ccunbaja.web.id",
  "current_password": "OldPassword123!",
  "new_password": "NewStrongPassword456!"
}
```

### 2.5. Logout Session
Mencabut *session token* dan membersihkan *cookie*.

- **Metode**: `POST /api/auth/logout`
- **Autentikasi**: Opsional / Wajib
- **Respon Sukses (200 OK)**:
```json
{
  "ok": true,
  "data": { "message": "Berhasil keluar sistem." }
}
```

### 2.6. List Team Admins
- **Metode**: `GET /api/auth/admins`
- **Autentikasi**: `owner`, `admin`

### 2.7. Create Team Admin from Member
- **Metode**: `POST /api/auth/admins`
- **Autentikasi**: `owner`
- **Request Body**:
```json
{
  "member_id": "mem_01hqz8x...",
  "role": "admin",
  "password": "InitialSecurePassword123!"
}
```

### 2.8. Update Admin Status or Role
- **Metode**: `PATCH /api/auth/admins/:id`
- **Autentikasi**: `owner`
- **Request Body**:
```json
{
  "role": "operator",
  "status": "inactive"
}
```

### 2.9. Delete Team Admin
- **Metode**: `DELETE /api/auth/admins/:id`
- **Autentikasi**: `owner` (Dilindungi: Default owner & self-delete dilarang)

### 2.10. Bulk Delete Team Admins
- **Metode**: `POST /api/auth/admins/bulk-delete`
- **Autentikasi**: `owner`
- **Request Body**:
```json
{
  "ids": ["adm_01...", "adm_02..."]
}
```

---

## 3. Modul Anggota & Siklus Calon Anggota (`/api/members`)

### 3.1. List Members
- **Metode**: `GET /api/members`
- **Autentikasi**: Wajib (Semua Peran)
- **Query Params**: `search`, `group_name`, `division`, `status` (`active`, `candidate`, `archived`, `all`), `page` (default 1), `limit` (default 25/50).

### 3.2. Summary Statistics
- **Metode**: `GET /api/members/stats/summary`
- **Autentikasi**: Wajib (Edge Cached: 15 detik)
- **Respon Sukses (200 OK)**:
```json
{
  "ok": true,
  "data": {
    "totalMembers": 150,
    "activeMembers": 120,
    "candidateMembers": 25,
    "archivedMembers": 5,
    "totalDivisions": 4,
    "totalGroups": 6
  }
}
```

### 3.3. Yearly Recap Analytics
- **Metode**: `GET /api/members/stats/yearly-recap` (Alias: `/reports/yearly`, `/analytics/yearly-stats`)
- **Autentikasi**: Wajib (Edge Cached: 60 detik)

### 3.4. Generate & Download Universal QR Tokens
- **Metode**: `GET /api/members/universal-tokens`
- **Autentikasi**: `owner`, `admin`

### 3.5. Single Member Universal Pass
- **Metode**: `GET /api/members/:id/universal-qr`
- **Autentikasi**: `owner`, `admin`, atau pemilik akun sendiri.

### 3.6. Create Member
- **Metode**: `POST /api/members`
- **Autentikasi**: `owner`, `admin`
- **Request Body**:
```json
{
  "external_id": "CC2024001",
  "name": "Ahmad Fauzi",
  "email": "ahmad@example.com",
  "phone": "081234567890",
  "group_name": "Angkatan 2024",
  "division": "Divisi Pemrograman",
  "status": "active",
  "metadata": {}
}
```

### 3.7. Candidate Lifecycle: Induct Candidates
Melantik calon anggota menjadi anggota aktif resmi dan secara opsional mengarsipkan kandidat yang tersisa.

- **Metode**: `POST /api/members/candidates/induct`
- **Autentikasi**: `owner`, `admin`
- **Request Body**:
```json
{
  "member_ids": ["mem_01...", "mem_02..."],
  "archive_remaining": true,
  "batch_group": "Batch Rekrutmen 2024",
  "division": "Divisi Jaringan"
}
```

### 3.8. Candidate Lifecycle: Archive Candidates
- **Metode**: `POST /api/members/candidates/archive`
- **Autentikasi**: `owner`, `admin`
- **Request Body**:
```json
{
  "member_ids": ["mem_01..."],
  "batch_group": "Batch Rekrutmen 2024"
}
```

### 3.9. Candidate Lifecycle: Restore Archived
- **Metode**: `POST /api/members/candidates/restore`
- **Autentikasi**: `owner`, `admin`

### 3.10. Candidate Lifecycle: Purge Archived
- **Metode**: `POST /api/members/candidates/purge`
- **Autentikasi**: `owner`, `admin`
- **Request Body**:
```json
{
  "member_ids": ["mem_01..."],
  "all_archived": false
}
```

### 3.11. Convert Guests to Candidates
Mengonversi tamu kegiatan menjadi calon anggota berstatus `candidate`.

- **Metode**: `POST /api/members/candidates/convert-from-guests`
- **Autentikasi**: `owner`, `admin`
- **Request Body**:
```json
{
  "guest_member_ids": ["mem_guest_01...", "mem_guest_02..."],
  "target_group": "Calon Anggota 2025",
  "target_division": "Divisi Humas"
}
```

### 3.12. Import & Export CSV
- **Import**: `POST /api/members/import` (Body: `{ rows: [...], mode: "merge" | "skip" | "replace" }`)
- **Export**: `GET /api/members/export?format=csv` (Formula Sanitized CSV)

---

## 4. Modul Kegiatan & Tamu Undangan (`/api/events`)

*Catatan: Modul ini memiliki alias kebal pemblokir iklan: `/api/agenda`, `/api/programs`, `/api/activities`.*

### 4.1. List Events
- **Metode**: `GET /api/events`
- **Autentikasi**: Wajib (Edge Cached: 15 detik)
- **Query Params**: `status` (`all`, `active`, `upcoming`, `closed`), `search`, `limit`, `page`.

### 4.2. Create Event
- **Metode**: `POST /api/events`
- **Autentikasi**: `owner`, `admin`
- **Request Body**:
```json
{
  "name": "Seminar Nasional AI & Cloud Computing",
  "description": "Seminar teknologi terbuka untuk mahasiswa.",
  "location_name": "Auditorium Lantai 3",
  "starts_at": "2025-04-10T09:00:00Z",
  "ends_at": "2025-04-10T16:00:00Z",
  "grace_minutes": 30,
  "qr_policy": "universal_allowed",
  "session_modes": ["CHECKIN", "CHECKOUT"],
  "allow_manual_attendance": true
}
```

### 4.3. Update & Activate/Close Event
- `PATCH /api/events/:id`: Perbarui metadata kegiatan
- `POST /api/events/:id/activate`: Aktifkan status kegiatan
- `POST /api/events/:id/close`: Tutup kegiatan dan kunci presensi
- `DELETE /api/events/:id`: Hapus kegiatan beserta data presensi & token terkait.

### 4.4. Issue Multi-Guest Passes
Menerbitkan tiket QR tamu sekaligus untuk satu kegiatan.

- **Metode**: `POST /api/events/:id/guests`
- **Autentikasi**: `owner`, `admin`
- **Request Body**:
```json
{
  "guests": [
    { "name": "Prof. Dr. Irwan", "division": "Narasumber" },
    { "name": "Dewi Sartika", "division": "Tamu VIP" }
  ],
  "expires_at": "2025-04-10T23:59:59Z"
}
```

### 4.5. Multi-Event Guest Pass Reuse (Import Guests)
Menggunakan kembali tiket tamu dari kegiatan sebelumnya tanpa membuat QR baru.

- **Metode**: `POST /api/events/:id/guests/import`
- **Autentikasi**: `owner`, `admin`
- **Request Body**:
```json
{
  "source_event_id": "evt_prior_01...",
  "guest_member_ids": ["mem_guest_01...", "mem_guest_02..."]
}
```

---

## 5. Modul QR Engine (`/api/qr`)

### 5.1. Batch Token Generation
- **Metode**: `POST /api/qr/generate`
- **Autentikasi**: `owner`, `admin`
- **Request Body**:
```json
{
  "member_ids": ["mem_01...", "mem_02..."],
  "scope": "universal",
  "valid_from": "2025-01-01T00:00:00Z",
  "expires_at": "2099-12-31T23:59:59Z",
  "note": "Perpetual ID Card"
}
```

### 5.2. Revoke QR Token
Membatalkan tiket QR tertentu secara permanen.

- **Metode**: `POST /api/qr/:id/revoke`
- **Autentikasi**: `owner`, `admin`
- **Respon**: Mengembalikan konfirmasi pencabutan dan menghapus token dari memori aktif.

---

## 6. Modul Pemindai & Presensi (`/api/scan` & `/api/attendances`)

### 6.1. Record QR Scan Attendance (High Throughput)
- **Metode**: `POST /api/scan`
- **Autentikasi**: `owner`, `admin`, `operator`
- **Rate Limit**: Max 60 requests / minute
- **Request Body**:
```json
{
  "eventId": "evt_01hqz...",
  "qr": "eyBhbGciOiAiZGlyIiwgImVuYyI6ICJBMjU2R0NNI...",
  "sessionType": "CHECKIN",
  "stationId": "gate_north_01"
}
```
- **Respon Sukses (200 OK)**:
```json
{
  "ok": true,
  "data": {
    "attendance": {
      "id": "att_01...",
      "member_id": "mem_01...",
      "member_name": "Ahmad Fauzi",
      "member_external_id": "CC2024001",
      "session_type": "CHECKIN",
      "status": "valid",
      "scanned_at": "2025-04-10T09:05:12Z"
    }
  }
}
```

### 6.2. Manual Attendance Fallback
- **Metode**: `POST /api/attendances/event/:id/manual`
- **Autentikasi**: `owner`, `admin`, `operator`
- **Request Body**:
```json
{
  "member_id": "mem_01...",
  "session_type": "CHECKIN",
  "notes": "Lupa membawa kartu QR"
}
```

### 6.3. Member Activity Tracker Matrix
- **Metode**: `GET /api/attendances/recap/matrix` (Alias: `/stats/tracker`, `/activity-tracker`)
- **Autentikasi**: Wajib (Edge Cached: 5 detik)
- **Respon**: Matriks keaktifan anggota per kegiatan beserta persentase kehadiran dan label keaktifan (*Tier*: `Sangat Aktif`, `Aktif`, `Kurang Aktif`, `Tidak Aktif`).

---

## 7. Modul Jejak Audit & Keamanan (`/api/audit`)

### 7.1. List System Audit Logs
- **Metode**: `GET /api/audit/logs`
- **Autentikasi**: `owner`, `admin`, `auditor`
- **Ketentuan Privasi**: Untuk peran `auditor`, seluruh alamat email disamarkan secara otomatis (`bu***@ccunbaja.web.id`).

### 7.2. List Recent Scan Attempts
- **Metode**: `GET /api/audit/scans?event_id=evt_01...`
- **Autentikasi**: Wajib (Semua Peran)
- **Respon**: Mengembalikan 20 riwayat pemindaian terakhir (berhasil maupun ditolak).
