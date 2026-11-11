/* --------------------------------------------------------------------------
   1B. HISTORY MANAGER (Undo / Redo Stack)
   -------------------------------------------------------------------------- */
const HistoryManager = {
  undoStack: [],
  redoStack: [],
  maxStackSize: 50,
  isTraversing: false,

  pushState(description = 'change') {
    if (this.isTraversing) return;
    try {
      const snapshot = JSON.parse(JSON.stringify(AppState.data));
      this.undoStack.push({ data: snapshot, description });
      if (this.undoStack.length > this.maxStackSize) {
        this.undoStack.shift();
      }
      this.redoStack = [];
    } catch (e) {
      console.warn('History pushState error:', e);
    }
  },

  undo() {
    if (!this.canUndo()) return false;
    try {
      this.isTraversing = true;
      const currentSnapshot = JSON.parse(JSON.stringify(AppState.data));
      const prevEntry = this.undoStack.pop();
      this.redoStack.push({ data: currentSnapshot, description: prevEntry.description });

      AppState.data = prevEntry.data;
      applyTheme(AppState.data.settings.theme || 'system'); // an undone import/reset may have changed it
      AppState.saveDirty();
      AppState.notify();
      showToast(`Undid: ${prevEntry.description || 'action'}`, 'info');
      return true;
    } catch (e) {
      console.error('History undo error:', e);
      return false;
    } finally {
      this.isTraversing = false;
    }
  },

  redo() {
    if (!this.canRedo()) return false;
    try {
      this.isTraversing = true;
      const currentSnapshot = JSON.parse(JSON.stringify(AppState.data));
      const nextEntry = this.redoStack.pop();
      this.undoStack.push({ data: currentSnapshot, description: nextEntry.description });

      AppState.data = nextEntry.data;
      applyTheme(AppState.data.settings.theme || 'system'); // an undone import/reset may have changed it
      AppState.saveDirty();
      AppState.notify();
      showToast(`Redid: ${nextEntry.description || 'action'}`, 'info');
      return true;
    } catch (e) {
      console.error('History redo error:', e);
      return false;
    } finally {
      this.isTraversing = false;
    }
  },

  canUndo() {
    return this.undoStack.length > 0;
  },

  canRedo() {
    return this.redoStack.length > 0;
  }
};
