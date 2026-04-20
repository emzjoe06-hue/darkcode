// PluginForge AI - Setup Script

const fs = require('fs-extra');
const path = require('path');
const { execSync } = require('child_process');

const ROOT_DIR = path.resolve(__dirname);
const DATA_DIR = path.join(ROOT_DIR, 'data');
const WORKSPACE_DIR = path.join(ROOT_DIR, 'workspace');
const TABCHAT_DIR = path.join(ROOT_DIR, 'tabchat');

const defaultProjects = [];
const defaultSettings = {
  apiKey: '',
  defaultModel: 'kilo-auto/free',
  defaultReasoningMode: 'MEDIUM',
  defaultMcVersion: '1.21',
  defaultServerType: 'Paper',
  defaultJavaVersion: '17'
};

function checkMaven() {
  try {
    execSync('mvn -version', { stdio: 'ignore' });
    console.log('✅ Maven is installed');
    return true;
  } catch (e) {
    console.log('❌ Maven not found');
    console.log('\n📦 To install Maven on Termux, run:');
    console.log('   pkg install openjdk-21 maven\n');
    return false;
  }
}

function checkNodeVersion() {
  const version = process.version;
  const major = parseInt(version.slice(1).split('.')[0]);
  if (major >= 18) {
    console.log(`✅ Node.js ${version} is sufficient`);
    return true;
  } else {
    console.log(`⚠️  Node.js ${version} may be too old. Recommended: 18+`);
    return false;
  }
}

function createDirectories() {
  console.log('\n📁 Creating directories...');
  fs.ensureDirSync(DATA_DIR);
  fs.ensureDirSync(WORKSPACE_DIR);
  fs.ensureDirSync(TABCHAT_DIR);
  console.log('✅ Directories created');
}

function initializeDataFiles() {
  console.log('\n📄 Initializing data files...');
  
  const projectsPath = path.join(DATA_DIR, 'projects.json');
  const settingsPath = path.join(DATA_DIR, 'settings.json');
  
  if (!fs.existsSync(projectsPath)) {
    fs.writeJsonSync(projectsPath, defaultProjects, { spaces: 2 });
    console.log('✅ Created projects.json');
  } else {
    console.log('ℹ️  projects.json already exists');
  }
  
  if (!fs.existsSync(settingsPath)) {
    fs.writeJsonSync(settingsPath, defaultSettings, { spaces: 2 });
    console.log('✅ Created settings.json');
  } else {
    console.log('ℹ️  settings.json already exists');
  }
}

console.log('═══════════════════════════════════════');
console.log('       PluginForge AI - Setup');
console.log('═══════════════════════════════════════\n');

checkNodeVersion();
checkMaven();
createDirectories();
initializeDataFiles();

console.log('\n═══════════════════════════════════════');
console.log('✅ PluginForge AI is ready!');
console.log('📝 Run: npm start');
console.log('🌐 Then open: http://localhost:3000');
console.log('═══════════════════════════════════════\n');
