/**
 * Build Module - Handles Maven builds and JAR downloads
 */

const Build = {
  state: {
    isBuilding: false,
    currentBuildId: null,
    ws: null
  },
  
  init() {
    this.buildLog = document.getElementById('build-log');
    this.buildStatus = document.getElementById('build-status');
    this.downloadJarBtn = document.getElementById('download-jar-btn');
    this.buildHistoryContainer = document.getElementById('build-history');
    this.autoFixStatus = document.getElementById('auto-fix-status');
    
    // Connect to WebSocket for build logs
    this.connectWebSocket();
  },
  
  connectWebSocket() {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws`;
    
    this.state.ws = new WebSocket(wsUrl);
    
    this.state.ws.onopen = () => {
      console.log('WebSocket connected');
    };
    
    this.state.ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        this.handleWsMessage(data);
      } catch (err) {
        console.error('WS parse error:', err);
      }
    };
    
    this.state.ws.onclose = () => {
      console.log('WebSocket disconnected, reconnecting...');
      setTimeout(() => this.connectWebSocket(), 3000);
    };
    
    this.state.ws.onerror = (err) => {
      console.error('WebSocket error:', err);
    };
  },
  
  handleWsMessage(data) {
    switch (data.type) {
      case 'log':
        this.appendLogLine(data.line, data.level);
        break;
        
      case 'success':
        this.setBuildStatus('success', 'Build Successful');
        this.downloadJarBtn.disabled = false;
        Toast.success(`Build completed in ${data.duration}ms`);
        this.loadBuildHistory(App.state.currentProject?.id);
        break;
        
      case 'error':
        this.setBuildStatus('failed', 'Build Failed');
        Toast.error('Build failed');
        this.loadBuildHistory(App.state.currentProject?.id);
        break;
        
      case 'build_started':
        this.clearLog();
        this.setBuildStatus('building', 'Building...');
        this.downloadJarBtn.disabled = true;
        break;
    }
  },
  
  async triggerBuild() {
    if (!App.state.currentProject) {
      Toast.error('No project selected');
      return;
    }
    
    if (this.state.isBuilding) {
      Toast.warning('Build already in progress');
      return;
    }
    
    try {
      const response = await fetch(`/api/projects/${App.state.currentProject.id}/build`, {
        method: 'POST'
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Build failed to start');
      }
      
      const result = await response.json();
      this.state.isBuilding = true;
      this.state.currentBuildId = result.buildId;
      
      Toast.info('Build started');
      
      // Switch to build tab
      FileTree.switchTab('build');
      
    } catch (err) {
      console.error('Build error:', err);
      Toast.error(err.message);
      this.setBuildStatus('idle', 'Idle');
    }
  },
  
  appendLogLine(line, level = 'info') {
    const div = document.createElement('div');
    div.className = `log-line ${level}`;
    div.textContent = line;
    
    // Remove placeholder if present
    const placeholder = this.buildLog.querySelector('.log-placeholder');
    if (placeholder) placeholder.remove();
    
    this.buildLog.appendChild(div);
    this.buildLog.scrollTop = this.buildLog.scrollHeight;
  },
  
  clearLog() {
    this.buildLog.innerHTML = '';
  },
  
  setBuildStatus(status, text) {
    this.state.isBuilding = status === 'building';
    
    const indicator = this.buildStatus.querySelector('.status-indicator');
    const statusText = this.buildStatus.querySelector('.status-text');
    
    indicator.className = `status-indicator ${status}`;
    statusText.textContent = text;
  },
  
  async loadBuildHistory(projectId) {
    if (!projectId) return;
    
    try {
      const response = await fetch(`/api/projects/${projectId}/build/history`);
      const history = await response.json();
      
      this.buildHistoryContainer.innerHTML = '';
      
      if (history.length === 0) {
        this.buildHistoryContainer.innerHTML = '<div style="color: var(--text-dim); font-size: 12px; padding: 8px;">No builds yet</div>';
        return;
      }
      
      history.slice().reverse().forEach(build => {
        const div = document.createElement('div');
        div.className = `build-history-item ${build.success ? 'success' : 'failed'}`;
        
        const time = new Date(build.timestamp).toLocaleString();
        const duration = build.duration ? `${Math.round(build.duration)}ms` : '';
        
        div.innerHTML = `
          <span>${build.success ? '✅' : '❌'} Build #${build.id.substring(0, 8)}</span>
          <span class="build-history-time">${time}</span>
        `;
        
        div.addEventListener('click', () => {
          this.showBuildLog(build.log);
        });
        
        this.buildHistoryContainer.appendChild(div);
      });
    } catch (err) {
      console.error('Failed to load build history:', err);
    }
  },
  
  showBuildLog(log) {
    this.buildLog.innerHTML = '';
    log.split('\n').forEach(line => {
      if (line.trim()) {
        let level = 'info';
        if (line.toLowerCase().includes('error')) level = 'error';
        else if (line.toLowerCase().includes('warning')) level = 'warn';
        this.appendLogLine(line, level);
      }
    });
    FileTree.switchTab('build');
  },
  
  async downloadJar() {
    if (!App.state.currentProject) return;
    
    try {
      const response = await fetch(`/api/projects/${App.state.currentProject.id}/download/jar`);
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'JAR not found');
      }
      
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${App.state.currentProject.safeName}.jar`;
      a.click();
      URL.revokeObjectURL(url);
      
      Toast.success('JAR downloaded');
    } catch (err) {
      console.error('Download error:', err);
      Toast.error(err.message);
    }
  }
};
