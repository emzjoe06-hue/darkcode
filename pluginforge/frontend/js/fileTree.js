/**
 * File Tree Manager
 */

const FileTree = {
  currentFile: null,
  
  init() {
    this.treeContainer = document.getElementById('file-tree');
    this.codeViewer = document.getElementById('code-viewer');
    this.codeContent = document.getElementById('code-content');
    this.currentFilePath = document.getElementById('current-file-path');
    
    // Tab switching
    document.querySelectorAll('.tab').forEach(tab => {
      tab.addEventListener('click', () => this.switchTab(tab.dataset.tab));
    });
    
    // File actions
    document.getElementById('copy-file-btn')?.addEventListener('click', () => this.copyCurrentFile());
    document.getElementById('download-file-btn')?.addEventListener('click', () => this.downloadCurrentFile());
    document.getElementById('download-zip-btn')?.addEventListener('click', () => this.downloadZip());
    document.getElementById('build-download-jar-btn')?.addEventListener('click', () => Build.triggerBuild());
    
    // Font size controls
    document.querySelectorAll('.font-btn').forEach(btn => {
      btn.addEventListener('click', (e) => this.setFontSize(e.target.dataset.size));
    });
  },
  
  switchTab(tabName) {
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
    
    document.querySelector(`[data-tab="${tabName}"]`)?.classList.add('active');
    document.getElementById(`${tabName}-tab`)?.classList.add('active');
  },
  
  async loadTree(projectId) {
    try {
      const response = await fetch(`/api/projects/${projectId}/files`);
      const tree = await response.json();
      
      this.treeContainer.innerHTML = '';
      
      if (tree.length === 0) {
        this.treeContainer.innerHTML = '<div style="color: var(--text-dim); padding: 16px; text-align: center;">No files yet</div>';
        return;
      }
      
      this.renderTree(tree, this.treeContainer);
    } catch (err) {
      console.error('Failed to load file tree:', err);
      Toast.error('Failed to load files');
    }
  },
  
  renderTree(items, container, isRoot = true) {
    const ul = document.createElement('div');
    ul.className = isRoot ? '' : 'file-tree-children';
    
    items.forEach(item => {
      const div = document.createElement('div');
      
      if (item.type === 'directory') {
        div.className = 'file-tree-item folder-collapsed';
        div.innerHTML = `
          <span class="icon">📁</span>
          <span>${item.name}</span>
        `;
        
        div.addEventListener('click', () => {
          const children = div.querySelector('.file-tree-children');
          if (children) {
            const isExpanded = children.style.display !== 'none';
            children.style.display = isExpanded ? 'none' : 'block';
            div.classList.toggle('folder-expanded', !isExpanded);
            div.classList.toggle('folder-collapsed', isExpanded);
          }
        });
        
        ul.appendChild(div);
        
        if (item.children && item.children.length > 0) {
          const childrenContainer = document.createElement('div');
          childrenContainer.className = 'file-tree-children';
          childrenContainer.style.display = 'none';
          this.renderTree(item.children, childrenContainer, false);
          div.appendChild(childrenContainer);
        }
      } else {
        div.className = 'file-tree-item';
        const icon = this.getFileIcon(item.name);
        div.innerHTML = `<span class="icon">${icon}</span><span>${item.name}</span>`;
        
        div.addEventListener('click', () => {
          document.querySelectorAll('.file-tree-item').forEach(i => i.classList.remove('active'));
          div.classList.add('active');
          this.viewFile(App.state.currentProject.id, item.path);
        });
        
        ul.appendChild(div);
      }
    });
    
    container.appendChild(ul);
  },
  
  getFileIcon(fileName) {
    const ext = fileName.split('.').pop().toLowerCase();
    const icons = {
      java: '☕',
      xml: '📄',
      yml: '⚙️',
      yaml: '⚙️',
      json: '📋',
      md: '📝',
      txt: '📄',
      sh: '🔧',
      jar: '📦'
    };
    return icons[ext] || '📄';
  },
  
  async viewFile(projectId, filePath) {
    try {
      const response = await fetch(`/api/projects/${projectId}/files/content?path=${encodeURIComponent(filePath)}`);
      const data = await response.json();
      
      this.currentFile = { path: filePath, content: data.content };
      
      this.currentFilePath.textContent = filePath;
      this.codeContent.textContent = data.content;
      this.codeContent.className = `language-${this.getLanguage(filePath)}`;
      
      this.codeViewer.classList.remove('hidden');
      
      // Apply syntax highlighting
      hljs.highlightElement(this.codeContent);
    } catch (err) {
      console.error('Failed to load file:', err);
      Toast.error('Failed to load file');
    }
  },
  
  getLanguage(fileName) {
    const ext = fileName.split('.').pop().toLowerCase();
    const langs = {
      java: 'java',
      xml: 'xml',
      yml: 'yaml',
      yaml: 'yaml',
      json: 'json',
      md: 'markdown',
      txt: 'text',
      sh: 'bash'
    };
    return langs[ext] || 'text';
  },
  
  setFontSize(size) {
    document.querySelectorAll('.font-btn').forEach(b => b.classList.remove('active'));
    document.querySelector(`[data-size="${size}"]`)?.classList.add('active');
    
    const sizes = { S: '11px', M: '13px', L: '16px' };
    this.codeContent.style.fontSize = sizes[size] || sizes.M;
  },
  
  copyCurrentFile() {
    if (!this.currentFile) return;
    
    navigator.clipboard.writeText(this.currentFile.content);
    Toast.success('File copied to clipboard');
  },
  
  downloadCurrentFile() {
    if (!this.currentFile) return;
    
    const blob = new Blob([this.currentFile.content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = this.currentFile.path.split('/').pop();
    a.click();
    URL.revokeObjectURL(url);
    
    Toast.success('File downloaded');
  },
  
  async downloadZip() {
    if (!App.state.currentProject) return;
    
    try {
      const response = await fetch(`/api/projects/${App.state.currentProject.id}/download/zip`);
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${App.state.currentProject.safeName}.zip`;
      a.click();
      URL.revokeObjectURL(url);
      
      Toast.success('Project downloaded as ZIP');
    } catch (err) {
      console.error('Failed to download ZIP:', err);
      Toast.error('Failed to download ZIP');
    }
  }
};
