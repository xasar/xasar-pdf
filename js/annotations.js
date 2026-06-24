// ── Render all annotations for a page ─────────────────────────────────────────
function renderAnnotations(displayNum) {
  closeActiveTextOptions();
  annotationLayer.innerHTML = '';
  const key  = pageKey(displayNum);
  const anns = annotations[key] || getAnnotations(key);

  anns.highlights.forEach(hl => {
    hl.rects.forEach(r => {
      const div = document.createElement('div');
      div.className = 'hl-rect';
      div.style.cssText = `left:${r.x*100}%;top:${r.y*100}%;width:${r.w*100}%;height:${r.h*100}%;background:${hl.color};opacity:0.38;`;
      annotationLayer.appendChild(div);
    });
  });

  anns.texts.forEach(t   => createTextElement(t));
  anns.images.forEach(img => createImageElement(img));
  (anns.symbols || []).forEach(s => createSymbolElement(s));
}

function closeActiveTextOptions() {
  pageContainer.querySelectorAll('.text-formatter-tooltip').forEach(t => t.remove());
  document.querySelectorAll('.text-annotation-editing').forEach(el => {
    el.classList.remove('text-annotation-editing');
    el.style.border = '1px solid transparent';
  });
  activeTextId = null;
}

// ── Color Popup builder ───────────────────────────────────────────────────────
function buildColorPopup(currentColor, onChange) {
  const popup = document.createElement('div');
  popup.className = 'color-popup';

  const grid = document.createElement('div');
  grid.className = 'color-popup-swatches';

  TEXT_COLORS.forEach(hex => {
    const sw = document.createElement('div');
    sw.className = 'color-popup-swatch' + (hex === currentColor ? ' selected' : '');
    sw.style.backgroundColor = hex;
    sw.title = hex;
    sw.addEventListener('mousedown', e => {
      e.preventDefault(); e.stopPropagation();
      grid.querySelectorAll('.color-popup-swatch').forEach(s => s.classList.remove('selected'));
      sw.classList.add('selected');
      hexInput.value = hex; colorInput.value = hex;
      onChange(hex);
      popup.classList.remove('open');
    });
    grid.appendChild(sw);
  });

  const hexRow     = document.createElement('div');  hexRow.className = 'color-popup-hex';
  const colorInput = document.createElement('input'); colorInput.type  = 'color'; colorInput.value = currentColor;
  const hexInput   = document.createElement('input'); hexInput.type    = 'text';  hexInput.value   = currentColor; hexInput.maxLength = 7;

  colorInput.addEventListener('input',  () => { hexInput.value = colorInput.value; onChange(colorInput.value); });
  hexInput.addEventListener('change', () => {
    if (/^#[0-9a-fA-F]{6}$/.test(hexInput.value)) { colorInput.value = hexInput.value; onChange(hexInput.value); }
  });

  hexRow.appendChild(colorInput);
  hexRow.appendChild(hexInput);
  popup.appendChild(grid);
  popup.appendChild(hexRow);
  return popup;
}

// ── Text Formatter Tooltip ────────────────────────────────────────────────────
function attachTextFormatterTooltip(parentEl, data, targetField) {
  parentEl.querySelectorAll('.text-formatter-tooltip').forEach(t => t.remove());
  const tooltip = document.createElement('div');
  tooltip.className = 'text-formatter-tooltip';

  const fontSelect = document.createElement('select');
  fontSelect.className = 'font-select';
  ['Times','Helvetica','Courier'].forEach(f => {
    const o = document.createElement('option');
    o.value = f; o.textContent = f;
    if ((data.font || 'Times') === f) o.selected = true;
    fontSelect.appendChild(o);
  });
  fontSelect.onchange = () => {
    data.font = fontSelect.value;
    const ff = fontSelect.value === 'Times' ? 'Times New Roman' : fontSelect.value;
    parentEl.style.fontFamily = ff;
    if (targetField) targetField.style.fontFamily = ff;
  };

  const sizeSelect = document.createElement('select');
  sizeSelect.className = 'size-select';
  [8,9,10,11,12,14,16,18,20,24,28,32,36,48,72].forEach(sz => {
    const o = document.createElement('option');
    o.value = sz; o.textContent = sz + 'pt';
    if ((data.size || 12) === sz) o.selected = true;
    sizeSelect.appendChild(o);
  });
  sizeSelect.onchange = () => {
    data.size = parseInt(sizeSelect.value);
    parentEl.style.fontSize = (data.size * scale) + 'px';
    if (targetField) targetField.style.fontSize = (data.size * scale) + 'px';
  };

  const d1 = document.createElement('div'); d1.className = 'divider';

  const btnBold = document.createElement('button');
  btnBold.className = 'style-btn' + (data.isBold ? ' active' : '');
  btnBold.innerHTML = '<b>B</b>'; btnBold.title = 'Bold';
  btnBold.onclick = () => {
    data.isBold = !data.isBold;
    parentEl.style.fontWeight = data.isBold ? 'bold' : 'normal';
    if (targetField) targetField.style.fontWeight = data.isBold ? 'bold' : 'normal';
    btnBold.classList.toggle('active');
  };

  const btnItalic = document.createElement('button');
  btnItalic.className = 'style-btn' + (data.isItalic ? ' active' : '');
  btnItalic.innerHTML = '<i>I</i>'; btnItalic.title = 'Italic';
  btnItalic.onclick = () => {
    data.isItalic = !data.isItalic;
    parentEl.style.fontStyle = data.isItalic ? 'italic' : 'normal';
    if (targetField) targetField.style.fontStyle = data.isItalic ? 'italic' : 'normal';
    btnItalic.classList.toggle('active');
  };

  const d2 = document.createElement('div'); d2.className = 'divider';

  const colorBlock  = document.createElement('div');
  colorBlock.className = 'color-picker-block';
  colorBlock.style.backgroundColor = data.color || '#000000';
  colorBlock.title = 'Text color';

  const colorPopup = buildColorPopup(data.color || '#000000', newColor => {
    data.color = newColor;
    colorBlock.style.backgroundColor = newColor;
    parentEl.style.color = newColor;
    if (targetField) targetField.style.color = newColor;
  });
  tooltip.appendChild(colorPopup);

  colorBlock.addEventListener('mousedown', e => {
    e.preventDefault(); e.stopPropagation();
    colorPopup.classList.toggle('open');
  });

  const d3 = document.createElement('div'); d3.className = 'divider';

  const btnDel = document.createElement('button');
  btnDel.className = 'delete-btn'; btnDel.title = 'Delete text';
  btnDel.innerHTML = '<i class="fas fa-trash"></i>';
  btnDel.onclick = e => { e.stopPropagation(); deleteAnnotation(data.id); };

  tooltip.append(fontSelect, sizeSelect, d1, btnBold, btnItalic, d2, colorBlock, d3, btnDel);
  parentEl.appendChild(tooltip);

  requestAnimationFrame(() => {
    const tipRect = tooltip.getBoundingClientRect();
    if (tipRect.top < 0) { tooltip.style.bottom = 'auto'; tooltip.style.top = 'calc(100% + 8px)'; }
  });

  document.addEventListener('mousedown', function handler(e) {
    if (!colorPopup.contains(e.target) && e.target !== colorBlock) colorPopup.classList.remove('open');
    if (!tooltip.contains(e.target) && !parentEl.contains(e.target)) document.removeEventListener('mousedown', handler);
  });
}

// ── Create Text Element ───────────────────────────────────────────────────────
function createTextElement(data) {
  const el = document.createElement('div');
  el.className   = 'text-annotation';
  el.dataset.id  = data.id;
  el.style.left       = (data.x * 100) + '%';
  el.style.top        = (data.y * 100) + '%';
  el.style.fontSize   = ((data.size || 12) * scale) + 'px';
  el.style.fontFamily = (data.font || 'Times') === 'Times' ? 'Times New Roman' : (data.font || 'Times');
  el.style.fontWeight = data.isBold ? 'bold' : 'normal';
  el.style.fontStyle  = data.isItalic ? 'italic' : 'normal';
  el.style.color      = data.color || '#000000';
  el.style.width      = data.w ? (data.w * 100) + '%' : 'auto';
  el.style.maxWidth   = data.maxW ? (data.maxW * 100) + '%' : '90%';
  el.textContent      = data.content;

  const handle = document.createElement('div');
  handle.className = 'text-width-handle';
  handle.addEventListener('mousedown', e => { e.stopPropagation(); e.preventDefault(); startTextWidthResize(e, el, data); });
  el.appendChild(handle);

  el.addEventListener('click', e => {
    e.stopPropagation();
    if (currentTool === 'text' && !e.target.closest('.text-width-handle')) {
      el.classList.add('text-annotation-editing');
      el.style.border = '1px dashed rgba(0,0,0,0.3)';
      attachTextFormatterTooltip(el, data, null);
    }
  });
  el.addEventListener('dblclick', e => { e.stopPropagation(); convertTextToInput(el, data); });
  el.addEventListener('mousedown', e => {
    if (e.target.closest('.text-formatter-tooltip') || e.target.closest('.text-width-handle') || e.target.tagName === 'INPUT') return;
    e.stopPropagation();
    startDrag(e, el, data, 'text');
  });

  annotationLayer.appendChild(el);
  return el;
}

// ── Convert Text to Editable Input ───────────────────────────────────────────
function convertTextToInput(el, data) {
  closeActiveTextOptions();
  el.innerHTML = '';
  el.classList.add('text-annotation-editing');
  el.style.border = '1px dashed rgba(0,0,0,0.4)';

  const field = document.createElement('input');
  field.type = 'text'; field.className = 'text-input-overlay-box'; field.value = data.content;

  const handle = document.createElement('div');
  handle.className = 'text-width-handle'; handle.style.display = 'block';
  handle.addEventListener('mousedown', e => { e.stopPropagation(); e.preventDefault(); startTextWidthResize(e, el, data); });

  el.appendChild(field); el.appendChild(handle);
  attachTextFormatterTooltip(el, data, field);
  requestAnimationFrame(() => { field.focus(); field.setSelectionRange(field.value.length, field.value.length); });

  function commit() {
    const txt = field.value.trim();
    if (txt) { data.content = txt; renderAnnotations(currentPage); }
    else deleteAnnotation(data.id);
  }

  field.onblur = () => setTimeout(() => {
    if (document.activeElement === field || document.activeElement.closest('.text-formatter-tooltip')) return;
    commit();
  }, 150);
  field.onkeydown = ev => {
    if (ev.key === 'Enter') commit();
    if (ev.key === 'Escape') { renderAnnotations(currentPage); closeActiveTextOptions(); }
  };
}

// ── Symbol Element ────────────────────────────────────────────────────────────
function createSymbolElement(data) {
  const el = document.createElement('div');
  el.className  = 'symbol-annotation';
  el.dataset.id = data.id;
  const px = (data.size || 24) * scale;
  el.style.left      = (data.x * 100) + '%';
  el.style.top       = (data.y * 100) + '%';
  el.style.fontSize  = px + 'px';
  el.style.color     = data.color || '#000000';
  el.style.width     = px + 'px';
  el.style.height    = px + 'px';
  el.textContent     = data.sym;

  const delBtn = document.createElement('button');
  delBtn.className = 'sym-del';
  delBtn.innerHTML = '<i class="fas fa-times"></i>';
  delBtn.onclick = e => { e.stopPropagation(); deleteAnnotation(data.id); };
  el.appendChild(delBtn);

  const rh = document.createElement('div');
  rh.className = 'sym-resize-handle';
  rh.addEventListener('mousedown', e => { e.stopPropagation(); e.preventDefault(); startSymResize(e, el, data); });
  el.appendChild(rh);

  el.addEventListener('mousedown', e => {
    if (e.target.closest('.sym-del') || e.target.closest('.sym-resize-handle')) return;
    e.stopPropagation();
    startDrag(e, el, data, 'symbol');
  });

  annotationLayer.appendChild(el);
  return el;
}

// ── Image Element ─────────────────────────────────────────────────────────────
function createImageElement(data) {
  const el = document.createElement('div');
  el.className  = 'image-annotation';
  el.dataset.id = data.id;
  el.style.left  = (data.x * 100) + '%';
  el.style.top   = (data.y * 100) + '%';
  el.style.width = (data.w * 100) + '%';

  const img = document.createElement('img');
  img.src = data.src; img.draggable = false;
  el.appendChild(img);

  const del = document.createElement('button');
  del.className = 'ann-delete';
  del.innerHTML = '<i class="fas fa-xmark"></i>';
  del.addEventListener('click', e => { e.stopPropagation(); deleteAnnotation(data.id); });
  el.appendChild(del);

  const rh = document.createElement('div');
  rh.className = 'resize-handle';
  rh.addEventListener('mousedown', e => { e.stopPropagation(); e.preventDefault(); startResize(e, el, data); });
  el.appendChild(rh);

  el.addEventListener('mousedown', e => {
    if (e.target.closest('.ann-delete') || e.target.closest('.resize-handle')) return;
    e.stopPropagation();
    startDrag(e, el, data, 'image');
  });

  annotationLayer.appendChild(el);
  return el;
}

// ── Delete ────────────────────────────────────────────────────────────────────
function deleteAnnotation(id) {
  const key  = pageKey(currentPage);
  const anns = getAnnotations(key);
  anns.highlights = anns.highlights.filter(h => h.id !== id);
  anns.texts      = anns.texts.filter(t => t.id !== id);
  anns.images     = anns.images.filter(i => i.id !== id);
  anns.symbols    = (anns.symbols || []).filter(s => s.id !== id);
  renderAnnotations(currentPage);
  updateAnnCount();
}

// ── Drag / Resize ─────────────────────────────────────────────────────────────
function startDrag(e, el, data, type) {
  const rect = pageContainer.getBoundingClientRect();
  dragState = { el, data, type, startMouseX:e.clientX, startMouseY:e.clientY, origX:data.x, origY:data.y, containerW:rect.width, containerH:rect.height };
  document.body.style.userSelect = 'none';
}

function startResize(e, el, data) {
  const rect = pageContainer.getBoundingClientRect();
  globalIsResizingFlag = true;
  resizeState = { el, data, startMouseX:e.clientX, origW:data.w, containerW:rect.width };
  document.body.style.userSelect = 'none';
}

function startSymResize(e, el, data) {
  globalIsResizingFlag = true;
  symResizeState = { el, data, startMouseX:e.clientX, startMouseY:e.clientY, origSize: data.size || 24 };
  document.body.style.userSelect = 'none';
}

function startTextWidthResize(e, el, data) {
  const rect = pageContainer.getBoundingClientRect();
  globalIsResizingFlag = true;
  textWidthResizeState = { el, data, startMouseX:e.clientX, origW: data.w || (el.offsetWidth / rect.width), containerW: rect.width };
  document.body.style.userSelect = 'none';
}

document.addEventListener('mousemove', e => {
  if (dragState) {
    const dx = (e.clientX - dragState.startMouseX) / dragState.containerW;
    const dy = (e.clientY - dragState.startMouseY) / dragState.containerH;
    dragState.data.x = Math.max(0, Math.min(0.95, dragState.origX + dx));
    dragState.data.y = Math.max(0, Math.min(0.95, dragState.origY + dy));
    dragState.el.style.left = (dragState.data.x * 100) + '%';
    dragState.el.style.top  = (dragState.data.y * 100) + '%';
  }
  if (resizeState) {
    const rdx = (e.clientX - resizeState.startMouseX) / resizeState.containerW;
    resizeState.data.w = Math.max(0.05, resizeState.origW + rdx);
    resizeState.el.style.width = (resizeState.data.w * 100) + '%';
  }
  if (symResizeState) {
    const delta = (e.clientX - symResizeState.startMouseX) + (e.clientY - symResizeState.startMouseY);
    const newSize = Math.max(8, Math.min(200, symResizeState.origSize + delta * 0.5));
    symResizeState.data.size = newSize;
    symResizeState.el.style.fontSize = (newSize * scale) + 'px';
    symResizeState.el.style.width    = (newSize * scale) + 'px';
    symResizeState.el.style.height   = (newSize * scale) + 'px';
  }
  if (textWidthResizeState) {
    const tdx = (e.clientX - textWidthResizeState.startMouseX) / textWidthResizeState.containerW;
    textWidthResizeState.data.w = Math.max(0.05, textWidthResizeState.origW + tdx);
    textWidthResizeState.el.style.width = (textWidthResizeState.data.w * 100) + '%';
  }
});

document.addEventListener('mouseup', () => {
  if (dragState)           { document.body.style.userSelect = ''; dragState = null; }
  if (resizeState)         { document.body.style.userSelect = ''; resizeState = null;         setTimeout(() => { globalIsResizingFlag = false; }, 80); }
  if (symResizeState)      { document.body.style.userSelect = ''; symResizeState = null;      setTimeout(() => { globalIsResizingFlag = false; }, 80); }
  if (textWidthResizeState){ document.body.style.userSelect = ''; textWidthResizeState = null; setTimeout(() => { globalIsResizingFlag = false; }, 80); }
});

// ── Highlight mouseup ─────────────────────────────────────────────────────────
textLayer.addEventListener('mouseup', () => {
  if (currentTool !== 'highlight') return;
  const sel = window.getSelection();
  if (!sel.rangeCount || sel.isCollapsed) return;
  const range = sel.getRangeAt(0);
  const clientRects = range.getClientRects();
  const pageRect = pageContainer.getBoundingClientRect();
  const rects = [];
  for (let i = 0; i < clientRects.length; i++) {
    const r = clientRects[i];
    if (r.width < 1 || r.height < 1) continue;
    rects.push({ x:(r.left-pageRect.left)/pageRect.width, y:(r.top-pageRect.top)/pageRect.height, w:r.width/pageRect.width, h:r.height/pageRect.height });
  }
  sel.removeAllRanges();
  if (!rects.length) return;
  getAnnotations(pageKey(currentPage)).highlights.push({ id:genId(), rects, color:highlightColor });
  renderAnnotations(currentPage);
  updateAnnCount();
});

// ── Text Tool Click ───────────────────────────────────────────────────────────
pageContainer.addEventListener('click', e => {
  if (currentTool !== 'text' && currentTool !== 'symbol') return;
  if (e.target.closest('.text-annotation') || e.target.closest('.image-annotation') || e.target.closest('.symbol-annotation')) return;
  if (e.target.closest('.text-input-overlay-box') || e.target.closest('.text-formatter-tooltip') || e.target.closest('.text-width-handle')) return;

  const rect = pageContainer.getBoundingClientRect();
  const relX = (e.clientX - rect.left) / rect.width;
  const relY = (e.clientY - rect.top)  / rect.height;

  if (currentTool === 'symbol') {
    if (!pendingSymbol) return;
    const symData = { id:genId(), x:relX, y:relY, sym:pendingSymbol, size:pendingSymbolSize, color:'#000000' };
    getAnnotations(pageKey(currentPage)).symbols.push(symData);
    renderAnnotations(currentPage);
    updateAnnCount();
    return;
  }

  // Text tool
  const tempId   = genId();
  const mockData = { id:tempId, x:relX, y:relY, content:'', font:'Times', size:12, isBold:false, isItalic:false, color:'#000000', w:0.4 };

  const inputWrapper = document.createElement('div');
  inputWrapper.className = 'text-annotation text-annotation-editing';
  inputWrapper.style.cssText = `left:${relX*100}%;top:${relY*100}%;border:1px dashed rgba(0,0,0,0.4);font-size:${12*scale}px;font-family:'Times New Roman';color:#000000;width:40%;`;

  const field = document.createElement('input');
  field.type = 'text'; field.placeholder = 'Type here…'; field.className = 'text-input-overlay-box';

  const handle = document.createElement('div');
  handle.className = 'text-width-handle'; handle.style.display = 'block';
  handle.addEventListener('mousedown', e => { e.stopPropagation(); e.preventDefault(); startTextWidthResize(e, inputWrapper, mockData); });

  inputWrapper.appendChild(field);
  inputWrapper.appendChild(handle);
  annotationLayer.appendChild(inputWrapper);
  attachTextFormatterTooltip(inputWrapper, mockData, field);
  requestAnimationFrame(() => field.focus());

  function commitNew() {
    const txt = field.value.trim();
    inputWrapper.remove();
    if (txt) {
      mockData.content = txt;
      getAnnotations(pageKey(currentPage)).texts.push(mockData);
      updateAnnCount();
      renderAnnotations(currentPage);
    } else {
      closeActiveTextOptions();
    }
  }

  field.onblur = () => setTimeout(() => {
    if (document.activeElement === field || document.activeElement.closest('.text-formatter-tooltip')) return;
    commitNew();
  }, 150);
  field.onkeydown = ev => {
    if (ev.key === 'Enter') commitNew();
    if (ev.key === 'Escape') { inputWrapper.remove(); closeActiveTextOptions(); }
  };
});

// ── Image input ───────────────────────────────────────────────────────────────
imageInput.addEventListener('change', e => {
  if (!e.target.files[0]) return;
  const file = e.target.files[0];
  if (!file.type.startsWith('image/')) return;
  const pos = { x: imagePlacePos ? imagePlacePos.x : 0.1, y: imagePlacePos ? imagePlacePos.y : 0.1 };
  imageInput.value = '';
  const reader = new FileReader();
  reader.onload = ev => {
    const src = ev.target.result;
    const img = new Image();
    img.onload = () => {
      const containerW = pageContainer.offsetWidth;
      const defaultW   = Math.min(0.4, img.naturalWidth / containerW);
      const imgData    = { id:genId(), x:pos.x, y:pos.y, src, w:defaultW, ar:img.naturalWidth/img.naturalHeight };
      getAnnotations(pageKey(currentPage)).images.push(imgData);
      renderAnnotations(currentPage);
      updateAnnCount();
    };
    img.src = src;
  };
  reader.readAsDataURL(file);
});