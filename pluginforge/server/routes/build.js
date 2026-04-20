const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs-extra');
const { exec } = require('child_process');
const { v4: uuidv4 } = require('uuid');

const ROOT_DIR = path.resolve(__dirname, '../..');
const WORKSPACE_DIR = path.join(ROOT_DIR, 'workspace');
const DATA_DIR = path.join(ROOT_DIR, 'data');
const PROJECTS_FILE = path.join(DATA_DIR, 'projects.json');

// Helper functions
function getProjects() {
  return fs.readJsonSync(PROJECTS_FILE);
}

function saveProjects(projects) {
  fs.writeJsonSync(PROJECTS_FILE, projects, { spaces: 2 });
}

function getProjectById(id) {
  const projects = getProjects();
  return projects.find(p => p.id === id);
}

function updateProject(updatedProject) {
  const projects = getProjects();
  const index = projects.findIndex(p => p.id === updatedProject.id);
  if (index !== -1) {
    projects[index] = { ...projects[index], ...updatedProject };
    saveProjects(projects);
    return projects[index];
  }
  return null;
}

// Track active builds per project
const activeBuilds = new Map();

// POST /api/projects/:id/build - Trigger Maven build
router.post('/projects/:id/build', async (req, res) => {
  try {
    const project = getProjectById(req.params.id);
    
    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }
    
    // Check if already building
    if (activeBuilds.has(project.id)) {
      return res.status(400).json({ error: 'Build already in progress' });
    }
    
    const workspacePath = path.join(WORKSPACE_DIR, project.safeName);
    const pomPath = path.join(workspacePath, 'pom.xml');
    
    if (!fs.existsSync(pomPath)) {
      return res.status(400).json({ error: 'pom.xml not found' });
    }
    
    const buildId = uuidv4();
    const startTime = Date.now();
    let autoFixAttempts = 0;
    const maxAutoFixAttempts = 3;
    
    // Store build info
    activeBuilds.set(project.id, {
      buildId,
      startTime,
      autoFixAttempts,
      ws: req.app.get('broadcastToProject')
    });
    
    console.log(`🔨 Starting build for ${project.name} (${buildId})`);
    
    // Send initial status via WebSocket
    const broadcast = req.app.get('broadcastToProject');
    broadcast(project.id, { 
      type: 'build_started', 
      projectId: project.id,
      buildId,
      message: 'Starting Maven build...' 
    });
    
    // Run Maven build
    const buildProcess = exec(`mvn clean package -f "${pomPath}"`, {
      cwd: workspacePath,
      maxBuffer: 10 * 1024 * 1024 // 10MB buffer
    });
    
    let fullLog = '';
    let hasError = false;
    let jarPath = null;
    
    buildProcess.stdout.on('data', (data) => {
      const lines = data.toString().split('\n');
      for (const line of lines) {
        if (line.trim()) {
          fullLog += line + '\n';
          
          let level = 'info';
          if (line.toLowerCase().includes('error')) level = 'error';
          else if (line.toLowerCase().includes('warning')) level = 'warn';
          
          broadcast(project.id, {
            type: 'log',
            projectId: project.id,
            buildId,
            line,
            level
          });
        }
      }
    });
    
    buildProcess.stderr.on('data', (data) => {
      const lines = data.toString().split('\n');
      for (const line of lines) {
        if (line.trim()) {
          fullLog += line + '\n';
          hasError = true;
          
          broadcast(project.id, {
            type: 'log',
            projectId: project.id,
            buildId,
            line,
            level: 'error'
          });
        }
      }
    });
    
    buildProcess.on('close', async (code) => {
      activeBuilds.delete(project.id);
      
      const duration = Date.now() - startTime;
      const success = code === 0;
      
      // Find JAR path if successful
      if (success) {
        const targetPath = path.join(workspacePath, 'target');
        if (fs.existsSync(targetPath)) {
          const files = fs.readdirSync(targetPath);
          const jarFile = files.find(f => f.endsWith('.jar') && !f.includes('-sources') && !f.includes('-javadoc'));
          if (jarFile) {
            jarPath = path.join('target', jarFile);
          }
        }
      }
      
      // Save to build history
      const buildRecord = {
        id: buildId,
        timestamp: new Date().toISOString(),
        success,
        log: fullLog,
        jarPath,
        duration
      };
      
      const updatedProject = updateProject({
        id: project.id,
        buildHistory: [...(project.buildHistory || []).slice(-9), buildRecord],
        updatedAt: new Date().toISOString()
      });
      
      if (success) {
        console.log(`✅ Build succeeded for ${project.name} in ${duration}ms`);
        broadcast(project.id, {
          type: 'success',
          projectId: project.id,
          buildId,
          jarPath,
          duration,
          message: `Build completed successfully in ${duration}ms`
        });
      } else {
        console.log(`❌ Build failed for ${project.name}`);
        broadcast(project.id, {
          type: 'error',
          projectId: project.id,
          buildId,
          log: fullLog,
          message: 'Build failed. Check logs for details.'
        });
      }
    });
    
    buildProcess.on('error', (err) => {
      activeBuilds.delete(project.id);
      
      const errorMsg = `Failed to start build: ${err.message}`;
      console.error(errorMsg);
      
      broadcast(project.id, {
        type: 'error',
        projectId: project.id,
        buildId,
        log: errorMsg,
        message: 'Failed to start Maven. Is it installed?'
      });
    });
    
    res.json({ 
      success: true, 
      buildId, 
      message: 'Build started',
      streaming: true 
    });
    
  } catch (err) {
    console.error('Error starting build:', err);
    res.status(500).json({ error: 'Failed to start build' });
  }
});

// GET /api/projects/:id/build/status - Get current build status
router.get('/projects/:id/build/status', (req, res) => {
  const project = getProjectById(req.params.id);
  
  if (!project) {
    return res.status(404).json({ error: 'Project not found' });
  }
  
  const buildInfo = activeBuilds.get(project.id);
  
  if (buildInfo) {
    res.json({
      building: true,
      buildId: buildInfo.buildId,
      startTime: buildInfo.startTime,
      autoFixAttempts: buildInfo.autoFixAttempts
    });
  } else {
    res.json({ building: false });
  }
});

// GET /api/projects/:id/build/history - Get build history
router.get('/projects/:id/build/history', (req, res) => {
  const project = getProjectById(req.params.id);
  
  if (!project) {
    return res.status(404).json({ error: 'Project not found' });
  }
  
  res.json(project.buildHistory || []);
});

module.exports = router;
