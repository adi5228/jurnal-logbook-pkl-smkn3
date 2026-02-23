/**
 * ============================================================================
 * CODE.GS - CORE CONTROLLER
 * Deskripsi: Kontroler utama (Server-side) untuk Sistem Logbook PKL berbasis Google Apps Script (GAS).
 * File ini menangani dua hal utama:
 * 1. HTTP GET Request: Menentukan halaman HTML mana yang akan dirender ke pengguna.
 * 2. API Gateway: Menerima request dari client (HTML/JS), memvalidasi sesi, lalu meneruskannya 
 * ke service yang sesuai (AuthService, StudentService, dll).
 * ============================================================================
 */

/**
 * =======================================================
 * 1. SETUP HALAMAN UTAMA & ROUTING URL (HTTP GET)
 * =======================================================
 * Fungsi ini otomatis dipanggil oleh Google Apps Script ketika URL Web App diakses.
 * Digunakan untuk melakukan routing halaman berdasarkan parameter URL '?page='.
 * @param {Object} e - Event object bawaan GAS yang berisi parameter URL.
 * @returns {HtmlOutput} - Tampilan HTML yang dirender.
 */
function doGet(e) {
  var page = e.parameter.page;

  // A. Routing Halaman Pembimbing Lapangan (Supervisor)
  // Diakses melalui URL: https://script.google.com/.../exec?page=supervisor
  if (page === 'supervisor') {
    return HtmlService.createTemplateFromFile('supervisor_dashboard')
      .evaluate()
      .setTitle('Dashboard Pembimbing Lapangan')
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL) // Mengizinkan embed jika diperlukan
      .addMetaTag('viewport', 'width=device-width, initial-scale=1'); // Setup mobile responsive
  }
  
  // B. Routing Halaman Admin
  // Diakses melalui URL: https://script.google.com/.../exec?page=admin
  if (page === 'admin') {
    return HtmlService.createTemplateFromFile('admin')
      .evaluate()
      .setTitle('Admin Panel - Sistem PKL')
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)
      .addMetaTag('viewport', 'width=device-width, initial-scale=1');
  }
  
  // C. Routing Default (Login / Dashboard Siswa / Dashboard Guru)
  // Jika URL diakses tanpa parameter (https://script.google.com/.../exec), arahkan ke file 'index.html'.
  // Logika untuk membedakan apakah user harus melihat halaman login, dashboard siswa, 
  // atau dashboard guru ditangani sepenuhnya di sisi client (JavaScript di dalam index.html) menggunakan token.
  return HtmlService.createTemplateFromFile('index') 
      .evaluate()
      .setTitle('Sistem Logbook PKL')
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)
      .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

/**
 * =======================================================
 * 2. HELPER INCLUDE (Templating Engine Sederhana)
 * =======================================================
 * Fungsi ini digunakan untuk menyisipkan konten dari satu file HTML ke file HTML lainnya.
 * Sangat berguna untuk komponen UI yang diulang (seperti Header, Footer, atau file CSS/JS terpisah).
 * Penggunaan di file HTML: <?!= include('nama_file_tanpa_ekstensi'); ?>
 * @param {string} filename - Nama file HTML yang akan disisipkan.
 * @returns {string} - Konten HTML mentah.
 */
function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

/**
 * =======================================================
 * 3. API GATEWAY (PENGATUR LALU LINTAS DATA / CONTROLLER)
 * =======================================================
 * Ini adalah pusat komunikasi antara front-end (HTML/Client) dan back-end (Database Google Sheets).
 * Semua pemanggilan menggunakan `google.script.run.api('nama_action', {data})` akan bermuara ke sini.
 * Fungsi ini mengatur sekuriti (Token) dan mengarahkan data ke Service yang tepat.
 * @param {string} action - Nama perintah yang ingin dieksekusi.
 * @param {Object} data - Objek JSON berisi payload data yang dikirim dari client.
 * @returns {Object} - Objek JSON yang dikirim kembali ke client berisi status (success: true/false) dan data respon.
 */
