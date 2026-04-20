const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs-extra');
const { v4: uuidv4 } = require('uuid');

const ROOT_DIR = path.resolve(__dirname, '../..');
const DATA_DIR = path.join(ROOT_DIR, 'data');
const WORKSPACE_DIR = path.join(ROOT_DIR, 'workspace');
const TABCHAT_DIR = path.join(ROOT_DIR, 'tabchat');
const PROJECTS_FILE = path.join(DATA_DIR, 'projects.json');

// Helper to read/write projects
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

// GET /api/projects - List all projects
router.get('/projects', (req, res) => {
  try {
    const projects = getProjects();
    res.json(projects);
  } catch (err) {
    console.error('Error listing projects:', err);
    res.status(500).json({ error: 'Failed to list projects' });
  }
});

// POST /api/projects - Create new project
router.post('/projects', async (req, res) => {
  try {
    const { name, description, mcVersion, serverType, javaVersion, model, reasoningMode } = req.body;
    
    if (!name) {
      return res.status(400).json({ error: 'Project name is required' });
    }
    
    // Sanitize name for filesystem
    const safeName = name.replace(/[^a-zA-Z0-9_-]/g, '_');
    const id = uuidv4();
    
    // Create workspace directory structure
    const pluginDir = path.join(WORKSPACE_DIR, safeName);
    const javaPackage = `com.pluginforge.${safeName.toLowerCase()}`;
    const javaPath = javaPackage.replace(/\./g, '/');
    
    await fs.ensureDir(path.join(pluginDir, 'src/main/java', javaPath));
    await fs.ensureDir(path.join(pluginDir, 'src/main/java', javaPath, 'listeners'));
    await fs.ensureDir(path.join(pluginDir, 'src/main/java', javaPath, 'commands'));
    await fs.ensureDir(path.join(pluginDir, 'src/main/java', javaPath, 'managers'));
    await fs.ensureDir(path.join(pluginDir, 'src/main/java', javaPath, 'utils'));
    await fs.ensureDir(path.join(pluginDir, 'src/main/resources'));
    
    // Create tabchat directory
    await fs.ensureDir(path.join(TABCHAT_DIR, safeName));
    await fs.writeJson(path.join(TABCHAT_DIR, safeName, 'history.json'), [], { spaces: 2 });
    
    // Create initial pom.xml
    const pomContent = `<?xml version="1.0" encoding="UTF-8"?>
<project xmlns="http://maven.apache.org/POM/4.0.0"
         xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
         xsi:schemaLocation="http://maven.apache.org/POM/4.0.0 http://maven.apache.org/xsd/maven-4.0.0.xsd">
    <modelVersion>4.0.0</modelVersion>

    <groupId>com.pluginforge</groupId>
    <artifactId>${safeName}</artifactId>
    <version>1.0.0</version>
    <packaging>jar</packaging>

    <name>${name}</name>
    <description>${description || 'A Minecraft plugin'}</description>

    <properties>
        <java.version>${javaVersion || '17'}</java.version>
        <project.build.sourceEncoding>UTF-8</project.build.sourceEncoding>
    </properties>

    <build>
        <plugins>
            <plugin>
                <groupId>org.apache.maven.plugins</groupId>
                <artifactId>maven-compiler-plugin</artifactId>
                <version>3.11.0</version>
                <configuration>
                    <source>\${java.version}</source>
                    <target>\${java.version}</target>
                </configuration>
            </plugin>
            <plugin>
                <groupId>org.apache.maven.plugins</groupId>
                <artifactId>maven-jar-plugin</artifactId>
                <version>3.3.0</version>
                <configuration>
                    <archive>
                        <manifest>
                            <mainClass>${javaPackage}.Main</mainClass>
                        </manifest>
                    </archive>
                </configuration>
            </plugin>
        </plugins>
        <resources>
            <resource>
                <directory>src/main/resources</directory>
                <filtering>true</filtering>
            </resource>
        </resources>
    </build>

    <repositories>
        <repository>
            <id>spigot-repo</id>
            <url>https://hub.spigotmc.org/nexus/content/repositories/snapshots/</url>
        </repository>
        <repository>
            <id>papermc-repo</id>
            <url>https://repo.papermc.io/repository/maven-public/</url>
        </repository>
    </repositories>

    <dependencies>
        ${serverType === 'Paper' ? `
        <dependency>
            <groupId>io.papermc.paper</groupId>
            <artifactId>paper-api</artifactId>
            <version>${mcVersion || '1.21'}-R0.1-SNAPSHOT</version>
            <scope>provided</scope>
        </dependency>` : `
        <dependency>
            <groupId>org.spigotmc</groupId>
            <artifactId>spigot-api</artifactId>
            <version>${mcVersion || '1.21'}-R0.1-SNAPSHOT</version>
            <scope>provided</scope>
        </dependency>`}
    </dependencies>
</project>`;

    await fs.writeFile(path.join(pluginDir, 'pom.xml'), pomContent);
    
    // Create initial plugin.yml
    const pluginYml = `name: ${name}
version: 1.0.0
main: ${javaPackage}.Main
api-version: '${mcVersion || '1.21'}'
description: ${description || 'A Minecraft plugin'}
author: PluginForge AI
`;
    await fs.writeFile(path.join(pluginDir, 'src/main/resources/plugin.yml'), pluginYml);
    
    // Create initial config.yml
    const configYml = `# ${name} Configuration
# Generated by PluginForge AI

settings:
  enabled: true
  debug: false

# Add your configuration options below
`;
    await fs.writeFile(path.join(pluginDir, 'src/main/resources/config.yml'), configYml);
    
    // Create README.md
    const readme = `# ${name}

${description || 'A Minecraft plugin generated by PluginForge AI.'}

## Features

- Feature 1
- Feature 2

## Installation

1. Download the JAR file
2. Place it in your server's plugins folder
3. Restart the server

## Configuration

Edit \`config.yml\` to customize settings.

---
*Generated by PluginForge AI*
`;
    await fs.writeFile(path.join(pluginDir, 'README.md'), readme);
    
    // Create project entry
    const now = new Date().toISOString();
    const project = {
      id,
      name,
      safeName,
      description: description || '',
      tags: ['WIP'],
      model: model || 'kilo-auto/free',
      reasoningMode: reasoningMode || 'MEDIUM',
      mcVersion: mcVersion || '1.21',
      serverType: serverType || 'Paper',
      javaVersion: javaVersion || '17',
      javaPackage,
      createdAt: now,
      updatedAt: now,
      buildHistory: []
    };
    
    const projects = getProjects();
    projects.push(project);
    saveProjects(projects);
    
    console.log(`✅ Created project: ${name} (${id})`);
    res.status(201).json(project);
  } catch (err) {
    console.error('Error creating project:', err);
    res.status(500).json({ error: 'Failed to create project', details: err.message });
  }
});

