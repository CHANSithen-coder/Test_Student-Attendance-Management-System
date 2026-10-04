/**
 * reports.js — Attendance Matrix, KPI Aggregation & Student Breakdown
 */

const ReportsModule = {
  initReportsPage() {
    this.populateSelectors();
    this.bindEvents();
    this.generateClassReport();
  },

  populateSelectors() {
    const classSelect = document.getElementById('report-class-select');
    const studentSelect = document.getElementById('report-student-select');
    const fromInput = document.getElementById('report-from-date');
    const toInput = document.getElementById('report-to-date');

    const classes = ClassModule.getClasses();
    if (classSelect) {
      classSelect.innerHTML = classes.map(c => `<option value="${c.id}">${c.nameKh}</option>`).join('');
    }

    const students = StudentModule.getStudents().filter(s => s.status === 'active');
    if (studentSelect) {
      studentSelect.innerHTML = '<option value="">-- ជ្រើសរើសសិស្សដើម្បីពិនិត្យ --</option>' +
        students.map(s => `<option value="${s.id}">${s.nameKh} (${s.code})</option>`).join('');
    }

    // Default: current month
    const today = Utils.getCambodiaDateString();
    if (toInput && !toInput.value) toInput.value = today;
    if (fromInput && !fromInput.value) {
      const parts = today.split('-');
      fromInput.value = `${parts[0]}-${parts[1]}-01`;
    }
  },

  bindEvents() {
    document.querySelectorAll('.report-tab-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        document.querySelectorAll('.report-tab-btn').forEach(b => b.classList.remove('active'));
        document.querySelectorAll('.report-tab-content').forEach(c => c.classList.remove('active'));
        e.currentTarget.classList.add('active');
        const tab = e.currentTarget.getAttribute('data-report-tab');
        document.getElementById(`tab-${tab}`).classList.add('active');
      });
    });

    document.getElementById('btn-generate-class-report')?.addEventListener('click', () => {
      this.generateClassReport();
    });

    document.getElementById('report-student-select')?.addEventListener('change', (e) => {
      this.generateStudentReport(e.target.value);
    });

    document.getElementById('btn-export-current-report')?.addEventListener('click', () => {
      this.exportReportToExcel();
    });
  },

  generateClassReport() {
    const classId = document.getElementById('report-class-select')?.value;
    const fromDate = document.getElementById('report-from-date')?.value;
    const toDate = document.getElementById('report-to-date')?.value;
    const tbody = document.getElementById('report-matrix-tbody');

    if (!classId || !tbody) return;

    const students = StudentModule.getActiveStudentsByClass(classId);
    const sessions = StorageService.getAttendanceSessions().filter(s => {
      return s.classId === classId && (!fromDate || s.date >= fromDate) && (!toDate || s.date <= toDate);
    });

    if (students.length === 0) {
      tbody.innerHTML = `<tr><td colspan="8" class="text-center">គ្មានសិស្សក្នុងថ្នាក់នេះ</td></tr>`;
      return;
    }

    const settings = StorageService.getSettings();

    tbody.innerHTML = students.map((stu, idx) => {
      let present = 0, absent = 0, late = 0, excused = 0;

      sessions.forEach(sess => {
        const rec = sess.records.find(r => r.studentId === stu.id);
        if (rec) {
          if (rec.status === 'present') present++;
          else if (rec.status === 'absent') absent++;
          else if (rec.status === 'late') late++;
          else if (rec.status === 'excused') excused++;
        }
      });

      const totalRecorded = present + absent + late + excused;
      const attended = settings.lateCountsAsPresent ? (present + late) : present;
      const rate = totalRecorded > 0 ? Math.round((attended / totalRecorded) * 100) : 0;

      return `
        <tr>
          <td>${Utils.toKhmerNum(idx + 1)}</td>
          <td><strong>${stu.nameKh}</strong></td>
          <td><code>${stu.code}</code></td>
          <td class="text-success font-weight-bold">${Utils.toKhmerNum(present)}</td>
          <td class="text-danger font-weight-bold">${Utils.toKhmerNum(absent)}</td>
          <td class="text-warning font-weight-bold">${Utils.toKhmerNum(late)}</td>
          <td class="text-info font-weight-bold">${Utils.toKhmerNum(excused)}</td>
          <td>
            <strong>${Utils.toKhmerNum(rate)}%</strong>
            <div style="background: #e2e8f0; height: 6px; border-radius: 3px; overflow: hidden; width: 60px; margin-top: 4px;">
              <div style="background: ${rate >= 80 ? '#057a55' : rate >= 60 ? '#d97706' : '#e02424'}; width: ${rate}%; height: 100%;"></div>
            </div>
          </td>
        </tr>
      `;
    }).join('');
  },

  generateStudentReport(studentId) {
    const card = document.getElementById('student-detail-report-card');
    if (!card) return;

    if (!studentId) {
      card.innerHTML = `<div class="empty-state"><p>សូមជ្រើសរើសសិស្សដើម្បីពិនិត្យប្រវត្តិវត្តមានលម្អិត</p></div>`;
      return;
    }

    const student = StudentModule.getStudentById(studentId);
    if (!student) return;

    const classObj = ClassModule.getClassById(student.classId);
    const sessions = StorageService.getAttendanceSessions()
      .filter(s => s.records.some(r => r.studentId === student.id))
      .sort((a, b) => b.date.localeCompare(a.date));

    let present = 0, absent = 0, late = 0, excused = 0;
    const historyList = [];

    sessions.forEach(s => {
      const r = s.records.find(rec => rec.studentId === student.id);
      if (r) {
        if (r.status === 'present') present++;
        else if (r.status === 'absent') absent++;
        else if (r.status === 'late') late++;
        else if (r.status === 'excused') excused++;

        historyList.push({
          date: s.date,
          subject: s.subject,
          periodId: s.periodId,
          status: r.status,
          note: r.note
        });
      }
    });

    const total = present + absent + late + excused;
    const settings = StorageService.getSettings();
    const attended = settings.lateCountsAsPresent ? (present + late) : present;
    const rate = total > 0 ? Math.round((attended / total) * 100) : 0;

    card.innerHTML = `
      <div class="d-flex justify-content-between align-items-center flex-wrap gap-2">
        <div>
          <h3>${student.nameKh}</h3>
          <span class="text-muted">អត្តលេខ: <strong>${student.code}</strong> | ភេទ: ${student.gender === 'F' ? 'ស្រី' : 'ប្រុស'} | ថ្នាក់: ${classObj ? classObj.nameKh : '-'}</span>
        </div>
        <div class="kpi-data text-right">
          <span class="kpi-label">អត្រាវត្តមានសរុប</span>
          <span class="kpi-value text-primary">${Utils.toKhmerNum(rate)}%</span>
        </div>
      </div>

      <div class="kpi-grid mt-4">
        <div class="card p-2 text-center">
          <span class="text-muted text-sm">វត្តមានសរុប</span>
          <strong class="text-lg">${Utils.toKhmerNum(total)} លើក</strong>
        </div>
        <div class="card p-2 text-center">
          <span class="text-muted text-sm">មករៀន</span>
          <strong class="text-lg text-success">${Utils.toKhmerNum(present)}</strong>
        </div>
        <div class="card p-2 text-center">
          <span class="text-muted text-sm">អវត្តមាន</span>
          <strong class="text-lg text-danger">${Utils.toKhmerNum(absent)}</strong>
        </div>
        <div class="card p-2 text-center">
          <span class="text-muted text-sm">យឺត</span>
          <strong class="text-lg text-warning">${Utils.toKhmerNum(late)}</strong>
        </div>
        <div class="card p-2 text-center">
          <span class="text-muted text-sm">ច្បាប់</span>
          <strong class="text-lg text-info">${Utils.toKhmerNum(excused)}</strong>
        </div>
      </div>

      <h4 class="mt-4 mb-2">ប្រវត្តិកាលបរិច្ឆេទវត្តមានកន្លងមក</h4>
      <div class="table-responsive">
        <table class="data-table">
          <thead>
            <tr>
              <th>កាលបរិច្ឆេទ</th>
              <th>មុខវិជ្ជា</th>
              <th>ម៉ោង</th>
              <th>ស្ថានភាព</th>
              <th>កំណត់សម្គាល់</th>
            </tr>
          </thead>
          <tbody>
            ${historyList.length === 0 ? '<tr><td colspan="5" class="text-center">មិនទាន់មានប្រវត្តិវត្តមាននៅឡើយទេ</td></tr>' : 
              historyList.map(h => {
                let badgeClass = 'badge-success';
                let khStatus = 'មករៀន';
                if (h.status === 'absent') { badgeClass = 'badge-danger'; khStatus = 'អវត្តមាន'; }
                if (h.status === 'late') { badgeClass = 'badge-warning'; khStatus = 'យឺត'; }
                if (h.status === 'excused') { badgeClass = 'badge-info'; khStatus = 'ច្បាប់'; }

                return `
                  <tr>
                    <td>${Utils.formatKhmerDate(h.date)}</td>
                    <td>${h.subject}</td>
                    <td>ម៉ោងទី ${Utils.toKhmerNum(h.periodId)}</td>
                    <td><span class="badge ${badgeClass}">${khStatus}</span></td>
                    <td>${h.note || '-'}</td>
                  </tr>
                `;
              }).join('')
            }
          </tbody>
        </table>
      </div>
    `;
  },

  exportReportToExcel() {
    const classId = document.getElementById('report-class-select')?.value;
    if (!classId) {
      Utils.showToast('សូមជ្រើសរើសថ្នាក់ដើម្បី Export របាយការណ៍', 'warning');
      return;
    }
    ImportExportModule.exportAttendanceReport(classId);
  }
};