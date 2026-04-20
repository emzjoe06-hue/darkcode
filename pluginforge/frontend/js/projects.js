/**
 * Projects Module - Handles project list and management
 */

const Projects = {
  projects: [],
  
  init() {
    this.projectList = document.getElementById('project-list');
    this.projectSearch = document.getElementById('project-search');
    
    // Event listeners
    this.projectSearch?.addEventListener('input', (e) => this.filterProjects(e.target.value));
    document.getElementById('new-project-btn')?.addEventListener('click', () => this.showNewProjectModal());
    document.getElementById('settings-btn')?.addEventListener('click', () => App.showSettingsModal());
    document.getElementById('import-btn')?.addEventListener('click', () => document.getElementById('import-file-input').click());
    document.getElementById('import-file-input')?.addEventListener('change', (e) => this.importProject(e));
    
    // Modal handlers
    document.getElementById('new-project-form')?.addEventListener('submit', (e) => this.createProject(e));
    
    // Close modal buttons
    document.querySelectorAll('.modal-close, .modal-cancel').forEach(btn => {
      btn.addEventListener('click', () => {
        btn.closest('.modal').classList.add('hidden');
      });
    });
  },
  
  async loadProjects() {
    try {
      const response = await fetch('/api/projects');
      this.projects = await response.json();
      this.renderProjects();
    } catch (err) {
      console.error('Failed to load projects:', err);
      Toast.error('Failed to load projects');
    }
  },
  
  renderProjects(filter = '') {
    this.projectList.innerHTML = '';
    
    const filtered = this.projects.filter(p => 
      p.name.toLowerCase().includes(filter.toLowerCase())
    );
    
    if (filtered.length === 0) {
      this.projectList.innerHTML = `
        <div style="color: var(--text-dim); text-align: center; padding: 24px;">
          ${filter ? 'No matching projects' : 'No projects yet.<br>Create one to get started!'}
        </div>
      `;
      return;
    }
    
    filtered.forEach(project => {
      const div = document.createElement('div');
      div.className = `project-item ${App.state.currentProject?.id === project.id ? 'active' : ''}`;
      
      const tags = project.tags || ['WIP'];
      const tagClass = tags[0].toLowerCase();
      
      const updated = new Date(project.updatedAt).toLocaleDateString();
      
      div.innerHTML = `
        <div class="project-item-name">
          <span>${project.name}</span>
          <span class="badge badge-${tagClass}">${tags[0]}</span>
        </div>
        <div class="project-item-meta">
          <span class="badge badge-mc">${project.mcVersion}</span>
          <span>${project.serverType}</span>
        </div>
        <div class="project-item-updated">Updated: ${updated}</div>
      `;
      
      div.addEventListener('click', () => App.selectProject(project));
      
      // Right-click context menu
      div.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        this.showContextMenu(e, project);
      });
      
      this.projectList.appendChild(div);
    });
  },
  
  filterProjects(query) {
    this.renderProjects(query);
  },
  
  showNewProjectModal() {
    document.getElementById('new-project-modal').classList.remove('hidden');
    document.getElementById('project-name').focus();
  },
  
  async createProject(e) {
    e.preventDefault();
    
    const name = document.getElementById('project-name').value.trim();
    const description = document.getElementById('project-description').value.trim();
    const mcVersion = document.getElementById('new-mc-version').value;
    const serverType = document.getElementById('new-server-type').value;
    const javaVersion = document.getElementById('new-java-version').value;
    const model = document.getElementById('new-model').value;
    const reasoningMode = document.querySelector('input[name="reasoning"]:checked')?.value || 'MEDIUM';
    
    if (!name) {
      Toast.error('Project name is required');
      return;
    }
    
    try {
      const response = await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          description,
          mcVersion,
          serverType,
          javaVersion,
          model,
          reasoningMode
        })
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to create project');
      }
      
      const project = await response.json();
      
      document.getElementById('new-project-modal').classList.add('hidden');
      document.getElementById('new-project-form').reset();
      
      Toast.success('Project created');
      
      await this.loadProjects();
      App.selectProject(project);
      
    } catch (err) {
      console.error('Create project error:', err);
      Toast.error(err.message);
    }
  },
  
  async deleteProject(projectId) {
    const project = this.projects.find(p => p.id === projectId);
    if (!project) return;
    
    if (!confirm(`Delete "${project.name}"? This cannot be undone.`)) return;
    
    try {
      await fetch(`/api/projects/${projectId}`, { method: 'DELETE' });
      Toast.success('Project deleted');
      
      if (App.state.currentProject?.id === projectId) {
        App.state.currentProject = null;
        App.updateUI();
      }
      
      await this.loadProjects();
    } catch (err) {
      console.error('Delete error:', err);
      Toast.error('Failed to delete project');
    }
  },
  
  async cloneProject(projectId) {
    try {
      const response = await fetch(`/api/projects/${projectId}/clone`, { method: 'POST' });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to clone');
      }
      
      const project = await response.json();
      Toast.success('Project cloned');
      await this.loadProjects();
      App.selectProject(project);
      
    } catch (err) {
      console.error('Clone error:', err);
      Toast.error('Failed to clone project');
    }
  },
  
  async exportProject(projectId) {
    try {
      const response = await fetch(`/api/projects/${projectId}/export`, { method: 'POST' });
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `pluginforge_export_${Date.now()}.json`;
      a.click();
      URL.revokeObjectURL(url);
      Toast.success('Project exported');
    } catch (err) {
      console.error('Export error:', err);
      Toast.error('Failed to export project');
    }
  },
  
  importProject(e) {
    const file = e.target.files[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const data = JSON.parse(event.target.result);
        
        const response = await fetch('/api/projects/import', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data)
        });
        
        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.error || 'Failed to import');
        }
        
        const project = await response.json();
        Toast.success('Project imported');
        await this.loadProjects();
        App.selectProject(project);
        
      } catch (err) {
        console.error('Import error:', err);
        Toast.error('Invalid import file');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  },
  
  showContextMenu(e, project) {
    // Simple context menu using confirm dialogs for now
    const actions = [
      { label: 'Clone', action: () => this.cloneProject(project.id) },
      { label: 'Export', action: () => this.exportProject(project.id) },
      { label: 'Delete', action: () => this.deleteProject(project.id) }
    ];
    
    // For simplicity, we'll use prompt-style selection
    // In a full implementation, this would be a proper context menu
    setTimeout(() => {
      const choice = prompt(
        `Actions for "${project.name}":\n1. Clone\n2. Export\n3. Delete\n\nEnter number:`
      );
      
      if (choice === '1') this.cloneProject(project.id);
      else if (choice === '2') this.exportProject(project.id);
      else if (choice === '3') this.deleteProject(project.id);
    }, 100);
  }
};
