/**
 * ============================================================================
 * AUTH SERVICE
 * Deskripsi: Modul ini bertanggung jawab untuk menangani proses Autentikasi.
 * Mencakup proses Login, Validasi Token Sesi, Pendaftaran (Register) Siswa,
 * dan pengambilan daftar referensi (misal: daftar Guru untuk form registrasi).
 * ============================================================================
 */

var AuthService = {
  
  /**
   * --------------------------------------------------------------------------
   * 1. LOGIN SYSTEM
   * --------------------------------------------------------------------------
   * Memeriksa kecocokan username (NISN/ID) dan password yang diinput user 
   * dengan data di dalam sheet 'users'. Jika cocok, buatkan Session Token unik.
   * * @param {string} u - Username (Bisa NISN Siswa, ID Guru, atau 'admin').
   * @param {string} p - Password text murni (plaintext).
   * @returns {Object} JSON response (success boolean, token, role, dan data profil).
   */
  login: function(u, p) {
    var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('users');
    var data = sheet.getDataRange().getDisplayValues();
    
    // Looping data mulai dari index 1 (melewati baris header di row 0)
    for(var i = 1; i < data.length; i++) {
      var dbUser = String(data[i][0]).trim();
      var dbPass = String(data[i][1]).trim();

      // Cek kredensial
      if(dbUser === String(u).trim() && dbPass === String(p).trim()) {
        
        // Buat Token Sesi Baru
        var token = Utilities.getUuid();
        
        // Simpan token tersebut ke database (Kolom F / Index 5)
        sheet.getRange(i + 1, 6).setValue(token); 
        
        // Cek Fallback Nama (Jika kolom nama kosong, gunakan username sebagai nama)
        var dbNama = data[i][3] ? data[i][3] : data[i][0];
        
        // Ambil Tahun (Kolom H / Index 7)
        var dbTahun = data[i][7] ? data[i][7] : "";

        return { 
          success: true, 
          token: token, 
          role: data[i][2], 
          user: { 
            nisn: data[i][0], 
            nama: dbNama,     
            role: data[i][2],
            jurusan: data[i][4],
            tahun: dbTahun 
          }
        };
      }
    }
    
    // Jika looping selesai dan tidak ada yang cocok
    return { success: false, error: "Username atau Password Salah!" };
  },
  
  /**
   * --------------------------------------------------------------------------
   * 2. VALIDASI TOKEN (AUTO-LOGIN / SESSION CHECK)
   * --------------------------------------------------------------------------
   * Fungsi krusial untuk keamanan. Dipanggil setiap kali user melakukan aksi 
   * (CRUD) atau me-refresh halaman, untuk memastikan token di LocalStorage 
   * browser masih valid dan ada di database.
   * * @param {string} token - UUID Token dari LocalStorage client.
   * @returns {Object|null} Objek data user jika valid, atau null jika tidak valid.
   */
  validateToken: function(token) {
    if(!token) return null; // Tolak langsung jika token kosong
    
    var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('users');
    var data = sheet.getDataRange().getDisplayValues();
    
    for(var i = 1; i < data.length; i++) {
      if(String(data[i][5]) === String(token)) {
        var dbNama = data[i][3] ? data[i][3] : data[i][0];
        var dbTahun = data[i][7] ? data[i][7] : "";
        
        return { 
          nisn: data[i][0], 
          nama: dbNama, 
          role: data[i][2],
          jurusan: data[i][4],
          tahun: dbTahun
        };
      }
    }
    
    return null; // Token tidak ditemukan (sesi sudah ditimpa/login di perangkat lain)
  },
  
  /**
   * --------------------------------------------------------------------------
   * 3. REGISTER SISWA BARU
   * --------------------------------------------------------------------------
   * Menerima payload data dari form registrasi, melakukan validasi duplikasi 
   * NISN, lalu menyimpan data ke sheet 'users' (sebagai akun) dan 'students_map' 
   * (untuk relasi antara siswa dan guru pembimbing).
   * * @param {Object} data - Payload dari frontend (nisn, nama, jurusan, tahun, nip_guru, password).
   * @returns {Object} JSON response status pendaftaran.
   */
  register: function(data) {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sUsers = ss.getSheetByName('users');
    var sMap = ss.getSheetByName('students_map'); 
    
    // Validasi Tahun: Gunakan tahun input, jika kosong gunakan tahun berjalan server
    var inputTahun = data.tahun || new Date().getFullYear();
    
    // Cek Duplikasi NISN di sheet 'users'
    var allUsers = sUsers.getDataRange().getDisplayValues();
    for(var i = 1; i < allUsers.length; i++) {
       if(String(allUsers[i][0]).trim() === String(data.nisn).trim()) {
         return { success: false, error: "Pendaftaran Gagal: NISN sudah terdaftar!" };
       }
    }
    
    try {
      // A. Simpan Akun Baru ke Sheet 'users'
      // Struktur Kolom: [Username(NISN), Password, Role, Nama, Jurusan, Token, Foto, Tahun]
      sUsers.appendRow([
        "'" + data.nisn,  // Gunakan tanda kutip tunggal agar Google Sheet membaca sebagai teks murni
        data.password, 
        'SISWA', 
        data.nama, 
        data.jurusan, 
        '',  // Token dikosongkan saat baru register
        '',  // Foto dikosongkan
        inputTahun 
      ]);
      
      // B. Simpan Relasi Siswa-Guru ke Sheet 'students_map'
      if (!sMap) sMap = ss.insertSheet('students_map'); // Auto-create sheet jika terhapus
      
      sMap.appendRow([
        "'" + data.nisn, 
        data.nama, 
        data.jurusan, 
        data.nip_guru 
      ]);
      
      return { success: true };
      
    } catch(e) {
      return { success: false, error: "Gagal menyimpan data ke server: " + e.toString() };
    }
  },
  
  /**
   * --------------------------------------------------------------------------
   * 4. AMBIL DAFTAR GURU (GET TEACHER LIST)
   * --------------------------------------------------------------------------
   * Digunakan oleh form registrasi siswa untuk memilih Guru Pembimbing.
   * Data diambil dari sheet 'teachers' dan diurutkan berdasarkan abjad (A-Z).
   * * @returns {Object} JSON response berisi array of objects (Daftar Guru).
   */
  getTeacherList: function() {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName('teachers');
    
    // Fallback: Jika penamaan sheet case-sensitive bermasalah, cari manual
    if (!sheet) {
      var sheets = ss.getSheets();
      for (var i = 0; i < sheets.length; i++) {
        if (sheets[i].getName().toLowerCase() === 'teachers') {
          sheet = sheets[i];
          break;
        }
      }
    }

    // Jika sheet benar-benar tidak ada, kembalikan array kosong (mencegah crash)
    if (!sheet) return { success: true, list: [] };

    // PENTING: Paksa server membaca state data terbaru (bypass internal cache GAS)
    SpreadsheetApp.flush();

    var lastRow = sheet.getLastRow();
    if (lastRow < 2) return { success: true, list: [] }; // Hanya ada baris header

    // Ambil rentang data spesifik (menghindari array kosong dari baris yang terformat tapi kosong)
    var data = sheet.getRange(2, 1, lastRow - 1, 2).getDisplayValues();
    var list = [];
    
    for(var i = 0; i < data.length; i++) {
      var nip = String(data[i][0]).trim();  // Bisa berisi ID Urut / NIP
      var nama = String(data[i][1]).trim(); // Nama Guru

      // Filter: Hanya ambil baris yang benar-benar memiliki isi
      if(nip !== "" && nama !== "") {
        list.push({
          nip: nip, 
          nama: nama
        });
      }
    }
    
    // Sorting Array: Urutkan nama guru secara alfabetis (A-Z)
    list.sort(function(a, b) {
      return a.nama.localeCompare(b.nama);
    });

    return { success: true, list: list };
  }
};
