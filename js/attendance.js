/**
 * attendance.js — Fast Attendance Workflow, Collision Guard & Calculations
 */

const AttendanceModule = {
  // Current active working session in UI
  activeSession: {
    classId: '',
    date: Utils.getCambodiaDateString(),
    subject: 'Digital Literacy',
    periodId: 1,
    records: new Map() // studentId -> { status: 'present' | 'absent' | 'late' | 'excused', note: '' }
  },

  initAttendancePage() {
    const dateInput = document.getElementById('att-date-input');
    if (dateInput && !dateInput.value) {
      dateInput.value = Utils.getCambodiaDateString();
    }

    this.populateClassDropdown();
    this.bindEvents();
  },

  populateClassDropdown() {
    const select = document.getElementById('att-class-select');
    if (!select) return;

    const classes = ClassModule.getClasses();
    const currentVal = select.value;

    select.innerHTML = '<option value="">-- ជ្រើសរើសថ្នាក់ --</option>' +
      classes.map(c => `<option value="${c.id}">${c.nameKh} (${c.nameEn || ''})</option>`).join('');

    if (currentVal && classes.some(c => c.id === currentVal)) {
      select.value = currentVal;
    } else if (classes.length > 0 && !select.value) {
      select.value = classes[0].id;
      this.loadClassForAttendance();
    }
  },

  bindEvents() {
    document.getElementById('att-class-select')?.addEventListener('change', () => this.loadClassForAttendance());
    document.getElementById('att-date-input')?.addEventListener('change', () => this.loadClassForAttendance());
    document.getElementById('att-subject-select')?.addEventListener('change', () => this.loadClassForAttendance());
    document.getElementById('att-period-select')?.addEventListener('change', () => this.loadClassForAttendance());

    // Fast batch actions
    document.getElementById('btn-mark-all-present')?.addEventListener('click', () => this.markAll('present'));
    document.getElementById('btn-mark-all-absent')?.addEventListener('click', async () => {
      const ok = await Utils.confirm('បញ្ជាក់', 'តើអ្នកប្រាកដទេថាកំណត់សិស្សទាំងអស់ជា «អវត្តមាន»?');
      if (ok) this.markAll('absent');
    });

    // Search filter in attendance
    document.getElementById('att-student-search')?.addEventListener('input', (e) => {
      this.filterStudentCards(e.target.value);
    });

    // Save
    document.getElementById('btn-save-attendance')?.addEventListener('click', () => this.handleSaveAttendance());
  },

  loadClassForAttendance() {
    const classId = document.getElementById('att-class-select').value;
    const date = document.getElementById('att-date-input').value;
    const subject = document.getElementById('att-subject-select').value;
    const periodId = parseInt(document.getElementById('att-period-select').value, 10);

    if (!classId) {
      document.getElementById('attendance-students-container').innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">👈</div>
          <h3>សូមជ្រើសរើសថ្នាក់រៀន</h3>
          <p>ជ្រើសរើសថ្នាក់ខាងលើដើម្បីបង្ហាញបញ្ជីសិស្ស</p>
        </div>
      `;
      this.updateSummaryPills();
      return;
    }

    const students = StudentModule.getActiveStudentsByClass(classId);
    const existingSession = this.findExistingSession(classId, date, periodId);
    const settings = StorageService.getSettings();

    this.activeSession.classId = classId;
    this.activeSession.date = date;
    this.activeSession.subject = subject;
    this.activeSession.periodId = periodId;
    this.activeSession.records.clear();

    if (existingSession) {
      // Pre-fill existing records
      existingSession.records.forEach(r => {
        this.activeSession.records.set(r.studentId, { status: r.status, note: r.note || '' });
      });
      Utils.showToast(`បានផ្ទុកទិន្នន័យស្រង់វត្តមានដែលមានស្រាប់ (${existingSession.records.length} នាក់)`, 'info', 2000);
    } else {
      // Fast mode default initialization
      const defaultStatus = settings.defaultAttendanceMode === 'all_present' ? 'present' : 'unmarked';
      students.forEach(s => {
        this.activeSession.records.set(s.id, { status: defaultStatus, note: '' });
      });
    }

    this.renderAttendanceList(students);
    this.updateSummaryPills();
  },

  renderAttendanceList(students) {
    const container = document.getElementById('attendance-students-container');
    const totalEl = document.getElementById('att-total-display');

    if (totalEl) totalEl.textContent = `សិស្ស: ${Utils.toKhmerNum(students.length)} នាក់`;

    if (students.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">👨‍🎓</div>
          <h3>មិនទាន់មានសិស្សក្នុងថ្នាក់នេះនៅឡើយទេ</h3>
          <p>សូមបន្ថែមសិស្សទៅក្នុងថ្នាក់នេះជាមុនសិន</p>
        </div>
      `;
      return;
    }

    container.innerHTML = students.map((s, idx) => {
      const rec = this.activeSession.records.get(s.id) || { status: 'unmarked' };
      const cur = rec.status;

      return `
        <div class="student-att-row" id="row-stu-${s.id}" data-name="${s.nameKh}" data-code="${s.code}">
          <div class="student-idx">${Utils.toKhmerNum(idx + 1)}</div>
          <div class="student-name-box">
            ${s.nameKh}
            <div class="student-code-box d-md-none">${s.code} | ${s.gender === 'F' ? 'ស្រី' : 'ប្រុស'}</div>
          </div>
          <div class="student-code-box d-none d-md-block">${s.code}</div>
          <div class="status-btn-group">
            <button type="button" class="status-btn present ${cur === 'present' ? 'active' : ''}" 
              onclick="AttendanceModule.setStatus('${s.id}', 'present')">✓ មករៀន</button>
            <button type="button" class="status-btn absent ${cur === 'absent' ? 'active' : ''}" 
              onclick="AttendanceModule.setStatus('${s.id}', 'absent')">✕ អវត្តមាន</button>
            <button type="button" class="status-btn late ${cur === 'late' ? 'active' : ''}" 
              onclick="AttendanceModule.setStatus('${s.id}', 'late')">⏰ យឺត</button>
            <button type="button" class="status-btn excused ${cur === 'excused' ? 'active' : ''}" 
              onclick="AttendanceModule.setStatus('${s.id}', 'excused')">📋 ច្បាប់</button>
          </div>
        </div>
      `;
    }).join('');
  },

  setStatus(studentId, status) {
    const rec = this.activeSession.records.get(studentId) || { note: '' };
    rec.status = status;
    this.activeSession.records.set(studentId, rec);

    // Update button states in row
    const row = document.getElementById(`row-stu-${studentId}`);
    if (row) {
      row.querySelectorAll('.status-btn').forEach(btn => btn.classList.remove('active'));
      const activeBtn = row.querySelector(`.status-btn.${status}`);
      if (activeBtn) activeBtn.classList.add('active');
    }

    this.updateSummaryPills();
  },

  markAll(status) {
    const students = StudentModule.getActiveStudentsByClass(this.activeSession.classId);
    students.forEach(s => {
      this.setStatus(s.id, status);
    });
    Utils.showToast(`បានកំណត់សិស្សទាំងអស់ជា «${status === 'present' ? 'មករៀន' : 'អវត្តមាន'}»`, 'info', 2000);
  },

  filterStudentCards(keyword) {
    const rows = document.querySelectorAll('.student-att-row');
    rows.forEach(r => {
      const name = r.getAttribute('data-name');
      const code = r.getAttribute('data-code');
      const match = Utils.matchesSearch(name, keyword) || Utils.matchesSearch(code, keyword);
      r.style.display = match ? 'grid' : 'none';
    });
  },

  calculateAttendanceSummary() {
    const settings = StorageService.getSettings();
    let total = this.activeSession.records.size;
    let present = 0, absent = 0, late = 0, excused = 0, unmarked = 0;

    this.activeSession.records.forEach(rec => {
      if (rec.status === 'present') present++;
      else if (rec.status === 'absent') absent++;
      else if (rec.status === 'late') late++;
      else if (rec.status === 'excused') excused++;
      else unmarked++;
    });

    const attendedCount = settings.lateCountsAsPresent ? (present + late) : present;
    const rate = total > 0 ? Math.round((attendedCount / total) * 100) : 0;

    return { total, present, absent, late, excused, unmarked, rate };
  },

  updateSummaryPills() {
    const sum = this.calculateAttendanceSummary();
    document.getElementById('sum-total').textContent = Utils.toKhmerNum(sum.total);
    document.getElementById('sum-present').textContent = Utils.toKhmerNum(sum.present);
    document.getElementById('sum-absent').textContent = Utils.toKhmerNum(sum.absent);
    document.getElementById('sum-late').textContent = Utils.toKhmerNum(sum.late);
    document.getElementById('sum-excused').textContent = Utils.toKhmerNum(sum.excused);
    document.getElementById('sum-rate').textContent = `${Utils.toKhmerNum(sum.rate)}%`;
  },

  findExistingSession(classId, date, periodId) {
    const sessions = StorageService.getAttendanceSessions();
    return sessions.find(s => s.classId === classId && s.date === date && s.periodId === periodId);
  },

  async handleSaveAttendance() {
    const { classId, date, subject, periodId } = this.activeSession;

    if (!classId) {
      Utils.showToast('សូមជ្រើសរើសថ្នាក់រៀនជាមុនសិន', 'error');
      return;
    }
    if (!date) {
      Utils.showToast('សូមជ្រើសរើសកាលបរិច្ឆេទ', 'error');
      return;
    }
    if (this.activeSession.records.size === 0) {
      Utils.showToast('មិនមានសិស្សក្នុងថ្នាក់នេះដើម្បីស្រង់វត្តមានទេ', 'error');
      return;
    }

    // Check unmarked
    const sum = this.calculateAttendanceSummary();
    if (sum.unmarked > 0) {
      const ok = await Utils.confirm(
        'មានសិស្សមិនទាន់កំណត់វត្តមាន',
        `នៅសល់សិស្សចំនួន ${Utils.toKhmerNum(sum.unmarked)} នាក់ មិនទាន់បានស្រង់។ តើអ្នកចង់កំណត់ពួកគេជា «អវត្តមាន» ដោយស្វ័យប្រវត្ត ឬបោះបង់ដើម្បីពិនិត្យឡើងវិញ?`,
        'កំណត់ជាអវត្តមាន និងរក្សាទុក'
      );
      if (!ok) return;

      // Auto-set unmarked to absent
      this.activeSession.records.forEach((rec, sid) => {
        if (rec.status === 'unmarked') this.setStatus(sid, 'absent');
      });
    }

    // Check collision / overwrite guard
    const existing = this.findExistingSession(classId, date, periodId);
    if (existing) {
      const overwrite = await Utils.confirm(
        'កំណត់ត្រាវត្តមានមានរួចហើយ',
        `វត្តមានសម្រាប់ថ្ងៃនេះ និងម៉ោងនេះមានរួចហើយ។ តើអ្នកពិតជាចង់ «កែប្រែវត្តមាន» ជំនួសកំណត់ត្រាចាស់មែនទេ?`,
        'កែប្រែវត្តមាន'
      );
      if (!overwrite) return;
    }

    // Construct Normalized Session Document
    const recordsArray = [];
    this.activeSession.records.forEach((rec, studentId) => {
      recordsArray.push({
        studentId,
        status: rec.status,
        note: rec.note || ''
      });
    });

    const sessions = StorageService.getAttendanceSessions();
    const sessionId = existing ? existing.id : Utils.generateId('att');

    const sessionPayload = {
      id: sessionId,
      classId,
      date,
      subject,
      periodId,
      teacherId: 'teacher-001',
      records: recordsArray,
      createdAt: existing ? existing.createdAt : new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    if (existing) {
      const idx = sessions.findIndex(s => s.id === existing.id);
      sessions[idx] = sessionPayload;
    } else {
      sessions.push(sessionPayload);
    }

    StorageService.saveAttendanceSessions(sessions);
    Utils.showToast('✓ បានរក្សាទុកវត្តមានដោយជោគជ័យ', 'success');
    App.refreshAll();
  }
};