/**
 * Toast Notification System
 */

const Toast = {
  container: null,
  
  init() {
    this.container = document.getElementById('toast-container');
  },
  
  show(message, type = 'info', duration = 3000) {
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    
    const icons = {
      success: '✅',
      error: '❌',
      warning: '⚠️',
      info: 'ℹ️'
    };
    
    toast.innerHTML = `
      <span>${icons[type] || icons.info}</span>
      <span>${message}</span>
    `;
    
    this.container.appendChild(toast);
    
    // Auto dismiss
    setTimeout(() => {
      toast.style.animation = 'toastSlideIn 0.3s ease reverse';
      setTimeout(() => toast.remove(), 300);
    }, duration);
    
    return toast;
  },
  
  success(message, duration) {
    return this.show(message, 'success', duration);
  },
  
  error(message, duration) {
    return this.show(message, 'error', duration);
  },
  
  warning(message, duration) {
    return this.show(message, 'warning', duration);
  },
  
  info(message, duration) {
    return this.show(message, 'info', duration);
  }
};

// Initialize on load
document.addEventListener('DOMContentLoaded', () => Toast.init());
