// ── Load PDF ──────────────────────────────────────────────────────────────────
async function loadPDF(data) {
  try {
    pdfDoc = await pdfjsLib.getDocument({ data }).promise;
    totalPages = pdfDoc.numPages;
    pageOrder = Array.from({ length: totalPages }, (_, i) => i + 1);
    annotations = {};
    uploadScreen.style.display = 'none';
    app.classList.add('active');
    sbTotal.textContent = pageOrder.length;
    sbPageInput.max = pageOrder.length;
    await fitToWidth();
    await renderPageThumbs();
    showToast('PDF loaded successfully', 'success');
  } catch (e) {
    showToast('Failed to load PDF', 'error');
    console.error(e);
  }
}

function handleFile(file) {
  if (!file || file.type !== 'application/pdf') return;
  const reader = new FileReader();
  reader.onload = function (e) {
    const view = new Uint8Array(e.target.result);
    let bin = '';
    view.forEach(b => bin += String.fromCharCode(b));
    base64BackupSource = btoa(bin);
    loadPDF(view);
  };
  reader.readAsArrayBuffer(file);
}

// File drop / open
dropZone.addEventListener('click', () => fileInput.click());
fileInput.addEventListener('change', e => { if (e.target.files[0]) handleFile(e.target.files[0]); });
fileInput2.addEventListener('change', e => { if (e.target.files[0]) handleFile(e.target.files[0]); });
document.getElementById('btn-open').addEventListener('click', () => fileInput2.click());
dropZone.addEventListener('dragover', e => { e.preventDefault(); dropZone.classList.add('drag-over'); });
dropZone.addEventListener('dragleave', () => dropZone.classList.remove('drag-over'));
dropZone.addEventListener('drop', e => { e.preventDefault(); if (e.dataTransfer.files[0]) handleFile(e.dataTransfer.files[0]); });

// ── Render Page ───────────────────────────────────────────────────────────────
async function renderPage(displayNum) {
  if (isRendering) { pendingPage = displayNum; return; }
  isRendering = true;
  try {
    const sourceIdx = pageOrder[displayNum - 1];
    if (typeof sourceIdx === 'string' && sourceIdx.startsWith('blank')) {
      const w = 595 * scale, h = 842 * scale;
      pageContainer.style.width = w + 'px';
      pageContainer.style.height = h + 'px';
      pdfCanvas.width = w; pdfCanvas.height = h;
      const ctx = pdfCanvas.getContext('2d');
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, w, h);
    } else {
      const page = await pdfDoc.getPage(sourceIdx);
      const viewport = page.getViewport({ scale });
      pageContainer.style.width  = viewport.width  + 'px';
      pageContainer.style.height = viewport.height + 'px';
      pdfCanvas.width  = viewport.width;
      pdfCanvas.height = viewport.height;
      await page.render({ canvasContext: pdfCanvas.getContext('2d'), viewport }).promise;
      textLayer.innerHTML = '';
      textLayer.style.width  = viewport.width  + 'px';
      textLayer.style.height = viewport.height + 'px';
      textLayer.style.setProperty('--scale-factor', viewport.scale);
      const textContent = await page.getTextContent();
      pdfjsLib.renderTextLayer({ textContentSource: textContent, container: textLayer, viewport, textDivs: [] });
    }
    renderAnnotations(displayNum);
    sbPageInput.value = displayNum;
    currentPage = displayNum;
    updateAnnCount();
    document.querySelectorAll('.page-thumb').forEach((t, i) => t.classList.toggle('active', i + 1 === displayNum));
  } catch (e) { console.error(e); }
  isRendering = false;
  if (pendingPage !== null) { const p = pendingPage; pendingPage = null; renderPage(p); }
}

