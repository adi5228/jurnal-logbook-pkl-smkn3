/**
 * AUTHSERVICE.GS (Saved as AuthService.js)
 * Description:
 * Manages all authentication-related logic, including user login, 
 * session validation, and new student registration.
 * Handles interaction with 'users', 'students_map', and 'teachers' sheets.
 */

const AuthService = {
  
  /**
   * 1. LOGIN SYSTEM
   * Authenticates a user based on username (NISN/NIP) and password.
   * Generates a new session token upon successful login.
   * * @param {string} u - Username or NISN
   * @param {string} p - Password
   * @return {Object} Response object { success: boolean, token?: string, user?: Object, error?: string }
   */
  login: function(u, p) {
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('users');
    const data = sheet.getDataRange().getDisplayValues();
    
    // Loop through rows (skip header at index 0)
    for(let i = 1; i < data.length; i++) {
      // Check credentials (trim to avoid whitespace issues)
      // Column 0: Username, Column 1: Password
      if(String(data[i][0]).trim() == String(u).trim() && String(data[i][1]).trim() == String(p).trim()) {
        
        // Generate New Session Token
        const token = Utilities.getUuid();
        
        // Save token to database (Column F / Index 5)
        // i + 1 because sheet rows are 1-based
        sheet.getRange(i+1, 6).setValue(token); 
        
        // Handle name fallback
        const dbNama = data[i][3] ? data[i][3] : data[i][0];
        
        // Get Year (Column H / Index 7)
        const dbTahun = data[i][7] ? data[i][7] : "";

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
    return { success: false, error: "Username atau Password Salah!" };
  },
  
  /**
   * 2. VALIDATE TOKEN (AUTO-LOGIN)
   * Checks if a provided session token is valid and active in the database.
   * * @param {string} token - The session token from client storage
   * @return {Object|null} User object if valid, null otherwise
   */
  validateToken: function(token) {
    if(!token) return null;
    
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('users');
    const data = sheet.getDataRange().getDisplayValues();
    
    for(let i = 1; i < data.length; i++) {
      // Check Column F (Index 5) for token match
      if(String(data[i][5]) == String(token)) {
        const dbNama = data[i][3] ? data[i][3] : data[i][0];
        const dbTahun = data[i][7] ? data[i][7] : "";
        
        return { 
          nisn: data[i][0], 
          nama: dbNama, 
          role: data[i][2],
          jurusan: data[i][4],
          tahun: dbTahun
        };
      }
    }
    return null; 
  },
  
  /**
   * 3. REGISTER NEW STUDENT
   * Registers a new student account.
   * Saves to 'users' sheet and creates a mapping entry in 'students_map'.
   * * @param {Object} data - Registration data { nisn, password, nama, jurusan, nip_guru, tahun }
   * @return {Object} Response object { success: boolean, error?: string }
   */
  register: function(data) {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sUsers = ss.getSheetByName('users');
    let sMap = ss.getSheetByName('students_map'); 
    
    // Validate Year (Use input or default to current year)
    const inputTahun = data.tahun || new Date().getFullYear();
    
    // Check for Duplicate NISN
    const allUsers = sUsers.getDataRange().getDisplayValues();
    for(let i = 1; i < allUsers.length; i++) {
       if(String(allUsers[i][0]).trim() == String(data.nisn).trim()) {
         return { success: false, error: "NISN sudah terdaftar!" };
       }
    }
    
    try {
      // A. Save New User to 'users' sheet
      // Format: [username, password, role, nama, jurusan, token, foto_profil, tahun]
      // Note: Adding "'" to NISN forces it to be treated as a string in Sheets
      sUsers.appendRow([
        "'" + data.nisn, 
        data.password, 
        'SISWA', 
        data.nama, 
        data.jurusan, 
        '',  // Token empty initially
        '',  // Photo empty initially
        inputTahun // Column H (Year)
      ]);
      
      // B. Save Teacher Mapping to 'students_map' sheet
      if (!sMap) sMap = ss.insertSheet('students_map'); // Create sheet if missing
      
      sMap.appendRow([
        "'" + data.nisn, 
        data.nama, 
        data.jurusan, 
        data.nip_guru 
      ]);
      
      return { success: true };
      
    } catch(e) {
      return { success: false, error: "Gagal menyimpan data: " + e.toString() };
    }
  },
  
  /**
   * 4. GET TEACHER LIST
   * Retrieves a list of all teachers for the registration dropdown.
   * * @return {Object} Response object { success: boolean, list: Array<{nip, nama}> }
   */
  getTeacherList: function() {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let sheet = ss.getSheetByName('teachers');
    
    // Fallback: Case-insensitive search if 'teachers' sheet not found directly
    if (!sheet) {
      const sheets = ss.getSheets();
      for (let i = 0; i < sheets.length; i++) {
        if (sheets[i].getName().toLowerCase() === 'teachers') {
          sheet = sheets[i];
          break;
        }
      }
    }

    if (!sheet) return { success: true, list: [] };

    // Force flush to ensure latest data read
    SpreadsheetApp.flush();

    // Avoid reading header row only
    const lastRow = sheet.getLastRow();
    if (lastRow < 2) return { success: true, list: [] }; 

    // Get Data (Start Row 2, Col 1, NumRows, NumCols 2)
    const data = sheet.getRange(2, 1, lastRow - 1, 2).getDisplayValues();
    const list = [];
    
    for(let i = 0; i < data.length; i++) {
      const nip = String(data[i][0]).trim();
      const nama = String(data[i][1]).trim();

      // Ensure valid data
      if(nip !== "" && nama !== "") {
        list.push({
          nip: nip, 
          nama: nama
        });
      }
    }
    
    // Sort alphabetically by Name
    list.sort(function(a, b) {
      return a.nama.localeCompare(b.nama);
    });

    return { success: true, list: list };
  }
};