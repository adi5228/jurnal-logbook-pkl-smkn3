/**
 * ============================================================================
 * UTILS.GS - FUNGSI BANTUAN (HELPER)
 * Deskripsi: Objek yang berisi kumpulan fungsi utilitas kecil yang digunakan 
 * berulang kali oleh berbagai modul Service di dalam aplikasi.
 * ============================================================================
 */

var Utils = {
  
  /**
   * --------------------------------------------------------------------------
   * 1. GENERATE TOKEN / ID UNIK
   * --------------------------------------------------------------------------
   * Digunakan untuk dua keperluan utama:
   * - Membuat Session Token yang aman saat pengguna (Siswa/Guru/Admin) login.
   * - Membuat ID unik (UUID) untuk menandai setiap baris Logbook yang dikirim.
   * * @returns {string} String UUID unik (contoh: '123e4567-e89b-12d3-a456-426614174000')
   */
  generateToken: function() {
    return Utilities.getUuid();
  },

  /**
   * --------------------------------------------------------------------------
   * 2. FORMAT TANGGAL INDONESIA (WITA)
   * --------------------------------------------------------------------------
   * Mengubah format objek tanggal bawaan Google/Javascript menjadi 
   * format teks (string) yang seragam dan mudah dibaca oleh pengguna,
   * disesuaikan dengan zona waktu Makassar (WITA).
   * * @param {Date|string} dateObj - Objek Date atau string dari Spreadsheet.
   * @returns {string} Teks tanggal dengan format 'dd/MM/yyyy HH:mm' (contoh: 30/01/2026 10:30)
   */
  formatDate: function(dateObj) {
    // Jika input kosong atau null, kembalikan string kosong agar tidak menyebabkan error
    if (!dateObj) return "";
    
    // Jika data yang diambil dari sheet kebetulan sudah berupa teks/string 
    // (bukan objek Date), kembalikan teks tersebut apa adanya.
    if (typeof dateObj !== 'object') {
      return dateObj;
    }
    
    // Konversi objek Date menjadi string format khusus zona waktu Asia/Makassar (WITA)
    return Utilities.formatDate(dateObj, "Asia/Makassar", "dd/MM/yyyy HH:mm");
  }

};
