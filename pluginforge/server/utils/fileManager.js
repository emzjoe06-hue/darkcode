const fs = require('fs-extra');
const path = require('path');

const ROOT_DIR = path.resolve(__dirname, '../..');
const WORKSPACE_DIR = path.join(ROOT_DIR, 'workspace');

/**
 * Parse AI response for FILE: blocks and extract file info
 * @param {string} text - AI response text
 * @returns {Array<{path: string, content: string, language: string}>}
 */
function parseFilesFromAIResponse(text) {
  const files = [];
  
  // Match FILE: blocks with code fences
  const fileRegex = /FILE:\s*workspace\/[^\/]+\/([^\n]+)\n```(\w+)?\n([\s\S]*?)```/g;
  let match;
  
  while ((match = fileRegex.exec(text)) !== null) {
    const filePath = match[1].trim();
    const language = match[2] || '';
    const content = match[3];
    
    if (filePath && content) {
      files.push({
        path: filePath,
        content: content.trim(),
        language
      });
    }
  }
  
  return files;
}

/**
 * Write project files to disk
 * @param {Array<{path: string, content: string}>} files - Files to write
 * @param {string} projectName - Safe project name for workspace path
 * @returns {Array<{path: string, size: number}>}
 */
async function writeProjectFiles(files, projectName) {
  const writtenFiles = [];
  const projectPath = path.join(WORKSPACE_DIR, projectName);
  
  for (const file of files) {
    const fullPath = path.join(projectPath, file.path);
    
    try {
      // Create directory if needed
      await fs.ensureDir(path.dirname(fullPath));
      
      // Write file
      await fs.writeFile(fullPath, file.content, 'utf-8');
      
      writtenFiles.push({
        path: file.path,
        size: file.content.length
      });
      
      console.log(`📝 Written: ${file.path}`);
    } catch (err) {
      console.error(`Failed to write ${file.path}:`, err.message);
    }
  }
  
  return writtenFiles;
}

/**
 * Get nested file tree structure for a project
 * @param {string} projectName - Safe project name
 * @returns {Array}
 */
function getFileTree(projectName) {
  const projectPath = path.join(WORKSPACE_DIR, projectName);
  
  if (!fs.existsSync(projectPath)) {
    return [];
  }
  
  function buildTree(dir, baseDir = dir) {
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
          children: buildTree(fullPath, baseDir)
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
  
  return buildTree(projectPath);
}

/**
 * Get line-by-line diff between old and new content
 * @param {string} oldContent 
 * @param {string} newContent 
 * @returns {{added: string[], removed: string[], unchanged: string[]}}
 */
function getFileDiff(oldContent, newContent) {
  const oldLines = oldContent.split('\n');
  const newLines = newContent.split('\n');
  
  const added = [];
  const removed = [];
  const unchanged = [];
  
  // Simple diff algorithm
  const maxLen = Math.max(oldLines.length, newLines.length);
  
  for (let i = 0; i < maxLen; i++) {
    const oldLine = oldLines[i];
    const newLine = newLines[i];
    
    if (oldLine === undefined) {
      added.push(newLine);
    } else if (newLine === undefined) {
      removed.push(oldLine);
    } else if (oldLine === newLine) {
      unchanged.push(oldLine);
    } else {
      removed.push(oldLine);
      added.push(newLine);
    }
  }
  
  return { added, removed, unchanged };
}

/**
 * Get file content with language detection
 * @param {string} projectName 
 * @param {string} filePath 
 * @returns {{content: string, language: string, size: number}}
 */
function getFileContent(projectName, filePath) {
  const fullPath = path.join(WORKSPACE_DIR, projectName, filePath);
  
  if (!fs.existsSync(fullPath)) {
    return null;
  }
  
  const content = fs.readFileSync(fullPath, 'utf-8');
  const ext = path.extname(filePath).toLowerCase();
  
  const languageMap = {
    '.java': 'java',
    '.yml': 'yaml',
    '.yaml': 'yaml',
    '.xml': 'xml',
    '.json': 'json',
    '.md': 'markdown',
    '.txt': 'text',
    '.sh': 'bash',
    '.js': 'javascript',
    '.css': 'css',
    '.html': 'html'
  };
  
  return {
    content,
    language: languageMap[ext] || 'text',
    size: fs.statSync(fullPath).size
  };
}

module.exports = {
  parseFilesFromAIResponse,
  writeProjectFiles,
  getFileTree,
  getFileDiff,
  getFileContent
};
