/**
 * ============================================================================
 * SUPERVISOR SERVICE
 * Deskripsi: Modul backend yang menangani logika bisnis untuk peran
 * 'PEMBIMBING LAPANGAN' (Supervisor/Instruktur dari Pihak Industri/DUDI).
 * Modul ini menggunakan token statis ('SUPERVISOR_ACCESS') sehingga
 * pembimbing dari luar sekolah bisa memantau siswa secara praktis 
 * tanpa harus melalui proses registrasi akun yang rumit.
 * ============================================================================
 */

var SupervisorService = {
  
  /**
   * --------------------------------------------------------------------------
   * 1. FEED UMUM (TIMELINE AKTIVITAS GLOBAL)
   * --------------------------------------------------------------------------
   * Mengambil data logbook terbaru dari semua siswa untuk ditampilkan 
   * layaknya timeline media sosial. Berguna agar pembimbing bisa memantau
   * kegiatan anak-anak magang secara real-time.
   * * @returns {Object} JSON berisi array of objects dari 30 logbook terbaru.
   */
  getPublicFeed: function() {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sLogs = ss.getSheetByName('logbooks');
    var sUsers = ss.getSheetByName('users');
    
    // Validasi keamanan: Pastikan sheet benar-benar ada di database
    if (!sLogs || !sUsers) return { success: true, list: [] };
    
    // Ambil seluruh data dari sheet sekaligus untuk meminimalisir panggilan API ke Google
    var logs = sLogs.getDataRange().getDisplayValues();
    var users = sUsers.getDataRange().getDisplayValues();
    
    // A. TEKNIK OPTIMASI: Buat Kamus Data User (HashMap)
    // Tujuannya agar kita tidak perlu melakukan perulangan (loop) ke data 'users'
    // setiap kali membaca baris 'logbooks'. Ini mempercepat proses secara drastis.
    // Format Kamus: { "NISN_1": {nama, jurusan, foto}, "NISN_2": {...} }
    var userMap = {};
    for(var i = 1; i < users.length; i++) {
      // Index kolom: 0=NISN, 3=Nama, 4=Jurusan, 6=Foto Profil
      var fotoProfil = (users[i].length > 6) ? users[i][6] : "";
      userMap[users[i][0]] = { 
        nama: users[i][3], 
        jurusan: users[i][4], 
        foto_profil: fotoProfil 
      };
    }
    
    // B. PROSES AMBIL LOGBOOK TERBARU
    var feed = [];
    var limit = 30; // Dibatasi maksimal 30 post agar browser client tidak berat (lagging)
    var count = 0;

    // Loop array dari belakang (index terbesar ke terkecil) agar data terbaru tampil duluan
    for(var j = logs.length - 1; j >= 1; j--) {
      var logOwnerNisn = String(logs[j][1]).trim();
      
      // Ambil data pemilik logbook dari kamus yang dibuat di langkah A
      var ownerData = userMap[logOwnerNisn] || { nama: 'Siswa', jurusan: '-', foto_profil: '' };
      
      feed.push({
        owner_nama: ownerData.nama,
        owner_jurusan: ownerData.jurusan,
        owner_foto: ownerData.foto_profil,
        tanggal: logs[j][2],
        judul: logs[j][5],
        deskripsi: logs[j][6],
        foto: logs[j][7] // Tautan foto bukti kegiatan
      });
      
      count++;
      if(count >= limit) break; // Hentikan loop jika kuota limit sudah terpenuhi
    }
    
    return { success: true, list: feed };
  },

  /**
   * --------------------------------------------------------------------------
   * 2. PENCARIAN SISWA (SEARCH ENGINE SEDERHANA)
   * --------------------------------------------------------------------------
   * Mencari profil siswa di database berdasarkan input teks (Nama atau NISN).
   * Pencarian tidak bersifat case-sensitive (huruf besar/kecil tidak masalah).
   * * @param {string} query - Kata kunci pencarian yang diketik oleh pembimbing.
   * @returns {Object} JSON berisi array profil siswa yang cocok (maksimal 10 data).
   */
  searchStudent: function(query) {
    var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('users');
    var data = sheet.getDataRange().getDisplayValues();
    var results = [];
    
    // Normalisasi input: ubah ke huruf kecil dan hilangkan spasi berlebih
    var q = String(query).toLowerCase().trim();
    
    // Mencegah pencarian berlebih: Minimal 2 karakter untuk mulai mencari
    if(q.length < 2) return { success: true, list: [] };

    for(var i = 1; i < data.length; i++) {
      // Struktur Kolom: 0=NISN, 2=Role, 3=Nama, 4=Jurusan, 6=Foto
      var role = String(data[i][2]).toUpperCase();
      var nisn = String(data[i][0]).toLowerCase();
      var nama = String(data[i][3]).toLowerCase();
      
      // Filter: Harus berstatus 'SISWA' dan kata kunci ada di Nama ATAU NISN
      if (role === 'SISWA' && (nama.includes(q) || nisn.includes(q))) {
         results.push({
           nisn: data[i][0], // Kembalikan format asli (case sensitive) ke frontend
           nama: data[i][3], 
           jurusan: data[i][4],
           foto: (data[i].length > 6) ? data[i][6] : ""
         });
      }
      
      // Batasi hasil pencarian maksimal 10 data
      // Berguna agar tampilan UI di mobile tidak memanjang terlalu ekstrem
      if(results.length >= 10) break; 
    }
    
    return { success: true, list: results };
  },

  /**
   * --------------------------------------------------------------------------
   * 3. LIHAT DETAIL LOGBOOK SISWA TERTENTU
   * --------------------------------------------------------------------------
   * Menarik seluruh riwayat kegiatan (logbook) dari satu siswa spesifik
   * saat pembimbing meng-klik nama siswa dari hasil pencarian.
   * * @param {string} nisn - Nomor Induk Siswa Nasional target.
   * @returns {Object} JSON berisi array riwayat kegiatan khusus siswa tersebut.
   */
  getStudentLogs: function(nisn) {
    var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('logbooks');
    var data = sheet.getDataRange().getDisplayValues();
    var list = [];
    var target = String(nisn).trim();
    
    // Loop dari bawah (Terbaru ke terlama)
    for(var i = data.length - 1; i >= 1; i--) {
      
      // Cek kecocokan kolom NISN (Index 1). 
      // Menggunakan operator '===' dan trim() untuk akurasi mutlak.
      if(String(data[i][1]).trim() === target) {
        list.push({
          tanggal: data[i][2],
          jam: data[i][3] + ' - ' + data[i][4], // Format gabungan jam mulai dan selesai
          judul: data[i][5],
          deskripsi: data[i][6],
          foto: data[i][7],     // Link gambar bukti
          feedback: data[i][8]  // Catatan persetujuan dari Guru Pembimbing Sekolah
        });
      }
    }
    
    return { success: true, list: list };
  }
};
