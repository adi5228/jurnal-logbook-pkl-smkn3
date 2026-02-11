/**
 * UTILS.GS (Saved as Utils.js)
 * Description:
 * A collection of utility helper functions used throughout the system.
 * Handles common tasks such as unique ID generation and timezone-specific date formatting.
 * * Dependencies:
 * - Google Apps Script "Utilities" Class
 */

const Utils = {
  
  /**
   * 1. GENERATE UNIQUE TOKEN / ID
   * Generates a unique identifier (UUID) used for:
   * - User Session Tokens (AuthService)
   * - Logbook Entry IDs (StudentService)
   * * @return {string} A unique UUID string.
   */
  generateToken: function() {
    return Utilities.getUuid();
  },

  /**
   * 2. FORMAT DATE (INDONESIA / WITA)
   * Formats a raw Date object into a readable string string specific to
   * the Central Indonesia Time (Asia/Makassar).
   * * Format: dd/MM/yyyy HH:mm (e.g., 30/01/2026 10:30)
   * * @param {Date|string} dateObj - The date object (usually from Spreadsheet)
   * @return {string} The formatted date string, or the original value if not a Date object.
   */
  formatDate: function(dateObj) {
    if (!dateObj) return "";
    
    // If input is not a Date object (e.g., string from CSV or JSON), return as is
    if (typeof dateObj !== 'object') {
      return dateObj;
    }
    
    // Format using Google Apps Script Utilities for "Asia/Makassar" (WITA)
    return Utilities.formatDate(dateObj, "Asia/Makassar", "dd/MM/yyyy HH:mm");
  }
};