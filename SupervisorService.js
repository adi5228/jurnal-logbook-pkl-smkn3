/**
 * SUPERVISORSERVICE.GS (Saved as SupervisorService.js)
 * Description:
 * Manages functionality for Field Supervisors (Pembimbing Lapangan):
 * - Viewing a public feed of all student activities
 * - Searching for specific students by Name or NISN
 * - Viewing detailed logbook history for a specific student
 * * Note: Supervisors access this via a special token ('SUPERVISOR_ACCESS')
 * defined in Code.js routing.
 */

const SupervisorService = {
  
  /**
   * 1. PUBLIC FEED
   * Retrieves the latest logbook entries from ALL students.
   * Useful for supervisors to get a general overview of activities.
   * * @return {Object} { success: boolean, list: Array }
   */
  getPublicFeed: function() {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sLogs = ss.getSheetByName('logbooks');
    const sUsers = ss.getSheetByName('users');
    
    // Validation: Ensure sheets exist
    if (!sLogs || !sUsers) return { success: true, list: [] };
    
    const logs = sLogs.getDataRange().getDisplayValues();
    const users = sUsers.getDataRange().getDisplayValues();
    
    // A. Build User Dictionary (NISN -> Name, Major, Photo)
    const userMap = {};
    for(let i = 1; i < users.length; i++) {
      // Index: 0=NISN, 3=Name, 4=Major, 6=Photo (Col G)
      const fotoProfil = (users[i].length > 6) ? users[i][6] : "";
      userMap[users[i][0]] = { 
        nama: users[i][3], 
        jurusan: users[i][4], 
        foto_profil: fotoProfil 
      };
    }
    
    // B. Fetch Latest Logbooks
    const feed = [];
    const limit = 30; // Limit to 30 recent posts for performance
    let count = 0;

    // Loop backwards (newest data first)
    for(let i = logs.length - 1; i >= 1; i--) {
      const logOwnerNisn = String(logs[i][1]).trim();
      
      // Get owner data from dictionary
      const ownerData = userMap[logOwnerNisn] || { nama: 'Siswa', jurusan: '-', foto_profil: '' };
      
      feed.push({
        owner_nama: ownerData.nama,
        owner_jurusan: ownerData.jurusan,
        owner_foto: ownerData.foto_profil,
        tanggal: logs[i][2],
        judul: logs[i][5],
        deskripsi: logs[i][6],
        foto: logs[i][7] // Activity Photo
      });
      
      count++;
      if(count >= limit) break;
    }
    
    return { success: true, list: feed };
  },

  /**
   * 2. SEARCH STUDENT
   * Finds students based on partial matches for Name or NISN.
   * * @param {string} query - The search keyword
   * @return {Object} { success: boolean, list: Array }
   */
  searchStudent: function(query) {
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('users');
    const data = sheet.getDataRange().getDisplayValues();
    const results = [];
    const q = String(query).toLowerCase().trim();
    
    // Require at least 2 characters to start search
    if(q.length < 2) return { success: true, list: [] };

    for(let i = 1; i < data.length; i++) {
      // Columns: 0=Username/NISN, 2=Role, 3=Name, 4=Major, 6=Photo
      const role = String(data[i][2]).toUpperCase();
      const nisn = String(data[i][0]).toLowerCase();
      const nama = String(data[i][3]).toLowerCase();
      
      // Only search for active STUDENTS matching the query
      if (role === 'SISWA' && (nama.includes(q) || nisn.includes(q))) {
         results.push({
           nisn: data[i][0], // Return original case NISN
           nama: data[i][3], // Return original case Name
           jurusan: data[i][4],
           foto: (data[i].length > 6) ? data[i][6] : ""
         });
      }
      
      // Limit search results to 10 to keep UI clean
      if(results.length >= 10) break; 
    }
    
    return { success: true, list: results };
  },

  /**
   * 3. GET SPECIFIC STUDENT LOGS
   * Retrieves the full logbook history for a specific student NISN.
   * Used when a supervisor clicks on a student from search results.
   * * @param {string} nisn - Target student NISN
   * @return {Object} { success: boolean, list: Array }
   */
  getStudentLogs: function(nisn) {
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('logbooks');
    const data = sheet.getDataRange().getDisplayValues();
    const list = [];
    const target = String(nisn).trim();
    
    // Loop backwards (newest first)
    for(let i = data.length - 1; i >= 1; i--) {
      // Check if NISN column (Index 1) matches target
      if(String(data[i][1]).trim() == target) {
        list.push({
          tanggal: data[i][2],
          jam: data[i][3] + ' - ' + data[i][4], // Combine start-end time
          judul: data[i][5],
          deskripsi: data[i][6],
          foto: data[i][7],    // Proof Photo
          feedback: data[i][8] // Teacher Feedback (if any)
        });
      }
    }
    
    return { success: true, list: list };
  }
};