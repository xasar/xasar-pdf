// ── Symbol Picker ─────────────────────────────────────────────────────────────
SYMBOLS.forEach(s => {
  const btn = document.createElement('button');
  btn.className   = 'sym-btn';
  btn.textContent = s.sym;
  btn.title       = s.title;
  btn.addEventListener('mousedown', e => {
    e.stopPropagation();
    symbolGrid.querySelectorAll('.sym-btn').forEach(b => b.classList.remove('selected'));
    btn.classList.add('selected');
    pendingSymbol = s.sym;
    showToast('Click on PDF to place ' + s.title, 'info');
    symbolPanel.classList.remove('open');
  });
  symbolGrid.appendChild(btn);
});

symSizeSlider.addEventListener('input', () => {
  pendingSymbolSize = parseInt(symSizeSlider.value);
  symSizeLabel.textContent = pendingSymbolSize + 'px';
});

function openSymbolPanel() {
  const btn     = document.getElementById('tool-symbol');
  const btnRect = btn.getBoundingClientRect();
  symbolPanel.style.left = btnRect.left + 'px';
  symbolPanel.style.top  = (btnRect.bottom + 6) + 'px';
  symbolPanel.classList.add('open');
}

// ── Highlight Colour Swatches (FIX: updates dynamic <style> tag) ──────────────
function updateHlSelStyle(color) {
  const r = parseInt(color.slice(1,3), 16);
  const g = parseInt(color.slice(3,5), 16);
  const b = parseInt(color.slice(5,7), 16);
  hlSelStyle.textContent = `.tool-highlight .text-layer ::selection{background:rgba(${r},${g},${b},0.45);}`;
}

HIGHLIGHT_COLORS.forEach(c => {
  const s = document.createElement('div');
  s.className    = 'color-swatch' + (c.color === highlightColor ? ' active' : '');
  s.style.background = c.color;
  s.title = c.name;
  s.addEventListener('click', e => {
    e.stopPropagation();
    highlightColor = c.color;
    updateHlSelStyle(c.color);
    colorGrid.querySelectorAll('.color-swatch').forEach(el => el.classList.remove('active'));
    s.classList.add('active');
  });
  colorGrid.appendChild(s);
});

updateHlSelStyle(highlightColor); // init

// ── Tool Switching ────────────────────────────────────────────────────────────
function setTool(tool) {
  currentTool = tool;
  document.querySelectorAll('.tb-btn[data-tool]').forEach(b => b.classList.remove('active'));
  const btn = document.querySelector('[data-tool="' + tool + '"]');
  if (btn) btn.classList.add('active');
  viewerArea.className = 'viewer-area tool-' + tool;
  closeActiveTextOptions();
  hlPopover.classList.remove('open');
  if (tool !== 'symbol') { symbolPanel.classList.remove('open'); pendingSymbol = null; }
}

document.querySelectorAll('.tb-btn[data-tool]').forEach(btn => {
  btn.addEventListener('click', e => {
    const tool = btn.dataset.tool;
    if (tool === 'highlight') {
      setTool('highlight');
      hlPopover.classList.toggle('open');
      return;
    }
    if (tool === 'symbol') {
      const wasOpen = symbolPanel.classList.contains('open');
      setTool('symbol');
      if (!wasOpen) openSymbolPanel();
      else symbolPanel.classList.remove('open');
      return;
    }
    if (tool === 'image') {
      setTool('image');
      pageContainer.addEventListener('click', function onceClick(e2) {
        if (e2.target.closest('.text-annotation') || e2.target.closest('.image-annotation')) return;
        const rect = pageContainer.getBoundingClientRect();
        imagePlacePos = { x:(e2.clientX-rect.left)/rect.width, y:(e2.clientY-rect.top)/rect.height };
        imageInput.click();
        pageContainer.removeEventListener('click', onceClick);
      }, { once: false });
      return;
    }
    setTool(tool);
  });
});

// Close popovers on outside click
document.addEventListener('click', e => {
  if (!e.target.closest('[data-tool="highlight"]')) hlPopover.classList.remove('open');
  if (!e.target.closest('[data-tool="symbol"]') && !e.target.closest('#symbol-picker-panel')) symbolPanel.classList.remove('open');
  if (!e.target.closest('.text-annotation') && !e.target.closest('.text-formatter-tooltip')) closeActiveTextOptions();
});

// ── Clear Annotations ─────────────────────────────────────────────────────────
document.getElementById('btn-clear-page').addEventListener('click', () => {
  annotations[pageKey(currentPage)] = { highlights:[], texts:[], images:[], symbols:[] };
  renderAnnotations(currentPage);
  updateAnnCount();
  showToast('Page annotations cleared', 'info');
});

