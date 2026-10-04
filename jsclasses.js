/**
 * classes.js — Class Management Module
 */

const ClassModule = {
  getClasses() {
    return StorageService.getClasses().filter(c => c.active !== false);
  },

  getAllClassesIncludingArchived() {
    return StorageService.getClasses();
  },

  getClassById(classId) {
    return StorageService.getClasses().find(c => c.id === classId);
  },

  /**
   * Dynamically calculate active students enrolled in this class
   */
  getStudentCount(classId) {
    const students = StorageService.getStudents();
    return students.filter(s => s.classId === classId && s.status === 'active').length;
  },

  addClass(classData) {
    const classes = StorageService.getClasses();
    const newClass = {
      id: Utils.generateId('cls'),
      nameKh: classData.nameKh.trim(),
      nameEn: (classData.nameEn || '').trim(),
      grade: parseInt(classData.grade, 10) || 4,
      academicYear: classData.academicYear || StorageService.getSettings().academicYear,
      active: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    classes.push(newClass);
    StorageService.saveClasses(classes);
    return newClass;
  },

  updateClass(classId, updateData) {
    const classes = StorageService.getClasses();
    const index = classes.findIndex(c => c.id === classId);
    if (index === -1) return null;

    classes[index] = {
      ...classes[index],
      ...updateData,
      updatedAt: new Date().toISOString()
    };
    StorageService.saveClasses(classes);
    return classes[index];
  },

  archiveClass(classId) {
    return ClassModule.updateClass(classId, { active: false });
  },

  renderClassesPage() {
    const container = document.getElementById('classes-cards-grid');
    if (!container) return;

    const classes = ClassModule.getClasses();
    if (classes.length === 0) {
      container.innerHTML = `
        <div class="empty-state" style="grid-column: 1/-1;">
          <div class="empty-icon">🏛️</div>
          <h3>មិនទាន់មានថ្នាក់រៀននៅឡើយទេ</h3>
          <p>សូមចុចប៊ូតុង «បង្កើតថ្នាក់ថ្មី» ដើម្បីបន្ថែមថ្នាក់ដំបូង</p>
        </div>
      `;
      return;
    }

    container.innerHTML = classes.map(c => {
      const studentCount = ClassModule.getStudentCount(c.id);
      return `
        <div class="card class-card">
          <div class="d-flex justify-content-between align-items-center">
            <span class="badge badge-primary">កម្រិតទី ${Utils.toKhmerNum(c.grade)}</span>
            <span class="text-muted text-sm">${c.academicYear}</span>
          </div>
          <h3 class="card-title mt-2" style="font-size: 18px;">${c.nameKh}</h3>
          <p class="text-muted text-sm">${c.nameEn || ''}</p>
          <div class="class-card-meta mt-3">
            <span>សិស្សសរុប: <strong>${Utils.toKhmerNum(studentCount)} នាក់</strong></span>
          </div>
          <div class="mt-3 d-flex gap-2 justify-content-end">
            <button class="btn btn-outline-secondary btn-sm" onclick="ClassModule.openEditModal('${c.id}')">✏️ កែប្រែ</button>
            <button class="btn btn-outline-danger btn-sm" onclick="ClassModule.confirmArchiveClass('${c.id}')">🗄️ ទុកជាឯកសារ</button>
          </div>
        </div>
      `;
    }).join('');
  },

  openEditModal(classId) {
    const c = ClassModule.getClassById(classId);
    if (!c) return;

    document.getElementById('class-id-field').value = c.id;
    document.getElementById('class-name-kh').value = c.nameKh;
    document.getElementById('class-name-en').value = c.nameEn || '';
    document.getElementById('class-grade-select').value = c.grade;
    document.getElementById('class-year-input').value = c.academicYear;
    document.getElementById('class-modal-title').textContent = 'កែប្រែថ្នាក់រៀន';

    Utils.openModal('class-modal');
  },

  async confirmArchiveClass(classId) {
    const c = ClassModule.getClassById(classId);
    if (!c) return;

    const confirmed = await Utils.confirm(
      'បញ្ជាក់ការទុកជាឯកសារ',
      `តើអ្នកពិតជាចង់ទុក «${c.nameKh}» ជាឯកសារមែនទេ? សិស្សក្នុងថ្នាក់នេះនឹងនៅតែរក្សាទុកក្នុងប្រព័ន្ធ។`
    );

    if (confirmed) {
      ClassModule.archiveClass(classId);
      Utils.showToast(`បានទុក ${c.nameKh} ជាឯកសាររួចរាល់`, 'info');
      App.refreshAll();
    }
  }
};