// GET /api/projects/:id - Get single project
router.get('/projects/:id', (req, res) => {
  try {
    const project = getProjectById(req.params.id);
    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }
    res.json(project);
  } catch (err) {
    console.error('Error getting project:', err);
    res.status(500).json({ error: 'Failed to get project' });
  }
});

// PUT /api/projects/:id - Update project metadata
router.put('/projects/:id', (req, res) => {
  try {
    const { name, description, tags, model, reasoningMode, mcVersion, serverType, javaVersion } = req.body;
    const project = getProjectById(req.params.id);
    
    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }
    
    const updated = updateProject({
      id: req.params.id,
      name: name || project.name,
      description: description !== undefined ? description : project.description,
      tags: tags || project.tags,
      model: model || project.model,
      reasoningMode: reasoningMode || project.reasoningMode,
      mcVersion: mcVersion || project.mcVersion,
      serverType: serverType || project.serverType,
      javaVersion: javaVersion || project.javaVersion,
      updatedAt: new Date().toISOString()
    });
    
    res.json(updated);
  } catch (err) {
    console.error('Error updating project:', err);
    res.status(500).json({ error: 'Failed to update project' });
  }
});

// DELETE /api/projects/:id - Delete project
router.delete('/projects/:id', async (req, res) => {
  try {
    const project = getProjectById(req.params.id);
    
    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }
    
    // Remove from projects.json
    const projects = getProjects();
    const filtered = projects.filter(p => p.id !== req.params.id);
    saveProjects(filtered);
    
    // Delete workspace folder
    const workspacePath = path.join(WORKSPACE_DIR, project.safeName);
    if (await fs.pathExists(workspacePath)) {
      await fs.remove(workspacePath);
    }
    
    // Delete tabchat folder
    const tabchatPath = path.join(TABCHAT_DIR, project.safeName);
    if (await fs.pathExists(tabchatPath)) {
      await fs.remove(tabchatPath);
    }
    
    console.log(`🗑️  Deleted project: ${project.name}`);
    res.json({ success: true, message: 'Project deleted' });
  } catch (err) {
    console.error('Error deleting project:', err);
    res.status(500).json({ error: 'Failed to delete project' });
  }
});

