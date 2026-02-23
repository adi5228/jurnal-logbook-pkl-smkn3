/**
 * ============================================================================
 * ADMIN SERVICE
 * Deskripsi: Modul backend yang menangani seluruh logika bisnis untuk pengguna
 * dengan role 'ADMIN'. Mencakup fungsi analisis dashboard (Statistik), 
 * manajemen CRUD pengguna (Siswa, Guru, Admin), dan pemantauan seluruh logbook.
 * ============================================================================
 */

var AdminService = {
  
  /**
   * --------------------------------------------------------------------------
   * 0. AMBIL TAHUN TERSEDIA (FILTER TAHUN)
   * --------------------------------------------------------------------------
   * Mengambil semua tahun unik yang tercatat di dalam sistem, baik dari 
   * tahun angkatan siswa di sheet 'users' maupun dari tanggal logbook.
   * Digunakan untuk mengisi opsi dropdown filter di UI Admin.
   * * @returns {Object} JSON berisi array tahun yang sudah diurutkan menurun (Terbaru -> Terlama).
   */
  getAvailableYears: function() {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sUsers = ss.getSheetByName('users');
    var sLogs = ss.getSheetByName('logbooks');
    var years = new Set(); // Menggunakan Set agar tahun tidak duplikat

    // Ambil tahun dari data pengguna (Siswa)
    if (sUsers) {
      var uData = sUsers.getDataRange().getDisplayValues();
      for (var i = 1; i < uData.length; i++) {
        var y = String(uData[i][7]).trim(); // Kolom H (Index 7) adalah Tahun
        // Hanya ambil jika formatnya benar-benar 4 digit angka
        if (y && y.match(/^\d{4}$/)) years.add(y); 
      }
    }

    // Ambil tahun dari tanggal entry logbook
    if (sLogs) {
      var lData = sLogs.getDataRange().getDisplayValues();
      for (var j = 1; j < lData.length; j++) {
        try {
           var d = new Date(lData[j][2]); // Kolom C (Index 2) adalah Tanggal
           if(!isNaN(d.getTime())) years.add(String(d.getFullYear()));
        } catch(e) {
           // Skip baris jika format tanggal gagal diparsing
        }
      }
    }

    // Konversi Set ke Array, urutkan, lalu balik (reverse) agar tahun terbaru di atas
    var sortedYears = Array.from(years).sort().reverse();
    return { success: true, years: sortedYears };
  },

  /**
   * --------------------------------------------------------------------------
   * 1. DASHBOARD STATISTIK
   * --------------------------------------------------------------------------
   * Menghitung total entitas di dalam sistem berdasarkan tahun tertentu.
   * * @param {string} targetYear - (Opsional) Tahun filter. Jika kosong, hitung semua.
   * @returns {Object} Total Siswa, Total Guru, dan Total Logbook.
   */
  getStats: function(targetYear) {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sUsers = ss.getSheetByName('users');
    var sLogs = ss.getSheetByName('logbooks');
    
    if (!sUsers || !sLogs) return { success: true, countSiswa: 0, countGuru: 0, totalLog: 0 };
    
    var filterYear = (targetYear) ? String(targetYear).trim() : null;

    var users = sUsers.getDataRange().getDisplayValues();
    var cSiswa = 0;
    var cGuru = 0;
    
    // Hitung User
    for(var i = 1; i < users.length; i++) {
       var role = String(users[i][2]).toUpperCase().trim();
       var userYear = String(users[i][7]).trim();

       // Skip jika filter tahun aktif dan tidak cocok (Guru biasanya tidak punya tahun, jadi bisa ter-skip)
       if (filterYear && userYear !== filterYear) continue;

       if(role === 'SISWA') cSiswa++;
       else if(role === 'GURU') cGuru++;
    }

    // Hitung Logbook
    var logs = sLogs.getDataRange().getDisplayValues();
    var cLog = 0;
    for(var j = 1; j < logs.length; j++) {
       if (filterYear) {
          var d = new Date(logs[j][2]);
          if(!isNaN(d.getTime()) && String(d.getFullYear()) === filterYear) {
             cLog++;
          }
       } else {
          cLog++;
       }
    }
    
    return { success: true, countSiswa: cSiswa, countGuru: cGuru, totalLog: cLog };
  },

  /**
   * --------------------------------------------------------------------------
   * 2. AMBIL SEMUA DATA PENGGUNA (USER MANAGEMENT)
   * --------------------------------------------------------------------------
   * Mengambil semua data dari sheet 'users' untuk ditampilkan pada tabel Manajemen User.
   * * @param {string} targetYear - Filter berdasarkan tahun daftar/PKL.
   */
  getAllUsers: function(targetYear) {
    var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('users');
    var data = sheet.getDataRange().getDisplayValues();
    var list = [];
    
    var filterYear = (targetYear) ? String(targetYear).trim() : null;

    for(var i = 1; i < data.length; i++) {
      var userYear = data[i][7] ? String(data[i][7]).trim() : "";

      if (filterYear && userYear !== filterYear) continue;

      list.push({
        username: String(data[i][0]),
        password: String(data[i][1]),
        role: data[i][2],
        nama: data[i][3],
        jurusan: data[i][4],
        tahun: userYear
      });
    }
    
    // Urutkan list berdasarkan Role (ADMIN -> GURU -> SISWA secara abjad)
    list.sort(function(a, b) { return a.role.localeCompare(b.role); });
    return { success: true, list: list };
  },

  /**
   * --------------------------------------------------------------------------
   * 3. SIMPAN USER (CREATE / UPDATE) - VERSI ROBUST
   * --------------------------------------------------------------------------
   * Menangani penambahan user baru atau pengeditan data user yang sudah ada
   * melalui Form Modal Admin. Juga memastikan sinkronisasi data dengan sheet 
   * 'teachers' dan 'students_map' agar sistem tetap terhubung.
   * * @param {Object} d - Payload data (isEdit, username, nama, password, role, dll).
   */
  saveUser: function(d) {
    try {
        var ss = SpreadsheetApp.getActiveSpreadsheet();
        var sUsers = ss.getSheetByName('users');
        var sMap = ss.getSheetByName('students_map');
        
        if(!sUsers) return { success: false, error: "Database 'users' hilang!" };
        if(!d.username || !d.nama || !d.password) return { success: false, error: "Data wajib diisi." };

        var rows = sUsers.getDataRange().getValues();
        
        // --- A. MODE EDIT (UPDATE) ---
        if(d.isEdit) {
           var userFound = false;
           for(var i = 1; i < rows.length; i++) {
              if(String(rows[i][0]) === String(d.username)) {
                 sUsers.getRange(i+1, 2).setValue(d.password);
                 sUsers.getRange(i+1, 4).setValue(d.nama);
                 sUsers.getRange(i+1, 3).setValue(d.role);
                 sUsers.getRange(i+1, 5).setValue(d.jurusan);
                 sUsers.getRange(i+1, 8).setValue(d.tahun);
                 
                 // Jika user adalah GURU, update juga di sheet 'teachers'
                 if(d.role === 'GURU') {
                    updateTeacherSheet(ss, d.username, d.nama, 'UPDATE');
                 }

                 // Jika user adalah SISWA, update relasinya dengan guru di 'students_map'
                 if(d.role === 'SISWA') {
                    // Buat sheet jika tidak sengaja terhapus
                    if(!sMap) { sMap = ss.insertSheet('students_map'); sMap.appendRow(['nisn','nama','jurusan','nip_guru']); }
                    
                    var mapRows = sMap.getDataRange().getValues();
                    var foundMap = false;
                    for(var j = 1; j < mapRows.length; j++) {
                       if(String(mapRows[j][0]) === String(d.username)) {
                          sMap.getRange(j+1, 2).setValue(d.nama); 
                          sMap.getRange(j+1, 3).setValue(d.jurusan);
                          if(d.nip_guru) sMap.getRange(j+1, 4).setValue(d.nip_guru); 
                          foundMap = true;
                          break;
                       }
                    }
                    // Jika siswa belum ada di map, tambahkan
                    if(!foundMap && d.nip_guru) sMap.appendRow(["'" + d.username, d.nama, d.jurusan, d.nip_guru]);
                 }
                 userFound = true;
                 break;
              }
           }
           if (!userFound) return { success: false, error: "User tidak ditemukan." };
           return { success: true };
        } 
        
        // --- B. MODE TAMBAH BARU (CREATE) ---
        else {
           // Cek duplikasi username
           for(var k = 0; k < rows.length; k++) {
              if(String(rows[k][0]) === String(d.username)) return { success: false, error: "Username/NISN sudah ada!" };
           }
           
           var tahunInput = d.tahun ? d.tahun : new Date().getFullYear();

           // 1. Simpan ke master sheet 'Users'
           sUsers.appendRow(["'" + d.username, d.password, d.role, d.nama, d.jurusan, '', '', tahunInput]);
           
           // 2. Simpan Sesuai Role untuk sinkronisasi relasi
           if(d.role === 'GURU') {
              var sTeach = ss.getSheetByName('teachers');
              if(!sTeach) { 
                  sTeach = ss.insertSheet('teachers'); 
                  sTeach.appendRow(['nip', 'nama_guru']); 
              }
              sTeach.appendRow(["'" + d.username, d.nama]);
           }
           else if(d.role === 'SISWA') {
              if (!sMap) { 
                  sMap = ss.insertSheet('students_map');
                  sMap.appendRow(['nisn', 'nama_siswa', 'jurusan', 'nip_guru']); 
              }
              sMap.appendRow(["'" + d.username, d.nama, d.jurusan, d.nip_guru || ""]); 
           }
        }
        
        return { success: true };

    } catch (err) {
        return { success: false, error: "Server Error: " + err.toString() };
    }
  },

  /**
   * --------------------------------------------------------------------------
   * 4. HAPUS USER (DELETE)
   * --------------------------------------------------------------------------
   * Menghapus baris user secara permanen. Admin dilarang menghapus akun "admin" root.
   * * @param {string} targetUsername - Username yang akan dihapus.
   */
  deleteUser: function(targetUsername) {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName('users');
    var data = sheet.getDataRange().getDisplayValues();
    var target = String(targetUsername).trim();

    for(var i = 1; i < data.length; i++) {
      if(String(data[i][0]).trim() === target) {
        var role = String(data[i][2]);
        
        // Mencegah super admin terhapus agar sistem tidak kehilangan akses admin
        if(role === 'ADMIN' && target === 'admin') {
           return { success: false, error: "Akun Admin Utama tidak boleh dihapus." };
        }
        
        sheet.deleteRow(i + 1);
        
        // Hapus juga data sinkronisasinya jika dia adalah guru
        if(role === 'GURU') updateTeacherSheet(ss, target, null, 'DELETE');
        
        return { success: true };
      }
    }
    return { success: false, error: "User tidak ditemukan." };
  },

  /**
   * --------------------------------------------------------------------------
   * 5. MONITORING LOGBOOK (READ-ONLY)
   * --------------------------------------------------------------------------
   * Menarik seluruh data logbook dari sheet 'logbooks'.
   * Fungsi ini menggunakan teknik Hash Map untuk memadukan data NISN Siswa 
   * dengan nama Guru Pembimbingnya secara efisien.
   * * @param {string} targetYear - (Opsional) Filter berdasarkan tahun entri.
   */
  getMonitoringData: function(targetYear) {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sLogs = ss.getSheetByName('logbooks');
    var sMap = ss.getSheetByName('students_map');
    var sTeach = ss.getSheetByName('teachers');
    
    if(!sLogs) return { success: true, list: [] };

    var logs = sLogs.getDataRange().getDisplayValues();
    var maps = sMap ? sMap.getDataRange().getDisplayValues() : [];
    var teachers = sTeach ? sTeach.getDataRange().getDisplayValues() : [];
    var filterYear = (targetYear) ? String(targetYear).trim() : null;
    
    // 1. Buat Mapping (Kamus): NIP_GURU => NAMA_GURU
    var teacherNameMap = {};
    for(var t = 1; t < teachers.length; t++) { 
       teacherNameMap[teachers[t][0]] = teachers[t][1]; 
    }

    // 2. Buat Mapping (Kamus): NISN_SISWA => NAMA_GURU_PEMBIMBING
    var studentMentorMap = {};
    for(var m = 1; m < maps.length; m++) {
      var nisn = maps[m][0];
      var nipGuru = maps[m][3];
      var namaGuru = teacherNameMap[nipGuru] || nipGuru || "-";
      studentMentorMap[nisn] = namaGuru;
    }

    // 3. Masukkan data Logbook dan pasangkan dengan nama pembimbing
    var list = [];
    for(var i = 1; i < logs.length; i++) {
      var row = logs[i];
      
      if (filterYear) {
         var d = new Date(row[2]); 
         if(isNaN(d.getTime()) || String(d.getFullYear()) !== filterYear) continue;
      }

      var logNisn = row[1];
      
      list.push({
        id: row[0],
        nisn: logNisn,
        tanggal: row[2],
        jam: row[3] + " - " + row[4],
        judul: row[5],
        deskripsi: row[6],
        foto: row[7],
        feedback: row[8],
        pembimbing: studentMentorMap[logNisn] || "Belum ada Pembimbing"
      });
    }
    
    // Reverse array agar logbook terbaru muncul paling atas di tabel admin
    return { success: true, list: list.reverse() };
  },

  /**
   * --------------------------------------------------------------------------
   * 6. GANTI PASSWORD ADMIN
   * --------------------------------------------------------------------------
   * Mengubah password dari user (Admin) yang sedang aktif login.
   * * @param {Object} user - User admin yang login
   * @param {string} newPass - Password teks baru
   */
  changeMyPassword: function(user, newPass) {
    var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('users');
    var rows = sheet.getDataRange().getValues();
    
    for(var i = 1; i < rows.length; i++) {
       if(String(rows[i][0]) === String(user.username)) {
          sheet.getRange(i + 1, 2).setValue(newPass);
          return { success: true };
       }
    }
    return { success: false, error: "User admin tidak ditemukan." };
  }
};

/**
 * =======================================================
 * FUNGSI HELPER INTERNAL
 * =======================================================
 * Digunakan untuk menjaga konsistensi data antara sheet 'users' dan 'teachers'.
 * Dipanggil secara otomatis ketika Admin mengedit nama guru atau menghapus akun guru.
 * * @param {Spreadsheet} ss - Objek Spreadsheet aktif.
 * @param {string} nip - ID Urut / Username guru.
 * @param {string} nama - Nama baru (jika update).
 * @param {string} action - 'UPDATE' atau 'DELETE'.
 */
function updateTeacherSheet(ss, nip, nama, action) {
  var sTeach = ss.getSheetByName('teachers');
  if(!sTeach) return; 
  
  var data = sTeach.getDataRange().getDisplayValues();
  
  if (action === 'UPDATE') {
     for(var i = 1; i < data.length; i++) { 
        if(String(data[i][0]) === String(nip)) { 
           sTeach.getRange(i + 1, 2).setValue(nama); 
           break; 
        } 
     }
  } else if (action === 'DELETE') {
     for(var j = 1; j < data.length; j++) { 
        if(String(data[j][0]) === String(nip)) { 
           sTeach.deleteRow(j + 1); 
           break; 
        } 
     }
  }
}
