/**
 * Chat Module - Handles AI communication and message rendering
 */

const Chat = {
  state: {
    isStreaming: false,
    currentMessage: ''
  },
  
  init() {
    this.chatHistory = document.getElementById('chat-history');
    this.chatInput = document.getElementById('chat-input');
    this.sendBtn = document.getElementById('send-btn');
    this.clearChatBtn = document.getElementById('clear-chat-btn');
    this.undoBtn = document.getElementById('undo-btn');
    this.pinnedMessages = document.getElementById('pinned-messages');
    
    // Event listeners
    this.sendBtn?.addEventListener('click', () => this.sendMessage());
    this.clearChatBtn?.addEventListener('click', () => this.clearChat());
    this.undoBtn?.addEventListener('click', () => this.undoLastMessage());
    
    this.chatInput?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        this.sendMessage();
      }
    });
    
    // Configure marked.js for markdown rendering
    if (typeof marked !== 'undefined') {
      marked.setOptions({
        highlight: (code, lang) => {
          if (typeof hljs !== 'undefined' && hljs.getLanguage(lang)) {
            return hljs.highlight(code, { language: lang }).value;
          }
          return code;
        },
        breaks: true,
        gfm: true
      });
    }
  },
  
  async loadHistory(projectId) {
    try {
      const response = await fetch(`/api/projects/${projectId}/chat`);
      const history = await response.json();
      
      this.chatHistory.innerHTML = '';
      
      if (history.length === 0) {
        this.showWelcome();
        return;
      }
      
      history.forEach(msg => this.renderMessage(msg.role, msg.content, msg.timestamp, msg.pinned));
      this.scrollToBottom();
    } catch (err) {
      console.error('Failed to load chat history:', err);
    }
  },
  
  showWelcome() {
    this.chatHistory.innerHTML = `
      <div class="welcome-message">
        <h2>👋 Welcome to PluginForge AI</h2>
        <p>Select a project from the left panel or create a new one to get started.</p>
        <div class="quick-start">
          <h3>Quick Start:</h3>
          <ol>
            <li>Click "New Project" to create a plugin</li>
            <li>Describe your plugin idea in the chat</li>
            <li>Review the generated code in the Files panel</li>
            <li>Build and download your JAR</li>
          </ol>
        </div>
      </div>
    `;
  },
  
  renderMessage(role, content, timestamp = null, pinned = false) {
    const div = document.createElement('div');
    div.className = `message message-${role}`;
    
    const timeStr = timestamp ? new Date(timestamp).toLocaleTimeString() : '';
    
    // Render markdown for assistant messages
    const renderedContent = role === 'assistant' && typeof marked !== 'undefined' 
      ? marked.parse(content) 
      : this.escapeHtml(content);
    
    div.innerHTML = `
      <div class="message-content">
        ${renderedContent}
        <div class="message-actions">
          ${role === 'assistant' ? `<button class="btn-icon-only pin-btn" title="Pin message">📌</button>` : ''}
          <button class="btn-icon-only copy-btn" title="Copy">📋</button>
          <span class="message-timestamp">${timeStr}</span>
        </div>
      </div>
    `;
    
    // Pin button handler
    const pinBtn = div.querySelector('.pin-btn');
    if (pinBtn) {
      pinBtn.addEventListener('click', () => this.togglePinMessage(content, pinned));
      if (pinned) pinBtn.style.color = 'var(--accent)';
    }
    
    // Copy button handler
    const copyBtn = div.querySelector('.copy-btn');
    if (copyBtn) {
      copyBtn.addEventListener('click', () => {
        navigator.clipboard.writeText(content);
        Toast.success('Message copied');
      });
    }
    
    this.chatHistory.appendChild(div);
    
    // Apply syntax highlighting to code blocks
    if (role === 'assistant' && typeof hljs !== 'undefined') {
      div.querySelectorAll('pre code').forEach(block => {
        hljs.highlightElement(block);
      });
    }
  },
  
  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  },
  
  async sendMessage() {
    const message = this.chatInput.value.trim();
    if (!message || this.state.isStreaming) return;
    
    if (!App.state.currentProject) {
      Toast.error('Please select a project first');
      return;
    }
    
    // Check API key
    const settings = await App.getSettings();
    if (!settings.apiKey) {
      Toast.warning('Please set your API key in Settings');
      document.getElementById('settings-btn').click();
      return;
    }
    
    // Clear input
    this.chatInput.value = '';
    
    // Remove welcome message if present
    const welcome = this.chatHistory.querySelector('.welcome-message');
    if (welcome) welcome.remove();
    
    // Render user message
    this.renderMessage('user', message);
    this.scrollToBottom();
    
    // Get model and reasoning mode from UI
    const model = document.getElementById('model-select')?.value || 'kilo-auto/free';
    const reasoningMode = document.querySelector('.reasoning-btn.active')?.dataset.mode || 'MEDIUM';
    
    // Create placeholder for streaming response
    const responseDiv = document.createElement('div');
    responseDiv.className = 'message message-assistant';
    responseDiv.innerHTML = `
      <div class="message-content">
        <div class="streaming-content"></div>
        <div class="message-actions">
          <button class="btn-icon-only pin-btn" title="Pin message">📌</button>
          <button class="btn-icon-only copy-btn" title="Copy">📋</button>
        </div>
      </div>
    `;
    this.chatHistory.appendChild(responseDiv);
    
    this.state.isStreaming = true;
    this.state.currentMessage = '';
    this.sendBtn.disabled = true;
    
    const streamingContent = responseDiv.querySelector('.streaming-content');
    
    try {
      const response = await fetch(`/api/projects/${App.state.currentProject.id}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message, model, reasoningMode })
      });
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        
        const chunk = decoder.decode(value);
        const lines = chunk.split('\n');
        
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6);
            if (data === '[DONE]') continue;
            
            try {
              const parsed = JSON.parse(data);
              
              if (parsed.type === 'files_written') {
                Toast.success(`${parsed.files.length} files written`);
                FileTree.loadTree(App.state.currentProject.id);
              } else if (parsed.content) {
                this.state.currentMessage += parsed.content;
                streamingContent.innerHTML = marked.parse(this.state.currentMessage);
                
                // Highlight code blocks
                streamingContent.querySelectorAll('pre code').forEach(block => {
                  hljs.highlightElement(block);
                });
                
                this.scrollToBottom();
              }
            } catch (e) {
              // Skip invalid JSON
            }
          }
        }
      }
      
      // Setup pin and copy buttons for final message
      const finalContent = this.state.currentMessage;
      const pinBtn = responseDiv.querySelector('.pin-btn');
      const copyBtn = responseDiv.querySelector('.copy-btn');
      
      pinBtn.addEventListener('click', () => this.togglePinMessage(finalContent, false));
      copyBtn.addEventListener('click', () => {
        navigator.clipboard.writeText(finalContent);
        Toast.success('Message copied');
      });
      
      // Re-highlight all code
      responseDiv.querySelectorAll('pre code').forEach(block => {
        hljs.highlightElement(block);
      });
      
    } catch (err) {
      console.error('Chat error:', err);
      streamingContent.innerHTML += `\n\n**Error:** ${err.message}`;
      Toast.error('Failed to get response');
    } finally {
      this.state.isStreaming = false;
      this.sendBtn.disabled = false;
      this.scrollToBottom();
    }
  },
  
  togglePinMessage(content, currentlyPinned) {
    // For now, just show toast - full pin implementation would save to backend
    if (currentlyPinned) {
      Toast.info('Message unpinned');
    } else {
      Toast.success('Message pinned');
      this.renderPinnedMessage(content);
    }
  },
  
  renderPinnedMessage(content) {
    // Strip markdown for pinned display
    const plainText = content.replace(/[*#`\[\]]/g, '').substring(0, 100) + '...';
    
    const div = document.createElement('div');
    div.className = 'pinned-message';
    div.innerHTML = `
      <span class="pin-icon">📌</span>
      <span>${this.escapeHtml(plainText)}</span>
    `;
    
    this.pinnedMessages.appendChild(div);
    this.pinnedMessages.classList.remove('hidden');
  },
  
  async clearChat() {
    if (!App.state.currentProject) return;
    
    if (!confirm('Clear chat history for this project?')) return;
    
    try {
      await fetch(`/api/projects/${App.state.currentProject.id}/chat`, { method: 'DELETE' });
      this.chatHistory.innerHTML = '';
      this.showWelcome();
      this.pinnedMessages.innerHTML = '';
      this.pinnedMessages.classList.add('hidden');
      Toast.success('Chat cleared');
    } catch (err) {
      console.error('Failed to clear chat:', err);
      Toast.error('Failed to clear chat');
    }
  },
  
  undoLastMessage() {
    // Simple implementation - remove last assistant message
    const messages = this.chatHistory.querySelectorAll('.message');
    if (messages.length >= 2) {
      messages[messages.length - 1].remove();
      messages[messages.length - 2].remove();
      Toast.info('Last exchange undone');
    }
  },
  
  scrollToBottom() {
    this.chatHistory.scrollTop = this.chatHistory.scrollHeight;
  }
};
