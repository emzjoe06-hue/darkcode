/**
 * Code Editor / Viewer
 */

const Editor = {
  currentFile: null,
  
  init() {
    this.codeViewer = document.getElementById('code-viewer');
    this.codeContent = document.getElementById('code-content');
    this.currentFilePath = document.getElementById('current-file-path');
    
    // Font size controls
    document.querySelectorAll('.font-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        document.querySelectorAll('.font-btn').forEach(b => b.classList.remove('active'));
        e.target.classList.add('active');
        
        const sizes = { S: '11px', M: '13px', L: '16px' };
        this.codeContent.style.fontSize = sizes[e.target.dataset.size] || sizes.M;
      });
    });
  },
  
  showFile(path, content, language = 'java') {
    this.currentFile = { path, content };
    
    this.currentFilePath.textContent = path;
    this.codeContent.textContent = content;
    this.codeContent.className = `language-${language}`;
    
    this.codeViewer.classList.remove('hidden');
    
    // Apply syntax highlighting
    if (typeof hljs !== 'undefined') {
      hljs.highlightElement(this.codeContent);
    }
  },
  
  hide() {
    this.codeViewer.classList.add('hidden');
    this.currentFile = null;
  },
  
  getContent() {
    return this.currentFile?.content || '';
  },
  
  async copyToClipboard() {
    if (!this.currentFile) return false;
    
    try {
      await navigator.clipboard.writeText(this.currentFile.content);
      Toast.success('Copied to clipboard');
      return true;
    } catch (err) {
      console.error('Failed to copy:', err);
      Toast.error('Failed to copy');
      return false;
    }
  },
  
  download() {
    if (!this.currentFile) return;
    
    const blob = new Blob([this.currentFile.content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = this.currentFile.path.split('/').pop();
    a.click();
    URL.revokeObjectURL(url);
    
    Toast.success('File downloaded');
  }
};
