<div align="center">
  <img src="https://wsrv.nl/?url=uho.ac.id/wp-content/uploads/2022/11/logo-7.png&bg=white&pad=20" alt="Logo UHO" width="500"/>
  
  <h1>🎓 Sistem Informasi Logbook PKL <br> SMKN 3 Kendari</h1>
  <p><i>Aplikasi Web Single Page Application (SPA) berbasis Google Apps Script & Google Sheets</i></p>
</div>

---

Sistem Informasi ini dirancang khusus untuk mendigitalkan proses pencatatan, pemantauan, dan rekapitulasi jurnal/kegiatan harian Praktik Kerja Lapangan (PKL) di SMKN 3 Kendari. Menggabungkan kemudahan Google Sheets sebagai *database* dengan antarmuka web modern yang responsif dan interaktif.

## 👨‍💻 Tim Pengembang (Kerja Praktik)
Proyek ini dibangun dengan penuh dedikasi oleh Tim Kerja Praktik (KP) Mahasiswa **Teknik Informatika, Universitas Halu Oleo (UHO) - 2026**:

| Nama | NIM / Stambuk | Peran / Kontribusi |
| :--- | :---: | :--- |
| **Adi Setiawan** | `E1E123023` | *Fullstack Development & Backend Logic* |
| **Indah Lestari** | `E1E123004` | *UI/UX Design & Frontend Integration* |
| **Nirmala** | `E1E123012` | *System Testing & Database Management* |

❤️

---

## ✨ Fitur Utama

### 👨‍🎓 Fitur Siswa (Student)
* **Manajemen Jurnal (CRUD):** Mengisi kegiatan harian, jam, deskripsi, dan upload foto dokumentasi secara langsung.
* **Jelajah (Timeline):** Melihat *public feed* aktivitas PKL dari teman-teman lainnya untuk referensi kegiatan.
* **Profil Mahasiswa:** Memperbarui data diri, jurusan, tahun angkatan, dan foto profil.
* **Export Laporan Otomatis:** Menghasilkan dokumen jurnal format **PDF** melalui integrasi Google Docs, lengkap dengan tabel rapi, foto, dan kolom tanda tangan siap cetak.

### 👨‍🏫 Fitur Guru Pembimbing Sekolah (Teacher)
* **Monitoring Binaan:** Melihat daftar siswa bimbingannya secara spesifik, dilengkapi fitur *Filter Tahun Angkatan*.
* **Review & ACC:** Memeriksa logbook siswa setiap hari dan memberikan tanggapan/catatan langsung (Feedback) yang akan muncul di layar siswa.

### 🏢 Fitur Pembimbing Lapangan/Industri (Supervisor)
* **Guest Access Mode:** Pihak industri dapat masuk ke sistem **tanpa perlu registrasi akun** (menggunakan *Token Access*).
* **Live Monitoring:** Memantau aktivitas seluruh anak magang di perusahaannya melalui fitur *Pencarian Siswa (NISN/Nama)* dan melihat logbook secara detail.

### 👨‍💻 Fitur Admin (Super Admin)
* **Dashboard Metrik:** Menampilkan statistik jumlah siswa, guru, dan total logbook yang telah masuk.
* **Manajemen User (CRUD):** Menambah, mengedit, atau menghapus data Siswa dan Guru. Terintegrasi dengan fitur sinkronisasi relasi guru-siswa otomatis.
* **Master Logbook Monitoring:** Tabel rekapitulasi yang memantau aliran seluruh data logbook dari semua jurusan.

---

