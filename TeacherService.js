/**
 * ============================================================================
 * TEACHER SERVICE
 * Deskripsi: Modul backend yang menangani seluruh logika bisnis untuk pengguna
 * dengan role 'GURU'. Mencakup fungsionalitas pemantauan siswa bimbingan, 
 * pemberian feedback/catatan pada jurnal siswa, dan manajemen profil guru.
 * ============================================================================
 */

var TeacherService = {

  /**
   * --------------------------------------------------------------------------
   * 0. AMBIL TAHUN TERSEDIA (Untuk Filter Dropdown)
   * --------------------------------------------------------------------------
   * Memindai seluruh data siswa yang ada di sistem untuk mendapatkan daftar 
   * tahun PKL/Angkatan yang terdaftar. Digunakan untuk filter di dashboard Guru.
   * * @returns {Object} JSON berisi array tahun yang sudah diurutkan menurun.
   */
  getAvailableYears: function() {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sUsers = ss.getSheetByName('users');
    var years = new Set(); // Menggunakan Set untuk mencegah duplikasi tahun

    // Scan Tahun dari sheet User (Kolom H / Index 7)
    if (sUsers) {
      var uData = sUsers.getDataRange().getDisplayValues();
      for (var i = 1; i < uData.length; i++) {
        var y = String(uData[i][7]).trim();
        // Hanya ambil data yang bentuknya 4 digit angka (misal: 2024, 2025)
        if (y && y.match(/^\d{4}$/)) years.add(y);
      }
    }
    
    // Konversi objek Set menjadi Array, lalu urutkan secara Descending (Terbaru di atas)
    var sortedYears = Array.from(years).sort().reverse();
    return { success: true, years: sortedYears };
  },

  /**
   * --------------------------------------------------------------------------
   * 1. AMBIL DAFTAR SISWA BINAAN (DENGAN FILTER TAHUN)
   * --------------------------------------------------------------------------
   * Menampilkan daftar siswa yang dibimbing secara khusus oleh Guru yang sedang
   * login. Data digabungkan dari tabel 'students_map' dan 'users'.
   * * @param {Object} user - Objek Guru yang sedang login.
   * @param {string} targetYear - Tahun yang dipilih dari dropdown filter.
   * @returns {Object} JSON berisi array of object data siswa binaan.
   */
  getMyStudents: function(user, targetYear) {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sMap = ss.getSheetByName('students_map');
    var sUsers = ss.getSheetByName('users');
    
    // Ambil Data Relasi (Mapping) & Data Profil (User)
    var maps = sMap.getDataRange().getDisplayValues();
    var users = sUsers.getDataRange().getDisplayValues();
    
    var filterYear = (targetYear) ? String(targetYear).trim() : null;

    // A. Buat HashMap (Kamus Data) Siswa dari Sheet Users (NISN -> {Foto, Tahun})
    // Ini lebih cepat daripada melakukan nested loop array di dalam array.
    var userDetails = {};
    for(var i = 1; i < users.length; i++) {
       userDetails[String(users[i][0])] = {
          foto: (users[i].length > 6) ? users[i][6] : "",
          tahun: (users[i].length > 7) ? String(users[i][7]).trim() : ""
       };
    }
    
    // Username guru biasanya merupakan Nomor Urut / NIP
    var myNip = String(user.username || user.nisn).trim(); 
    var list = [];
    
    // B. Looping sheet Mapping Siswa (Mencari siswa yang pembimbingnya = Guru ini)
    // Struktur Kolom Sheet Map: [0]NISN, [1]Nama, [2]Jurusan, [3]NIP_Guru
    for(var j = 1; j < maps.length; j++) {
      
      // Data di kolom pembimbing biasanya berformat "NIP - Nama Guru"
      // Kita cek apakah 'myNip' ada di dalam string tersebut.
      if(String(maps[j][3]).includes(myNip)) {
         
         var siswaNisn = String(maps[j][0]);
         // Ambil detail foto dan tahun dari HashMap yang dibuat di Langkah A
         var siswaData = userDetails[siswaNisn] || { foto: "", tahun: "" };

         // Jika filter tahun diaktifkan, abaikan siswa yang tahunnya tidak sesuai
         if (filterYear && siswaData.tahun !== filterYear) {
            continue; 
         }
         
         // Masukkan ke array jika lolos filter
         list.push({
           nisn: siswaNisn,
           nama: maps[j][1],
           jurusan: maps[j][2],
           foto: siswaData.foto,
           tahun: siswaData.tahun
         });
      }
    }
    
    // Urutkan daftar siswa secara alfabetis berdasarkan Nama
    list.sort(function(a, b) { return a.nama.localeCompare(b.nama); });
    
    return { success: true, list: list };
  },

  /**
   * --------------------------------------------------------------------------
   * 2. LIHAT LOGBOOK SISWA TERTENTU
   * --------------------------------------------------------------------------
   * Mengambil semua catatan kegiatan PKL dari seorang siswa secara spesifik
   * ketika guru meng-klik nama siswa tersebut di sidebar.
   * * @param {string} targetNisn - NISN milik siswa yang akan dilihat.
   * @returns {Object} JSON berisi riwayat logbook siswa.
   */
  getStudentLogbooks: function(targetNisn) {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sLogs = ss.getSheetByName('logbooks');
    var logs = sLogs.getDataRange().getDisplayValues();
    var list = [];
    
    // Loop dari bawah ke atas (Terbaru ke Terlama)
    for(var i = logs.length - 1; i >= 1; i--) {
      // Bandingkan NISN di sheet logbook dengan target NISN
      if(String(logs[i][1]).replace(/'/g, '').trim() === String(targetNisn).trim()) {
        list.push({
          id: logs[i][0],
          tanggal: logs[i][2],
          jam: logs[i][3] + ' - ' + logs[i][4],
          judul: logs[i][5],
          deskripsi: logs[i][6],
          foto: logs[i][7],
          feedback: logs[i][8]
        });
      }
    }
    return { success: true, list: list };
  },

  /**
   * --------------------------------------------------------------------------
   * 3. SIMPAN FEEDBACK GURU
   * --------------------------------------------------------------------------
   * Menyimpan catatan, tanggapan, atau persetujuan (ACC) dari guru pembimbing
   * untuk satu entri logbook tertentu.
   * * @param {Object} data - Payload dari frontend (id logbook, teks feedback).
   */
  saveFeedback: function(data) {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sLogs = ss.getSheetByName('logbooks');
    var rows = sLogs.getDataRange().getDisplayValues();
    
    // Cari baris logbook berdasarkan UUID
    for(var i = 1; i < rows.length; i++) {
      if(String(rows[i][0]) === String(data.id)) { 
         // Update Kolom I (Index 9) yang berisi Feedback Guru
         sLogs.getRange(i + 1, 9).setValue(data.feedback); 
         return { success: true };
      }
    }
    return { success: false, error: "Data Logbook tidak ditemukan di database." };
  },

  /**
   * --------------------------------------------------------------------------
   * 4. GANTI PASSWORD GURU
   * --------------------------------------------------------------------------
   * Memungkinkan guru untuk mengubah password login mereka sendiri dari dalam
   * dashboard guru.
   * * @param {Object} user - Objek Guru yang sedang login.
   * @param {string} newPass - Password baru yang diinputkan.
   */
  changePassword: function(user, newPass) {
    var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('users');
    var rows = sheet.getDataRange().getValues();
    
    for(var i = 1; i < rows.length; i++) {
       // Cari baris user berdasarkan username (Nomor Urut/NIP guru)
       if(String(rows[i][0]) === String(user.username || user.nisn)) {
          // Update Kolom B (Index 2) yaitu kolom Password
          sheet.getRange(i + 1, 2).setValue(newPass);
          return { success: true };
       }
    }
    return { success: false, error: "Akun guru tidak ditemukan dalam sistem." };
  }

};
