const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs-extra');
const archiver = require('archiver');

const ROOT_DIR = path.resolve(__dirname, '../..');
const WORKSPACE_DIR = path.join(ROOT_DIR, 'workspace');

// Helper to get project by ID from projects.json
function getProjectById(id) {
  const DATA_DIR = path.join(ROOT_DIR, 'data');
  const PROJECTS_FILE = path.join(DATA_DIR, 'projects.json');
  const projects = fs.readJsonSync(PROJECTS_FILE);
  return projects.find(p => p.id === id);
}

// GET /api/projects/:id/files - List all files in workspace
router.get('/projects/:id/files', (req, res) => {
  try {
    const project = getProjectById(req.params.id);
    
    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }
    
    const workspacePath = path.join(WORKSPACE_DIR, project.safeName);
    
    function getFileTree(dir, baseDir = dir) {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      const tree = [];
      
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        const relativePath = path.relative(baseDir, fullPath);
        
        if (entry.isDirectory()) {
          tree.push({
            name: entry.name,
            path: relativePath,
            type: 'directory',
            children: getFileTree(fullPath, baseDir)
          });
        } else {
          const stats = fs.statSync(fullPath);
          tree.push({
            name: entry.name,
            path: relativePath,
            type: 'file',
            size: stats.size,
            modified: stats.mtime.toISOString()
          });
        }
      }
      
      return tree.sort((a, b) => {
        if (a.type === b.type) return a.name.localeCompare(b.name);
        return a.type === 'directory' ? -1 : 1;
      });
    }
    
    const fileTree = getFileTree(workspacePath);
    res.json(fileTree);
  } catch (err) {
    console.error('Error listing files:', err);
    res.status(500).json({ error: 'Failed to list files' });
  }
});

// GET /api/projects/:id/files/content - Get file content
router.get('/projects/:id/files/content', (req, res) => {
  try {
    const project = getProjectById(req.params.id);
    
    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }
    
    const filePath = req.query.path;
    if (!filePath) {
      return res.status(400).json({ error: 'Path query parameter is required' });
    }
    
    const fullPath = path.join(WORKSPACE_DIR, project.safeName, filePath);
    
    if (!fs.existsSync(fullPath)) {
      return res.status(404).json({ error: 'File not found' });
    }
    
    const content = fs.readFileSync(fullPath, 'utf-8');
    res.json({ path: filePath, content });
  } catch (err) {
    console.error('Error reading file:', err);
    res.status(500).json({ error: 'Failed to read file' });
  }
});

// POST /api/projects/:id/files - Write a file
router.post('/projects/:id/files', async (req, res) => {
  try {
    const project = getProjectById(req.params.id);
    
    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }
    
    const { path: filePath, content } = req.body;
    
    if (!filePath) {
      return res.status(400).json({ error: 'Path is required' });
    }
    
    const fullPath = path.join(WORKSPACE_DIR, project.safeName, filePath);
    
    // Create directory if it doesn't exist
    await fs.ensureDir(path.dirname(fullPath));
    
    // Write file
    await fs.writeFile(fullPath, content || '', 'utf-8');
    
    console.log(`📝 Written file: ${filePath}`);
    res.json({ success: true, path: filePath });
  } catch (err) {
    console.error('Error writing file:', err);
    res.status(500).json({ error: 'Failed to write file' });
  }
});

// DELETE /api/projects/:id/files - Delete a file
router.delete('/projects/:id/files', async (req, res) => {
  try {
    const project = getProjectById(req.params.id);
    
    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }
    
    const filePath = req.query.path;
    if (!filePath) {
      return res.status(400).json({ error: 'Path query parameter is required' });
    }
    
    const fullPath = path.join(WORKSPACE_DIR, project.safeName, filePath);
    
    if (!fs.existsSync(fullPath)) {
      return res.status(404).json({ error: 'File not found' });
    }
    
    await fs.remove(fullPath);
    
    console.log(`🗑️  Deleted file: ${filePath}`);
    res.json({ success: true, path: filePath });
  } catch (err) {
    console.error('Error deleting file:', err);
    res.status(500).json({ error: 'Failed to delete file' });
  }
});

// GET /api/projects/:id/download/zip - Download full project as ZIP
router.get('/projects/:id/download/zip', async (req, res) => {
  try {
    const project = getProjectById(req.params.id);
    
    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }
    
    const workspacePath = path.join(WORKSPACE_DIR, project.safeName);
    
    if (!fs.existsSync(workspacePath)) {
      return res.status(404).json({ error: 'Workspace not found' });
    }
    
    const filename = `${project.safeName}.zip`;
    
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    
    const archive = archiver('zip', { zlib: { level: 9 } });
    
    archive.on('error', (err) => {
      console.error('Archive error:', err);
      res.status(500).json({ error: 'Failed to create ZIP' });
    });
    
    archive.pipe(res);
    archive.directory(workspacePath, project.safeName);
    await archive.finalize();
  } catch (err) {
    console.error('Error creating ZIP:', err);
    res.status(500).json({ error: 'Failed to create ZIP' });
  }
});

// GET /api/projects/:id/download/jar - Download compiled JAR if it exists
router.get('/projects/:id/download/jar', async (req, res) => {
  try {
    const project = getProjectById(req.params.id);
    
    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }
    
    const targetPath = path.join(WORKSPACE_DIR, project.safeName, 'target');
    
    if (!fs.existsSync(targetPath)) {
      return res.status(404).json({ error: 'No build found. Run a build first.' });
    }
    
    // Find the JAR file
    const files = fs.readdirSync(targetPath);
    const jarFile = files.find(f => f.endsWith('.jar') && !f.includes('-sources') && !f.includes('-javadoc'));
    
    if (!jarFile) {
      return res.status(404).json({ error: 'No JAR file found in target/' });
    }
    
    const jarPath = path.join(targetPath, jarFile);
    
    res.setHeader('Content-Type', 'application/java-archive');
    res.setHeader('Content-Disposition', `attachment; filename="${jarFile}"`);
    
    const stream = fs.createReadStream(jarPath);
    stream.pipe(res);
  } catch (err) {
    console.error('Error downloading JAR:', err);
    res.status(500).json({ error: 'Failed to download JAR' });
  }
});

module.exports = router;
