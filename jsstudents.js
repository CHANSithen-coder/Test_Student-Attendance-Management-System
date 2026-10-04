/**
 * students.js — Student Management Module
 */

const StudentModule = {
  getStudents() {
    return StorageService.getStudents();
  },

  getActiveStudentsByClass(classId) {
    if (!classId) return [];
    return StorageService.getStudents()
      .filter(s => s.classId === classId && s.status === 'active')
      .sort((a, b) => a.nameKh.localeCompare(b.nameKh, 'km'));
  },

  getStudentById(studentId) {
    return StorageService.getStudents().find(s => s.id === studentId);
  },

  isCodeDuplicate(code, excludeId = null) {
    if (!code) return false;
    const cleanCode = code.trim().toUpperCase();
    return StorageService.getStudents().some(s => 
      s.code.toUpperCase() === cleanCode && s.id !== excludeId && s.status !== 'archived'
    );
  },

  addStudent(studentData) {
    const students = StorageService.getStudents();
    const newStudent = {
      id: Utils.generateId('stu'),
      nameKh: studentData.nameKh.trim(),
      code: studentData.code.trim().toUpperCase(),
      gender: studentData.gender,
      classId: studentData.classId,
      phone: (studentData.phone || '').trim(),
      notes: (studentData.notes || '').trim(),
      status: 'active', // 'active', 'inactive', 'archived'
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    students.push(newStudent);
    StorageService.saveStudents(students);
    return newStudent;
  },

  updateStudent(studentId, updateData) {
    const students = StorageService.getStudents();
    const idx = students.findIndex(s => s.id === studentId);
    if (idx === -1) return null;

    students[idx] = {
      ...students[idx],
      ...updateData,
      updatedAt: new Date().toISOString()
    };
    StorageService.saveStudents(students);
    return students[idx];
  },

  archiveStudent(studentId) {
    return StudentModule.updateStudent(studentId, { status: 'archived' });
  },

  renderStudentsTable() {
    const tbody = document.getElementById('students-table-tbody');
    if (!tbody) return;

    const classFilter = document.getElementById('filter-student-class').value;
    const statusFilter = document.getElementById('filter-student-status').value;
    const keyword = document.getElementById('filter-student-keyword').value;

    let students = StorageService.getStudents();

    // Filters
    if (classFilter !== 'ALL') {
      students = students.filter(s => s.classId === classFilter);
    }
    if (statusFilter !== 'ALL') {
      students = students.filter(s => s.status === statusFilter);
    }
    if (keyword.trim()) {
      students = students.filter(s => 
        Utils.matchesSearch(s.nameKh, keyword) || 
        Utils.matchesSearch(s.code, keyword) ||
        Utils.matchesSearch(s.phone, keyword)
      );
    }

    if (students.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="8" class="text-center" style="padding: 30px;">
            <div class="empty-state">
              <p>មិនមានទិន្នន័យសិស្សត្រូវតាមលក្ខខណ្ឌស្វែងរកទេ</p>
            </div>
          </td>
        </tr>
      `;
      return;
    }

    const classesMap = new Map(ClassModule.getAllClassesIncludingArchived().map(c => [c.id, c.nameKh]));

    tbody.innerHTML = students.map((s, idx) => {
      const genderDisplay = s.gender === 'F' ? '<span class="badge badge-warning">ស្រី</span>' : '<span class="badge badge-info">ប្រុស</span>';
      const className = classesMap.get(s.classId) || 'គ្មានថ្នាក់';
      const statusBadge = s.status === 'active' 
        ? '<span class="badge badge-success">កំពុងរៀន</span>' 
        : '<span class="badge badge-danger">ទុកជាឯកសារ</span>';

      return `
        <tr>
          <td>${Utils.toKhmerNum(idx + 1)}</td>
          <td><strong>${s.nameKh}</strong></td>
          <td><code>${s.code}</code></td>
          <td>${genderDisplay}</td>
          <td>${className}</td>
          <td>${s.phone || '<span class="text-muted">-</span>'}</td>
          <td>${statusBadge}</td>
          <td style="text-align: right;">
            <button class="btn btn-outline-secondary btn-sm" onclick="StudentModule.openEditModal('${s.id}')">✏️</button>
            <button class="btn btn-outline-danger btn-sm" onclick="StudentModule.confirmArchiveStudent('${s.id}')">🗄️</button>
          </td>
        </tr>
      `;
    }).join('');
  },

  openEditModal(studentId) {
    const s = StudentModule.getStudentById(studentId);
    if (!s) return;

    document.getElementById('student-id-field').value = s.id;
    document.getElementById('student-name-input').value = s.nameKh;
    document.getElementById('student-code-input').value = s.code;
    document.getElementById('student-gender-select').value = s.gender;
    document.getElementById('student-class-select').value = s.classId;
    document.getElementById('student-phone-input').value = s.phone || '';
    document.getElementById('student-notes-input').value = s.notes || '';
    document.getElementById('student-modal-title').textContent = 'កែប្រែព័ត៌មានសិស្ស';

    Utils.openModal('student-modal');
  },

  async confirmArchiveStudent(studentId) {
    const s = StudentModule.getStudentById(studentId);
    if (!s) return;

    const confirmed = await Utils.confirm(
      'បញ្ជាក់ការទុកជាឯកសារ',
      `តើអ្នកពិតជាចង់ទុកសិស្ស «${s.nameKh}» ជាឯកសារមែនទេ? ប្រវត្តិវត្តមានកន្លងមកនឹងនៅតែរក្សាទុក។`
    );

    if (confirmed) {
      StudentModule.archiveStudent(studentId);
      Utils.showToast(`បានទុកសិស្ស ${s.nameKh} ជាឯកសាររួចរាល់`, 'info');
      App.refreshAll();
    }
  }
};