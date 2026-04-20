/**
 * Main Application Entry Point
 */

const App = {
  state: {
    currentProject: null,
    settings: null
  },
  
  async init() {
    console.log('🚀 PluginForge AI initializing...');
    
    // Initialize all modules
    Toast.init();
    Shortcuts.init();
    FileTree.init();
    Editor.init();
    Chat.init();
    Build.init();
    Projects.init();
    
    // Load initial data
    await this.loadSettings();
    await Projects.loadProjects();
    
    // Setup UI event listeners
    this.setupEventListeners();
    
    // Check for API key on first launch
    if (!this.state.settings?.apiKey) {
      setTimeout(() => {
        Toast.warning('Please set your API key in Settings');
      }, 1000);
    }
    
    console.log('✅ PluginForge AI ready');
  },
  
  setupEventListeners() {
    // Reasoning mode buttons
    document.querySelectorAll('.reasoning-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        document.querySelectorAll('.reasoning-btn').forEach(b => b.classList.remove('active'));
        e.target.classList.add('active');
      });
    });
    
    // Settings form
    document.getElementById('settings-form')?.addEventListener('submit', (e) => this.saveSettings(e));
    
    // Download JAR button
    document.getElementById('download-jar-btn')?.addEventListener('click', () => Build.downloadJar());
    
    // Project settings controls
    document.getElementById('mc-version-select')?.addEventListener('change', (e) => this.updateProjectSettings({ mcVersion: e.target.value }));
    document.getElementById('server-type-select')?.addEventListener('change', (e) => this.updateProjectSettings({ serverType: e.target.value }));
    document.getElementById('java-version-select')?.addEventListener('change', (e) => this.updateProjectSettings({ javaVersion: e.target.value }));
    document.getElementById('model-select')?.addEventListener('change', (e) => this.updateProjectSettings({ model: e.target.value }));
    
    // Modal overlay clicks
    document.querySelectorAll('.modal-overlay').forEach(overlay => {
      overlay.addEventListener('click', () => {
        overlay.closest('.modal').classList.add('hidden');
      });
    });
  },
  
  async loadSettings() {
    try {
      const response = await fetch('/api/settings');
      this.state.settings = await response.json();
      
      // Update settings modal with current values
      document.getElementById('api-key').value = '';
      document.getElementById('default-model').value = this.state.settings.defaultModel || 'kilo-auto/free';
      document.getElementById('default-reasoning').value = this.state.settings.defaultReasoningMode || 'MEDIUM';
      document.getElementById('default-mc-version').value = this.state.settings.defaultMcVersion || '1.21';
    } catch (err) {
      console.error('Failed to load settings:', err);
    }
  },
  
  async getSettings() {
    if (!this.state.settings) {
      await this.loadSettings();
    }
    return this.state.settings;
  },
  
  showSettingsModal() {
    document.getElementById('settings-modal').classList.remove('hidden');
  },
  
  async saveSettings(e) {
    e.preventDefault();
    
    const apiKey = document.getElementById('api-key').value.trim();
    const defaultModel = document.getElementById('default-model').value;
    const defaultReasoning = document.getElementById('default-reasoning').value;
    const defaultMcVersion = document.getElementById('default-mc-version').value;
    
    try {
      const response = await fetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          apiKey,
          defaultModel,
          defaultReasoningMode: defaultReasoning,
          defaultMcVersion
        })
      });
      
      if (!response.ok) {
        throw new Error('Failed to save settings');
      }
      
      await this.loadSettings();
      document.getElementById('settings-modal').classList.add('hidden');
      document.getElementById('settings-form').reset();
      
      Toast.success('Settings saved');
    } catch (err) {
      console.error('Save settings error:', err);
      Toast.error('Failed to save settings');
    }
  },
  
  selectProject(project) {
    this.state.currentProject = project;
    
    // Update UI
    document.getElementById('active-project-name').textContent = project.name;
    
    // Update badges
    const badgesContainer = document.getElementById('project-badges');
    badgesContainer.innerHTML = `
      <span class="badge badge-${(project.tags?.[0] || 'WIP').toLowerCase()}">${project.tags?.[0] || 'WIP'}</span>
      <span class="badge badge-mc">${project.mcVersion}</span>
    `;
    
    // Update dropdowns to match project settings
    document.getElementById('mc-version-select').value = project.mcVersion;
    document.getElementById('server-type-select').value = project.serverType;
    document.getElementById('java-version-select').value = project.javaVersion;
    document.getElementById('model-select').value = project.model || 'kilo-auto/free';
    
    // Set reasoning mode
    document.querySelectorAll('.reasoning-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.mode === (project.reasoningMode || 'MEDIUM'));
    });
    
    // Load project data
    Chat.loadHistory(project.id);
    FileTree.loadTree(project.id);
    Build.loadBuildHistory(project.id);
    
    // Update project list highlighting
    document.querySelectorAll('.project-item').forEach(item => {
      item.classList.toggle('active', false);
    });
    
    Toast.info(`Selected: ${project.name}`);
  },
  
  async updateProjectSettings(updates) {
    if (!this.state.currentProject) return;
    
    try {
      await fetch(`/api/projects/${this.state.currentProject.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates)
      });
      
      // Update local state
      this.state.currentProject = { ...this.state.currentProject, ...updates };
    } catch (err) {
      console.error('Update settings error:', err);
    }
  },
  
  updateUI() {
    if (!this.state.currentProject) {
      document.getElementById('active-project-name').textContent = 'No project selected';
      document.getElementById('project-badges').innerHTML = '';
      Chat.showWelcome();
      FileTree.treeContainer.innerHTML = '';
      Editor.hide();
    }
  }
};

// Initialize app when DOM is ready
document.addEventListener('DOMContentLoaded', () => App.init());