// ── Thumbnails ────────────────────────────────────────────────────────────────
async function renderPageThumbs() {
  pageThumbs.innerHTML = '';
  sbTotal.textContent = pageOrder.length;
  sbPageInput.max = pageOrder.length;
  for (let i = 0; i < pageOrder.length; i++) {
    const displayNum = i + 1;
    const sourceIdx  = pageOrder[i];
    const wrap = document.createElement('div');
    wrap.className  = 'page-thumb' + (displayNum === currentPage ? ' active' : '');
    wrap.dataset.display = displayNum;

    const thumbCanvas = document.createElement('canvas');
    if (typeof sourceIdx === 'string' && sourceIdx.startsWith('blank')) {
      thumbCanvas.width = 90; thumbCanvas.height = 127;
      const tc = thumbCanvas.getContext('2d');
      tc.fillStyle = '#fff'; tc.fillRect(0,0,90,127);
      tc.strokeStyle = '#ccc'; tc.strokeRect(0,0,90,127);
    } else {
      try {
        const pg = await pdfDoc.getPage(sourceIdx);
        const vp = pg.getViewport({ scale: 90 / pg.getViewport({scale:1}).width });
        thumbCanvas.width = vp.width; thumbCanvas.height = vp.height;
        await pg.render({ canvasContext: thumbCanvas.getContext('2d'), viewport: vp }).promise;
      } catch (e) {}
    }
    wrap.appendChild(thumbCanvas);

    const numEl = document.createElement('div');
    numEl.className = 'thumb-num';
    numEl.textContent = displayNum;
    wrap.appendChild(numEl);

    const delBtn = document.createElement('button');
    delBtn.className = 'thumb-del';
    delBtn.innerHTML = '<i class="fas fa-times"></i>';
    delBtn.title = 'Delete page';
    delBtn.addEventListener('click', e => { e.stopPropagation(); deletePage(displayNum); });
    wrap.appendChild(delBtn);

    wrap.addEventListener('click', () => goToPage(displayNum));
    wrap.draggable = true;
    wrap.addEventListener('dragstart', e => { thumbDragSrc = displayNum; e.dataTransfer.effectAllowed = 'move'; wrap.classList.add('page-thumb-drag'); });
    wrap.addEventListener('dragend', () => { wrap.classList.remove('page-thumb-drag'); document.querySelectorAll('.page-thumb').forEach(t => t.classList.remove('page-thumb-drop-over')); });
    wrap.addEventListener('dragover', e => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; wrap.classList.add('page-thumb-drop-over'); });
    wrap.addEventListener('dragleave', () => wrap.classList.remove('page-thumb-drop-over'));
    wrap.addEventListener('drop', e => { e.preventDefault(); wrap.classList.remove('page-thumb-drop-over'); if (thumbDragSrc && thumbDragSrc !== displayNum) reorderPage(thumbDragSrc, displayNum); thumbDragSrc = null; });
    pageThumbs.appendChild(wrap);
  }
}

// ── Page Operations ───────────────────────────────────────────────────────────
function addBlankPage(afterPage) {
  blankPageCount++;
  const key = 'blank_' + blankPageCount;
  pageOrder.splice(afterPage || pageOrder.length, 0, key);
  sbTotal.textContent = pageOrder.length;
  sbPageInput.max = pageOrder.length;
  renderPageThumbs();
  showToast('Blank page added', 'success');
}

function deletePage(displayNum) {
  if (pageOrder.length <= 1) { showToast('Cannot delete last page', 'error'); return; }
  const key = pageOrder[displayNum - 1];
  pageOrder.splice(displayNum - 1, 1);
  const newAnnotations = {};
  Object.keys(annotations).forEach(k => { if (k !== 'page_' + key) newAnnotations[k] = annotations[k]; });
  annotations = newAnnotations;
  sbTotal.textContent = pageOrder.length;
  sbPageInput.max = pageOrder.length;
  renderPageThumbs().then(() => goToPage(Math.min(currentPage, pageOrder.length)));
  showToast('Page deleted', 'info');
}

function reorderPage(fromDisplay, toDisplay) {
  const item = pageOrder.splice(fromDisplay - 1, 1)[0];
  pageOrder.splice(toDisplay - 1, 0, item);
  renderPageThumbs().then(() => goToPage(pageOrder.indexOf(item) + 1));
}

// ── Navigation ────────────────────────────────────────────────────────────────
function goToPage(n) {
  renderPage(Math.max(1, Math.min(pageOrder.length, n)));
}

document.getElementById('sb-prev').addEventListener('click', () => { if (currentPage > 1) goToPage(currentPage - 1); });
document.getElementById('sb-next').addEventListener('click', () => { if (currentPage < pageOrder.length) goToPage(currentPage + 1); });
sbPageInput.addEventListener('change', () => goToPage(parseInt(sbPageInput.value) || 1));

// ── Zoom ──────────────────────────────────────────────────────────────────────
function setZoom(newScale) {
  scale = Math.max(0.25, Math.min(4, newScale));
  zoomSlider.value = Math.round(scale * 100);
  sbZoomLabel.textContent = Math.round(scale * 100) + '%';
  renderPage(currentPage);
}

async function fitToWidth() {
  const availW = viewerArea.clientWidth - 48;
  let pageW = 595;
  const sourceIdx = pageOrder[currentPage - 1];
  if (typeof sourceIdx !== 'string') {
    try { const pg = await pdfDoc.getPage(sourceIdx); pageW = pg.getViewport({scale:1}).width; } catch(e) {}
  }
  setZoom(availW / pageW);
}

zoomSlider.addEventListener('input', () => setZoom(parseInt(zoomSlider.value) / 100));
document.getElementById('sb-zoom-in').addEventListener('click',  () => setZoom(scale + 0.15));
document.getElementById('sb-zoom-out').addEventListener('click', () => setZoom(scale - 0.15));
document.getElementById('sb-fit').addEventListener('click', fitToWidth);

// ── Export PDF ────────────────────────────────────────────────────────────────
function extractCleanImageData(srcUrl) {
  return new Promise(resolve => {
    if (srcUrl.startsWith('data:image/jpeg') || srcUrl.startsWith('data:image/png')) return resolve(srcUrl);
    const img = new Image(); img.crossOrigin = 'anonymous';
    img.onload = () => {
      const c = document.createElement('canvas');
      c.width = img.naturalWidth; c.height = img.naturalHeight;
      c.getContext('2d').drawImage(img, 0, 0);
      try { resolve(c.toDataURL('image/png')); } catch(e) { resolve(srcUrl); }
    };
    img.onerror = () => resolve(srcUrl);
    img.src = srcUrl;
  });
}

