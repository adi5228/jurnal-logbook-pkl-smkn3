/**
 * TEACHERSERVICE.GS (Saved as TeacherService.js)
 * Description:
 * Manages functionality specific to Teachers (Mentors):
 * - Retrieving list of assigned students (mentees)
 * - Viewing logbooks of assigned students
 * - Providing feedback/grading on logbooks
 * - Changing personal password
 */

const TeacherService = {

  /**
   * 0. GET AVAILABLE YEARS
   * Retrieves unique years from student data to populate filter dropdowns for teachers.
   * * @return {Object} { success: boolean, years: Array<string> }
   */
  getAvailableYears: function() {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sUsers = ss.getSheetByName('users');
    const years = new Set(); 

    // Scan Years from Users Sheet (Column H / Index 7)
    if (sUsers) {
      const uData = sUsers.getDataRange().getDisplayValues();
      for (let i = 1; i < uData.length; i++) {
        const y = String(uData[i][7]).trim();
        // Regex to ensure only 4-digit years
        if (y && y.match(/^\d{4}$/)) years.add(y);
      }
    }
    
    // Sort Descending (Newest first)
    const sortedYears = Array.from(years).sort().reverse();
    return { success: true, years: sortedYears };
  },

  /**
   * 1. GET MY STUDENTS (MENTEES)
   * Retrieves a list of students assigned to the logged-in teacher.
   * Supports filtering by year (Cohort).
   * * @param {Object} user - The logged-in teacher object
   * @param {string} targetYear - Optional year to filter students
   * @return {Object} { success: boolean, list: Array }
   */
  getMyStudents: function(user, targetYear) {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sMap = ss.getSheetByName('students_map');
    const sUsers = ss.getSheetByName('users');
    
    // Get Data
    const maps = sMap.getDataRange().getDisplayValues();
    const users = sUsers.getDataRange().getDisplayValues();
    
    const filterYear = (targetYear) ? String(targetYear).trim() : null;

    // 1. Build User Detail Dictionary from 'users' sheet (NISN -> {Photo, Year})
    const userDetails = {};
    for(let i = 1; i < users.length; i++) {
       // Index: 0=NISN, 6=Photo, 7=Year
       userDetails[String(users[i][0])] = {
          foto: (users[i].length > 6) ? users[i][6] : "",
          tahun: (users[i].length > 7) ? String(users[i][7]).trim() : ""
       };
    }
    
    const myNip = String(user.username || user.nisn).trim(); // Teachers login using NIP (Username)
    const list = [];
    
    // 2. Loop through Student Map
    // Structure: [0]NISN, [1]Name, [2]Major, [3]Teacher_NIP_Name
    for(let j = 1; j < maps.length; j++) {
      // Check if this teacher is the assigned mentor
      // We check if the teacher's NIP is contained within the map entry string
      if(String(maps[j][3]).includes(myNip)) {
          
          const siswaNisn = String(maps[j][0]);
          const siswaData = userDetails[siswaNisn] || { foto: "", tahun: "" };

          // --- FILTER LOGIC ---
          if (filterYear && siswaData.tahun !== filterYear) {
             continue; // Skip if year doesn't match
          }
          
          list.push({
            nisn: siswaNisn,
            nama: maps[j][1],
            jurusan: maps[j][2],
            foto: siswaData.foto,
            tahun: siswaData.tahun
          });
      }
    }
    
    // Sort Alphabetically by Name
    list.sort(function(a, b) { return a.nama.localeCompare(b.nama); });
    
    return { success: true, list: list };
  },

  /**
   * 2. GET STUDENT LOGBOOKS
   * Retrieves all logbook entries for a specific student (targetNisn).
   * Used when a teacher clicks on a student card.
   * * @param {string} targetNisn - The NISN of the student
   * @return {Object} { success: boolean, list: Array }
   */
  getStudentLogbooks: function(targetNisn) {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sLogs = ss.getSheetByName('logbooks');
    const logs = sLogs.getDataRange().getDisplayValues();
    const list = [];
    
    // Iterate backwards (newest first)
    for(let i = logs.length - 1; i >= 1; i--) {
      if(String(logs[i][1]) == String(targetNisn)) {
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
   * 3. SAVE FEEDBACK
   * Saves teacher's feedback/comments to a specific logbook entry.
   * * @param {Object} data - { id: logbookId, feedback: string }
   * @return {Object} { success: boolean, error?: string }
   */
  saveFeedback: function(data) {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sLogs = ss.getSheetByName('logbooks');
    const rows = sLogs.getDataRange().getDisplayValues();
    
    for(let i = 1; i < rows.length; i++) {
      if(String(rows[i][0]) == String(data.id)) { // Match Logbook ID
         sLogs.getRange(i+1, 9).setValue(data.feedback); // Column I (Index 9) is Feedback
         return { success: true };
      }
    }
    return { success: false, error: "Logbook tidak ditemukan" };
  },

  /**
   * 4. CHANGE TEACHER PASSWORD
   * Allows a logged-in teacher to update their own password.
   * * @param {Object} user - Logged-in teacher object
   * @param {string} newPass - New password
   * @return {Object} { success: boolean, error?: string }
   */
  changePassword: function(user, newPass) {
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('users');
    const rows = sheet.getDataRange().getValues();
    
    for(let i = 1; i < rows.length; i++) {
       // Find row by teacher's username/NIP
       if(String(rows[i][0]) === String(user.username)) {
          // Update Column B (Password)
          sheet.getRange(i+1, 2).setValue(newPass);
          return { success: true };
       }
    }
    return { success: false, error: "User guru tidak ditemukan." };
  }
};