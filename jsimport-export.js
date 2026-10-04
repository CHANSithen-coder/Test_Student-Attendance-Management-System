/**
 * import-export.js — SheetJS Real Excel (.xlsx, .xls, .csv) Validation & Export
 */

const ImportExportModule = {
  tempParsedRows: [],

  init() {
    this.bindDropzone();
    this.bindExports();
  },

  bindDropzone() {
    const dropzone = document.getElementById('excel-dropzone');
    const fileInput = document.getElementById('excel-file-input');

    if (!dropzone || !fileInput) return;

    dropzone.addEventListener('click', () => fileInput.click());
    dropzone.addEventListener('dragover', (e) => {
      e.preventDefault();
      dropzone.style.borderColor = 'var(--primary)';
    });
    dropzone.addEventListener('dragleave', () => {
      dropzone.style.borderColor = '#94a3b8';
    });
    dropzone.addEventListener('drop', (e) => {
      e.preventDefault();
      dropzone.style.borderColor = '#94a3b8';
      if (e.dataTransfer.files && e.dataTransfer.files[0]) {
        this.processExcelFile(e.dataTransfer.files[0]);
      }
    });

    fileInput.addEventListener('change', (e) => {
      if (e.target.files && e.target.files[0]) {
        this.processExcelFile(e.target.files[0]);
      }
    });

    document.getElementById('btn-cancel-import')?.addEventListener('click', () => {
      document.getElementById('import-preview-container').classList.add('hidden');
      fileInput.value = '';
    });

    document.getElementById('btn-confirm-import')?.addEventListener('click', () => {
      this.commitValidImport();
    });

    document.getElementById('btn-download-excel-template')?.addEventListener('click', (e) => {
      e.preventDefault();
      this.downloadTemplateFile();
    });
  },

  bindExports() {
    document.getElementById('btn-export-students-excel')?.addEventListener('click', () => {
      this.exportStudentsToExcel();
    });
    document.getElementById('btn-export-all-attendance-excel')?.addEventListener('click', () => {
      this.exportAllAttendanceToExcel();
    });
  },

  /**
   * Process and validate uploaded Excel / CSV file using SheetJS
   */
  processExcelFile(file) {
    if (typeof XLSX === 'undefined') {
      Utils.showToast('មិនអាចទាញយកបណ្ណាល័យ XLSX បានទេ។ សូមភ្ជាប់អ៊ីនធឺណិត', 'error');
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, { type: 'array' });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        const rawJson = XLSX.utils.sheet_to_json(worksheet, { defval: '' });

        if (!rawJson || rawJson.length === 0) {
          Utils.showToast('ឯកសារ Excel គ្មានទិន្នន័យទេ', 'warning');
          return;
        }

        this.validateAndPreview(rawJson);
      } catch (err) {
        console.error(err);
        Utils.showToast('មិនអាចអានឯកសារ Excel បានទេ សូមប្រើទម្រង់ .xlsx ឬ .csv', 'error');
      }
    };
    reader.readAsArrayBuffer(file);
  },

  /**
   * Column Mapper & Validation Rules Engine
   */
  validateAndPreview(rawRows) {
    const classes = ClassModule.getClasses();
    const existingStudents = StudentModule.getStudents();
    const existingCodes = new Set(existingStudents.map(s => s.code.toUpperCase()));
    const batchCodes = new Set();

    let validCount = 0;
    let invalidCount = 0;
    this.tempParsedRows = [];

    const parsed = rawRows.map((row, index) => {
      // Map possible column headers in Khmer and English
      const nameKh = String(row['ឈ្មោះសិស្ស'] || row['ឈ្មោះ'] || row['Name'] || row['Full Name'] || '').trim();
      const code = String(row['អត្តលេខ'] || row['អត្តលេខសិស្ស'] || row['Student ID'] || row['Code'] || '').trim().toUpperCase();
      let gender = String(row['ភេទ'] || row['Gender'] || '').trim();
      let className = String(row['ថ្នាក់'] || row['ថ្នាក់រៀន'] || row['Class'] || '').trim();
      const phone = String(row['លេខទូរស័ព្ទ'] || row['ទូរស័ព្ទអាណាព្យាបាល'] || row['Phone'] || '').trim();

      // Normalize Gender
      if (gender === 'ប្រុស' || gender.toLowerCase() === 'm' || gender.toLowerCase() === 'male') {
        gender = 'M';
      } else if (gender === 'ស្រី' || gender.toLowerCase() === 'f' || gender.toLowerCase() === 'female') {
        gender = 'F';
      } else {
        gender = 'M'; // default fallback
      }

      // Match Class
      let targetClass = classes.find(c => c.nameKh === className || c.nameEn?.toLowerCase() === className.toLowerCase());
      if (!targetClass && classes.length > 0) {
        targetClass = classes[0]; // Fallback to first active class if not specified
      }

      // Validation Checks
      const errors = [];
      if (!nameKh) errors.push('ខ្វះឈ្មោះសិស្ស');
      if (!code) errors.push('ខ្វះអត្តលេខ');
      if (code && existingCodes.has(code)) errors.push('អត្តលេខស្ទួននឹងសិស្សដែលមានស្រាប់');
      if (code && batchCodes.has(code)) errors.push('អត្តលេខស្ទួនក្នុងតារាង');
      if (code) batchCodes.add(code);
      if (!targetClass) errors.push('មិនស្គាល់ថ្នាក់រៀន');

      const isValid = errors.length === 0;
      if (isValid) validCount++;
      else invalidCount++;

      return {
        rowIndex: index + 1,
        isValid,
        errors,
        nameKh,
        code,
        gender,
        classId: targetClass ? targetClass.id : '',
        className: targetClass ? targetClass.nameKh : className,
        phone
      };
    });

    this.tempParsedRows = parsed;

    // Display Preview Table
    document.getElementById('preview-stat-total').textContent = `សរុប: ${Utils.toKhmerNum(parsed.length)}`;
    document.getElementById('preview-stat-valid').textContent = `✓ ត្រឹមត្រូវ: ${Utils.toKhmerNum(validCount)}`;
    document.getElementById('preview-stat-invalid').textContent = `⚠ មានបញ្ហា: ${Utils.toKhmerNum(invalidCount)}`;

    const tbody = document.getElementById('import-preview-tbody');
    tbody.innerHTML = parsed.map(r => `
      <tr style="${r.isValid ? '' : 'background-color: #fef2f2;'}">
        <td>${r.isValid ? '<span class="badge badge-success">✓ ត្រឹមត្រូវ</span>' : '<span class="badge badge-danger">⚠ មានបញ្ហា</span>'}</td>
        <td><strong>${r.nameKh || '-'}</strong></td>
        <td><code>${r.code || '-'}</code></td>
        <td>${r.gender === 'F' ? 'ស្រី' : 'ប្រុស'}</td>
        <td>${r.className || '-'}</td>
        <td class="text-danger text-sm">${r.errors.join(', ')}</td>
      </tr>
    `).join('');

    const confirmBtn = document.getElementById('btn-confirm-import');
    confirmBtn.disabled = validCount === 0;
    confirmBtn.textContent = `✅ នាំចូលសិស្សត្រឹមត្រូវ (${Utils.toKhmerNum(validCount)} នាក់)`;

    document.getElementById('import-preview-container').classList.remove('hidden');
  },

  commitValidImport() {
    const validRows = this.tempParsedRows.filter(r => r.isValid);
    if (validRows.length === 0) return;

    validRows.forEach(r => {
      StudentModule.addStudent({
        nameKh: r.nameKh,
        code: r.code,
        gender: r.gender,
        classId: r.classId,
        phone: r.phone
      });
    });

    Utils.showToast(`✓ បាននាំចូលសិស្សចំនួន ${Utils.toKhmerNum(validRows.length)} នាក់ដោយជោគជ័យ!`, 'success');
    document.getElementById('import-preview-container').classList.add('hidden');
    document.getElementById('excel-file-input').value = '';
    App.refreshAll();
  },

  downloadTemplateFile() {
    const templateData = [
      {
        'ឈ្មោះសិស្ស': 'សុខ ដារ៉ា',
        'អត្តលេខ': 'STU-101',
        'ភេទ': 'ប្រុស',
        'ថ្នាក់': 'ថ្នាក់ទី ៤ក',
        'លេខទូរស័ព្ទ': '012345678'
      },
      {
        'ឈ្មោះសិស្ស': 'ចាន់ ធារ៉ា',
        'អត្តលេខ': 'STU-102',
        'ភេទ': 'ស្រី',
        'ថ្នាក់': 'ថ្នាក់ទី ៤ក',
        'លេខទូរស័ព្ទ': '098765432'
      }
    ];

    const worksheet = XLSX.utils.json_to_sheet(templateData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'StudentsTemplate');
    XLSX.writeFile(workbook, 'students-template.xlsx');
  },

  exportStudentsToExcel() {
    const students = StudentModule.getStudents().filter(s => s.status === 'active');
    const classesMap = new Map(ClassModule.getAllClassesIncludingArchived().map(c => [c.id, c.nameKh]));

    const exportData = students.map((s, idx) => ({
      'ល.រ': idx + 1,
      'ឈ្មោះសិស្ស': s.nameKh,
      'អត្តលេខ': s.code,
      'ភេទ': s.gender === 'F' ? 'ស្រី' : 'ប្រុស',
      'ថ្នាក់': classesMap.get(s.classId) || '',
      'លេខទូរស័ព្ទអាណាព្យាបាល': s.phone || '',
      'កាលបរិច្ឆេទចុះឈ្មោះ': s.createdAt ? s.createdAt.split('T')[0] : ''
    }));

    const worksheet = XLSX.utils.json_to_sheet(exportData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Students');
    XLSX.writeFile(workbook, `student-roster-${Utils.getCambodiaDateString()}.xlsx`);
    Utils.showToast('បានទាញយកបញ្ជីសិស្សរួចរាល់', 'success');
  },

  exportAllAttendanceToExcel() {
    const sessions = StorageService.getAttendanceSessions();
    const studentsMap = new Map(StudentModule.getStudents().map(s => [s.id, s]));
    const classesMap = new Map(ClassModule.getAllClassesIncludingArchived().map(c => [c.id, c.nameKh]));

    const rows = [];
    sessions.forEach(sess => {
      sess.records.forEach(rec => {
        const student = studentsMap.get(rec.studentId);
        rows.push({
          'កាលបរិច្ឆេទ': sess.date,
          'ថ្នាក់': classesMap.get(sess.classId) || '',
          'មុខវិជ្ជា': sess.subject,
          'ម៉ោង': sess.periodId,
          'អត្តលេខសិស្ស': student ? student.code : '',
          'ឈ្មោះសិស្ស': student ? student.nameKh : '',
          'ភេទ': student ? (student.gender === 'F' ? 'ស្រី' : 'ប្រុស') : '',
          'ស្ថានភាពវត្តមាន': rec.status === 'present' ? 'មករៀន' : rec.status === 'absent' ? 'អវត្តមាន' : rec.status === 'late' ? 'យឺត' : 'ច្បាប់',
          'កំណត់សម្គាល់': rec.note || ''
        });
      });
    });

    const worksheet = XLSX.utils.json_to_sheet(rows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'AttendanceRecords');
    XLSX.writeFile(workbook, `all-attendance-${Utils.getCambodiaDateString()}.xlsx`);
    Utils.showToast('បានទាញយកទិន្នន័យវត្តមានរួចរាល់', 'success');
  },

  exportAttendanceReport(classId) {
    const classObj = ClassModule.getClassById(classId);
    const students = StudentModule.getActiveStudentsByClass(classId);
    const sessions = StorageService.getAttendanceSessions().filter(s => s.classId === classId);
    const settings = StorageService.getSettings();

    const reportRows = students.map((stu, idx) => {
      let present = 0, absent = 0, late = 0, excused = 0;
      sessions.forEach(sess => {
        const r = sess.records.find(rec => rec.studentId === stu.id);
        if (r) {
          if (r.status === 'present') present++;
          else if (r.status === 'absent') absent++;
          else if (r.status === 'late') late++;
          else if (r.status === 'excused') excused++;
        }
      });

      const total = present + absent + late + excused;
      const attended = settings.lateCountsAsPresent ? (present + late) : present;
      const rate = total > 0 ? `${Math.round((attended / total) * 100)}%` : '0%';

      return {
        'ល.រ': idx + 1,
        'ឈ្មោះសិស្ស': stu.nameKh,
        'អត្តលេខ': stu.code,
        'ភេទ': stu.gender === 'F' ? 'ស្រី' : 'ប្រុស',
        'មករៀន (✓)': present,
        'អវត្តមាន (✕)': absent,
        'យឺត (⏰)': late,
        'ច្បាប់ (📋)': excused,
        'អត្រាវត្តមាន': rate
      };
    });

    const worksheet = XLSX.utils.json_to_sheet(reportRows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'ClassReport');
    XLSX.writeFile(workbook, `attendance-report-${classObj ? classObj.nameKh : classId}-${Utils.getCambodiaDateString()}.xlsx`);
    Utils.showToast('បានទាញយករបាយការណ៍ថ្នាក់រួចរាល់', 'success');
  }
};