function api(action, data) {
  try {
    // Pastikan data tidak undefined
    data = data || {};
    
    /* ---------------------------------------------------
       KELOMPOK A: AKSES PUBLIK (TANPA TOKEN)
       Endpoint ini dapat diakses oleh siapa saja (proses login & register).
       --------------------------------------------------- */
    
    // 1. Proses Login User (Siswa, Guru, Admin)
    if (action === 'login') {
      var result = AuthService.login(data.u, data.p);
      // Jika berhasil login, sertakan juga URL Web App saat ini agar client bisa melakukan redirect halaman
      if(result.success) {
        result.appUrl = ScriptApp.getService().getUrl();
      }
      return result;
    }
    
    // 2. Proses Pendaftaran (Register) Siswa Baru
    if (action === 'register') {
      return AuthService.register(data);
    }
    
    // 3. Mengambil Daftar Nama Guru untuk ditampilkan di Dropdown Form Registrasi
    if (action === 'getTeacherList') {
      return AuthService.getTeacherList();
    }

    /* ---------------------------------------------------
       KELOMPOK B: AKSES PEMBIMBING LAPANGAN / SUPERVISOR
       Akses ini tidak menggunakan akun, melainkan token akses statis 
       ('SUPERVISOR_ACCESS') yang di-set di frontend supervisor_dashboard.
       --------------------------------------------------- */
    if (data.token === 'SUPERVISOR_ACCESS') {
       if (action === 'supervisorGetFeed') return SupervisorService.getPublicFeed();
       if (action === 'supervisorSearchStudent') return SupervisorService.searchStudent(data.query);
       if (action === 'supervisorGetStudentLogs') return SupervisorService.getStudentLogs(data.nisn);
       
       return { success: false, error: "Akses Ditolak: Token Supervisor Salah." };
    }

    /* ---------------------------------------------------
       KELOMPOK C: VALIDASI TOKEN USER & SESI AMAN
       Blok kode di bawah ini WAJIB MENGGUNAKAN TOKEN VALID.
       Token dicek dengan mencocokkan ke database sheet 'users'.
       --------------------------------------------------- */
    var user = AuthService.validateToken(data.token);
    
    // Jika token palsu, kadaluarsa, atau kosong, tolak akses.
    if (!user) {
      return { success: false, error: "Sesi Anda telah berakhir. Silakan login kembali.", sessionExpired: true };
    }

    /* ---------------------------------------------------
       KELOMPOK D: ROUTING ACTION BERDASARKAN PERAN (ROLE)
       Jika sesi valid, cek action yang diminta dan teruskan ke file Service terkait.
       --------------------------------------------------- */
    
    // --- 1. UMUM ---
    // Mengambil profil user yang sedang login untuk ditampilkan di Dashboard
    if (action === 'getDashboardData') {
      return { 
        success: true, 
        user: user,
        appUrl: ScriptApp.getService().getUrl() 
      };
    }
    
    // --- 2. FITUR SISWA (Akses modul StudentService.gs) ---
    if (action === 'saveLogbook') return StudentService.saveLogbook(user, data);       // Simpan (Baru) atau Edit Jurnal
    if (action === 'studentDeleteLog') return StudentService.deleteLogbook(user, data.logId); // Hapus logbook spesifik
    if (action === 'getHistory') return StudentService.getHistory(user);               // Menampilkan riwayat jurnal sendiri
    if (action === 'getPublicFeed') return StudentService.getPublicFeed(user);         // Menampilkan timeline jurnal teman
    if (action === 'updateProfile') return StudentService.updateProfile(user, data);   // Edit nama, foto, password
    if (action === 'exportLogbook') return StudentService.exportLogbook(user);         // Render jurnal menjadi Google Docs/PDF
    
    // --- 3. FITUR GURU (Akses modul TeacherService.gs) ---
    if (action === 'getMyStudents') return TeacherService.getMyStudents(user, data.targetYear); // List siswa bimbingan
    if (action === 'getStudentLogbooks') return TeacherService.getStudentLogbooks(data.targetNisn); // Lihat jurnal spesifik siswa
    if (action === 'saveFeedback') return TeacherService.saveFeedback(data);           // Input catatan ACC/Revisi jurnal
    if (action === 'teacherGetYears') return TeacherService.getAvailableYears();       // Ambil filter tahun untuk dropdown
    if (action === 'teacherChangePass') return TeacherService.changePassword(user, data.newPass); // Ganti password guru

    // --- 4. FITUR ADMIN (Akses modul AdminService.gs) ---
    // Validasi ekstra: Pastikan yang mengakses perintah ini benar-benar memiliki Role 'ADMIN'
    if (user.role === 'ADMIN') {
      if (action === 'adminGetYears') return AdminService.getAvailableYears();           // Ambil tahun untuk filter grafik
      if (action === 'getAdminStats') return AdminService.getStats(data.targetYear);     // Data metrik dashboard (jumlah siswa/guru)
      if (action === 'adminGetAllUsers') return AdminService.getAllUsers(data.targetYear); // Tabel master data pengguna
      if (action === 'adminGetMonitoring') return AdminService.getMonitoringData(data.targetYear); // Tabel rekap semua jurnal masuk
      
      if (action === 'adminSaveUser') return AdminService.saveUser(data);                // Tambah atau Edit User Manual
      if (action === 'adminDeleteUser') return AdminService.deleteUser(data.targetUsername); // Hapus User
      if (action === 'adminChangePass') return AdminService.changeMyPassword(user, data.newPass); // Ganti password akun admin
    }

    // Jika Action String yang dikirim dari JS tidak terdaftar di daftar atas
    return { success: false, error: "Action tidak dikenal: " + action };

  } catch (err) {
    // Tangkap Error Sistem / Script untuk mencegah crash aplikasi
    Logger.log("SERVER ERROR pada Action [" + action + "]: " + err.toString());
    return { success: false, error: "Server Error: Terjadi kesalahan di sistem. Hubungi administrator." };
  }
}

