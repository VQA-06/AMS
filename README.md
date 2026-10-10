# AMS — Attendance Management System

<div align="center">

![TypeScript](https://img.shields.io/badge/TypeScript-5.6-blue?style=for-the-badge&logo=typescript)
![Cloudflare Workers](https://img.shields.io/badge/Cloudflare-Workers-F38020?style=for-the-badge&logo=cloudflare)
![Cloudflare D1](https://img.shields.io/badge/Cloudflare-D1_SQLite-F38020?style=for-the-badge&logo=sqlite)
![Cloudflare KV](https://img.shields.io/badge/Cloudflare-KV_Storage-F38020?style=for-the-badge&logo=cloudflare)
![React](https://img.shields.io/badge/React-18-61DAFB?style=for-the-badge&logo=react)
![TailwindCSS](https://img.shields.io/badge/Tailwind_CSS-3.4-38B2AC?style=for-the-badge&logo=tailwind-css)
![PWA Ready](https://img.shields.io/badge/PWA-Ready-10B981?style=for-the-badge&logo=pwa)
![Vitest](https://img.shields.io/badge/Vitest-2.1_(333/333_Pass)-6E9F18?style=for-the-badge&logo=vitest)

**Sistem Manajemen Presensi, Kegiatan & Siklus Keanggotaan Berbasis QR Code Terenkripsi AES-256-GCM JWE untuk Komunitas Komputer (Computer Community).**

[Fitur Utama](#fitur-utama) • [Indeks Dokumentasi](#indeks-dokumentasi-sistem) • [Arsitektur Sistem](#arsitektur-sistem) • [Skema Database & Migrasi](#skema-database--migrasi-0001-0009) • [Instalasi Lokal](#panduan-instalasi-lokal) • [Deployment Cloudflare](#panduan-deployment-ke-cloudflare) • [Pengujian](#pengujian-otomatis)

</div>

---

## Tentang AMS

**AMS (Attendance Management System)** adalah platform pencatatan dan pengelolaan presensi berskala *enterprise* yang dirancang khusus untuk kegiatan, seminar, *workshop*, dan siklus hidup keanggotaan organisasi. Dibangun di atas infrastruktur serverless **Cloudflare Workers**, database relasional **Cloudflare D1 (SQLite)**, dan **Cloudflare KV**, AMS memberikan kecepatan respon instan (*edge computing* sub-10ms), efisiensi biaya tinggi (*Zero Cold Start*), kemampuan instalasi mandiri (*Progressive Web App*), serta keamanan kriptografis standar industri.

---

## Indeks Dokumentasi Sistem

Dokumentasi AMS disusun secara modular dalam direktori `docs/` untuk memfasilitasi pemahaman mendalam bagi arsitek, pengembang, penguji keamanan, dan operator:

| Dokumen | Deskripsi Teknis | Tautan |
|---|---|---|
| 📐 **Arsitektur Sistem** | Topologi edge compute, siklus request Hono middleware, subsistem kriptografi JWE/PBKDF2, dan alur pemindai. | [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) |
| 🔌 **Spesifikasi REST API** | Referensi lengkap seluruh *endpoint* REST API, validasi skema Zod, hak akses RBAC, dan format respon JSON. | [`docs/API.md`](docs/API.md) |
| 🗄️ **Database & Migrasi** | Pemodelan skema relasional D1 SQLite, indeks komposit, batasan chunking, dan riwayat migrasi 0001-0009. | [`docs/DATABASE.md`](docs/DATABASE.md) |
| 🛡️ **Keamanan & Pentest** | Model ancaman, pemetaan OWASP Top 10 / CWE, dan matriks resolusi 17 temuan pentest Strix (vuln-0001 - vuln-0017). | [`docs/SECURITY.md`](docs/SECURITY.md) |
| 🚀 **Operations Runbook** | Panduan provisioning, manajemen secret, rotasi kunci zero-downtime, dan penanganan insiden produksi. | [`docs/OPERATIONS.md`](docs/OPERATIONS.md) |
| 🎨 **Design System Authority** | Standar visual UI, dua ground (Paper vs Dark Chrome), ramp sinyal 50..950, dan aturan anti-slop. | [`DESIGN.md`](DESIGN.md) |

---

## Fitur Utama

- 🎫 **Digital Pass QR Terenkripsi (JWE AES-256-GCM)**: Mencegah pemalsuan identitas anggota dan tiket tamu dengan format enkripsi standar RFC 7516.
- ⚡ **Pemindai Presensi Berkecepatan Tinggi**: Integrasi kamera perangkat dengan Web Workers (`jsQR`), audio umpan balik osilator harmonik (*Web Audio API*), dan haptic vibration.
- 👥 **Candidate Member Lifecycle & Sweeping**: Alur perekrutan calon anggota terpadu: konversi tamu kegiatan (`convert-from-guests`), pelantikan anggota aktif resmi (`induct`), pengarsipan kandidat tersisa (`archive`), pemulihan (`restore`), dan pembersihan permanen (`purge`).
- 🎟️ **Multi-Event Guest Passes**: Penerbitan tiket tamu massal dan penggunaan ulang tiket tamu lintas kegiatan tanpa harus mencetak ulang kode QR baru.
- 📊 **Pelaporan & Analitik Keaktifan Real-Time**: Matriks keaktifan anggota per kegiatan (*Activity Tracker*), statistik tahunan (*Yearly Recap*), dan ekspor CSV aman dari *formula injection*.
- 🛡️ **Pertahanan Keamanan Berlapis**: Dual-key sliding window rate limiting (IP + Akun), proteksi CSRF ketat, mitigasi *Timing Attacks*, dan enkripsi kata sandi PBKDF2 100.000 iterasi.
- 📱 **PWA Mobile Touch Target 44px**: Antarmuka responsif dengan batas target sentuh minimum 44px, tipografi ramah sentuhan, dan navigasi ergonomis.

---

## Arsitektur Sistem

```mermaid
flowchart TB
    subgraph Client ["Client Device (React 18 PWA)"]
        UI["Dual-Ground UI (Paper vs Dark Chrome)"]
        Scanner["Camera Loop + jsQR Engine"]
        SW["Service Worker (Offline Fallback)"]
    end

    subgraph Edge ["Cloudflare Global Edge Network"]
        Worker["Cloudflare Worker (Hono Server)"]
        SecHeaders["Security Headers & Anti-CSRF"]
        RateLimit["Dual-Key Rate Limiter"]
        JWEAuth["JWE / PBKDF2 Crypto Subsystem"]
        EdgeCache["Cloudflare Edge Cache API"]
    end

    subgraph Storage ["Serverless Storage Tier"]
        KV["Cloudflare KV (Session & Token Revocation)"]
        D1[("Cloudflare D1 (SQLite Transactional Database)")]
    end

    Client <-->|HTTPS REST API| Worker
    Worker --> SecHeaders --> RateLimit --> JWEAuth
    Worker <-->|Tag-based Cache & Invalidation| EdgeCache
    Worker <-->|Token Blacklist & Sliding Counters| KV
    Worker <-->|Prepared Statements (Chunk <= 50)| D1
```

---

## Skema Database & Migrasi (0001 - 0009)

Database relasional dikelola melalui migrasi terstruktur pada `src/db/migrations/`:

| Versi | File Migrasi | Deskripsi & Dampak Skema |
|---|---|---|
| **0001** | `0001_initial_schema.sql` | Skema dasar: tabel `admins`, `members`, `events`, `qr_tokens`, `attendances`, `scan_attempts`, `import_jobs`, `audit_logs`. |
| **0002** | `0002_add_admin_password.sql` | Penambahan kolom `password_hash` pada `admins` untuk otentikasi kata sandi lokal. |
| **0003** | `0003_seed_default_owner.sql` | Seeding akun Master Owner (`adm_owner_default`) untuk instalasi awal. |
| **0004** | `0004_add_admin_member_id.sql` | Penambahan kolom `member_id` pada `admins` untuk integrasi kartu identitas. |
| **0005** | `0005_relational_integrity_and_indexes.sql` | Penegakan *foreign key cascade* dan indeks integritas relasional. |
| **0006** | `0006_relational_integrity_and_indexes.sql` | Indeks performa kueri untuk pemindaian massal dan rekapitulasi data. |
| **0007** | `0007_event_guests_multi_event.sql` | Tabel `event_guests` untuk otorisasi tamu lintas kegiatan (*Multi-Event Guest Passes*). |
| **0008** | `0008_candidate_lifecycle_and_status.sql` | Pengenalan status kandidat (`candidate`, `archived`) dan indeks komposit. |
| **0009** | `0009_expand_member_status_check_constraint.sql` | Rebuild tabel `members` untuk memperluas `CHECK (status IN ('active', 'inactive', 'candidate', 'archived'))`. |

---

## Panduan Instalasi Lokal

### 1. Klon Repositori & Instal Dependensi
```bash
git clone https://github.com/vqa/AMS.git
cd AMS
npm install
```

### 2. Konfigurasi Environment Lokal
Duplikasi file konfigurasi variabel lokal:
```bash
cp .dev.vars.example .dev.vars
```

### 3. Terapkan Migrasi Database Lokal
```bash
npm run db:migrate:local
```

### 4. Jalankan Server Pengembangan
```bash
# Menjalankan server Vite Client & Worker API
npm run dev
```
Akses aplikasi melalui peramban pada `http://localhost:5173`. Akun bawaan Master Owner aktif secara otomatis.

---

## Panduan Deployment ke Cloudflare

### 1. Provisioning Resources
```bash
# Buat database D1
npx wrangler d1 create ams-db

# Buat KV Namespace
npx wrangler kv:namespace create ams-kv
```

### 2. Konfigurasi Secret Produksi
```bash
npx wrangler secret put SESSION_SECRET
npx wrangler secret put QR_KEY_K1
```

### 3. Terapkan Migrasi & Deploy
```bash
# Terapkan skema database D1 di Cloudflare
npx wrangler d1 migrations apply ams-db --remote

# Build frontend PWA
npm run build

# Deploy Worker & Static Assets
npx wrangler deploy
```

---

## Pengujian Otomatis

Proyek dilengkapi dengan pengujian menyeluruh menggunakan Vitest yang memvalidasi integritas kriptografi, keamanan otentikasi, kepatuhan kontras warna, responsivitas target sentuh, dan alur kerja bisnis:

```bash
# Menjalankan seluruh test suite (41 test files, 333 passed)
npx vitest run

# Menjalankan typecheck TypeScript
npx tsc --noEmit -p tsconfig.json

# Menjalankan security regression suite
npx vitest run tests/strix-pentest-remediation.test.ts
```

---

## Lisensi & Kontribusi

Dikembangkan dan dikelola untuk **Computer Community UNBAJA**. Hak Cipta dilindungi Undang-Undang.
