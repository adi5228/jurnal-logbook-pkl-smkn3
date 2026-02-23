/**
 * ============================================================================
 * STUDENT SERVICE
 * Deskripsi: Modul backend yang menangani seluruh logika bisnis untuk pengguna
 * dengan role 'SISWA'. Mencakup operasi CRUD Logbook, upload foto ke Google Drive,
 * pengambilan timeline kegiatan, update profil, dan export laporan ke bentuk PDF.
 * ============================================================================
 */

var StudentService = {

  /**
   * --------------------------------------------------------------------------
   * 1. SIMPAN ATAU UPDATE LOGBOOK
   * --------------------------------------------------------------------------
   * Menerima payload dari form siswa. Jika payload memiliki ID, maka sistem akan
   * melakukan UPDATE pada baris yang sesuai. Jika tidak, akan membuat baris BARU.
   * Fungsi ini juga menangani konversi base64 image menjadi file di Google Drive.
   * * @param {Object} user - Objek data user yang sedang login (didapat dari token).
   * @param {Object} data - Payload data logbook (tanggal, jam, judul, deskripsi, foto).
   * @returns {Object} JSON response status keberhasilan.
   */
  saveLogbook: function(user, data) {
    var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('logbooks');
    var fotoUrl = "";
    
    // --- UPLOAD FOTO KEGIATAN KE GOOGLE DRIVE ---
    // Cek apakah data foto berupa string base64 yang valid
    if(data.foto && data.foto.includes('base64')) {
      try {
        // ID Folder Drive tempat menyimpan foto bukti kegiatan siswa
        var folderId = "1sn7os4yRxYA72kIlcmVkrT67nUOEgtOO"; 
        var folder = DriveApp.getFolderById(folderId);
        
        // Memisahkan metadata base64 dari string utamanya
        var base64Data = data.foto.split(',')[1];
        
        // Membuat nama file unik berdasarkan NISN, Tanggal, dan Timestamp
        var blob = Utilities.newBlob(Utilities.base64Decode(base64Data), 'image/jpeg', "LOG_" + user.nisn + "_" + data.tanggal + "_" + new Date().getTime());
        
        // Simpan file dan atur izin akses (Publik bisa melihat agar bisa di-load di tag <img>)
        var file = folder.createFile(blob);
        file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
        
        // Dapatkan URL thumbnail langsung dari Google Drive untuk mempercepat load gambar di web
        fotoUrl = "https://drive.google.com/thumbnail?id=" + file.getId() + "&sz=w1000"; 
      } catch(e) {
        Logger.log("Gagal Upload Foto Logbook: " + e.toString());
        fotoUrl = "";
      }
    }
    
    // --- LOGIKA PERCABANGAN: UPDATE vs CREATE ---
    if (data.id) {
       // === MODE EDIT (UPDATE) ===
       var rows = sheet.getDataRange().getDisplayValues();
       var updated = false;

       // Looping baris data logbook
       for(var i = 1; i < rows.length; i++) {
          // Pengecekan Keamanan Ganda: 
          // 1. ID Logbook harus cocok
          // 2. NISN di baris logbook tersebut HARUS sama dengan NISN user yang sedang login.
          // Fungsi replace(/'/g, '') digunakan karena Google Sheet sering menyimpan string angka dengan tanda kutip awalan (').
          if(String(rows[i][0]) === String(data.id) && String(rows[i][1]).replace(/'/g, '').trim() === String(user.nisn).trim()) {
             var row = i + 1; // Index array + 1 karena row di spreadsheet dimulai dari 1
             
             // Update Data Sel per Kolom
             sheet.getRange(row, 3).setValue("'" + data.tanggal);      // Kolom C: Tanggal
             sheet.getRange(row, 4).setValue("'" + data.jam_mulai);    // Kolom D: Jam Mulai
             sheet.getRange(row, 5).setValue("'" + data.jam_selesai);  // Kolom E: Jam Selesai
             sheet.getRange(row, 6).setValue(data.judul);              // Kolom F: Judul
             sheet.getRange(row, 7).setValue(data.deskripsi);          // Kolom G: Deskripsi
             
             // Hanya update kolom foto jika user mengunggah foto baru. Jika tidak, biarkan foto lama.
             if(fotoUrl !== "") {
                sheet.getRange(row, 8).setValue(fotoUrl);              // Kolom H: URL Foto
             }
             
             // Update Timestamp edit terakhir
             sheet.getRange(row, 10).setValue(new Date());
             
             updated = true;
             break;
          }
       }
       
       if(updated) {
         return { success: true };
       } else {
         return { success: false, error: "Gagal update. Data tidak ditemukan atau Anda tidak memiliki akses ke logbook ini." };
       }

    } else {
       // === MODE BARU (CREATE) ===
       var id = Utils.generateToken(); // Menggunakan helper pembuat UUID
       
       // Tambahkan baris baru ke bawah
       // Tanda kutip satu (') ditambahkan agar Excel/Sheet tidak otomatis mengubah format jam atau mengubah angka menjadi scientific.
       sheet.appendRow([
         id, 
         "'" + user.nisn, 
         "'" + data.tanggal, 
         "'" + data.jam_mulai, 
         "'" + data.jam_selesai, 
         data.judul, 
         data.deskripsi, 
         fotoUrl, 
         "", // Kolom Feedback guru dikosongkan pada pembuatan awal
         new Date()
       ]);
       
       return { success: true };
    }
  },

  /**
   * --------------------------------------------------------------------------
   * 2. HAPUS LOGBOOK
   * --------------------------------------------------------------------------
   * Menghapus baris logbook secara spesifik. Diperketat dengan validasi NISN
   * agar siswa hanya bisa menghapus jurnal miliknya sendiri.
   * * @param {Object} user - Objek user yang sedang login.
   * @param {string} logId - UUID dari logbook yang ingin dihapus.
   */
  deleteLogbook: function(user, logId) {
    var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('logbooks');
    var rows = sheet.getDataRange().getDisplayValues();
    
    // Cari baris yang sesuai
    for(var i = 1; i < rows.length; i++) {
       // Validasi keamanan: Pastikan ID cocok DAN yang menghapus adalah pemilik logbook
       if(String(rows[i][0]) === String(logId) && String(rows[i][1]).replace(/'/g, '').trim() === String(user.nisn).trim()) {
          sheet.deleteRow(i + 1); // Hapus seluruh baris
          return { success: true };
       }
    }
    return { success: false, error: "Gagal menghapus. Data tidak ditemukan atau Anda tidak memiliki hak akses." };
  },
  
  /**
   * --------------------------------------------------------------------------
   * 3. LIHAT RIWAYAT SENDIRI
   * --------------------------------------------------------------------------
   * Menarik data logbook dari database khusus untuk NISN siswa yang sedang login.
   * * @param {Object} user - Objek user yang sedang login.
   * @returns {Object} JSON berisi array data logbook.
   */
  getHistory: function(user) {
    var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('logbooks');
    var data = sheet.getDataRange().getDisplayValues();
    var list = [];
    
    // Looping dari index terbawah ke atas (Reverse Loop) 
    // agar data yang terbaru (paling bawah di sheet) muncul paling atas di UI web.
    for(var i = data.length - 1; i >= 1; i--) {
      // Filter berdasarkan NISN
      if(String(data[i][1]).replace(/'/g, '').trim() === String(user.nisn).trim()) {
        list.push({
          id: data[i][0],
          tanggal: data[i][2],
          jam_mulai: data[i][3], 
          jam_selesai: data[i][4],
          judul: data[i][5],
          deskripsi: data[i][6],
          foto: data[i][7],
          feedback: data[i][8]
        });
      }
    }
    return { success: true, list: list };
  },

  /**
   * --------------------------------------------------------------------------
   * 4. JELAJAH / PUBLIC FEED
   * --------------------------------------------------------------------------
   * Menampilkan lini masa (timeline) jurnal dari seluruh siswa LAINNYA.
   * Sangat berguna untuk memberikan referensi/inspirasi kegiatan antar siswa.
   * * @param {Object} currentUser - Objek user yang sedang login.
   * @returns {Object} JSON berisi array data public feed.
   */
  getPublicFeed: function(currentUser) {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sLogs = ss.getSheetByName('logbooks');
    var sUsers = ss.getSheetByName('users');
    
    var logs = sLogs.getDataRange().getDisplayValues();
    var users = sUsers.getDataRange().getDisplayValues();
    
    // Membuat Hash Map (Dictionary) User untuk mempercepat proses pencarian data profil (nama, jurusan, foto)
    // dibandingkan harus melakukan loop array berulang kali untuk setiap baris logbook.
    var userMap = {};
    for(var i = 1; i < users.length; i++) {
      var fotoProfil = (users[i].length > 6) ? users[i][6] : "";
      userMap[String(users[i][0]).trim()] = { 
        nama: users[i][3], 
        jurusan: users[i][4],
        foto_profil: fotoProfil 
      };
    }
    
    var feed = [];
    var limit = 20; // Batasi maksimal 20 post terbaru untuk menghemat load memory
    var count = 0;

    // Loop logbook dari bawah ke atas (Terbaru)
    for(var i = logs.length - 1; i >= 1; i--) {
      var logOwnerNisn = String(logs[i][1]).replace(/'/g, '').trim();
      
      // Jangan tampilkan logbook milik sendiri di halaman public feed
      if(logOwnerNisn !== String(currentUser.nisn).trim()) {
        var ownerData = userMap[logOwnerNisn] || { nama: 'Siswa', jurusan: '-', foto_profil: '' };
        
        feed.push({
          owner_nama: ownerData.nama,
          owner_jurusan: ownerData.jurusan,
          owner_foto: ownerData.foto_profil, 
          tanggal: logs[i][2],
          judul: logs[i][5],
          deskripsi: logs[i][6],
          foto: logs[i][7]
        });
        
        count++;
        if(count >= limit) break; // Berhenti jika sudah mencapai batas limit
      }
    }
    return { success: true, list: feed };
  },

  /**
   * --------------------------------------------------------------------------
   * 5. UPDATE PROFIL
   * --------------------------------------------------------------------------
   * Menyimpan perubahan data diri siswa termasuk upload foto profil baru.
   * * @param {Object} user - User aktif
   * @param {Object} newData - Payload berisi field-field profil yang diedit
   */
  updateProfile: function(user, newData) {
    var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('users');
    var data = sheet.getDataRange().getDisplayValues();
    var target = String(user.nisn).trim();
    var fotoUrl = "";

    // Upload Foto Profil jika ada data image yang dikirim
    if(newData.foto && newData.foto.includes('base64')) {
        try {
          var folderId = "1sn7os4yRxYA72kIlcmVkrT67nUOEgtOO"; // Pastikan ID ini valid dan open akses
          var folder = DriveApp.getFolderById(folderId);
          var base64Data = newData.foto.split(',')[1];
          var blob = Utilities.newBlob(Utilities.base64Decode(base64Data), 'image/jpeg', "PROFILE_" + user.nisn + "_" + new Date().getTime());
          var file = folder.createFile(blob);
          file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
          
          // Ukuran thumbnail lebih kecil untuk profil (sz=w600)
          fotoUrl = "https://drive.google.com/thumbnail?id=" + file.getId() + "&sz=w600";
        } catch(e) {
          return { success: false, error: "Gagal upload foto profil: " + e.toString() };
        }
    }

    // Cari User di database dan lakukan pembaruan
    for(var i = 1; i < data.length; i++) {
      if(String(data[i][0]).replace(/'/g, '').trim() === target) {
        var row = i + 1;
        
        // Update data HANYA jika field tersebut diisi
        if(newData.password && newData.password !== "") sheet.getRange(row, 2).setValue(newData.password);
        if(newData.nama) sheet.getRange(row, 4).setValue(newData.nama);
        if(newData.jurusan) sheet.getRange(row, 5).setValue(newData.jurusan);
        if(fotoUrl) sheet.getRange(row, 7).setValue(fotoUrl);
        if(newData.tahun) sheet.getRange(row, 8).setValue(newData.tahun);
        
        return { success: true, newPhotoUrl: fotoUrl }; // Kembalikan URL baru agar UI bisa update langsung tanpa reload
      }
    }
    return { success: false, error: "Data User tidak ditemukan dalam sistem." };
  },

  /**
   * --------------------------------------------------------------------------
   * 6. EXPORT LOGBOOK KE PDF
   * --------------------------------------------------------------------------
   * Men-generate laporan jurnal PKL siswa ke dalam bentuk dokumen Google Docs
   * yang telah diformat sedemikian rupa, lalu dikonversi menjadi file PDF statis
   * agar bisa di-print sebagai lampiran.
   * * @param {Object} user - Objek user aktif
   * @returns {Object} JSON berisi URL PDF yang bisa di-download/view oleh siswa
   */
  exportLogbook: function(user) {
    try {
      var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('logbooks');
      var data = sheet.getDataRange().getDisplayValues();
      var list = [];
      
      // Mengumpulkan semua logbook milik siswa bersangkutan
      for(var i = 1; i < data.length; i++) {
        var row = data[i];
        if(String(row[1]).replace(/'/g, '').trim() === String(user.nisn).trim()) {
           list.push({
             tanggal: row[2],
             jam: row[3] + ' - ' + row[4], 
             judul: row[5],
             deskripsi: row[6],
             fotoUrl: row[7] 
           });
        }
      }
      
      if(list.length === 0) return { success: false, error: "Anda belum memiliki entri jurnal untuk diexport." };

      // --- MEMBUAT GOOGLE DOCS SEMENTARA ---
      var docName = "LAMPIRAN KEGIATAN PKL - " + user.nama + " (" + user.nisn + ")";
      var doc = DocumentApp.create(docName);
      var docId = doc.getId(); 
      var body = doc.getBody();
      
      // A. HEADER HALAMAN (NISN Kecil di pojok kanan atas)
      var header = doc.addHeader();
      var headerText = header.appendParagraph("NISN: " + String(user.nisn));
      var smallHeaderStyle = {};
      smallHeaderStyle[DocumentApp.Attribute.HORIZONTAL_ALIGNMENT] = DocumentApp.HorizontalAlignment.RIGHT;
      smallHeaderStyle[DocumentApp.Attribute.FONT_FAMILY] = 'Arial';
      smallHeaderStyle[DocumentApp.Attribute.FONT_SIZE] = 9;
      smallHeaderStyle[DocumentApp.Attribute.FOREGROUND_COLOR] = '#666666';
      headerText.setAttributes(smallHeaderStyle);

      // B. JUDUL UTAMA DOKUMEN
      var styleTitle = {};
      styleTitle[DocumentApp.Attribute.HORIZONTAL_ALIGNMENT] = DocumentApp.HorizontalAlignment.CENTER;
      styleTitle[DocumentApp.Attribute.FONT_FAMILY] = 'Times New Roman';
      styleTitle[DocumentApp.Attribute.FONT_SIZE] = 12;
      styleTitle[DocumentApp.Attribute.BOLD] = true;

      body.appendParagraph("REKAPITULASI KEGIATAN").setAttributes(styleTitle);
      body.appendParagraph("PRAKTIK KERJA LAPANGAN (PKL)").setAttributes(styleTitle);
      body.appendParagraph("SMK NEGERI 3 KENDARI").setAttributes(styleTitle);
      body.appendParagraph(""); // Spasi

      // C. BAGIAN BIODATA SISWA (Menggunakan tabel tanpa border untuk layout)
      var bioData = [
        ["Nama Siswa", ":", user.nama],
        ["Nomor Induk (NISN)", ":", user.nisn],
        ["Kompetensi Keahlian", ":", user.jurusan],
        ["Tempat PKL", ":", ".........................................................................................."] 
      ];

      var bioTable = body.appendTable(bioData);
      bioTable.setBorderWidth(0); 
      bioTable.setColumnWidth(0, 140); 
      bioTable.setColumnWidth(1, 20); 
      bioTable.setColumnWidth(2, 300);
      
      var styleBio = {};
      styleBio[DocumentApp.Attribute.FONT_FAMILY] = 'Times New Roman';
      styleBio[DocumentApp.Attribute.FONT_SIZE] = 11;
      
      // Terapkan style ke sel-sel tabel biodata
      for (var r = 0; r < bioTable.getNumRows(); r++) {
         var rowBio = bioTable.getRow(r);
         for (var c = 0; c < rowBio.getNumCells(); c++) {
            var cell = rowBio.getCell(c);
            cell.setPaddingTop(2).setPaddingBottom(2);
            if(cell.getNumChildren() > 0) cell.getChild(0).asParagraph().setAttributes(styleBio);
         }
      }

      body.appendParagraph(""); 

      // D. TABEL REKAPITULASI JURNAL
      var table = body.appendTable();
      var headerRow = table.appendTableRow();
      var headers = ["No", "Hari/Tanggal", "Waktu (WITA)", "Uraian Kegiatan", "Foto Dokumentasi"];
      
      // Formatting Header Tabel Jurnal
      for(var k = 0; k < headers.length; k++) {
         var cellHeader = headerRow.appendTableCell(headers[k]);
         cellHeader.setBackgroundColor('#EFEFEF'); // Abu-abu muda
         cellHeader.getChild(0).asParagraph().setAlignment(DocumentApp.HorizontalAlignment.CENTER);
         cellHeader.getChild(0).asText().setBold(true).setFontFamily('Times New Roman').setFontSize(11);
         cellHeader.setVerticalAlignment(DocumentApp.VerticalAlignment.CENTER);
      }

      // Memasukkan list jurnal ke dalam baris tabel
      for(var j = 0; j < list.length; j++) {
        var rowContent = table.appendTableRow();
        rowContent.setMinimumHeight(60); 

        // Gabungkan Judul (Capslock) dengan Deskripsi untuk efisiensi kolom
        var uraianStr = list[j].judul.toUpperCase() + "\n" + list[j].deskripsi;
        
        rowContent.appendTableCell(String(j+1));
        rowContent.appendTableCell(list[j].tanggal);
        rowContent.appendTableCell(list[j].jam);
        rowContent.appendTableCell(uraianStr);
        
        var photoCell = rowContent.appendTableCell();
        var url = list[j].fotoUrl;
        
        // Pengecekan URL Foto & Proses Penyisipan Gambar ke Google Docs
        if(url && url.includes("id=")) {
           try {
             // Ekstrak file ID dari struktur link Google Drive Thumbnail
             var fileId = url.split('id=')[1].split('&')[0];
             var imageBlob = DriveApp.getFileById(fileId).getBlob();
             var image = photoCell.insertImage(0, imageBlob);
             // Resize ukuran gambar agar proporsional di dalam tabel A4
             image.setWidth(100);
             image.setHeight(75);
             photoCell.getChild(0).asParagraph().setAlignment(DocumentApp.HorizontalAlignment.CENTER);
           } catch(err) {
             photoCell.setText("(Gagal muat foto)");
           }
        } else {
           photoCell.setText("-"); // Beri tanda strip jika tidak melampirkan foto
        }
      }
      
      // Pengaturan Lebar Kolom Tabel Jurnal agar pas di Kertas A4 (Satuan pt)
      table.setColumnWidth(0, 30);
      table.setColumnWidth(1, 70);
      table.setColumnWidth(2, 60);
      table.setColumnWidth(3, 180);
      table.setColumnWidth(4, 120);
      
      // Styling Teks di dalam sel tabel (Times New Roman 10pt)
      for (var rTbl = 1; rTbl < table.getNumRows(); rTbl++) {
         var rowTbl = table.getRow(rTbl);
         for (var cTbl = 0; cTbl < rowTbl.getNumCells(); cTbl++) {
            var cellTbl = rowTbl.getCell(cTbl);
            cellTbl.setVerticalAlignment(DocumentApp.VerticalAlignment.TOP);
            cellTbl.setPaddingTop(4).setPaddingBottom(4);
            if(cellTbl.getNumChildren() > 0 && cellTbl.getChild(0).getType() == DocumentApp.ElementType.PARAGRAPH) {
               var par = cellTbl.getChild(0).asParagraph();
               if(par.getNumChildren() > 0) {
                  par.setFontFamily('Times New Roman').setFontSize(10); 
                  // Rata tengah untuk semua kolom KECUALI uraian kegiatan (kolom indeks 3)
                  if(cTbl !== 3) par.setAlignment(DocumentApp.HorizontalAlignment.CENTER);
               }
            }
         }
      }

      body.appendParagraph(""); body.appendParagraph(""); 

      // E. BAGIAN TANDA TANGAN PENGESAHAN
      var today = new Date();
      var dateStr = Utilities.formatDate(today, "Asia/Makassar", "dd MMMM yyyy"); // Format: 30 Januari 2026
      
      var signTable = body.appendTable([
        ["Mengetahui,", "Kendari, " + dateStr],
        ["Pembimbing Lapangan/Industri,", "Guru Pembimbing,"],
        ["\n\n\n\n", "\n\n\n\n"], // Space untuk tanda tangan basah
        ["(....................................................)", "(....................................................)"],
        ["", "NIP. ...................................................."] 
      ]);
      
      signTable.setBorderWidth(0); // Sembunyikan garis border
      
      for(var rSign = 0; rSign < signTable.getNumRows(); rSign++) {
        var rowSign = signTable.getRow(rSign);
        for (var cSign = 0; cSign < rowSign.getNumCells(); cSign++) {
           var cellSign = rowSign.getCell(cSign);
           if(cellSign.getNumChildren() > 0) {
              var pSign = cellSign.getChild(0).asParagraph();
              pSign.setAlignment(DocumentApp.HorizontalAlignment.CENTER); // Rata tengah teks tanda tangan
              pSign.setFontFamily('Times New Roman').setFontSize(11);
           }
        }
      }

      // Wajib di-save untuk memastikan konten ter-write ke storage
      doc.saveAndClose();

      // F. PROSES KONVERSI GOOGLE DOCS KE PDF
      var docFile = DriveApp.getFileById(docId);
      var pdfBlob = docFile.getAs('application/pdf');
      var pdfFile = DriveApp.createFile(pdfBlob); // Buat file PDF di Drive
      
      pdfFile.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
      docFile.setTrashed(true); // Hapus dokumen Google Docs temporary tadi ke tong sampah

      // Mengembalikan URL PDF langsung
      return { success: true, url: pdfFile.getUrl() };

    } catch(e) {
      return { success: false, error: "Gagal membuat dokumen Export PDF: " + e.toString() };
    }
  }
};
