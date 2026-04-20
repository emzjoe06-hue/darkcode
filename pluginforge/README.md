# PluginForge AI 🚀

An agentic Minecraft Java plugin generator powered by AI. Generate complete, buildable Minecraft plugins through natural language conversation.

![PluginForge AI](https://img.shields.io/badge/version-1.0.0-green)
![Node.js](https://img.shields.io/badge/node-%3E%3D18-brightgreen)
![Java](https://img.shields.io/badge/java-%3E%3D17-orange)

## Features

- 🤖 **AI-Powered Code Generation** - Describe your plugin idea and get complete, working code
- 📁 **Project Management** - Create, clone, export, and import projects
- 🔨 **Maven Build Integration** - Build plugins directly from the UI with live log streaming
- 💬 **Chat Interface** - Iteratively refine your plugin through conversation
- 📝 **File Viewer** - Browse and copy generated files with syntax highlighting
- ⚙️ **Configurable** - Support for multiple MC versions, server types (Paper/Spigot), and Java versions
- 🎯 **Smart Reasoning** - Three reasoning modes (Low/Medium/Strict) for different needs

## Requirements

### For Termux (Android)

```bash
pkg install nodejs openjdk-21 maven
```

### For Desktop Linux/macOS

- Node.js 18+
- Java 17 or 21
- Maven 3.6+

## Installation

### 1. Clone/Download the project

```bash
cd /path/to/pluginforge
```

### 2. Install dependencies

```bash
npm install
```

### 3. Run setup

```bash
npm run setup
```

This will:
- Check if Maven is installed
- Create required directories (`workspace/`, `tabchat/`, `data/`)
- Initialize `projects.json` and `settings.json`

### 4. Start the server

```bash
npm start
```

### 5. Open in browser

Navigate to: **http://localhost:3000**

## Project Structure

```
pluginforge/
├── server/
│   ├── index.js              # Main Express server + WebSocket
│   ├── routes/
│   │   ├── projects.js       # Project CRUD operations
│   │   ├── files.js          # File management endpoints
│   │   ├── build.js          # Maven build handling
│   │   ├── chat.js           # AI chat with Kilo API
│   │   └── settings.js       # App settings
│   ├── middleware/
│   │   └── auth.js           # (Future) Authentication
│   └── utils/
│       ├── fileManager.js    # File parsing and writing
│       └── buildManager.js   # Maven build utilities
├── frontend/
│   ├── index.html            # Main HTML structure
│   ├── css/
│   │   ├── themes.css        # Dark theme variables
│   │   ├── main.css          # Layout and components
│   │   └── syntax.css        # Syntax highlighting
│   └── js/
│       ├── app.js            # Main application entry
│       ├── chat.js           # Chat module
│       ├── editor.js         # Code viewer
│       ├── fileTree.js       # File tree navigation
│       ├── build.js          # Build system
│       ├── projects.js       # Project management
│       ├── toast.js          # Notifications
│       ├── diff.js           # Diff viewer
│       └── shortcuts.js      # Keyboard shortcuts
├── workspace/                # Generated plugin projects
├── tabchat/                  # Chat history per project
├── data/
│   ├── projects.json         # Project metadata
│   └── settings.json         # App settings (API key, etc.)
├── package.json
├── setup.js
└── README.md
```

## Usage Guide

### 1. Set Your API Key

1. Click **Settings** in the left panel
2. Enter your Kilo API key from [kilo.ai](https://kilo.ai)
3. Click **Save Settings**

### 2. Create a New Project

1. Click **New Project** button
2. Fill in:
   - Plugin Name (required)
   - Description
   - Minecraft Version
   - Server Type (Paper/Spigot)
   - Java Version
   - AI Model
   - Reasoning Mode
3. Click **Create Project**

### 3. Generate Your Plugin

1. In the chat, describe your plugin idea
2. The AI will respond with:
   - Complexity rating
   - Suggested features
   - Dependencies needed
   - Command structure
   - Config preview
3. Review and approve, then the AI generates all files

### 4. Build the Plugin

1. Switch to the **BUILD** tab in the right panel
2. Click **Build & Download JAR**
3. Watch the live build logs
4. On success, click **Download JAR**

### 5. Iterate

- Ask the AI to add features, fix bugs, or modify existing code
- Files are automatically updated when the AI generates them
- Use the file tree to review changes

## API Routes

### Projects

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/projects` | List all projects |
| POST | `/api/projects` | Create new project |
| GET | `/api/projects/:id` | Get single project |
| PUT | `/api/projects/:id` | Update project |
| DELETE | `/api/projects/:id` | Delete project |
| POST | `/api/projects/:id/clone` | Clone project |
| POST | `/api/projects/:id/export` | Export as JSON |
| POST | `/api/projects/import` | Import from JSON |

### Files

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/projects/:id/files` | List file tree |
| GET | `/api/projects/:id/files/content?path=` | Get file content |
| POST | `/api/projects/:id/files` | Write file |
| DELETE | `/api/projects/:id/files?path=` | Delete file |
| GET | `/api/projects/:id/download/zip` | Download ZIP |
| GET | `/api/projects/:id/download/jar` | Download JAR |

### Build

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/projects/:id/build` | Trigger Maven build |
| GET | `/api/projects/:id/build/status` | Get build status |
| GET | `/api/projects/:id/build/history` | Get build history |

### Chat

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/projects/:id/chat` | Get chat history |
| POST | `/api/projects/:id/chat` | Send message (SSE stream) |
| DELETE | `/api/projects/:id/chat` | Clear chat history |

### Settings

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/settings` | Get settings |
| PUT | `/api/settings` | Update settings |

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Ctrl+Enter` | Send message |
| `Ctrl+B` | Trigger build |
| `Ctrl+S` | Export project |
| `Ctrl+K` | Focus search |
| `Ctrl+[` | Collapse left panel |
| `Ctrl+]` | Collapse right panel |
| `Escape` | Close modal |

## WebSocket Messages

The server uses WebSocket for real-time build logs:

```javascript
// Build log line
{ type: "log", line: "...", level: "info|warn|error" }

// Build success
{ type: "success", jarPath: "...", duration: 1234 }

// Build error
{ type: "error", log: "..." }
```

## Configuration

### settings.json

```json
{
  "apiKey": "your-kilo-api-key",
  "defaultModel": "kilo-auto/free",
  "defaultReasoningMode": "MEDIUM",
  "defaultMcVersion": "1.21",
  "defaultServerType": "Paper",
  "defaultJavaVersion": "17"
}
```

### projects.json

Each project contains:

```json
{
  "id": "uuid",
  "name": "PluginName",
  "safeName": "PluginName",
  "description": "...",
  "tags": ["WIP"],
  "model": "kilo-auto/free",
  "reasoningMode": "MEDIUM",
  "mcVersion": "1.21",
  "serverType": "Paper",
  "javaVersion": "17",
  "javaPackage": "com.pluginforge.pluginname",
  "createdAt": "ISO date",
  "updatedAt": "ISO date",
  "buildHistory": [...]
}
```

## Troubleshooting

### Maven not found

```bash
# Termux
pkg install openjdk-21 maven

# Ubuntu/Debian
sudo apt install openjdk-21-jdk maven

# macOS
brew install openjdk@21 maven
```

### Port already in use

Edit `.env` or set environment variable:

```bash
PORT=3001 npm start
```

### API errors

- Verify your API key in Settings
- Check network connection
- Ensure Kilo API is accessible

## License

MIT License - Feel free to use and modify!

## Credits

Built with:
- Node.js + Express
- WebSocket (ws)
- Kilo AI API
- highlight.js
- marked.js

---

**Happy coding! ⚒️**