/**
 * =======================================================
 * 4. HELPER FUNCTION
 * =======================================================
 */

/**
 * Fungsi pembantu untuk mengambil Sheet berdasakan nama.
 * Jika sheet belum ada, maka otomatis akan dibuat baru.
 * Mencegah error 'null' saat database pertama kali diakses.
 * @param {Spreadsheet} ss - Objek aktif Google Spreadsheet.
 * @param {string} name - Nama tab sheet (contoh: 'users').
 */
function getSheet(ss, name) {
  var sheet = ss.getSheetByName(name);
  if (!sheet) sheet = ss.insertSheet(name);
  return sheet;
}

/**
 * Fungsi untuk mengambil URL Public Web App.
 * Digunakan oleh Javascript di client-side untuk melakukan redirect halaman (misal pindah ke mode admin).
 */
function getAppUrl() {
  return ScriptApp.getService().getUrl();
}

/**
 * ============================================================================
 * FUNGSI INSTALASI AWAL (SATU KALI JALAN)
 * Blok kode di bawah ini dalam status 'comment'.
 * Buka komentar (uncomment) dan jalankan SECARA MANUAL melalui editor Apps Script 
 * hanya pada saat PERTAMA KALI setup sistem untuk membuat tabel dan header kolom.
 * Setelah tabel terbuat, biarkan statusnya menjadi komentar.
 * ============================================================================
 */

// function setupDatabase() {
//   var ss = SpreadsheetApp.getActiveSpreadsheet();
  
//   // A. Sheet Users (Database Akun)
//   var sUsers = getSheet(ss, 'users');
//   if(sUsers.getLastRow() === 0) {
//     sUsers.appendRow(['username', 'password', 'role', 'nama', 'jurusan', 'token', 'foto_profil', 'tahun']); 
//     // Membuat Akun Admin Default otomatis (U: admin, P: admin123)
//     sUsers.appendRow(['admin', 'admin123', 'ADMIN', 'Administrator', '-', '', '', new Date().getFullYear()]);
//   }
  
