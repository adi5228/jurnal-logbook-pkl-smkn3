/**
 * CODE.GS - CORE SYSTEM (FULL INTEGRATED)
 * * Description:
 * This is the main controller script for the Google Apps Script project.
 * It handles HTTP requests (doGet), API routing, authentication validation,
 * and database setup logic.
 * * Modules Included: Auth, Student, Teacher, Admin, & Supervisor
 * Version: Final + Supervisor + Year Filter + Export PDF + Change Password
 */

/**
 * 1. SETUP MAIN PAGE & ROUTING
 * Handles GET requests to serve HTML templates based on URL parameters.
 * * @param {Object} e - Event parameter containing query string data
 * @return {HtmlOutput} The rendered HTML page
 */
function doGet(e) {
  // Route: Field Supervisor Dashboard
  if (e.parameter.page === 'supervisor') {
    return HtmlService.createTemplateFromFile('supervisor_dashboard')
      .evaluate()
      .setTitle('Dashboard Pembimbing Lapangan')
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)
      .addMetaTag('viewport', 'width=device-width, initial-scale=1');
  }
  
  // Route: Admin Panel
  if (e.parameter.page === 'admin') {
    return HtmlService.createTemplateFromFile('admin')
      .evaluate()
      .setTitle('Admin Panel')
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)
      .addMetaTag('viewport', 'width=device-width, initial-scale=1');
  }
  
  // Route: Main Dashboard (Student/Teacher) - Logic handled by frontend JS via 'index'
  
  // Default Route: Login/App Entry Point
  return HtmlService.createTemplateFromFile('index') 
      .evaluate()
      .setTitle('Sistem Logbook PKL')
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)
      .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

/**
 * 2. HELPER: INCLUDE HTML
 * Used to include CSS/JS files or partial HTML into templates.
 * * @param {string} filename - Name of the file to include
 * @return {string} File content
 */
function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

/**
 * 3. API GATEWAY (DATA TRAFFIC CONTROLLER)
 * Handles all client-side google.script.run requests.
 * Routes requests to specific services (Auth, Student, Teacher, Admin) based on 'action'.
 * * @param {string} action - The action identifier (e.g., 'login', 'saveLogbook')
 * @param {Object} data - Payload data sent from client
 * @return {Object} JSON response { success: boolean, ... }
 */
function api(action, data) {
  try {
    data = data || {};
    
    // --- A. PUBLIC ACCESS (No Token Required) ---
    
    // User Login (Student/Teacher/Admin)
    if (action === 'login') {
      var result = AuthService.login(data.u, data.p);
      if(result.success) {
        result.appUrl = ScriptApp.getService().getUrl();
      }
      return result;
    }
    
    // Register Student
    if (action === 'register') {
      return AuthService.register(data);
    }
    
    // Get Teacher List (For Registration Form)
    if (action === 'getTeacherList') {
      return AuthService.getTeacherList();
    }

    // --- B. SUPERVISOR ACCESS (Special Token) ---
    if (data.token === 'SUPERVISOR_ACCESS') {
       if (action === 'supervisorGetFeed') return SupervisorService.getPublicFeed();
       if (action === 'supervisorSearchStudent') return SupervisorService.searchStudent(data.query);
       if (action === 'supervisorGetStudentLogs') return SupervisorService.getStudentLogs(data.nisn);
       
       return { success: false, error: "Akses tidak dikenal." };
    }

    // --- C. DATABASE USER VALIDATION (Requires Valid Token) ---
    
    var user = AuthService.validateToken(data.token);
    
    if (!user) {
      return { success: false, error: "Sesi habis. Silakan login kembali.", sessionExpired: true };
    }

    // --- D. ROUTING BASED ON REGISTERED USER ACTIONS ---
    
    // 1. GENERAL ACTIONS
    if (action === 'getDashboardData') {
      return { 
        success: true, 
        user: user,
        appUrl: ScriptApp.getService().getUrl() 
      };
    }
    
    // 2. STUDENT FEATURES
    if (action === 'saveLogbook') return StudentService.saveLogbook(user, data);
    if (action === 'getHistory') return StudentService.getHistory(user);
    if (action === 'getPublicFeed') return StudentService.getPublicFeed(user);
    if (action === 'updateProfile') return StudentService.updateProfile(user, data);
    if (action === 'exportLogbook') return StudentService.exportLogbook(user); // Export PDF Watermark
    
    // 3. TEACHER FEATURES
    if (action === 'getMyStudents') return TeacherService.getMyStudents(user, data.targetYear); 
    if (action === 'getStudentLogbooks') return TeacherService.getStudentLogbooks(data.targetNisn);
    if (action === 'saveFeedback') return TeacherService.saveFeedback(data);
    if (action === 'teacherGetYears') return TeacherService.getAvailableYears(); 
    if (action === 'teacherChangePass') return TeacherService.changePassword(user, data.newPass); // Change Teacher Password

    // 4. ADMIN FEATURES
    if (user.role === 'ADMIN') {
      if (action === 'adminGetYears') return AdminService.getAvailableYears();
      if (action === 'getAdminStats') return AdminService.getStats(data.targetYear);
      if (action === 'adminGetAllUsers') return AdminService.getAllUsers(data.targetYear);
      if (action === 'adminGetMonitoring') return AdminService.getMonitoringData(data.targetYear);
      
      if (action === 'adminSaveUser') return AdminService.saveUser(data);
      if (action === 'adminDeleteUser') return AdminService.deleteUser(data.targetUsername);
      if (action === 'adminChangePass') return AdminService.changeMyPassword(user, data.newPass); // Change Admin Password
    }

    return { success: false, error: "Action tidak dikenal: " + action };

  } catch (err) {
    Logger.log("SERVER ERROR: " + err.toString());
    return { success: false, error: "Server Error: " + err.toString() };
  }
}

