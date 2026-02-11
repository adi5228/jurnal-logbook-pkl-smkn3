/**
 * STUDENTSERVICE.GS (Saved as StudentService.js)
 * Description:
 * Handles all logic related to student activities:
 * - Saving Logbook Entries
 * - Retrieving Personal Logbook History
 * - Loading Public Feed (Explore)
 * - Updating Profile Information (Photo, Password, etc.)
 * - Exporting Logbooks to PDF with Watermarks
 */

const StudentService = {

  /**
   * 1. SAVE LOGBOOK ENTRY
   * Saves a new logbook activity to the 'logbooks' sheet.
   * Handles photo upload to Google Drive if a base64 image is provided.
   * * @param {Object} user - The currently logged-in user object
   * @param {Object} data - Logbook data { tanggal, jam_mulai, jam_selesai, judul, deskripsi, foto }
   * @return {Object} { success: boolean }
   */
  saveLogbook: function(user, data) {
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('logbooks');
    const id = Utilities.getUuid(); 
    let fotoUrl = "";
    
    // --- HANDLE PHOTO UPLOAD ---
    if(data.foto && data.foto.includes('base64')) {
      try {
        // [SECURITY] REPLACE THIS ID WITH YOUR ACTUAL DRIVE FOLDER ID
        const folderId = "YOUR_DRIVE_FOLDER_ID_HERE"; 
        const folder = DriveApp.getFolderById(folderId);
        
        const base64Data = data.foto.split(',')[1];
        const blob = Utilities.newBlob(Utilities.base64Decode(base64Data), 'image/jpeg', "LOG_" + user.nisn + "_" + data.tanggal);
        
        const file = folder.createFile(blob);
        file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
        fotoUrl = "https://drive.google.com/thumbnail?id=" + file.getId() + "&sz=w1000"; 
      } catch(e) {
        Logger.log("Failed to Upload Photo: " + e.toString());
        fotoUrl = ""; // Continue saving even if photo fails
      }
    }
    
    // --- SAVE TO SHEET ---
    // Note: User.nisn is prepended with "'" to force string format in Sheets
    sheet.appendRow([
      id, 
      "'" + user.nisn, 
      "'" + data.tanggal, 
      "'" + data.jam_mulai, 
      "'" + data.jam_selesai, 
      data.judul, 
      data.deskripsi, 
      fotoUrl, 
      "", // Teacher feedback (empty initially)
      new Date()
    ]);
    
    return { success: true };
  },
  
  /**
   * 2. GET STUDENT HISTORY
   * Retrieves logbook entries specific to the logged-in student.
   * * @param {Object} user - The currently logged-in user
   * @return {Object} { success: boolean, list: Array }
   */
  getHistory: function(user) {
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('logbooks');
    const data = sheet.getDataRange().getDisplayValues();
    const list = [];
    
    // Iterate backwards to show newest first
    for(let i = data.length - 1; i >= 1; i--) {
      // Use trim() to ensure accurate string matching
      if(String(data[i][1]).trim() == String(user.nisn).trim()) {
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
   * 3. GET PUBLIC FEED (EXPLORE)
   * Retrieves recent logbook entries from OTHER students.
   * * @param {Object} currentUser - The logged-in user (to exclude their own posts)
   * @return {Object} { success: boolean, list: Array }
   */
  getPublicFeed: function(currentUser) {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sLogs = ss.getSheetByName('logbooks');
    const sUsers = ss.getSheetByName('users');
    
    const logs = sLogs.getDataRange().getDisplayValues();
    const users = sUsers.getDataRange().getDisplayValues();
    
    // Helper: Map NISN to User Profile Data
    const userMap = {};
    for(let i = 1; i < users.length; i++) {
      const fotoProfil = (users[i].length > 6) ? users[i][6] : "";
      userMap[String(users[i][0]).trim()] = { 
        nama: users[i][3], 
        jurusan: users[i][4],
        foto_profil: fotoProfil 
      };
    }
    
    const feed = [];
    const limit = 20; 
    let count = 0;

    for(let i = logs.length - 1; i >= 1; i--) {
      const logOwnerNisn = String(logs[i][1]).trim();
      
      // Exclude own posts
      if(logOwnerNisn !== String(currentUser.nisn).trim()) {
        const ownerData = userMap[logOwnerNisn] || { nama: 'Siswa', jurusan: '-', foto_profil: '' };
        
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
        if(count >= limit) break;
      }
    }
    return { success: true, list: feed };
  },

  /**
   * 4. UPDATE PROFILE
   * Updates student profile information (Name, Major, Password, Photo, Year).
   * * @param {Object} user - Current user object
   * @param {Object} newData - New data to update
   * @return {Object} { success: boolean, newPhotoUrl?: string }
   */
  updateProfile: function(user, newData) {
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('users');
    const data = sheet.getDataRange().getDisplayValues();
    const target = String(user.nisn).trim();
    let fotoUrl = "";

    // Handle Photo Upload if new photo provided
    if(newData.foto && newData.foto.includes('base64')) {
        try {
          const folderId = "YOUR_DRIVE_FOLDER_ID_HERE"; // Use same folder ID
          const folder = DriveApp.getFolderById(folderId);
          const base64Data = newData.foto.split(',')[1];
          const blob = Utilities.newBlob(Utilities.base64Decode(base64Data), 'image/jpeg', "PROFILE_" + user.nisn + "_" + new Date().getTime());
          const file = folder.createFile(blob);
          file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
          fotoUrl = "https://drive.google.com/thumbnail?id=" + file.getId() + "&sz=w600";
        } catch(e) {
          return { success: false, error: "Upload Failed: " + e.toString() };
        }
    }

    // Find and Update User Row
    for(let i = 1; i < data.length; i++) {
      if(String(data[i][0]).trim() == target) {
        const row = i + 1;
        
        if(newData.password && newData.password !== "") sheet.getRange(row, 2).setValue(newData.password);
        if(newData.nama) sheet.getRange(row, 4).setValue(newData.nama);
        if(newData.jurusan) sheet.getRange(row, 5).setValue(newData.jurusan);
        if(fotoUrl) sheet.getRange(row, 7).setValue(fotoUrl);
        if(newData.tahun) sheet.getRange(row, 8).setValue(newData.tahun); // Update Year (Col H)
        
        return { success: true, newPhotoUrl: fotoUrl };
      }
    }
    return { success: false, error: "User not found." };
  },

  /**
   * 5. EXPORT LOGBOOK TO PDF
   * Generates a Google Doc from logbook data, converts it to PDF, and returns the URL.
   * Includes a small NISN watermark in the header.
   * * @param {Object} user - The user requesting the export
   * @return {Object} { success: boolean, url?: string }
   */
  exportLogbook: function(user) {
    try {
      const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('logbooks');
      const data = sheet.getDataRange().getDisplayValues();
      const list = [];
      
      // Filter logbooks for this student
      for(let i = 1; i < data.length; i++) {
        const row = data[i];
        if(String(row[1]).trim() == String(user.nisn).trim()) {
           list.push({
             tanggal: row[2],
             jam: row[3] + ' - ' + row[4], 
             judul: row[5],
             deskripsi: row[6],
             fotoUrl: row[7] 
           });
        }
      }
      
      if(list.length === 0) return { success: false, error: "No logbook data to export." };

      // Create Temporary Doc
      const docName = "LAMPIRAN KEGIATAN - " + user.nama + " (" + user.nisn + ")";
      const doc = DocumentApp.create(docName);
      const docId = doc.getId(); 
      const body = doc.getBody();
      
      // --- HEADER WATERMARK ---
      const header = doc.addHeader();
      const headerText = header.appendParagraph("NISN: " + String(user.nisn));
      const smallHeaderStyle = {};
      smallHeaderStyle[DocumentApp.Attribute.HORIZONTAL_ALIGNMENT] = DocumentApp.HorizontalAlignment.RIGHT;
      smallHeaderStyle[DocumentApp.Attribute.FONT_FAMILY] = 'Arial';
      smallHeaderStyle[DocumentApp.Attribute.FONT_SIZE] = 9; 
      smallHeaderStyle[DocumentApp.Attribute.FOREGROUND_COLOR] = '#666666'; 
      headerText.setAttributes(smallHeaderStyle);

      // --- DOCUMENT CONTENT ---
      const styleTitle = {};
      styleTitle[DocumentApp.Attribute.HORIZONTAL_ALIGNMENT] = DocumentApp.HorizontalAlignment.CENTER;
      styleTitle[DocumentApp.Attribute.FONT_FAMILY] = 'Times New Roman';
      styleTitle[DocumentApp.Attribute.FONT_SIZE] = 12;
      styleTitle[DocumentApp.Attribute.BOLD] = true;

      body.appendParagraph("REKAPITULASI KEGIATAN").setAttributes(styleTitle);
      body.appendParagraph("PRAKTIK KERJA LAPANGAN (PKL)").setAttributes(styleTitle);
      body.appendParagraph("SMK NEGERI 3 KENDARI").setAttributes(styleTitle);
      body.appendParagraph(""); 

      // Bio Data Table
      const bioData = [
        ["Nama Siswa", ":", user.nama],
        ["Nomor Induk (NISN)", ":", user.nisn],
        ["Kompetensi Keahlian", ":", user.jurusan],
        ["Tempat PKL", ":", ".........................................................................................."] 
      ];

      const bioTable = body.appendTable(bioData);
      bioTable.setBorderWidth(0); 
      bioTable.setColumnWidth(0, 140); 
      bioTable.setColumnWidth(1, 20); 
      bioTable.setColumnWidth(2, 300);
      
      const styleBio = {};
      styleBio[DocumentApp.Attribute.FONT_FAMILY] = 'Times New Roman';
      styleBio[DocumentApp.Attribute.FONT_SIZE] = 11;
      
      for (let r = 0; r < bioTable.getNumRows(); r++) {
         const rowBio = bioTable.getRow(r);
         for (let c = 0; c < rowBio.getNumCells(); c++) {
            const cell = rowBio.getCell(c);
            cell.setPaddingTop(2).setPaddingBottom(2);
            if(cell.getNumChildren() > 0) cell.getChild(0).asParagraph().setAttributes(styleBio);
         }
      }

      body.appendParagraph(""); 

      // Main Data Table
      const table = body.appendTable();
      const headerRow = table.appendTableRow();
      const headers = ["No", "Hari/Tanggal", "Waktu (WITA)", "Uraian Kegiatan", "Foto Dokumentasi"];
      
      for(let k=0; k<headers.length; k++) {
         const cell = headerRow.appendTableCell(headers[k]);
         cell.setBackgroundColor('#EFEFEF');
         cell.getChild(0).asParagraph().setAlignment(DocumentApp.HorizontalAlignment.CENTER);
         cell.getChild(0).asText().setBold(true).setFontFamily('Times New Roman').setFontSize(11);
         cell.setVerticalAlignment(DocumentApp.VerticalAlignment.CENTER);
      }

      for(let j=0; j<list.length; j++) {
        const rowContent = table.appendTableRow();
        rowContent.setMinimumHeight(60); 

        const uraianStr = list[j].judul.toUpperCase() + "\n" + list[j].deskripsi;
        rowContent.appendTableCell(String(j+1));
        rowContent.appendTableCell(list[j].tanggal);
        rowContent.appendTableCell(list[j].jam);
        rowContent.appendTableCell(uraianStr);
        
        const photoCell = rowContent.appendTableCell();
        const url = list[j].fotoUrl;
        
        if(url && url.includes("id=")) {
           try {
             const fileId = url.split('id=')[1].split('&')[0];
             const imageBlob = DriveApp.getFileById(fileId).getBlob();
             const image = photoCell.insertImage(0, imageBlob);
             image.setWidth(100);
             image.setHeight(75);
             photoCell.getChild(0).asParagraph().setAlignment(DocumentApp.HorizontalAlignment.CENTER);
           } catch(err) {
             photoCell.setText("(Image Error)");
           }
        } else {
           photoCell.setText("-");
        }
      }
      
      // Formatting Main Table
      table.setColumnWidth(0, 30);
      table.setColumnWidth(1, 70);
      table.setColumnWidth(2, 60);
      table.setColumnWidth(3, 180);
      table.setColumnWidth(4, 120);
      
      for (let r = 1; r < table.getNumRows(); r++) {
         const rowTbl = table.getRow(r);
         for (let c = 0; c < rowTbl.getNumCells(); c++) {
            const cell = rowTbl.getCell(c);
            cell.setVerticalAlignment(DocumentApp.VerticalAlignment.TOP);
            cell.setPaddingTop(4).setPaddingBottom(4);
            if(cell.getNumChildren() > 0 && cell.getChild(0).getType() == DocumentApp.ElementType.PARAGRAPH) {
               const par = cell.getChild(0).asParagraph();
               if(par.getNumChildren() > 0) {
                  par.setFontFamily('Times New Roman').setFontSize(10); 
                  if(c !== 3) par.setAlignment(DocumentApp.HorizontalAlignment.CENTER);
               }
            }
         }
      }

      body.appendParagraph(""); body.appendParagraph(""); 

      // Signature Section
      const today = new Date();
      const dateStr = Utilities.formatDate(today, "Asia/Makassar", "dd MMMM yyyy");
      
      const signTable = body.appendTable([
        ["Mengetahui,", "Kendari, " + dateStr],
        ["Pembimbing Lapangan/Industri,", "Guru Pembimbing,"],
        ["\n\n\n\n", "\n\n\n\n"], 
        ["(....................................................)", "(....................................................)"],
        ["", "NIP. ...................................................."] 
      ]);
      signTable.setBorderWidth(0); 
      for(let r=0; r<signTable.getNumRows(); r++) {
        const rowSign = signTable.getRow(r);
        for (let c=0; c<rowSign.getNumCells(); c++) {
           const cell = rowSign.getCell(c);
           if(cell.getNumChildren() > 0) {
              const p = cell.getChild(0).asParagraph();
              p.setAlignment(DocumentApp.HorizontalAlignment.CENTER);
              p.setFontFamily('Times New Roman').setFontSize(11);
           }
        }
      }

      doc.saveAndClose();

      // Convert to PDF
      const docFile = DriveApp.getFileById(docId);
      const pdfBlob = docFile.getAs('application/pdf');
      const pdfFile = DriveApp.createFile(pdfBlob);
      
      // Set Permission
      pdfFile.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);

      // Delete Temp Doc
      docFile.setTrashed(true);

      return { success: true, url: pdfFile.getUrl() };

    } catch(e) {
      return { success: false, error: "Export Failed: " + e.toString() };
    }
  }
};