const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs-extra');

const ROOT_DIR = path.resolve(__dirname, '../..');
const DATA_DIR = path.join(ROOT_DIR, 'data');
const SETTINGS_FILE = path.join(DATA_DIR, 'settings.json');

// GET /api/settings - Get settings
router.get('/', async (req, res) => {
  try {
    if (!await fs.pathExists(SETTINGS_FILE)) {
      await fs.ensureDir(DATA_DIR);
      await fs.writeJson(SETTINGS_FILE, {
        apiKey: '',
        defaultModel: 'kilo-auto/free',
        defaultReasoningMode: 'MEDIUM',
        defaultMcVersion: '1.21',
        defaultServerType: 'Paper',
        defaultJavaVersion: '17'
      }, { spaces: 2 });
    }
    
    const settings = await fs.readJson(SETTINGS_FILE);
    // Don't expose API key in full
    res.json({
      ...settings,
      apiKey: settings.apiKey ? settings.apiKey.substring(0, 8) + '...' : ''
    });
  } catch (err) {
    console.error('Error getting settings:', err);
    res.status(500).json({ error: 'Failed to get settings' });
  }
});

// PUT /api/settings - Update settings
router.put('/', async (req, res) => {
  try {
    const { apiKey, defaultModel, defaultReasoningMode, defaultMcVersion, defaultServerType, defaultJavaVersion } = req.body;
    
    let settings = {};
    if (await fs.pathExists(SETTINGS_FILE)) {
      settings = await fs.readJson(SETTINGS_FILE);
    }
    
    // Update only provided fields
    if (apiKey !== undefined) settings.apiKey = apiKey;
    if (defaultModel !== undefined) settings.defaultModel = defaultModel;
    if (defaultReasoningMode !== undefined) settings.defaultReasoningMode = defaultReasoningMode;
    if (defaultMcVersion !== undefined) settings.defaultMcVersion = defaultMcVersion;
    if (defaultServerType !== undefined) settings.defaultServerType = defaultServerType;
    if (defaultJavaVersion !== undefined) settings.defaultJavaVersion = defaultJavaVersion;
    
    await fs.writeJson(SETTINGS_FILE, settings, { spaces: 2 });
    
    console.log('✅ Settings updated');
    res.json({ success: true, settings });
  } catch (err) {
    console.error('Error updating settings:', err);
    res.status(500).json({ error: 'Failed to update settings' });
  }
});

module.exports = router;
