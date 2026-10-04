/**
 * utils.js — Helper Functions, Khmer Date Formatters, Search & Notifications
 */

const Utils = {
  /**
   * Return Cambodia Local Date string YYYY-MM-DD
   * Ensures Asia/Phnom_Penh (UTC+7) timezone correctness.
   */
  getCambodiaDateString(date = new Date()) {
    const formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Phnom_Penh',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    });
    return formatter.format(date); // Outputs YYYY-MM-DD
  },

  /**
   * Format date into friendly Khmer display: ថ្ងៃចន្ទ ទី០៤ ខែតុលា ឆ្នាំ២០២៦
   */
  formatKhmerDate(dateString) {
    if (!dateString) return '';
    try {
      const parts = dateString.split('-');
      if (parts.length !== 3) return dateString;
      const date = new Date(parts[0], parts[1] - 1, parts[2]);

      const khmerDays = ['អាទិត្យ', 'ចន្ទ', 'អង្គារ', 'ពុធ', 'ព្រហស្បតិ៍', 'សុក្រ', 'សៅរ៍'];
      const khmerMonths = [
        'មករា', 'កុម្ភៈ', 'មីនា', 'មេសា', 'ឧសភា', 'មិថុនា',
        'កក្កដា', 'សីហា', 'កញ្ញា', 'តុលា', 'វិច្ឆិកា', 'ធ្នូ'
      ];

      const dayName = khmerDays[date.getDay()];
      const dayNum = Utils.toKhmerNum(parts[2]);
      const monthName = khmerMonths[parseInt(parts[1], 10) - 1];
      const yearNum = Utils.toKhmerNum(parts[0]);

      return `ថ្ងៃ${dayName} ទី${dayNum} ខែ${monthName} ឆ្នាំ${yearNum}`;
    } catch (e) {
      return dateString;
    }
  },

  /**
   * Convert Arabic digits (0-9) to Khmer numbers (០-៩)
   */
  toKhmerNum(num) {
    if (num === null || num === undefined) return '';
    const khmerDigits = ['០', '១', '២', '៣', '៤', '៥', '៦', '៧', '៨', '៩'];
    return String(num).replace(/[0-9]/g, d => khmerDigits[d]);
  },

  /**
   * Intelligent Khmer & English string search matching
   */
  normalizeSearchText(text) {
    if (!text) return '';
    return text
      .toString()
      .trim()
      .toLowerCase()
      .replace(/[\u200B-\u200D\uFEFF]/g, ''); // Strip zero-width invisible spaces
  },

  matchesSearch(targetText, keyword) {
    const normTarget = Utils.normalizeSearchText(targetText);
    const normKey = Utils.normalizeSearchText(keyword);
    return normTarget.includes(normKey);
  },

  /**
   * Unique UUID v4 generator for local records
   */
  generateId(prefix = 'id') {
    return `${prefix}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  },

  /**
   * Toast notification dispatch
   */
  showToast(message, type = 'info', duration = 3500) {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    
    let icon = 'ℹ️';
    if (type === 'success') icon = '✓';
    if (type === 'error') icon = '✕';
    if (type === 'warning') icon = '⚠️';

    toast.innerHTML = `
      <span class="toast-icon">${icon}</span>
      <span class="toast-msg">${message}</span>
    `;

    container.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(10px)';
      toast.style.transition = 'all 0.25s ease';
      setTimeout(() => toast.remove(), 250);
    }, duration);
  },

  /**
   * Modal management
   */
  openModal(modalId) {
    const el = document.getElementById(modalId);
    if (el) el.classList.remove('hidden');
  },

  closeModal(modalId) {
    const el = document.getElementById(modalId);
    if (el) el.classList.add('hidden');
  },

  /**
   * Safe Confirmation Dialog
   */
  confirm(title, message, okText = 'យល់ព្រម') {
    return new Promise((resolve) => {
      const modal = document.getElementById('confirm-modal');
      const titleEl = document.getElementById('confirm-modal-title');
      const bodyEl = document.getElementById('confirm-modal-body');
      const okBtn = document.getElementById('btn-confirm-ok');
      const cancelBtn = document.getElementById('btn-confirm-cancel');

      titleEl.textContent = title;
      bodyEl.innerHTML = `<p>${message}</p>`;
      okBtn.textContent = okText;

      const handleOk = () => {
        cleanup();
        Utils.closeModal('confirm-modal');
        resolve(true);
      };

      const handleCancel = () => {
        cleanup();
        Utils.closeModal('confirm-modal');
        resolve(false);
      };

      const cleanup = () => {
        okBtn.removeEventListener('click', handleOk);
        cancelBtn.removeEventListener('click', handleCancel);
      };

      okBtn.addEventListener('click', handleOk);
      cancelBtn.addEventListener('click', handleCancel);

      Utils.openModal('confirm-modal');
    });
  }
};