document.getElementById('btn-clear-all').addEventListener('click', () => {
  annotations = {};
  renderAnnotations(currentPage);
  updateAnnCount();
  showToast('All annotations cleared', 'info');
});

// ── Page Manager ──────────────────────────────────────────────────────────────
let modalDragSrc = null;

async function openPageModal() {
  pageModal.classList.add('open');
  modalPagesGrid.innerHTML = '';
  for (let i = 0; i < pageOrder.length; i++) {
    const displayNum = i + 1;
    const sourceIdx  = pageOrder[i];
    const wrap = document.createElement('div');
    wrap.className   = 'modal-page-thumb' + (displayNum === currentPage ? ' active' : '');
    wrap.dataset.display = displayNum;
    wrap.draggable = true;

    const thumbCanvas = document.createElement('canvas');
    if (typeof sourceIdx === 'string' && sourceIdx.startsWith('blank')) {
      thumbCanvas.width = 100; thumbCanvas.height = 141;
      const tc = thumbCanvas.getContext('2d');
      tc.fillStyle = '#fff'; tc.fillRect(0,0,100,141);
      tc.strokeStyle = '#ccc'; tc.strokeRect(1,1,98,139);
    } else {
      try {
        const pg = await pdfDoc.getPage(sourceIdx);
        const vp = pg.getViewport({ scale: 100 / pg.getViewport({scale:1}).width });
        thumbCanvas.width = vp.width; thumbCanvas.height = vp.height;
        await pg.render({ canvasContext: thumbCanvas.getContext('2d'), viewport: vp }).promise;
      } catch (e) {}
    }
    wrap.appendChild(thumbCanvas);

    const numEl = document.createElement('div');
    numEl.className = 'mpt-num'; numEl.textContent = 'Page ' + displayNum;
    wrap.appendChild(numEl);

    const delBtn = document.createElement('button');
    delBtn.className = 'mpt-del';
    delBtn.innerHTML = '<i class="fas fa-trash"></i>';
    delBtn.addEventListener('click', e => { e.stopPropagation(); deletePage(displayNum); pageModal.classList.remove('open'); });
    wrap.appendChild(delBtn);

    wrap.addEventListener('click', () => { goToPage(displayNum); pageModal.classList.remove('open'); });
    wrap.addEventListener('dragstart', e => { modalDragSrc = displayNum; e.dataTransfer.effectAllowed = 'move'; });
    wrap.addEventListener('dragover',  e => { e.preventDefault(); wrap.classList.add('drag-over'); });
    wrap.addEventListener('dragleave', () => wrap.classList.remove('drag-over'));
    wrap.addEventListener('drop', e => {
      e.preventDefault(); wrap.classList.remove('drag-over');
      if (modalDragSrc && modalDragSrc !== displayNum) { reorderPage(modalDragSrc, displayNum); openPageModal(); }
    });
    modalPagesGrid.appendChild(wrap);
  }
}

document.getElementById('btn-page-manager').addEventListener('click', openPageModal);
document.getElementById('pp-manage').addEventListener('click', openPageModal);
document.getElementById('pp-add').addEventListener('click', () => addBlankPage(currentPage));
document.getElementById('modal-close').addEventListener('click', () => pageModal.classList.remove('open'));
document.getElementById('modal-close-btn').addEventListener('click', () => pageModal.classList.remove('open'));
document.getElementById('modal-add-blank').addEventListener('click', () => { addBlankPage(currentPage); openPageModal(); });
pageModal.addEventListener('click', e => { if (e.target === pageModal) pageModal.classList.remove('open'); });

// ── Keyboard Shortcuts (FIX: disabled when text tool active) ──────────────────
document.addEventListener('keydown', e => {
  if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.isContentEditable) return;
  if (currentTool === 'text') return; // disable shortcuts while typing
  switch (e.key.toLowerCase()) {
    case 'h': setTool('hand'); break;
    case 'l': setTool('highlight'); break;
    case 't': setTool('text'); break;
    case 'i': setTool('image'); break;
    case 's': setTool('symbol'); openSymbolPanel(); break;
    case 'arrowleft':  if (currentPage > 1)               goToPage(currentPage - 1); break;
    case 'arrowright': if (currentPage < pageOrder.length) goToPage(currentPage + 1); break;
    case 'escape':
      pageModal.classList.remove('open');
      closeActiveTextOptions();
      symbolPanel.classList.remove('open');
      hlPopover.classList.remove('open');
      if (currentTool !== 'hand') setTool('hand');
      break;
  }
  if ((e.ctrlKey || e.metaKey) && e.key === '+') { e.preventDefault(); setZoom(scale + 0.15); }
  if ((e.ctrlKey || e.metaKey) && e.key === '-') { e.preventDefault(); setZoom(scale - 0.15); }
  if ((e.ctrlKey || e.metaKey) && e.key === '0') { e.preventDefault(); fitToWidth(); }
});