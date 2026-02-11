/**
 * ADMINSERVICE.GS (Saved as AdminService.js)
 * Description:
 * Manages all administrative functions:
 * - Dashboard Statistics (Counts of Students, Teachers, Logbooks)
 * - User Management (CRUD: Create, Read, Update, Delete Users)
 * - Monitoring Logbook Submissions
 * - Admin Password Change
 * - Auto-sync between 'users' and 'teachers'/'students_map' sheets
 */

const AdminService = {
  
  /**
   * 0. GET AVAILABLE YEARS
   * Scans 'users' and 'logbooks' sheets to find all unique years present in the data.
   * Used to populate dropdown filters on the Admin Dashboard.
   * * @return {Object} { success: boolean, years: Array<string> }
   */
  getAvailableYears: function() {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sUsers = ss.getSheetByName('users');
    const sLogs = ss.getSheetByName('logbooks');
    const years = new Set(); 

    // 1. Scan Years from Users (Column H / Index 7)
    if (sUsers) {
      const uData = sUsers.getDataRange().getDisplayValues();
      for (let i = 1; i < uData.length; i++) {
        const y = String(uData[i][7]).trim();
        // Regex to ensure only 4-digit years are added
        if (y && y.match(/^\d{4}$/)) years.add(y); 
      }
    }

    // 2. Scan Years from Logbooks (Column C / Index 2)
    if (sLogs) {
      const lData = sLogs.getDataRange().getDisplayValues();
      for (let i = 1; i < lData.length; i++) {
        try {
           const d = new Date(lData[i][2]);
           if(!isNaN(d.getTime())) years.add(String(d.getFullYear()));
        } catch(e) {}
      }
    }

    // Sort descending (newest first)
    const sortedYears = Array.from(years).sort().reverse();
    return { success: true, years: sortedYears };
  },

  /**
   * 1. DASHBOARD STATISTICS
   * Calculates total counts for dashboard cards, optionally filtered by year.
   * * @param {string} targetYear - Optional year filter
   * @return {Object} { success: boolean, countSiswa, countGuru, totalLog }
   */
  getStats: function(targetYear) {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sUsers = ss.getSheetByName('users');
    const sLogs = ss.getSheetByName('logbooks');
    
    if (!sUsers || !sLogs) return { success: true, countSiswa: 0, countGuru: 0, totalLog: 0 };
    
    const filterYear = (targetYear) ? String(targetYear).trim() : null;

    // A. Count Users
    const users = sUsers.getDataRange().getDisplayValues();
    let cSiswa = 0;
    let cGuru = 0;
    
    for(let i = 1; i < users.length; i++) {
       const role = String(users[i][2]).toUpperCase().trim();
       const userYear = String(users[i][7]).trim();

       if (filterYear && userYear !== filterYear) continue;

       if(role === 'SISWA') cSiswa++;
       else if(role === 'GURU') cGuru++;
    }

    // B. Count Logbooks
    const logs = sLogs.getDataRange().getDisplayValues();
    let cLog = 0;
    for(let j = 1; j < logs.length; j++) {
       if (filterYear) {
          const d = new Date(logs[j][2]);
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
   * 2. GET ALL USERS
   * Retrieves a list of all registered users, filtered by year.
   * * @param {string} targetYear - Optional year filter
   * @return {Object} { success: boolean, list: Array }
   */
  getAllUsers: function(targetYear) {
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('users');
    const data = sheet.getDataRange().getDisplayValues();
    const list = [];
    
    const filterYear = (targetYear) ? String(targetYear).trim() : null;

    for(let i = 1; i < data.length; i++) {
      const userYear = data[i][7] ? String(data[i][7]).trim() : "";

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
    
    list.sort(function(a, b) { return a.role.localeCompare(b.role); });
    return { success: true, list: list };
  },

  /**
   * 3. SAVE USER (CREATE / UPDATE)
   * Robust function to Add or Edit users.
   * Automatically syncs changes to 'teachers' or 'students_map' sheets.
   * * @param {Object} d - Form data { isEdit, username, password, nama, role, jurusan, tahun, nip_guru }
   * @return {Object} { success: boolean, error?: string }
   */
  saveUser: function(d) {
    try {
        const ss = SpreadsheetApp.getActiveSpreadsheet();
        const sUsers = ss.getSheetByName('users');
        let sMap = ss.getSheetByName('students_map');
        
        // Ensure Users sheet exists
        if(!sUsers) return { success: false, error: "Database 'users' hilang!" };

        if(!d.username || !d.nama || !d.password) return { success: false, error: "Data wajib diisi." };

        const rows = sUsers.getDataRange().getValues();
        
        // --- A. EDIT MODE ---
        if(d.isEdit) {
           let userFound = false;
           for(let i = 1; i < rows.length; i++) {
              if(String(rows[i][0]) === String(d.username)) {
                 // Update Main User Data
                 sUsers.getRange(i+1, 2).setValue(d.password);
                 sUsers.getRange(i+1, 4).setValue(d.nama);
                 sUsers.getRange(i+1, 3).setValue(d.role);
                 sUsers.getRange(i+1, 5).setValue(d.jurusan);
                 sUsers.getRange(i+1, 8).setValue(d.tahun);
                 
                 // Sync Teacher Data
                 if(d.role === 'GURU') {
                    updateTeacherSheet(ss, d.username, d.nama, 'UPDATE');
                 }

                 // Sync Student Map
                 if(d.role === 'SISWA') {
                    if(!sMap) { sMap = ss.insertSheet('students_map'); sMap.appendRow(['nisn','nama','jurusan','nip_guru']); }
                    
                    const mapRows = sMap.getDataRange().getValues();
                    let foundMap = false;
                    for(let j = 1; j < mapRows.length; j++) {
                       if(String(mapRows[j][0]) === String(d.username)) {
                          sMap.getRange(j+1, 2).setValue(d.nama); 
                          sMap.getRange(j+1, 3).setValue(d.jurusan);
                          if(d.nip_guru) sMap.getRange(j+1, 4).setValue(d.nip_guru); 
                          foundMap = true;
                          break;
                       }
                    }
                    // Create map entry if missing
                    if(!foundMap && d.nip_guru) sMap.appendRow(["'" + d.username, d.nama, d.jurusan, d.nip_guru]);
                 }
                 userFound = true;
                 break;
              }
           }
           if (!userFound) return { success: false, error: "User tidak ditemukan." };
           return { success: true };
        } 
        
        // --- B. ADD NEW MODE ---
        else {
           for(let i = 0; i < rows.length; i++) {
              if(String(rows[i][0]) === String(d.username)) return { success: false, error: "Username/NISN sudah ada!" };
           }
           
           const tahunInput = d.tahun ? d.tahun : new Date().getFullYear();

           // 1. Save to Users
           sUsers.appendRow(["'" + d.username, d.password, d.role, d.nama, d.jurusan, '', '', tahunInput]);
           
           // 2. Sync Logic based on Role
           if(d.role === 'GURU') {
              let sTeach = ss.getSheetByName('teachers');
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
   * 4. DELETE USER
   * Removes a user from the 'users' sheet and syncs deletion to 'teachers' sheet if applicable.
   * Prevents deletion of the main 'admin' account.
   * * @param {string} targetUsername - The username to delete
   * @return {Object} { success: boolean, error?: string }
   */
  deleteUser: function(targetUsername) {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName('users');
    const data = sheet.getDataRange().getDisplayValues();
    const target = String(targetUsername).trim();

    for(let i = 1; i < data.length; i++) {
      if(String(data[i][0]).trim() === target) {
        const role = String(data[i][2]);
        if(role === 'ADMIN' && target === 'admin') return { success: false, error: "Akun Admin Utama tidak boleh dihapus." };
        
        sheet.deleteRow(i + 1);
        
        // Sync Delete for Teachers
        if(role === 'GURU') updateTeacherSheet(ss, target, null, 'DELETE');
        
        return { success: true };
      }
    }
    return { success: false, error: "User tidak ditemukan." };
  },

  /**
   * 5. MONITORING LOGBOOK
   * Retrieves logbook entries joined with student and teacher data.
   * * @param {string} targetYear - Optional year filter
   * @return {Object} { success: boolean, list: Array }
   */
  getMonitoringData: function(targetYear) {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sLogs = ss.getSheetByName('logbooks');
    const sMap = ss.getSheetByName('students_map');
    const sTeach = ss.getSheetByName('teachers');
    
    if(!sLogs) return { success: true, list: [] };

    const logs = sLogs.getDataRange().getDisplayValues();
    const maps = sMap ? sMap.getDataRange().getDisplayValues() : [];
    const teachers = sTeach ? sTeach.getDataRange().getDisplayValues() : [];
    const filterYear = (targetYear) ? String(targetYear).trim() : null;
    
    // Map Teacher NIP -> Name
    const teacherNameMap = {};
    for(let t = 1; t < teachers.length; t++) { teacherNameMap[teachers[t][0]] = teachers[t][1]; }

    // Map Student NISN -> Teacher Name
    const studentMentorMap = {};
    for(let m = 1; m < maps.length; m++) {
      const nisn = maps[m][0];
      const nipGuru = maps[m][3];
      const namaGuru = teacherNameMap[nipGuru] || nipGuru || "-";
      studentMentorMap[nisn] = namaGuru;
    }

    const list = [];
    for(let i = 1; i < logs.length; i++) {
      const row = logs[i];
      
      if (filterYear) {
         const d = new Date(row[2]); 
         if(isNaN(d.getTime()) || String(d.getFullYear()) !== filterYear) continue;
      }

      const logNisn = row[1];
      
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
    
    return { success: true, list: list.reverse() };
  },

  /**
   * 6. CHANGE ADMIN PASSWORD
   * Updates the password for the current admin user.
   * * @param {Object} user - Current user object
   * @param {string} newPass - New password
   * @return {Object} { success: boolean, error?: string }
   */
  changeMyPassword: function(user, newPass) {
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('users');
    const rows = sheet.getDataRange().getValues();
    
    for(let i = 1; i < rows.length; i++) {
       if(String(rows[i][0]) === String(user.username)) {
          sheet.getRange(i+1, 2).setValue(newPass);
          return { success: true };
       }
    }
    return { success: false, error: "User admin tidak ditemukan." };
  }
};

/**
 * HELPER: Update Sheet Teachers (Sync)
 * Keeps the 'teachers' sheet in sync when users are modified in the main 'users' sheet.
 * * @param {Spreadsheet} ss - Active spreadsheet
 * @param {string} nip - Teacher NIP (Username)
 * @param {string} nama - Teacher Name
 * @param {string} action - 'UPDATE' or 'DELETE'
 */
function updateTeacherSheet(ss, nip, nama, action) {
  const sTeach = ss.getSheetByName('teachers');
  if(!sTeach) return; 
  const data = sTeach.getDataRange().getDisplayValues();
  
  if (action === 'UPDATE') {
     for(let i = 1; i < data.length; i++) { 
         if(String(data[i][0]) === String(nip)) { 
             sTeach.getRange(i+1, 2).setValue(nama); 
             break; 
         } 
     }
  } else if (action === 'DELETE') {
     for(let i = 1; i < data.length; i++) { 
         if(String(data[i][0]) === String(nip)) { 
             sTeach.deleteRow(i+1); 
             break; 
         } 
     }
  }
}