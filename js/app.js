/**
 * app.js — Main Application Bootstrap, Router, State Sync & PWA Service Worker
 */

const App = {
  currentPage: 'dashboard',

  init() {
    this.checkFirstRunSeedDemo();
    this.setupNavigation();
    this.setupNetworkMonitoring();
    this.setupModals();
    this.setupSettingsForm();
    this.setupHistoryFilter();
    this.setupBackupRestore();
    this.registerServiceWorker();

    // Module Initializations
    AttendanceModule.initAttendancePage();
    ReportsModule.initReportsPage();
    ImportExportModule.init();

    this.refreshAll();
  },

  /**
   * Router and Page Switching
   */
  navigateTo(pageId) {
    this.currentPage = pageId;

    // Toggle pages
    document.querySelectorAll('.page-section').forEach(sec => sec.classList.remove('active'));
    const targetSection = document.getElementById(`page-${pageId}`);
    if (targetSection) targetSection.classList.add('active');

    // Update Desktop Nav
    document.querySelectorAll('.nav-item').forEach(item => {
      item.classList.toggle('active', item.getAttribute('data-page') === pageId);
    });

    // Update Mobile Bottom Nav
    document.querySelectorAll('.bottom-nav-item').forEach(item => {
      item.classList.toggle('active', item.getAttribute('data-page') === pageId);
    });

    // Mobile header title update
    const titleMap = {
      dashboard: 'ផ្ទាំងសង្ខេប',
      attendance: 'ស្រង់វត្តមាន',
      students: 'បញ្ជីសិស្ស',
      classes: 'ថ្នាក់រៀន',
      history: 'ប្រវត្តិវត្តមាន',
      reports: 'របាយការណ៍',
      'import-export': 'នាំចូល / នាំចេញ',
      settings: 'ការកំណត់'
    };
    const titleEl = document.getElementById('page-title-mobile');
    if (titleEl) titleEl.textContent = titleMap[pageId] || 'វត្តមានសិស្ស';

    // Page-specific refresh
    if (pageId === 'attendance') AttendanceModule.loadClassForAttendance();
    if (pageId === 'students') StudentModule.renderStudentsTable();
    if (pageId === 'classes') ClassModule.renderClassesPage();
    if (pageId === 'history') this.renderHistoryPage();
    if (pageId === 'dashboard') this.renderDashboard();
    if (pageId === 'reports') ReportsModule.generateClassReport();

    window.scrollTo({ top: 0, behavior: 'smooth' });
  },

  setupNavigation() {
    document.querySelectorAll('[data-page]').forEach(el => {
      el.addEventListener('click', (e) => {
        const page = e.currentTarget.getAttribute('data-page');
        this.navigateTo(page);
      });
    });

    document.getElementById('btn-quick-take-attendance')?.addEventListener('click', () => {
      this.navigateTo('attendance');
    });

    document.getElementById('btn-quick-import-students')?.addEventListener('click', () => {
      this.navigateTo('import-export');
    });
  },

  /**
   * Refresh all components and KPI states
   */
  refreshAll() {
    this.updateBrandAndHeader();
    this.renderDashboard();
    StudentModule.renderStudentsTable();
    ClassModule.renderClassesPage();
    AttendanceModule.populateClassDropdown();
    this.syncFilterDropdowns();
  },

  updateBrandAndHeader() {
    const settings = StorageService.getSettings();
    const sideSchool = document.getElementById('sidebar-school-name');
    if (sideSchool) sideSchool.textContent = settings.schoolName;

    const dateBox = document.getElementById('current-cambodia-date');
    if (dateBox) dateBox.textContent = Utils.formatKhmerDate(Utils.getCambodiaDateString());

    const isDemo = StorageService.isDemoMode();
    const demoBadge = document.getElementById('demo-badge-box');
    if (demoBadge) demoBadge.style.display = isDemo ? 'block' : 'none';
  },

  renderDashboard() {
    const students = StudentModule.getStudents().filter(s => s.status === 'active');
    const classes = ClassModule.getClasses();
    const sessions = StorageService.getAttendanceSessions();
    const today = Utils.getCambodiaDateString();

    // KPI Values
    document.getElementById('kpi-total-students').textContent = Utils.toKhmerNum(students.length);
    document.getElementById('kpi-total-classes').textContent = Utils.toKhmerNum(classes.length);

    const todaySessions = sessions.filter(s => s.date === today);
    document.getElementById('kpi-today-sessions').textContent = `${Utils.toKhmerNum(todaySessions.length)} / ${Utils.toKhmerNum(classes.length)}`;

    let totalRecordedToday = 0;
    let presentToday = 0;
    const settings = StorageService.getSettings();

    todaySessions.forEach(sess => {
      sess.records.forEach(r => {
        totalRecordedToday++;
        if (r.status === 'present' || (settings.lateCountsAsPresent && r.status === 'late')) {
          presentToday++;
        }
      });
    });

    const rateToday = totalRecordedToday > 0 ? Math.round((presentToday / totalRecordedToday) * 100) : 0;
    document.getElementById('kpi-attendance-rate').textContent = `${Utils.toKhmerNum(rateToday)}%`;

    // Today Class Table Breakdown
    const tbody = document.getElementById('dashboard-classes-tbody');
    if (!tbody) return;

    if (classes.length === 0) {
      tbody.innerHTML = `<tr><td colspan="8" class="text-center">មិនទាន់មានថ្នាក់រៀនទេ</td></tr>`;
      return;
    }

    tbody.innerHTML = classes.map(c => {
      const classStudentsCount = ClassModule.getStudentCount(c.id);
      const session = todaySessions.find(s => s.classId === c.id);

      if (!session) {
        return `
          <tr>
            <td><strong>${c.nameKh}</strong></td>
            <td>ថ្នាក់ទី ${Utils.toKhmerNum(c.grade)}</td>
            <td>${Utils.toKhmerNum(classStudentsCount)} នាក់</td>
            <td><span class="badge badge-warning">មិនទាន់ស្រង់</span></td>
            <td>-</td>
            <td>-</td>
            <td>-</td>
            <td>
              <button class="btn btn-primary btn-sm" onclick="App.quickStartAttendance('${c.id}')">
                ស្រង់វត្តមាន
              </button>
            </td>
          </tr>
        `;
      }

      let p = 0, a = 0, l = 0;
      session.records.forEach(r => {
        if (r.status === 'present') p++;
        else if (r.status === 'absent') a++;
        else if (r.status === 'late') l++;
      });

      return `
        <tr>
          <td><strong>${c.nameKh}</strong></td>
          <td>ថ្នាក់ទី ${Utils.toKhmerNum(c.grade)}</td>
          <td>${Utils.toKhmerNum(classStudentsCount)} នាក់</td>
          <td><span class="badge badge-success">✓ ស្រង់រួច</span></td>
          <td class="text-success font-weight-bold">${Utils.toKhmerNum(p)}</td>
          <td class="text-danger font-weight-bold">${Utils.toKhmerNum(a)}</td>
          <td class="text-warning font-weight-bold">${Utils.toKhmerNum(l)}</td>
          <td>
            <button class="btn btn-outline-secondary btn-sm" onclick="App.quickStartAttendance('${c.id}')">
              ពិនិត្យ/កែ
            </button>
          </td>
        </tr>
      `;
    }).join('');
  },

  quickStartAttendance(classId) {
    this.navigateTo('attendance');
    const select = document.getElementById('att-class-select');
    if (select) {
      select.value = classId;
      AttendanceModule.loadClassForAttendance();
    }
  },

  syncFilterDropdowns() {
    const classes = ClassModule.getClasses();
    const classFilter = document.getElementById('filter-student-class');
    const studentModalClass = document.getElementById('student-class-select');
    const historyClass = document.getElementById('history-class-filter');

    const options = classes.map(c => `<option value="${c.id}">${c.nameKh}</option>`).join('');

    if (classFilter) classFilter.innerHTML = '<option value="ALL">-- ថ្នាក់ទាំងអស់ --</option>' + options;
    if (studentModalClass) studentModalClass.innerHTML = options;
    if (historyClass) historyClass.innerHTML = '<option value="ALL">-- ថ្នាក់ទាំងអស់ --</option>' + options;
  },

  setupHistoryFilter() {
    document.getElementById('btn-apply-history-filter')?.addEventListener('click', () => this.renderHistoryPage());
    document.getElementById('btn-reset-history-filter')?.addEventListener('click', () => {
      document.getElementById('history-from-date').value = '';
      document.getElementById('history-to-date').value = '';
      document.getElementById('history-class-filter').value = 'ALL';
      this.renderHistoryPage();
    });
  },

  renderHistoryPage() {
    const container = document.getElementById('history-sessions-list');
    if (!container) return;

    const fromDate = document.getElementById('history-from-date').value;
    const toDate = document.getElementById('history-to-date').value;
    const classId = document.getElementById('history-class-filter').value;

    let sessions = StorageService.getAttendanceSessions().sort((a, b) => b.date.localeCompare(a.date));

    if (fromDate) sessions = sessions.filter(s => s.date >= fromDate);
    if (toDate) sessions = sessions.filter(s => s.date <= toDate);
    if (classId !== 'ALL') sessions = sessions.filter(s => s.classId === classId);

    if (sessions.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">📅</div>
          <h3>មិនមានកំណត់ត្រាវត្តមានតាមលក្ខខណ្ឌស្វែងរកទេ</h3>
        </div>
      `;
      return;
    }

    const classesMap = new Map(ClassModule.getAllClassesIncludingArchived().map(c => [c.id, c.nameKh]));

    container.innerHTML = sessions.map(s => {
      let p = 0, a = 0, l = 0, e = 0;
      s.records.forEach(r => {
        if (r.status === 'present') p++;
        else if (r.status === 'absent') a++;
        else if (r.status === 'late') l++;
        else if (r.status === 'excused') e++;
      });

      return `
        <div class="card mb-3">
          <div class="d-flex justify-content-between align-items-center flex-wrap gap-2">
            <div>
              <span class="badge badge-primary">${classesMap.get(s.classId) || 'ថ្នាក់រៀន'}</span>
              <span class="badge badge-info ml-2">${s.subject} (ម៉ោងទី ${Utils.toKhmerNum(s.periodId)})</span>
              <h4 class="mt-2">${Utils.formatKhmerDate(s.date)}</h4>
            </div>
            <div class="d-flex gap-2">
              <button class="btn btn-outline-primary btn-sm" onclick="App.editHistorySession('${s.id}')">✏️ ពិនិត្យ / កែប្រែ</button>
            </div>
          </div>
          <div class="summary-pills mt-3">
            <div class="summary-pill pill-present">មករៀន: <strong>${Utils.toKhmerNum(p)}</strong></div>
            <div class="summary-pill pill-absent">អវត្តមាន: <strong>${Utils.toKhmerNum(a)}</strong></div>
            <div class="summary-pill pill-late">យឺត: <strong>${Utils.toKhmerNum(l)}</strong></div>
            <div class="summary-pill pill-excused">ច្បាប់: <strong>${Utils.toKhmerNum(e)}</strong></div>
          </div>
        </div>
      `;
    }).join('');
  },

  editHistorySession(sessionId) {
    const session = StorageService.getAttendanceSessions().find(s => s.id === sessionId);
    if (!session) return;

    this.navigateTo('attendance');
    document.getElementById('att-class-select').value = session.classId;
    document.getElementById('att-date-input').value = session.date;
    document.getElementById('att-subject-select').value = session.subject;
    document.getElementById('att-period-select').value = session.periodId;

    AttendanceModule.loadClassForAttendance();
  },

  setupModals() {
    // Student Form
    document.getElementById('btn-add-student')?.addEventListener('click', () => {
      document.getElementById('student-id-field').value = '';
      document.getElementById('student-form').reset();
      document.getElementById('student-modal-title').textContent = 'បន្ថែមសិស្សថ្មី';
      Utils.openModal('student-modal');
    });

    document.getElementById('student-form')?.addEventListener('submit', (e) => {
      e.preventDefault();
      const id = document.getElementById('student-id-field').value;
      const nameKh = document.getElementById('student-name-input').value;
      const code = document.getElementById('student-code-input').value;
      const gender = document.getElementById('student-gender-select').value;
      const classId = document.getElementById('student-class-select').value;
      const phone = document.getElementById('student-phone-input').value;
      const notes = document.getElementById('student-notes-input').value;

      if (StudentModule.isCodeDuplicate(code, id)) {
        Utils.showToast('អត្តលេខសិស្សនេះមានក្នុងប្រព័ន្ធរួចហើយ!', 'error');
        return;
      }

      if (id) {
        StudentModule.updateStudent(id, { nameKh, code, gender, classId, phone, notes });
        Utils.showToast('បានកែប្រែព័ត៌មានសិស្សដោយជោគជ័យ', 'success');
      } else {
        StudentModule.addStudent({ nameKh, code, gender, classId, phone, notes });
        Utils.showToast('បានបន្ថែមសិស្សថ្មីដោយជោគជ័យ', 'success');
      }

      Utils.closeModal('student-modal');
      App.refreshAll();
    });

    // Class Form
    document.getElementById('btn-add-class')?.addEventListener('click', () => {
      document.getElementById('class-id-field').value = '';
      document.getElementById('class-form').reset();
      document.getElementById('class-modal-title').textContent = 'បង្កើតថ្នាក់រៀនថ្មី';
      Utils.openModal('class-modal');
    });

    document.getElementById('class-form')?.addEventListener('submit', (e) => {
      e.preventDefault();
      const id = document.getElementById('class-id-field').value;
      const nameKh = document.getElementById('class-name-kh').value;
      const nameEn = document.getElementById('class-name-en').value;
      const grade = document.getElementById('class-grade-select').value;
      const academicYear = document.getElementById('class-year-input').value;

      if (id) {
        ClassModule.updateClass(id, { nameKh, nameEn, grade, academicYear });
        Utils.showToast('បានកែប្រែព័ត៌មានថ្នាក់ដោយជោគជ័យ', 'success');
      } else {
        ClassModule.addClass({ nameKh, nameEn, grade, academicYear });
        Utils.showToast('បានបង្កើតថ្នាក់ថ្មីដោយជោគជ័យ', 'success');
      }

      Utils.closeModal('class-modal');
      App.refreshAll();
    });

    // Close buttons
    document.querySelectorAll('[data-close-modal]').forEach(btn => {
      btn.addEventListener('click', () => {
        const modalId = btn.getAttribute('data-close-modal');
        Utils.closeModal(modalId);
      });
    });
  },

  setupSettingsForm() {
    const settings = StorageService.getSettings();
    document.getElementById('set-school-name').value = settings.schoolName;
    document.getElementById('set-academic-year').value = settings.academicYear;
    document.getElementById('set-default-mode').value = settings.defaultAttendanceMode;
    document.getElementById('set-late-counts-present').checked = settings.lateCountsAsPresent;

    document.getElementById('settings-form')?.addEventListener('submit', (e) => {
      e.preventDefault();
      StorageService.saveSettings({
        schoolName: document.getElementById('set-school-name').value,
        academicYear: document.getElementById('set-academic-year').value,
        defaultAttendanceMode: document.getElementById('set-default-mode').value,
        lateCountsAsPresent: document.getElementById('set-late-counts-present').checked
      });
      Utils.showToast('✓ បានរក្សាទុកការកំណត់ដោយជោគជ័យ', 'success');
      App.refreshAll();
    });

    // Load Demo Data Button
    document.getElementById('btn-load-demo-data')?.addEventListener('click', async () => {
      const ok = await Utils.confirm('បញ្ចូលទិន្នន័យសាកល្បង', 'តើអ្នកចង់បង្កើតទិន្នន័យគំរូសម្រាប់សាកល្បងប្រព័ន្ធមែនទេ?');
      if (ok) {
        App.seedDemoData();
        Utils.showToast('បានបញ្ចូលទិន្នន័យសាកល្បងរួចរាល់', 'success');
        App.refreshAll();
      }
    });

    // Clear All Data
    document.getElementById('btn-clear-all-data')?.addEventListener('click', async () => {
      const ok = await Utils.confirm(
        '⚠️ លុបទិន្នន័យទាំងអស់',
        'តើអ្នកពិតជាចង់លុបទិន្នន័យសិស្ស ថ្នាក់ និងវត្តមានទាំងអស់ក្នុង Browser មែនទេ? សកម្មភាពនេះមិនអាចត្រឡប់វិញបានទេ។'
      );
      if (ok) {
        StorageService.clearAllData();
        Utils.showToast('បានសម្អាតទិន្នន័យទាំងអស់រួចរាល់', 'info');
        App.refreshAll();
      }
    });
  },

  setupBackupRestore() {
    document.getElementById('btn-backup-json')?.addEventListener('click', () => {
      StorageService.backupApplicationData();
      Utils.showToast('បានទាញយកឯកសារ Backup រួចរាល់', 'success');
    });

    const restoreInput = document.getElementById('restore-json-input');
    restoreInput?.addEventListener('change', async (e) => {
      if (e.target.files && e.target.files[0]) {
        const file = e.target.files[0];
        const ok = await Utils.confirm(
          'ការស្តារទិន្នន័យ (Restore)',
          'ការស្តារទិន្នន័យនឹងជំនួសទិន្នន័យបច្ចុប្បន្នទាំងអស់។ តើអ្នកប្រាកដទេ?'
        );
        if (!ok) {
          restoreInput.value = '';
          return;
        }

        const reader = new FileReader();
        reader.onload = async (event) => {
          try {
            await StorageService.restoreApplicationData(event.target.result);
            Utils.showToast('✓ បានស្តារទិន្នន័យជោគជ័យ!', 'success');
            App.refreshAll();
          } catch (err) {
            Utils.showToast('ឯកសារ Backup មិនត្រឹមត្រូវ', 'error');
          }
        };
        reader.readAsText(file);
      }
    });
  },

  setupNetworkMonitoring() {
    const updateStatus = () => {
      const online = navigator.onLine;
      const banner = document.getElementById('connection-banner');
      const text = document.getElementById('connection-text');
      const dot = document.getElementById('mobile-online-status');

      if (banner && text) {
        if (!online) {
          banner.classList.remove('hidden');
          banner.classList.add('offline');
          text.textContent = '🟠 គ្មានអ៊ីនធឺណិត (Offline) — ប្រព័ន្ធកំពុងដំណើរការលើទិន្នន័យក្នុងឧបករណ៍';
        } else {
          banner.classList.add('hidden');
          banner.classList.remove('offline');
        }
      }

      if (dot) {
        dot.className = `status-dot ${online ? 'online' : 'offline'}`;
      }
    };

    window.addEventListener('online', updateStatus);
    window.addEventListener('offline', updateStatus);
    updateStatus();
  },

  registerServiceWorker() {
    if ('serviceWorker' in navigator) {
      window.addEventListener('load', () => {
        navigator.serviceWorker.register('./service-worker.js').catch(err => {
          console.warn('SW registration skipped in local sandbox:', err);
        });
      });
    }
  },

  checkFirstRunSeedDemo() {
    if (StorageService.getClasses().length === 0) {
      this.seedDemoData();
    }
  },

  seedDemoData() {
    const demoClasses = [
      { id: 'c_4a', nameKh: 'ថ្នាក់ទី ៤ក', nameEn: 'Grade 4A', grade: 4, academicYear: '2026-2027', active: true },
      { id: 'c_4b', nameKh: 'ថ្នាក់ទី ៤ខ', nameEn: 'Grade 4B', grade: 4, academicYear: '2026-2027', active: true },
      { id: 'c_5a', nameKh: 'ថ្នាក់ទី ៥ក', nameEn: 'Grade 5A', grade: 5, academicYear: '2026-2027', active: true }
    ];
    StorageService.saveClasses(demoClasses);

    const demoStudents = [
      { id: 's_01', nameKh: 'សុខ ដារ៉ា', code: 'STU-001', gender: 'M', classId: 'c_4a', phone: '012 345 678', status: 'active' },
      { id: 's_02', nameKh: 'ចាន់ ធារ៉ា', code: 'STU-002', gender: 'F', classId: 'c_4a', phone: '098 765 432', status: 'active' },
      { id: 's_03', nameKh: 'គង់ ចិន្តា', code: 'STU-003', gender: 'F', classId: 'c_4a', phone: '011 223 344', status: 'active' },
      { id: 's_04', nameKh: 'ឡុង វិបុល', code: 'STU-004', gender: 'M', classId: 'c_4a', phone: '077 889 900', status: 'active' },
      { id: 's_05', nameKh: 'ម៉ៅ ស្រីម៉ៅ', code: 'STU-005', gender: 'F', classId: 'c_4a', phone: '016 554 433', status: 'active' },
      { id: 's_06', nameKh: 'ខៀវ សុវណ្ណ', code: 'STU-006', gender: 'M', classId: 'c_4b', phone: '012 998 877', status: 'active' },
      { id: 's_07', nameKh: 'ទូច បូរ៉ា', code: 'STU-007', gender: 'M', classId: 'c_4b', phone: '093 112 233', status: 'active' },
      { id: 's_08', nameKh: 'ហេង ពិសី', code: 'STU-008', gender: 'F', classId: 'c_5a', phone: '010 445 566', status: 'active' }
    ];
    StorageService.saveStudents(demoStudents);

    // Sample Attendance Session
    const today = Utils.getCambodiaDateString();
    const demoSession = [
      {
        id: 'att_demo_01',
        classId: 'c_4a',
        date: today,
        subject: 'Digital Literacy',
        periodId: 1,
        teacherId: 'teacher-001',
        records: [
          { studentId: 's_01', status: 'present', note: '' },
          { studentId: 's_02', status: 'present', note: '' },
          { studentId: 's_03', status: 'absent', note: 'ឈឺ' },
          { studentId: 's_04', status: 'late', note: 'យឺត ១០ នាទី' },
          { studentId: 's_05', status: 'present', note: '' }
        ],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }
    ];
    StorageService.saveAttendanceSessions(demoSession);
    StorageService.setDemoMode(true);
  }
};

// Bootstrap application on DOMContentLoaded
document.addEventListener('DOMContentLoaded', () => {
  App.init();
});