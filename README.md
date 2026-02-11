# 🎓 Sistem Informasi Logbook PKL (Praktik Kerja Lapangan)

![Google Apps Script](https://img.shields.io/badge/Built%20with-Google%20Apps%20Script-4285F4?style=for-the-badge&logo=google-drive&logoColor=white)
![Bootstrap](https://img.shields.io/badge/Frontend-Bootstrap%205-7952B3?style=for-the-badge&logo=bootstrap&logoColor=white)
![Status](https://img.shields.io/badge/Status-Production%20Ready-success?style=for-the-badge)
![License](https://img.shields.io/badge/License-MIT-green?style=for-the-badge)

Sistem Informasi Manajemen Logbook PKL berbasis Web yang dibangun sepenuhnya menggunakan ekosistem **Google Workspace** (Google Sheets, Drive, & Apps Script). Aplikasi ini dirancang untuk memudahkan siswa mencatat kegiatan harian, guru memantau perkembangan, dan admin mengelola data pengguna secara terpusat tanpa memerlukan hosting berbayar (Serverless).

---

## 📸 Screenshots

| Halaman Login | Dashboard Siswa | Dashboard Guru |
|:---:|:---:|:---:|
| ![Login Screen](https://via.placeholder.com/300x160?text=Login+Page) | ![Siswa Screen](https://via.placeholder.com/300x160?text=Dashboard+Siswa) | ![Guru Screen](https://via.placeholder.com/300x160?text=Dashboard+Guru) |

*(Catatan: Ganti link gambar di atas dengan screenshot asli aplikasi Anda setelah diupload)*

---

## ✨ Fitur Utama

Sistem ini memiliki 4 Hak Akses (Role) berbeda dengan fitur spesifik:

### 👨‍🎓 1. Siswa (Student)
* **Logbook Harian:** Input jurnal kegiatan harian, jam kerja, dan deskripsi detail.
* **Upload Bukti:** Upload foto dokumentasi kegiatan langsung tersimpan ke Google Drive.
* **Riwayat & Feedback:** Melihat riwayat logbook dan membaca catatan/koreksi dari guru pembimbing.
* **Export PDF:** Fitur cetak rekap jurnal otomatis ke PDF dengan kop surat dan tanda tangan.
* **Profil:** Edit biodata, password, dan foto profil.

### 👩‍🏫 2. Guru Pembimbing (Teacher)
* **Monitoring Siswa:** Melihat daftar siswa bimbingan (dengan filter tahun angkatan).
* **Review Jurnal:** Memeriksa detail jurnal siswa (foto & deskripsi).
* **Feedback System:** Memberikan nilai atau catatan perbaikan pada logbook siswa.

### 🛠 3. Administrator (Admin)
* **Dashboard Statistik:** Grafik ringkas total siswa, guru, dan logbook yang masuk.
* **Manajemen User (CRUD):** Tambah, Edit, Hapus data Siswa dan Guru.
* **Auto-Sync:** Sinkronisasi otomatis antara data User dan data Guru Pembimbing.
* **Monitoring Global:** Tabel pantauan real-time seluruh aktivitas logbook.

### 👷‍♂️ 4. Pembimbing Lapangan (Supervisor)
* **Akses Tanpa Login:** Menggunakan Token Akses khusus (`SUPERVISOR_ACCESS`).
* **Public Feed:** Melihat linimasa aktivitas terbaru dari seluruh siswa PKL.
* **Pencarian Cepat:** Mencari riwayat siswa berdasarkan Nama atau NISN.

---

## 🚀 Teknologi yang Digunakan

* **Backend:** Google Apps Script (Serverless Node.js-like environment).
* **Database:** Google Sheets (Spreadsheet sebagai database relasional sederhana).
* **File Storage:** Google Drive (Menyimpan foto logbook & foto profil).
* **Frontend:** HTML5, CSS3, JavaScript (Vanilla).
* **Framework UI:** Bootstrap 5 (Responsive Mobile-First).
* **Libraries:** SweetAlert2 (Popups), Animate.css (Animasi UI).

---

## 📂 Struktur File

Struktur file dalam repositori ini:

```text
├── 📄 Code.js              # Main Controller, Routing (doGet), & Setup Database
├── 📄 AuthService.js       # Logika Login, Validasi Token, & Register
├── 📄 AdminService.js      # Logika Dashboard Admin (CRUD User, Stats)
├── 📄 StudentService.js    # Logika Dashboard Siswa (Logbook, Export PDF)
├── 📄 TeacherService.js    # Logika Dashboard Guru (Feedback, Monitoring)
├── 📄 SupervisorService.js # Logika Dashboard Pembimbing (Feed, Search)
├── 📄 Utils.js             # Helper Functions (Format Tanggal, UUID)
├── 📄 index.html           # Loading Screen & Router Frontend
├── 📄 login.html           # Halaman Login Utama
├── 📄 admin.html           # UI Panel Admin
├── 📄 student_dashboard.html # UI Dashboard Siswa
├── 📄 teacher_dashboard.html # UI Dashboard Guru
├── 📄 supervisor_dashboard.html # UI Dashboard Pembimbing
└── 📄 README.md            # Dokumentasi Proyek ini

```

---

## ⚙️ Panduan Instalasi & Deploy

Karena proyek ini berbasis Google Apps Script, Anda tidak memerlukan hosting (Vercel/Netlify). Ikuti langkah ini:

### 1. Persiapan Google Sheet

1. Buat **Google Sheet** baru di Google Drive Anda.
2. Beri nama (misal: `DB_Logbook_PKL`).
3. Di menu atas, klik **Ekstensi** > **Apps Script**.

### 2. Salin Kode

1. Salin semua file dari repositori ini ke dalam editor Apps Script.
* **PENTING:** File berekstensi `.js` di repo ini, ubah ekstensinya menjadi `.gs` saat membuat file di editor Apps Script (Contoh: `Code.js` menjadi `Code.gs`).
* File `.html` tetap `.html`.



### 3. Konfigurasi Google Drive (PENTING!)

1. Buat **Folder Baru** di Google Drive Anda (untuk menampung upload foto).
2. Buka folder tersebut, salin **ID Folder** dari URL browser (bagian acak di akhir URL).
3. Buka file `StudentService.gs` di editor Apps Script.
4. Cari variabel `folderId` dan tempel ID folder Anda:

```javascript
// StudentService.gs
// Ganti dengan ID Folder Drive Anda yang asli
const folderId = "1xXx_ID_FOLDER_DRIVE_ANDA_xXx";

```

### 4. Setup Database Otomatis

1. Di editor Apps Script, pastikan Anda berada di file `Code.gs`.
2. Pilih fungsi `setupDatabase` dari dropdown menu debug di atas.
3. Klik tombol **Jalankan (Run)**.
4. Berikan izin akses (Review Permissions -> Pilih Akun -> Advanced -> Go to Project (Unsafe) -> Allow).
5. Cek Google Sheet Anda. Sheet `users`, `logbooks`, `teachers`, dll akan dibuat otomatis beserta headernya.

**Akun Admin Default:**

* **Username:** `admin`
* **Password:** `admin123`

### 5. Deploy Web App

1. Klik tombol biru **Terapkan (Deploy)** di pojok kanan atas > **Deployment Baru**.
2. Klik ikon gear (jenis) > pilih **Aplikasi Web**.
3. Konfigurasi:
* **Deskripsi:** Versi 1.0
* **Eksekusi sebagai:** **Saya (Me)**
* **Yang memiliki akses:** **Siapa saja (Anyone)**


4. Klik **Terapkan (Deploy)**.
5. Salin **URL Web App** yang diberikan. Aplikasi siap digunakan!

---

## 🤝 Kontribusi

Kontribusi selalu diterima! Cara berkontribusi:

1. Fork repositori ini.
2. Buat branch fitur baru (`git checkout -b fitur-keren`).
3. Commit perubahan Anda (`git commit -m 'Menambahkan fitur keren'`).
4. Push ke branch (`git push origin fitur-keren`).
5. Buat Pull Request.

---

## 📄 Lisensi

Project ini dilisensikan di bawah [MIT License](https://www.google.com/search?q=LICENSE).

```
