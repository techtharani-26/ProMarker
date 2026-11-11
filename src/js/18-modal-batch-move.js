function openBatchMoveModal() {
  const { categories } = AppState.data;
  const catTree = getCategoryTree(categories);
  const modalContainer = document.getElementById('modal-container');
  modalContainer.innerHTML = `
    <div class="modal-overlay active">
      <div class="modal">
        <div class="modal-header">
          <h3 class="modal-title">Move ${AppState.selectedIds.size} Selected Links</h3>
          <button class="btn btn-icon-only" id="btn-close-modal">
            <svg class="icon"><use href="#icon-x"/></svg>
          </button>
        </div>

        <div class="modal-body">
          <div class="form-group">
            <label class="form-label" for="batch-cat-select">Move to category</label>
            <select class="form-select" id="batch-cat-select">
              ${catTree.map(({ cat: c, depth }) => `<option value="${c.id}" data-depth="${depth}">${escapeHTML(getCategoryPathString(c.id, categories))}</option>`).join('')}
            </select>
          </div>
        </div>

        <div class="modal-footer">
          <button class="btn btn-secondary" id="btn-cancel-modal">Cancel</button>
          <button class="btn btn-primary" id="btn-confirm-batch-move">Move Links</button>
        </div>
      </div>
    </div>
  `;

  enhanceCategorySelect(document.getElementById('batch-cat-select'));
  const closeModal = () => { modalContainer.innerHTML = ''; };
  document.getElementById('btn-close-modal').onclick = closeModal;
  document.getElementById('btn-cancel-modal').onclick = closeModal;

  document.getElementById('btn-confirm-batch-move').onclick = () => {
    const targetCatId = document.getElementById('batch-cat-select').value;
    const targetCat = categories.find(c => c.id === targetCatId);
    AppState.recordAction(`Move Selected to "${targetCat ? targetCat.name : 'Category'}"`);
    AppState.data.bookmarks.forEach(b => {
      if (AppState.selectedIds.has(b.id)) {
        b.categoryId = targetCatId;
        b.isTrash = false;
      }
    });
    const count = AppState.selectedIds.size;
    AppState.selectedIds.clear();
    AppState.saveDirty();
    showToast(`Moved ${count} links successfully`, 'success', {
      label: 'Undo',
      onClick: () => HistoryManager.undo()
    });
    closeModal();
    renderApp();
  };
}
