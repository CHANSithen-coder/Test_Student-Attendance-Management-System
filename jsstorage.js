/**
 * storage.js — Repository Pattern & Data Persistence Engine
 * Supports LocalStorage & Prepared Schema for Supabase PostgreSQL
 */

const STORAGE_KEYS = {
  CLASSES: 'cambodia_school_classes_v1',
  STUDENTS: 'cambodia_school_students_v1',
  ATTENDANCE: 'cambodia_school_attendance_v1',
  SETTINGS: 'cambodia_school_settings_v1',
  IS_DEMO: 'cambodia_school_is_demo_v1'
};

const DEFAULT_SETTINGS = {
  schoolName: 'សាលាបឋមសិក្សា និងអនុវិទ្យាល័យគំរូ',
  academicYear: '2026-2027',
  defaultSubject: 'Digital Literacy',
  defaultPeriod: 1,
  defaultAttendanceMode: 'all_present', // 'all_present' or 'unmarked'
  lateCountsAsPresent: true,
  updatedAt: new Date().toISOString()
};

const StorageService = {
  /**
   * Get Settings
   */
  getSettings() {
    try {
      const raw = localStorage.getItem(STORAGE_KEYS.SETTINGS);
      return raw ? { ...DEFAULT_SETTINGS, ...JSON.parse(raw) } : { ...DEFAULT_SETTINGS };
    } catch (e) {
      console.error('Error loading settings', e);
      return { ...DEFAULT_SETTINGS };
    }
  },

  /**
   * Save Settings
   */
  saveSettings(settings) {
    try {
      const current = StorageService.getSettings();
      const updated = { ...current, ...settings, updatedAt: new Date().toISOString() };
      localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(updated));
      return updated;
    } catch (e) {
      console.error('Error saving settings', e);
      return null;
    }
  },

  /**
   * Classes Data Access
   */
  getClasses() {
    try {
      const raw = localStorage.getItem(STORAGE_KEYS.CLASSES);
      return raw ? JSON.parse(raw) : [];
    } catch (e) {
      return [];
    }
  },

  saveClasses(classesArray) {
    localStorage.setItem(STORAGE_KEYS.CLASSES, JSON.stringify(classesArray));
  },

  /**
   * Students Data Access
   */
  getStudents() {
    try {
      const raw = localStorage.getItem(STORAGE_KEYS.STUDENTS);
      return raw ? JSON.parse(raw) : [];
    } catch (e) {
      return [];
    }
  },

  saveStudents(studentsArray) {
    localStorage.setItem(STORAGE_KEYS.STUDENTS, JSON.stringify(studentsArray));
  },

  /**
   * Attendance Sessions Data Access
   */
  getAttendanceSessions() {
    try {
      const raw = localStorage.getItem(STORAGE_KEYS.ATTENDANCE);
      return raw ? JSON.parse(raw) : [];
    } catch (e) {
      return [];
    }
  },

  saveAttendanceSessions(sessionsArray) {
    localStorage.setItem(STORAGE_KEYS.ATTENDANCE, JSON.stringify(sessionsArray));
  },

  /**
   * Demo Data State Check
   */
  isDemoMode() {
    return localStorage.getItem(STORAGE_KEYS.IS_DEMO) === 'true';
  },

  setDemoMode(isDemo) {
    localStorage.setItem(STORAGE_KEYS.IS_DEMO, isDemo ? 'true' : 'false');
  },

  /**
   * Full Backup of All Local Entities
   */
  backupApplicationData() {
    const backupData = {
      version: '1.0.0',
      exportDate: Utils.getCambodiaDateString(),
      exportedAt: new Date().toISOString(),
      settings: StorageService.getSettings(),
      classes: StorageService.getClasses(),
      students: StorageService.getStudents(),
      attendanceSessions: StorageService.getAttendanceSessions()
    };

    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(backupData, null, 2));
    const downloadAnchor = document.createElement('a');
    const filename = `attendance-backup-${Utils.getCambodiaDateString()}.json`;
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute('download', filename);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  },

  /**
   * Restore Application Data from JSON
   */
  async restoreApplicationData(jsonContent) {
    try {
      const parsed = JSON.parse(jsonContent);
      if (!parsed.classes || !parsed.students || !parsed.attendanceSessions) {
        throw new Error('ឯកសារ JSON មិនពេញលេញ ឬមិនត្រូវទម្រង់ទិន្នន័យ');
      }

      StorageService.saveSettings(parsed.settings || DEFAULT_SETTINGS);
      StorageService.saveClasses(parsed.classes);
      StorageService.saveStudents(parsed.students);
      StorageService.saveAttendanceSessions(parsed.attendanceSessions);
      StorageService.setDemoMode(false);
      return true;
    } catch (e) {
      console.error('Restore failed:', e);
      throw e;
    }
  },

  /**
   * Clear All Application Data
   */
  clearAllData() {
    localStorage.removeItem(STORAGE_KEYS.CLASSES);
    localStorage.removeItem(STORAGE_KEYS.STUDENTS);
    localStorage.removeItem(STORAGE_KEYS.ATTENDANCE);
    localStorage.removeItem(STORAGE_KEYS.IS_DEMO);
    StorageService.saveSettings(DEFAULT_SETTINGS);
  }
};