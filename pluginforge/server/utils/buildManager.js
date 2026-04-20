const { exec } = require('child_process');

/**
 * Check if Maven is installed
 * @returns {Promise<boolean>}
 */
function checkMavenInstalled() {
  return new Promise((resolve) => {
    exec('mvn -version', (err) => {
      resolve(!err);
    });
  });
}

/**
 * Get Maven installation instructions for Termux
 * @returns {string}
 */
function getMavenInstallInstructions() {
  return 'pkg install openjdk-21 maven';
}

/**
 * Build a project using Maven
 * @param {string} projectName - Safe project name
 * @param {WebSocket} ws - WebSocket connection for streaming logs
 * @returns {Promise<{success: boolean, log: string, jarPath?: string}>}
 */
function buildProject(projectName, ws, ROOT_DIR) {
  return new Promise((resolve, reject) => {
    const path = require('path');
    const workspacePath = path.join(ROOT_DIR, 'workspace', projectName);
    const pomPath = path.join(workspacePath, 'pom.xml');
    
    const fs = require('fs-extra');
    if (!fs.existsSync(pomPath)) {
      reject(new Error('pom.xml not found'));
      return;
    }
    
    let fullLog = '';
    let jarPath = null;
    
    const buildProcess = exec(`mvn clean package -f "${pomPath}"`, {
      cwd: workspacePath,
      maxBuffer: 10 * 1024 * 1024
    });
    
    buildProcess.stdout.on('data', (data) => {
      const lines = data.toString().split('\n');
      for (const line of lines) {
        if (line.trim()) {
          fullLog += line + '\n';
          
          let level = 'info';
          if (line.toLowerCase().includes('error')) level = 'error';
          else if (line.toLowerCase().includes('warning')) level = 'warn';
          
          if (ws && ws.readyState === 1) { // WebSocket.OPEN
            ws.send(JSON.stringify({
              type: 'log',
              line,
              level
            }));
          }
        }
      }
    });
    
    buildProcess.stderr.on('data', (data) => {
      const lines = data.toString().split('\n');
      for (const line of lines) {
        if (line.trim()) {
          fullLog += line + '\n';
          
          if (ws && ws.readyState === 1) {
            ws.send(JSON.stringify({
              type: 'log',
              line,
              level: 'error'
            }));
          }
        }
      }
    });
    
    buildProcess.on('close', (code) => {
      const success = code === 0;
      
      if (success) {
        const targetPath = path.join(workspacePath, 'target');
        if (fs.existsSync(targetPath)) {
          const files = fs.readdirSync(targetPath);
          const jarFile = files.find(f => 
            f.endsWith('.jar') && 
            !f.includes('-sources') && 
            !f.includes('-javadoc')
          );
          if (jarFile) {
            jarPath = path.join('target', jarFile);
          }
        }
      }
      
      resolve({
        success,
        log: fullLog,
        jarPath
      });
    });
    
    buildProcess.on('error', (err) => {
      reject(err);
    });
  });
}

/**
 * Find the compiled JAR file in target directory
 * @param {string} projectName - Safe project name
 * @returns {string|null}
 */
function getJarPath(projectName, ROOT_DIR) {
  const path = require('path');
  const fs = require('fs-extra');
  
  const targetPath = path.join(ROOT_DIR, 'workspace', projectName, 'target');
  
  if (!fs.existsSync(targetPath)) {
    return null;
  }
  
  const files = fs.readdirSync(targetPath);
  const jarFile = files.find(f => 
    f.endsWith('.jar') && 
    !f.includes('-sources') && 
    !f.includes('-javadoc')
  );
  
  return jarFile ? path.join('target', jarFile) : null;
}

module.exports = {
  checkMavenInstalled,
  getMavenInstallInstructions,
  buildProject,
  getJarPath
};
