const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs-extra');

const ROOT_DIR = path.resolve(__dirname, '../..');
const TABCHAT_DIR = path.join(ROOT_DIR, 'tabchat');
const DATA_DIR = path.join(ROOT_DIR, 'data');
const PROJECTS_FILE = path.join(DATA_DIR, 'projects.json');
const WORKSPACE_DIR = path.join(ROOT_DIR, 'workspace');

// Helper functions
function getProjects() {
  return fs.readJsonSync(PROJECTS_FILE);
}

function getProjectById(id) {
  const projects = getProjects();
  return projects.find(p => p.id === id);
}

// GET /api/projects/:id/chat - Get chat history
router.get('/projects/:id/chat', async (req, res) => {
  try {
    const project = getProjectById(req.params.id);
    
    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }
    
    const chatPath = path.join(TABCHAT_DIR, project.safeName, 'history.json');
    
    if (!fs.existsSync(chatPath)) {
      return res.json([]);
    }
    
    const history = await fs.readJson(chatPath);
    res.json(history);
  } catch (err) {
    console.error('Error getting chat history:', err);
    res.status(500).json({ error: 'Failed to get chat history' });
  }
});

// POST /api/projects/:id/chat - Send message and get AI response
router.post('/projects/:id/chat', async (req, res) => {
  try {
    const project = getProjectById(req.params.id);
    
    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }
    
    const { message, model, reasoningMode } = req.body;
    
    if (!message) {
      return res.status(400).json({ error: 'Message is required' });
    }
    
    // Get settings for API key
    const settingsPath = path.join(DATA_DIR, 'settings.json');
    const settings = await fs.readJson(settingsPath);
    
    if (!settings.apiKey) {
      return res.status(400).json({ error: 'API key not configured. Please set it in settings.' });
    }
    
    // Build system prompt
    const systemPrompt = buildSystemPrompt(project, reasoningMode || project.reasoningMode);
    
    // Get existing chat history
    const chatPath = path.join(TABCHAT_DIR, project.safeName, 'history.json');
    let chatHistory = [];
    if (await fs.pathExists(chatPath)) {
      chatHistory = await fs.readJson(chatPath);
    }
    
    // Prepare messages for Kilo API
    const messages = [
      { role: 'system', content: systemPrompt },
      ...chatHistory.map(msg => ({ role: msg.role, content: msg.content })),
      { role: 'user', content: message }
    ];
    
    // Determine model to use
    const selectedModel = model || project.model || settings.defaultModel || 'kilo-auto/free';
    
    // Build request body
    const requestBody = {
      model: selectedModel,
      stream: true,
      max_tokens: 16000,
      messages
    };
    
    // Add thinking budget for trinity model
    if (selectedModel.includes('trinity')) {
      requestBody.thinking = { budget_tokens: 8000 };
    }
    
    // Make the API call
    const response = await fetch('https://api.kilo.ai/api/gateway/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${settings.apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(requestBody)
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Kilo API error: ${response.status} - ${errorText}`);
    }
    
    // Stream the response
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    
    let fullResponse = '';
    const decoder = new TextDecoder();
    
    for await (const chunk of response.body) {
      const text = decoder.decode(chunk);
      const lines = text.split('\n');
      
      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const data = line.slice(6);
          if (data === '[DONE]') continue;
          
          try {
            const parsed = JSON.parse(data);
            const content = parsed.choices?.[0]?.delta?.content || '';
            if (content) {
              fullResponse += content;
              res.write(`data: ${JSON.stringify({ content })}\n\n`);
            }
          } catch (e) {
            // Skip invalid JSON
          }
        }
      }
    }
    
    // Save user message to history
    chatHistory.push({
      role: 'user',
      content: message,
      timestamp: new Date().toISOString(),
      pinned: false
    });
    
    // Save AI response to history
    chatHistory.push({
      role: 'assistant',
      content: fullResponse,
      timestamp: new Date().toISOString(),
      pinned: false
    });
    
    // Write updated history
    await fs.writeJson(chatPath, chatHistory, { spaces: 2 });
    
    // Parse FILE: blocks and write files
    const writtenFiles = await parseAndWriteFiles(fullResponse, project);
    
    // Notify about written files
    if (writtenFiles.length > 0) {
      res.write(`data: ${JSON.stringify({ 
        type: 'files_written', 
        files: writtenFiles 
      })}\n\n`);
    }
    
    res.write('data: [DONE]\n\n');
    res.end();
    
    console.log(`💬 Chat message processed for ${project.name}, ${writtenFiles.length} files written`);
    
  } catch (err) {
    console.error('Error in chat:', err);
    res.status(500).json({ error: 'Failed to process chat', details: err.message });
  }
});

// DELETE /api/projects/:id/chat - Clear chat history
router.delete('/projects/:id/chat', async (req, res) => {
  try {
    const project = getProjectById(req.params.id);
    
    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }
    
    const chatPath = path.join(TABCHAT_DIR, project.safeName, 'history.json');
    
    if (await fs.pathExists(chatPath)) {
      await fs.writeJson(chatPath, [], { spaces: 2 });
    }
    
    console.log(`🗑️  Cleared chat history for ${project.name}`);
    res.json({ success: true, message: 'Chat history cleared' });
  } catch (err) {
    console.error('Error clearing chat:', err);
    res.status(500).json({ error: 'Failed to clear chat history' });
  }
});

// Build system prompt with project context
function buildSystemPrompt(project, reasoningMode) {
  const { name, serverType, mcVersion, javaVersion, safeName } = project;
  
  return `You are PluginForge AI, an expert Minecraft Java plugin developer with 10+ years of experience. You are working on the plugin: ${name} targeting ${serverType} ${mcVersion} with Java ${javaVersion}.

WORKSPACE RULE: All files belong to workspace/${safeName}/. Never mix code or context between different plugins.

FILE OUTPUT FORMAT — CRITICAL:
Every file you generate MUST be prefixed exactly like this:
FILE: workspace/${safeName}/path/to/File.java
\`\`\`java
// full file content here
\`\`\`
Always output complete files. Never truncate. Never say "same as before."

IDEA EXPANSION PHASE:
When given a plugin idea, NEVER immediately generate code. First respond with:

1. COMPLEXITY: Rate as 🟢 Easy | 🟡 Medium | 🔴 Hard | 💀 Very Hard + brief reason
2. SUGGESTED FEATURES: List 6-12 features grouped by category. Each labeled [Core] [Optional] or [Advanced] with a one-line description
3. DEPENDENCIES: List external plugins that would help (Vault, WorldGuard, PlaceholderAPI etc) and why
4. API COMPATIBILITY: Warn about anything that doesn't exist in ${mcVersion}
5. PERMISSIONS: Suggest clean permission node structure
6. COMMANDS: Suggest command layout with aliases and subcommands
7. CONFIG PREVIEW: Show what config.yml will look like

Then ask: "Ready to generate? Tell me what to add, remove, or change."

GENERATION PHASE:
When user approves, output ALL files in this order:
1. pom.xml
2. plugin.yml
3. config.yml (fully commented)
4. Main.java
5. All manager classes
6. All listener classes
7. All command classes
8. Utility classes
9. README.md

CODING STANDARDS:
- Java ${javaVersion}, prefer ${serverType} API
- Never block the main thread — use BukkitRunnable.runAsync for heavy tasks
- Use UUID for player storage, never player names
- Null checks everywhere relevant
- Save all data on onDisable()
- Register commands in BOTH plugin.yml AND code
- Never use deprecated methods without a comment explaining why
- Use try-catch for all I/O operations
- Close all resources (DB connections, streams)

ANTI-PATTERN DETECTION:
After generating, check and report any of these found:
⚠️ Blocking main thread
⚠️ Storing Player objects instead of UUIDs
⚠️ Tasks not cancelled on onDisable
⚠️ Memory leaks from unclosed resources
⚠️ Hardcoded values that should be in config.yml
⚠️ Missing permission checks on commands

BUILD ERROR HANDLING:
When user pastes a build error:
1. Identify exact file and line
2. Explain the error in plain English
3. Output ONLY the fixed files in full
4. Explain what changed and why

ITERATION:
When updating code based on user requests:
- Only regenerate changed files
- Label what changed: "Updated: Main.java, ArenaManager.java"
- Brief summary of what was added/changed/removed

REASONING MODE: ${reasoningMode}
STRICT — double-check everything, verify all imports, thread safety, null checks, plugin.yml accuracy. Self-review and list potential issues. Be verbose.
MEDIUM — check for obvious errors, ensure plugin.yml is complete, briefly explain key decisions.
LOW — generate fast, minimal checking, only flag critical blockers.

ALWAYS end every single response with:
💡 SUGGESTIONS:
[3-5 specific features or improvements to add next]`;
}

// Parse FILE: blocks from AI response and write files
async function parseAndWriteFiles(response, project) {
  const writtenFiles = [];
  
  // Match FILE: blocks
  const fileRegex = /FILE:\s*workspace\/[^\/]+\/([^\n]+)\n```(\w+)?\n([\s\S]*?)```/g;
  let match;
  
  while ((match = fileRegex.exec(response)) !== null) {
    const filePath = match[1].trim();
    const language = match[2] || '';
    const content = match[3].trim();
    
    if (filePath && content) {
      const fullPath = path.join(WORKSPACE_DIR, project.safeName, filePath);
      
      try {
        // Create directory if needed
        await fs.ensureDir(path.dirname(fullPath));
        
        // Write file
        await fs.writeFile(fullPath, content, 'utf-8');
        
        writtenFiles.push({
          path: filePath,
          content: content.substring(0, 100) + (content.length > 100 ? '...' : ''),
          size: content.length
        });
        
        console.log(`📝 Written: ${filePath}`);
      } catch (err) {
        console.error(`Failed to write ${filePath}:`, err.message);
      }
    }
  }
  
  return writtenFiles;
}

module.exports = router;
