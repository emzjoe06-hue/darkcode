const express = require('express');
const cors = require('cors');
const http = require('http');
const WebSocket = require('ws');
const path = require('path');
const fs = require('fs-extra');

// Load environment variables
require('dotenv').config();

// Import routes
const projectsRoutes = require('./routes/projects');
const filesRoutes = require('./routes/files');
const buildRoutes = require('./routes/build');
const chatRoutes = require('./routes/chat');
const settingsRoutes = require('./routes/settings');

// Import utils
const fileManager = require('./utils/fileManager');
const buildManager = require('./utils/buildManager');

const app = express();
const PORT = process.env.PORT || 3000;
const ROOT_DIR = path.resolve(__dirname, '..');

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Serve static frontend files
app.use(express.static(path.join(ROOT_DIR, 'frontend')));

// API Routes
app.use('/api/projects', projectsRoutes);
app.use('/api/projects', filesRoutes);
app.use('/api/projects', buildRoutes);
app.use('/api/projects', chatRoutes);
app.use('/api/settings', settingsRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', version: '1.0.0' });
});

// Serve index.html for all other routes (SPA fallback)
app.get('*', (req, res) => {
  res.sendFile(path.join(ROOT_DIR, 'frontend', 'index.html'));
});

// Create HTTP server
const server = http.createServer(app);

// WebSocket server for build logs and chat streaming
const wss = new WebSocket.Server({ server, path: '/ws' });

// Track active WebSocket connections
const activeConnections = new Map();

wss.on('connection', (ws, req) => {
  const connectionId = Math.random().toString(36).substring(7);
  console.log(`🔌 WebSocket connected: ${connectionId}`);
  
  activeConnections.set(connectionId, ws);
  
  ws.on('message', (data) => {
    try {
      const message = JSON.parse(data);
      // Handle client messages if needed
      console.log(`📨 WS Message from ${connectionId}:`, message.type);
    } catch (e) {
      console.error('WS parse error:', e);
    }
  });
  
  ws.on('close', () => {
    console.log(`🔌 WebSocket disconnected: ${connectionId}`);
    activeConnections.delete(connectionId);
  });
  
  ws.on('error', (err) => {
    console.error(`❌ WS Error ${connectionId}:`, err.message);
  });
  
  // Send connection confirmation
  ws.send(JSON.stringify({ type: 'connected', id: connectionId }));
});

// Broadcast to specific project's subscribers
function broadcastToProject(projectId, message) {
  const msg = JSON.stringify(message);
  let count = 0;
  activeConnections.forEach((ws) => {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(msg);
      count++;
    }
  });
  return count;
}

// Make broadcast function available to routes
app.set('broadcastToProject', broadcastToProject);
app.set('wss', wss);
app.set('activeConnections', activeConnections);

// Initialize directories on startup
function initializeApp() {
  const dataDir = path.join(ROOT_DIR, 'data');
  const workspaceDir = path.join(ROOT_DIR, 'workspace');
  const tabchatDir = path.join(ROOT_DIR, 'tabchat');
  
  fs.ensureDirSync(dataDir);
  fs.ensureDirSync(workspaceDir);
  fs.ensureDirSync(tabchatDir);
  
  // Initialize projects.json if missing
  const projectsPath = path.join(dataDir, 'projects.json');
  if (!fs.existsSync(projectsPath)) {
    fs.writeJsonSync(projectsPath, [], { spaces: 2 });
    console.log('✅ Created projects.json');
  }
  
  // Initialize settings.json if missing
  const settingsPath = path.join(dataDir, 'settings.json');
  if (!fs.existsSync(settingsPath)) {
    fs.writeJsonSync(settingsPath, {
      apiKey: '',
      defaultModel: 'kilo-auto/free',
      defaultReasoningMode: 'MEDIUM',
      defaultMcVersion: '1.21',
      defaultServerType: 'Paper',
      defaultJavaVersion: '17'
    }, { spaces: 2 });
    console.log('✅ Created settings.json');
  }
}

// Start server
server.listen(PORT, () => {
  initializeApp();
  console.log('═══════════════════════════════════════');
  console.log('       🚀 PluginForge AI Server');
  console.log('═══════════════════════════════════════');
  console.log(`📡 Server running on http://localhost:${PORT}`);
  console.log(`🔌 WebSocket ready at ws://localhost:${PORT}/ws`);
  console.log('═══════════════════════════════════════\n');
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n👋 Shutting down...');
  wss.close(() => {
    console.log('WebSocket server closed');
  });
  server.close(() => {
    console.log('HTTP server closed');
    process.exit(0);
  });
});

module.exports = { app, server, wss };