## 🛠️ Teknologi yang Digunakan
* **Backend & Server:** Google Apps Script (GAS)
* **Database:** Google Sheets
* **Storage:** Google Drive API & Google Docs API (Export PDF)
* **Frontend:** HTML5, CSS3, Vanilla JavaScript
* **UI Framework:** Bootstrap 5.1.3 & Bootstrap Icons
* **Library Tambahan:** * [SweetAlert2](https://sweetalert2.github.io/) *(Pop-up Alerts)*
  * [Animate.css](https://animate.style/) *(UI Animations)*

---

## 📂 Struktur File Repository

| Nama File | Deskripsi |
| :--- | :--- |
| `Code.gs` | *Entry point* server, HTTP GET Loader, dan Router API utama. |
| `Utils.gs` | Helper pembuat ID unik (UUID) dan format tanggal/waktu. |
| `AuthService.gs` | Menangani Logika Login, Registrasi, dan Validasi Sesi. |
| `StudentService.gs` | Menangani CRUD Logbook Siswa, Public Feed, dan Export PDF. |
| `TeacherService.gs` | Menangani fungsi Guru (List Siswa, Input Feedback, Ganti Pass). |
| `SupervisorService.gs` | Menangani fungsi *Guest Mode* untuk pembimbing industri. |
| `AdminService.gs` | Menangani Dashboard Admin, CRUD Master User, dan Monitoring. |
| `index.html` | Kerangka awal SPA & Script penentu *Routing* halaman (Loading Screen). |
| `login.html` | Antarmuka halaman Login dan Form Pendaftaran Siswa. |
| `student_dashboard.html`| Antarmuka panel Siswa. |
| `teacher_dashboard.html`| Antarmuka panel Guru Pembimbing. |
| `supervisor_dashboard.html`| Antarmuka panel Pembimbing Lapangan. |
| `admin.html` | Antarmuka panel Super Admin. |

---

## 🗄️ Persiapan Database (Google Sheets)

Buatlah sebuah file Google Sheets baru di Google Drive Anda, lalu buat *Sheet (Tab)* dengan nama-nama persis seperti berikut (Huruf kecil semua):

1. **`users`** (Tabel Akun)
   * *Header:* `username` | `password` | `role` | `nama` | `jurusan` | `token` | `foto_profil` | `tahun`
2. **`logbooks`** (Tabel Jurnal Harian)
   * *Header:* `id` | `nisn` | `tanggal` | `jam_mulai` | `jam_selesai` | `judul` | `deskripsi` | `foto_bukti` | `catatan_guru` | `timestamp`
3. **`students_map`** (Tabel Relasi Siswa & Guru)
   * *Header:* `nisn` | `nama_siswa` | `jurusan` | `nip_guru`
4. **`teachers`** (Tabel Referensi Dropdown)
   * *Header:* `nip` | `nama_guru`

*(Catatan: Anda dapat membuat header ini secara otomatis dengan menjalankan fungsi `setupDatabase()` di dalam file `Code.gs`)*

---

## 🚀 Panduan Instalasi & Deployment

1. **Siapkan Google Drive (Untuk Storage):** * Buat satu folder kosong di Google Drive Anda (untuk menampung foto logbook dan file PDF).
   * Klik kanan folder tersebut -> *Bagikan (Share)* -> Ubah Akses Umum menjadi **"Siapa saja yang memiliki link" (Anyone with the link)**.
   * *Copy* ID Folder yang ada di URL. Buka file `StudentService.gs`, cari variabel `folderId`, dan *paste* ID tersebut.
2. **Siapkan Spreadsheet:** Ikuti panduan pembuatan database di atas.
3. **Buka Editor Script:** Pada Google Sheets, klik menu **Ekstensi > Apps Script**.
4. **Salin Kode:** Buat file `.gs` (Script) dan `.html` sesuai dengan tabel struktur file di atas, lalu *copy-paste* semua kodenya.
5. **Setup Akun Awal & Data Guru:** * Buka file `Code.gs`.
   * Hapus tanda komentar (`//`) pada blok fungsi `setupDatabase()` lalu klik **Jalankan (Run)** untuk membuat tabel beserta akun Admin default (User: `admin`, Pass: `admin123`).
   * (Opsional) Hapus tanda komentar pada fungsi `setupTeacherData()` lalu jalankan jika ingin meng-*import* daftar nama guru secara massal.
   * *Pastikan mengembalikan tanda komentar (`//`) setelah sukses dijalankan.*
6. **Deploy Aplikasi:**
   * Klik tombol biru **Terapkan (Deploy) > Deployment Baru**.
   * Pilih jenis: **Aplikasi Web (Web App)**.
   * Setel Akses: **Siapa saja (Anyone)**.
   * Klik **Terapkan**.
   * Izinkan (Otorisasi) akses akun Google yang diminta (Lanjutan > Buka / Go to...).
7. **Selesai:** Salin URL Web App yang diberikan. Aplikasi Logbook siap digunakan!

---

## ⚠️ Catatan Maintenance
Jika Anda melakukan perubahan pada kode (HTML/JS/GS) di kemudian hari, Anda **WAJIB** melakukan Deploy Ulang agar perubahannya muncul:
1. Klik **Terapkan > Kelola Penerapan**.
2. Klik ikon pensil (Edit) pada versi yang sedang aktif.
3. Pada dropdown Versi, pilih **Versi Baru**.
4. Klik **Terapkan**. *(Langkah ini menjaga agar URL Link aplikasi sekolah tidak berubah)*.

---
<p align="center">
  <b>Dibuat untuk memenuhi tugas Kerja Praktik (KP) Tahun 2026.</b><br>
  <i>Fakultas Teknik - Universitas Halu Oleo</i>
</p>