/**
 * 4. SETUP DATABASE
 * Initializes the Spreadsheet with required sheets and headers if they don't exist.
 * Should be run once manually or on deployment.
 */
function setupDatabase() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  
  // A. Sheet Users (Schema: username, password, role, nama, jurusan, token, foto_profil, tahun)
  var sUsers = getSheet(ss, 'users');
  if(sUsers.getLastRow() === 0) {
    sUsers.appendRow(['username', 'password', 'role', 'nama', 'jurusan', 'token', 'foto_profil', 'tahun']); 
    // Create Default Admin
    sUsers.appendRow(['admin', 'admin123', 'ADMIN', 'Administrator', '-', '', '', new Date().getFullYear()]);
  }
  
  // B. Sheet Logbooks
  var sLogs = getSheet(ss, 'logbooks');
  if(sLogs.getLastRow() === 0) {
    sLogs.appendRow(['id', 'nisn', 'tanggal', 'jam_mulai', 'jam_selesai', 'judul', 'deskripsi', 'foto_bukti', 'catatan_guru', 'timestamp']);
  }
  
  // C. Sheet Students Map
  var sMap = getSheet(ss, 'students_map');
  if(sMap.getLastRow() === 0) {
    sMap.appendRow(['nisn', 'nama_siswa', 'jurusan', 'nip_guru']);
  }
  
  // D. Sheet Teachers
  var sTeach = getSheet(ss, 'teachers');
  if(sTeach.getLastRow() === 0) {
    sTeach.appendRow(['nip', 'nama_guru']);
    // Default Teachers example
    sTeach.appendRow(['198001', 'Pak Budi Santoso']);
    sTeach.appendRow(['198002', 'Bu Siti Aminah']);
  }
  
  Logger.log("Database Siap!");
}

/**
 * Helper: Get or Create Sheet
 * @param {Spreadsheet} ss - Active Spreadsheet object
 * @param {string} name - Sheet name
 * @return {Sheet} The requested sheet
 */
function getSheet(ss, name) {
  var sheet = ss.getSheetByName(name);
  if (!sheet) sheet = ss.insertSheet(name);
  return sheet;
}

/**
 * 5. GET APP URL
 * Necessary for frontend redirection logic (Bypass iframe restrictions).
 * @return {string} The published web app URL
 */
function getAppUrl() {
  return ScriptApp.getService().getUrl();
}