//   // B. Sheet Logbooks (Database Jurnal Kegiatan)
//   var sLogs = getSheet(ss, 'logbooks');
//   if(sLogs.getLastRow() === 0) {
//     sLogs.appendRow(['id', 'nisn', 'tanggal', 'jam_mulai', 'jam_selesai', 'judul', 'deskripsi', 'foto_bukti', 'catatan_guru', 'timestamp']);
//   }
  
//   // C. Sheet Students Map (Pemetaan Siswa ke Guru)
//   var sMap = getSheet(ss, 'students_map');
//   if(sMap.getLastRow() === 0) {
//     sMap.appendRow(['nisn', 'nama_siswa', 'jurusan', 'nip_guru']);
//   }
  
//   // D. Sheet Teachers (Data Master Guru untuk Referensi Dropdown)
//   var sTeach = getSheet(ss, 'teachers');
//   if(sTeach.getLastRow() === 0) {
//     sTeach.appendRow(['nip', 'nama_guru']);
//     // Contoh Data Dummy
//     sTeach.appendRow(['198001', 'Pak Budi Santoso']);
//     sTeach.appendRow(['198002', 'Bu Siti Aminah']);
//   }
  
//   Logger.log("Database Berhasil Disiapkan!");
// }


/**
 * =======================================================
 * FUNGSI KHUSUS: IMPORT DATA GURU (Jalankan Sekali Saja)
 * Digunakan untuk memasukkan daftar nama guru yang banyak secara otomatis 
 * ke dalam database (sheet 'teachers' dan membuatkan akun di 'users').
 * Username otomatis diset ke Nomor Urut (1, 2, 3...)
 * =======================================================
 */

// function setupTeacherData() {
//   var ss = SpreadsheetApp.getActiveSpreadsheet();
  
//   // 1. Daftar Nama Guru (Hasil Ekstrak & Sortir Abjad dari File Eksternal)
//   var teacherNames = [
//     "Adi Setiawan, S.T.",
//     "Indah Lestari, S.T.",
//     "Nirmala, S.T.",
//   ];

//   Logger.log("Memulai Proses Import " + teacherNames.length + " Guru...");

//   // 2. Siapkan Sheet 'teachers' (Daftar Referensi)
//   var sTeach = getSheet(ss, 'teachers');
//   sTeach.clear(); 
//   sTeach.appendRow(['id_urut', 'nama_guru']); // Membuat ulang Header

//   // 3. Siapkan Sheet 'users' (Akun Login)
//   var sUsers = getSheet(ss, 'users');
//   var existingData = sUsers.getDataRange().getDisplayValues();
//   var existingUsernames = [];
//   // Mencegah duplikasi data jika fungsi ini dijalankan 2x
//   if (existingData.length > 1) {
//     existingUsernames = existingData.map(function(row) { return String(row[0]); });
//   }

//   // 4. Proses Loop Data Guru
//   for (var i = 0; i < teacherNames.length; i++) {
//     var nomorUrut = String(i + 1); // 1, 2, 3...
//     var namaGuru = teacherNames[i];
//     var defaultPass = "guru123";

//     // A. Masukkan ke Sheet Referensi 'teachers'
//     sTeach.appendRow([nomorUrut, namaGuru]);

//     // B. Buat Akun Login di Sheet 'users' (Jika nomor urut tersebut belum terdaftar)
//     if (existingUsernames.indexOf(nomorUrut) === -1) {
//       sUsers.appendRow([
//         nomorUrut,      // Username (Angka Urut)
//         defaultPass,    // Password Default
//         'GURU',         // Role Aplikasi
//         namaGuru,       // Nama Lengkap
//         '-',            // Jurusan (Guru diset strip)
//         '',             // Token Sesi (Dikosongkan saat inisiasi)
//         '',             // Link Foto Profil
//         ''              // Tahun Aktif
//       ]);
//     }
//   }
  
//   Logger.log("=== SELESAI IMPORT DATA GURU ===");
// }
