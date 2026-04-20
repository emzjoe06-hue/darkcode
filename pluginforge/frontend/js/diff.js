/**
 * Diff Viewer Utility
 */

const DiffViewer = {
  /**
   * Generate simple line-by-line diff
   */
  generateDiff(oldContent, newContent) {
    const oldLines = oldContent.split('\n');
    const newLines = newContent.split('\n');
    
    const diff = [];
    const maxLen = Math.max(oldLines.length, newLines.length);
    
    for (let i = 0; i < maxLen; i++) {
      const oldLine = oldLines[i];
      const newLine = newLines[i];
      
      if (oldLine === undefined) {
        diff.push({ type: 'added', content: newLine, lineNum: i + 1 });
      } else if (newLine === undefined) {
        diff.push({ type: 'removed', content: oldLine, lineNum: i + 1 });
      } else if (oldLine === newLine) {
        diff.push({ type: 'unchanged', content: oldLine, lineNum: i + 1 });
      } else {
        diff.push({ type: 'removed', content: oldLine, lineNum: i + 1 });
        diff.push({ type: 'added', content: newLine, lineNum: i + 1 });
      }
    }
    
    return diff;
  },
  
  /**
   * Render diff to HTML
   */
  render(diff, container) {
    container.innerHTML = '';
    
    const addedCount = diff.filter(d => d.type === 'added').length;
    const removedCount = diff.filter(d => d.type === 'removed').length;
    
    // Header with stats
    const header = document.createElement('div');
    header.className = 'diff-header';
    header.innerHTML = `+${addedCount} -${removedCount} lines changed`;
    container.appendChild(header);
    
    // Diff lines
    diff.forEach(line => {
      const div = document.createElement('div');
      div.className = `diff-line diff-line-${line.type}`;
      
      const prefix = line.type === 'added' ? '+' : line.type === 'removed' ? '-' : ' ';
      div.textContent = `${prefix} ${line.content}`;
      
      container.appendChild(div);
    });
  },
  
  /**
   * Show diff in modal
   */
  showInModal(fileName, oldContent, newContent) {
    const modal = document.getElementById('diff-modal');
    const content = document.getElementById('diff-content');
    
    const diff = this.generateDiff(oldContent, newContent);
    content.innerHTML = `<h3 style="margin-bottom: 16px;">${fileName}</h3>`;
    this.render(diff, content);
    
    modal.classList.remove('hidden');
  }
};