document.getElementById('btn-export').addEventListener('click', async () => {
  if (!base64BackupSource) { showToast('No PDF loaded', 'error'); return; }
  showToast('Exporting…', 'info');
  try {
    const bin = atob(base64BackupSource);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);

    const targetDoc = await PDFLib.PDFDocument.load(bytes);
    const newDoc    = await PDFLib.PDFDocument.create();

    for (let i = 0; i < pageOrder.length; i++) {
      const displayNum = i + 1;
      const sourceIdx  = pageOrder[i];
      let page;
      if (typeof sourceIdx === 'string') {
        page = newDoc.addPage([595, 842]);
      } else {
        const [copied] = await newDoc.copyPages(targetDoc, [sourceIdx - 1]);
        page = newDoc.addPage(copied);
      }
      const { width, height } = page.getSize();
      const key = pageKey(displayNum);
      const pageAnns = annotations[key];
      if (!pageAnns) continue;

      // Highlights
      for (const hl of pageAnns.highlights || []) {
        const hex = hl.color.replace('#','');
        const r = parseInt(hex.substring(0,2),16)/255, g = parseInt(hex.substring(2,4),16)/255, b = parseInt(hex.substring(4,6),16)/255;
        for (const rect of hl.rects) {
          page.drawRectangle({ x:rect.x*width, y:height-(rect.y*height)-(rect.h*height), width:rect.w*width, height:rect.h*height, color:PDFLib.rgb(r,g,b), opacity:0.35 });
        }
      }

      // Text
      for (const txt of pageAnns.texts || []) {
        let fontKey = PDFLib.StandardFonts.TimesRoman;
        if (txt.font === 'Helvetica') fontKey = txt.isBold ? (txt.isItalic ? PDFLib.StandardFonts.HelveticaBoldOblique : PDFLib.StandardFonts.HelveticaBold) : (txt.isItalic ? PDFLib.StandardFonts.HelveticaOblique : PDFLib.StandardFonts.Helvetica);
        else if (txt.font === 'Courier') fontKey = txt.isBold ? (txt.isItalic ? PDFLib.StandardFonts.CourierBoldOblique : PDFLib.StandardFonts.CourierBold) : (txt.isItalic ? PDFLib.StandardFonts.CourierOblique : PDFLib.StandardFonts.Courier);
        else fontKey = txt.isBold ? (txt.isItalic ? PDFLib.StandardFonts.TimesRomanBoldItalic : PDFLib.StandardFonts.TimesRomanBold) : (txt.isItalic ? PDFLib.StandardFonts.TimesRomanItalic : PDFLib.StandardFonts.TimesRoman);
        const font = await newDoc.embedFont(fontKey);
        const hex = (txt.color || '#000000').replace('#','');
        const r = parseInt(hex.substring(0,2),16)/255, g = parseInt(hex.substring(2,4),16)/255, b = parseInt(hex.substring(4,6),16)/255;
        const fs = txt.size || 12;
        page.drawText(txt.content, { x:(txt.x*width)+4, y:height-(txt.y*height)-(fs*1.15), size:fs, font, color:PDFLib.rgb(r,g,b), maxWidth:txt.w?txt.w*width:undefined });
      }

      // Symbols
      for (const sym of pageAnns.symbols || []) {
        const symCanvas = document.createElement('canvas');
        const symSize = (sym.size || 24) * 3;
        symCanvas.width = symSize; symCanvas.height = symSize;
        const sc = symCanvas.getContext('2d');
        sc.fillStyle = sym.color || '#000000';
        sc.font = `${symSize * 0.8}px serif`;
        sc.textAlign = 'center'; sc.textBaseline = 'middle';
        sc.fillText(sym.sym, symSize/2, symSize/2);
        try {
          const dataUrl = symCanvas.toDataURL('image/png');
          const imgEmbed = await newDoc.embedPng(dataUrl);
          const sz = sym.size || 24;
          page.drawImage(imgEmbed, { x:sym.x*width, y:height-(sym.y*height)-sz, width:sz, height:sz });
        } catch (err) { console.warn('Symbol embed failed:', err); }
      }

      // Images
      for (const imgObj of pageAnns.images || []) {
        try {
          const clean = await extractCleanImageData(imgObj.src);
          const emb   = clean.includes('image/png') ? await newDoc.embedPng(clean) : await newDoc.embedJpg(clean);
          const dims  = emb.scale(1);
          const ew = imgObj.w * width;
          const eh = (dims.height / dims.width) * ew;
          page.drawImage(emb, { x:imgObj.x*width, y:height-(imgObj.y*height)-eh, width:ew, height:eh });
        } catch (e) { console.error('Image embed failed:', e); }
      }
    }

    const finalBytes = await newDoc.save();
    const blob = new Blob([finalBytes], { type:'application/pdf' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href = url; a.download = 'annotated.pdf'; a.click();
    showToast('Export successful!', 'success');
  } catch (err) {
    console.error(err);
    showToast('Export failed', 'error');
  }
});