// POST /api/projects/:id/clone - Clone a project
router.post('/projects/:id/clone', async (req, res) => {
  try {
    const project = getProjectById(req.params.id);
    
    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }
    
    const cloneName = `${project.name} (Copy)`;
    const safeCloneName = cloneName.replace(/[^a-zA-Z0-9_-]/g, '_');
    const cloneId = uuidv4();
    
    // Copy workspace folder
    const sourcePath = path.join(WORKSPACE_DIR, project.safeName);
    const destPath = path.join(WORKSPACE_DIR, safeCloneName);
    await fs.copy(sourcePath, destPath);
    
    // Copy tabchat folder
    const sourceTabchat = path.join(TABCHAT_DIR, project.safeName);
    const destTabchat = path.join(TABCHAT_DIR, safeCloneName);
    if (await fs.pathExists(sourceTabchat)) {
      await fs.copy(sourceTabchat, destTabchat);
    }
    
    // Create new project entry
    const now = new Date().toISOString();
    const cloneProject = {
      ...project,
      id: cloneId,
      name: cloneName,
      safeName: safeCloneName,
      description: `Clone of ${project.name}`,
      createdAt: now,
      updatedAt: now,
      buildHistory: []
    };
    
    const projects = getProjects();
    projects.push(cloneProject);
    saveProjects(projects);
    
    console.log(`📋 Cloned project: ${project.name} -> ${cloneName}`);
    res.status(201).json(cloneProject);
  } catch (err) {
    console.error('Error cloning project:', err);
    res.status(500).json({ error: 'Failed to clone project' });
  }
});

// POST /api/projects/:id/export - Export project as JSON download
router.post('/projects/:id/export', async (req, res) => {
  try {
    const project = getProjectById(req.params.id);
    
    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }
    
    // Read chat history
    const chatHistoryPath = path.join(TABCHAT_DIR, project.safeName, 'history.json');
    let chatHistory = [];
    if (await fs.pathExists(chatHistoryPath)) {
      chatHistory = await fs.readJson(chatHistoryPath);
    }
    
    const exportData = {
      project,
      chatHistory,
      exportedAt: new Date().toISOString(),
      version: '1.0.0'
    };
    
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="${project.safeName}_export.json"`);
    res.json(exportData);
  } catch (err) {
    console.error('Error exporting project:', err);
    res.status(500).json({ error: 'Failed to export project' });
  }
});

// POST /api/projects/import - Import project from JSON
router.post('/projects/import', async (req, res) => {
  try {
    const { project, chatHistory } = req.body;
    
    if (!project || !project.name) {
      return res.status(400).json({ error: 'Invalid import data' });
    }
    
    const id = uuidv4();
    const now = new Date().toISOString();
    
    // Check if workspace exists, if not create minimal structure
    const workspacePath = path.join(WORKSPACE_DIR, project.safeName || project.name.replace(/[^a-zA-Z0-9_-]/g, '_'));
    if (!(await fs.pathExists(workspacePath))) {
      await fs.ensureDir(workspacePath);
    }
    
    // Import chat history if provided
    if (chatHistory && Array.isArray(chatHistory)) {
      const tabchatPath = path.join(TABCHAT_DIR, project.safeName || project.name.replace(/[^a-zA-Z0-9_-]/g, '_'));
      await fs.ensureDir(tabchatPath);
      await fs.writeJson(path.join(tabchatPath, 'history.json'), chatHistory, { spaces: 2 });
    }
    
    const importedProject = {
      ...project,
      id,
      safeName: project.safeName || project.name.replace(/[^a-zA-Z0-9_-]/g, '_'),
      createdAt: now,
      updatedAt: now
    };
    
    const projects = getProjects();
    projects.push(importedProject);
    saveProjects(projects);
    
    console.log(`📥 Imported project: ${project.name}`);
    res.status(201).json(importedProject);
  } catch (err) {
    console.error('Error importing project:', err);
    res.status(500).json({ error: 'Failed to import project' });
  }
});

module.exports = router;
