/**
 * Keyboard Shortcuts Handler
 */

const Shortcuts = {
  init() {
    document.addEventListener('keydown', (e) => {
      // Ctrl+Enter - Send message
      if (e.ctrlKey && e.key === 'Enter') {
        const chatInput = document.getElementById('chat-input');
        if (document.activeElement === chatInput) {
          e.preventDefault();
          document.getElementById('send-btn')?.click();
        }
      }
      
      // Ctrl+B - Trigger build
      if (e.ctrlKey && e.key === 'b') {
        e.preventDefault();
        const buildBtn = document.getElementById('build-download-jar-btn');
        if (buildBtn && !buildBtn.disabled) {
          buildBtn.click();
        }
      }
      
      // Ctrl+S - Export project
      if (e.ctrlKey && e.key === 's') {
        e.preventDefault();
        if (App.state.currentProject) {
          Projects.exportProject(App.state.currentProject.id);
        }
      }
      
      // Ctrl+K - Focus search
      if (e.ctrlKey && e.key === 'k') {
        e.preventDefault();
        document.getElementById('project-search')?.focus();
      }
      
      // Ctrl+[ - Collapse left panel
      if (e.ctrlKey && e.key === '[') {
        e.preventDefault();
        document.getElementById('left-panel')?.classList.toggle('collapsed');
      }
      
      // Ctrl+] - Collapse right panel
      if (e.ctrlKey && e.key === ']') {
        e.preventDefault();
        document.getElementById('right-panel')?.classList.toggle('collapsed');
      }
      
      // Escape - Close modal
      if (e.key === 'Escape') {
        document.querySelectorAll('.modal:not(.hidden)').forEach(modal => {
          modal.classList.add('hidden');
        });
      }
    });
  }
};
