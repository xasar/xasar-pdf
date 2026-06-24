// ── PDF.js worker ─────────────────────────────────────────────────────────────
pdfjsLib.GlobalWorkerOptions.workerSrc =
  'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

// ── App state ─────────────────────────────────────────────────────────────────
let pdfDoc            = null;
let base64BackupSource = '';
let currentPage       = 1;
let totalPages        = 0;
let scale             = 1.0;
let currentTool       = 'hand';
let highlightColor    = HIGHLIGHT_COLORS[0].color;
let annotations       = {};
let nextId            = 1;
let isRendering       = false;
let pendingPage       = null;
let dragState         = null;
let resizeState       = null;
let symResizeState    = null;
let textWidthResizeState = null;
let imagePlacePos     = null;
let activeTextId      = null;
let globalIsResizingFlag = false;
let pageOrder         = [];
let blankPageCount    = 0;
let thumbDragSrc      = null;
let pendingSymbol     = null;
let pendingSymbolSize = 24;

// ── DOM references ────────────────────────────────────────────────────────────
const uploadScreen    = document.getElementById('upload-screen');
const dropZone        = document.getElementById('drop-zone');
const fileInput       = document.getElementById('file-input');
const fileInput2      = document.getElementById('file-input-2');
const imageInput      = document.getElementById('image-input');
const app             = document.getElementById('app');
const viewerArea      = document.getElementById('viewer-area');
const pageContainer   = document.getElementById('page-container');
const pdfCanvas       = document.getElementById('pdf-canvas');
const textLayer       = document.getElementById('text-layer');
const annotationLayer = document.getElementById('annotation-layer');
const sbPageInput     = document.getElementById('sb-page-input');
const sbTotal         = document.getElementById('sb-total');
const sbZoomLabel     = document.getElementById('sb-zoom-label');
const zoomSlider      = document.getElementById('zoom-slider');
const toastContainer  = document.getElementById('toast-container');
const annCountEl      = document.getElementById('ann-count');
const annCountStatus  = document.getElementById('ann-count-status');
const pageThumbs      = document.getElementById('page-thumbs');
const colorGrid       = document.getElementById('color-grid');
const symbolGrid      = document.getElementById('symbol-grid');
const hlPopover       = document.getElementById('hl-popover');
const symbolPanel     = document.getElementById('symbol-picker-panel');
const pageModal       = document.getElementById('page-modal');
const modalPagesGrid  = document.getElementById('modal-pages-grid');
const symSizeSlider   = document.getElementById('sym-size-slider');
const symSizeLabel    = document.getElementById('sym-size-label');
const hlSelStyle      = document.getElementById('hl-sel-style');

// ── Shared utilities ──────────────────────────────────────────────────────────
function genId() { return 'ann_' + (nextId++); }

function getAnnotations(page) {
  if (!annotations[page]) annotations[page] = { highlights:[], texts:[], images:[], symbols:[] };
  if (!annotations[page].symbols) annotations[page].symbols = [];
  return annotations[page];
}

function updateAnnCount() {
  const total = Object.values(annotations).reduce((s, a) =>
    s + a.highlights.length + a.texts.length + a.images.length + (a.symbols||[]).length, 0);
  const label = total ? total + ' annotation' + (total > 1 ? 's' : '') : '';
  annCountEl.textContent = label;
  annCountStatus.textContent = label;
}

function showToast(msg, type = 'info') {
  const icons = { success:'fa-check-circle', error:'fa-exclamation-circle', info:'fa-info-circle' };
  const t = document.createElement('div');
  t.className = 'toast ' + type;
  t.innerHTML = '<i class="fas ' + (icons[type] || 'fa-info-circle') + '"></i>' + msg;
  toastContainer.appendChild(t);
  setTimeout(() => t.remove(), 3000);
}

function pageKey(displayPage) {
  return 'page_' + (pageOrder[displayPage - 1] || displayPage);
}
