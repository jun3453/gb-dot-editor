// GBDotEditor Application Logic

// --- Constants ---
const CANVAS_DISPLAY_SIZE = 512;
const PALETTE_THEMES = {
  classic: ['#e0f8d0', '#88c070', '#346856', '#081820'], // Original GB Green
  pocket: ['#ffffff', '#aaaaaa', '#555555', '#000000']   // GB Pocket Monochrome
};

// --- Application State ---
let canvasWidth = 16;
let canvasHeight = 16;
let frames = [];     // Array of { id: number, data: Uint8Array }
let currentFrameIndex = 0;
let activeTheme = 'classic';
let primaryColorIndex = 3;   // Left click color (default Black/Dark)
let secondaryColorIndex = 0; // Right click color (default White/Light)
let activeTool = 'pen';      // 'pen', 'eraser', 'fill', 'picker', 'text'
let shapeShear = 0.0;
let shapeShearDir = 'horizontal';
let hoverX = -1;
let hoverY = -1;
let isDrawing = false;
let drawingButton = null;    // Tracks drawing mouse button (0: left, 2: right)
let showGridPixel = true;
let showGridTile = true;
let showGridSprite = localStorage.getItem('gb_grid_sprite') === 'true';
let showPixelPerfect = localStorage.getItem('gb_pixel_perfect') !== 'false';
let showSymmetryH = localStorage.getItem('gb_symmetry_h') === 'true';
let showSymmetryV = localStorage.getItem('gb_symmetry_v') === 'true';
let showOnionSkin = false;
let gridPixelColor = localStorage.getItem('gb_grid_pixel_color') || '#888888';

let drawingStartData = null;
let pixelPerfectPath = [];

// Brush, dither, and shade settings
let brushSize = 1; // 1, 2, 3, 4
let ditherPattern = '50%'; // '25%', '50%', '75%'
let shadingMode = 'darken'; // 'darken', 'lighten'

// Bayer 4x4 matrix for dithering
const bayer4x4 = [
  [ 0,  8,  2, 10],
  [12,  4, 14,  6],
  [ 3, 11,  1,  9],
  [15,  7, 13,  5]
];

let lastMouseX = 0;
let lastMouseY = 0;
let startX = 0;
let startY = 0;

let previewZoom = 4;
let previewBlurEnabled = false;

// Zoom and responsive layout state
let zoomMode = 'fit'; // 'fit' or 'fixed'
let zoomScale = 1.0;
const ZOOM_STAGES = [0.25, 0.5, 0.75, 1.0, 1.5, 2.0, 3.0, 4.0, 6.0, 8.0];

let showToolsPanel = true;
let showSidebarPanel = true;
let showTimelinePanel = true;

// Panning state (drag canvas)
let isPanning = false;
let panStartX = 0;
let panStartY = 0;
let scrollStartX = 0;
let scrollStartY = 0;
let spacePressed = false;
let pannedDuringSpace = false;

// Selection State
let selection = {
  active: false,
  startX: 0,
  startY: 0,
  endX: 0,
  endY: 0,
  buffer: null,
  bufferWidth: 0,
  bufferHeight: 0,
  isFloating: false,
  floatingX: 0,
  floatingY: 0,
  floatingData: null
};
let lineDashOffset = 0;
let antsInterval = null;

// Drag state for floating selection
let isSelecting = false;
let isDraggingFloating = false;
let dragStartX = 0;
let dragStartY = 0;
let originalFloatingX = 0;
let originalFloatingY = 0;

// --- Custom Features & Workspace Mode States ---
let activeMode = 'pixel'; // 'pixel', 'tilemap', 'metasprite'
let showSeamless = false;
let showPreviewTiling = false;
let isGbcMode = false;
let gbcPalettes = Array.from({length: 8}, () => ['#ffffff', '#aaaaaa', '#555555', '#000000']);
let currentGbcPaletteIndex = 0;

// Tilemap Editor State
let tilemapWidth = 20;
let tilemapHeight = 18;
let tilemapData = new Uint8Array(20 * 18); // Default 0
let selectedTilemapTile = 0;
let activeTilemapTool = 'stamp'; // 'stamp', 'eraser', 'fill'
let tileSet = []; // Array of Uint8Array (64 bytes) for 8x8 tiles

// Metasprite Editor State
let metaspriteParts = []; // Array of { id, tileIndex, x, y, xFlip, yFlip, palette }
let activeMetaspritePartId = null;
let metasprite8x16 = false;
let selectedMetaspriteTile = 0;

// Offscreen canvas for preview rendering
let previewTempCanvas = null;

// Undo/Redo Stacks
let undoStack = [];
let redoStack = [];
const MAX_HISTORY = 40;

// Animation Preview
let isPlaying = false;
let previewFrameIndex = 0;
let previewInterval = null;
let fps = 8;

// --- DOM Elements ---
const editorCanvas = document.getElementById('editor-canvas');
const editorCtx = editorCanvas.getContext('2d');
const previewCanvas = document.getElementById('preview-canvas');
const previewCtx = previewCanvas.getContext('2d');

const selectWidth = document.getElementById('canvas-width-select');
const selectHeight = document.getElementById('canvas-height-select');
const btnUndo = document.getElementById('btn-undo');
const btnRedo = document.getElementById('btn-redo');

// Mode Tabs
const modePixelBtn = document.getElementById('mode-pixel');
const modeTilemapBtn = document.getElementById('mode-tilemap');
const modeMetaspriteBtn = document.getElementById('mode-metasprite');
const workspacePixel = document.getElementById('workspace-pixel');
const workspaceTilemap = document.getElementById('workspace-tilemap');
const workspaceMetasprite = document.getElementById('workspace-metasprite');

// Seamless & Tiling Preview
const chkSeamlessDraw = document.getElementById('chk-seamless-draw');
const chkPreviewTiling = document.getElementById('chk-preview-tiling');

// GBC Palette UI
const chkGbcMode = document.getElementById('chk-gbc-mode');
const monoPaletteSelector = document.getElementById('mono-palette-selector');
const gbcPaletteSelector = document.getElementById('gbc-palette-selector');
const gbcPaletteSelect = document.getElementById('gbc-palette-select');
const gbcColorEditor = document.getElementById('gbc-color-editor');
const gbcColorPicker = document.getElementById('gbc-color-picker');

// Tilemap UI
const tilemapCanvas = document.getElementById('tilemap-canvas');
const tilemapCtx = tilemapCanvas ? tilemapCanvas.getContext('2d') : null;
const tilemapToolStamp = document.getElementById('tilemap-tool-stamp');
const tilemapToolEraser = document.getElementById('tilemap-tool-eraser');
const tilemapToolFill = document.getElementById('tilemap-tool-fill');
const btnRefreshTileset = document.getElementById('btn-refresh-tileset');
const tilemapTilesetList = document.getElementById('tilemap-tileset-list');
const tilemapWidthInput = document.getElementById('tilemap-width-input');
const tilemapHeightInput = document.getElementById('tilemap-height-input');
const btnResizeTilemap = document.getElementById('btn-resize-tilemap');
const chkTilemapGrid = document.getElementById('chk-tilemap-grid');
const tilemapCodeIo = document.getElementById('tilemap-code-io');
const btnTilemapImportC = document.getElementById('btn-tilemap-import-c');
const btnTilemapExportC = document.getElementById('btn-tilemap-export-c');
const tilemapCursorCoord = document.getElementById('tilemap-cursor-coord');

// Metasprite UI
const metaspriteCanvas = document.getElementById('metasprite-canvas');
const metaspriteCtx = metaspriteCanvas ? metaspriteCanvas.getContext('2d') : null;
const btnMetaspriteAddPart = document.getElementById('btn-metasprite-add-part');
const chkMetaspriteSize8x16 = document.getElementById('chk-metasprite-size8x16');
const chkMetaspriteGrid = document.getElementById('chk-metasprite-grid');
const chkMetaspriteSnap = document.getElementById('chk-metasprite-snap');
const selMetaspriteBg = document.getElementById('sel-metasprite-bg');
const metaspriteTilesetList = document.getElementById('metasprite-tileset-list');
const metaspritePartsList = document.getElementById('metasprite-parts-list');
const metaspritePartProperties = document.getElementById('metasprite-part-properties');
const metaspritePartX = document.getElementById('metasprite-part-x');
const metaspritePartY = document.getElementById('metasprite-part-y');
const metaspritePartHFlip = document.getElementById('metasprite-part-hflip');
const metaspritePartVFlip = document.getElementById('metasprite-part-vflip');
const metaspritePartPalette = document.getElementById('metasprite-part-palette');
const metaspriteCodeIo = document.getElementById('metasprite-code-io');
const btnMetaspriteImportC = document.getElementById('btn-metasprite-import-c');
const btnMetaspriteExportC = document.getElementById('btn-metasprite-export-c');


const toolPen = document.getElementById('tool-pen');
const toolEraser = document.getElementById('tool-eraser');
const toolFill = document.getElementById('tool-fill');
const toolPicker = document.getElementById('tool-picker');
const toolSelect = document.getElementById('tool-select');
const toolLine = document.getElementById('tool-line');
const toolRect = document.getElementById('tool-rect');
const toolEllipse = document.getElementById('tool-ellipse');
const toolDither = document.getElementById('tool-dither');
const toolShade = document.getElementById('tool-shade');
const toolText = document.getElementById('tool-text');

const textSettingsContainer = document.getElementById('text-settings-container');
const textInput = document.getElementById('text-input');
const textFontSelect = document.getElementById('text-font-select');
const textSizeInput = document.getElementById('text-size-input');
const textBold = document.getElementById('text-bold');
const textItalic = document.getElementById('text-italic');
const textThreshold = document.getElementById('text-threshold');
const textThresholdVal = document.getElementById('text-threshold-val');

const shapeSettingsContainer = document.getElementById('shape-settings-container');
const shapeShearInput = document.getElementById('shape-shear');
const shapeShearVal = document.getElementById('shape-shear-val');
const shapeShearDirRadios = document.getElementsByName('shape-shear-dir');

const actionFlipH = document.getElementById('action-flip-h');
const actionFlipV = document.getElementById('action-flip-v');
const actionRotateCW = document.getElementById('action-rotate-cw');
const actionShearHRight = document.getElementById('action-shear-h-right');
const actionShearHLeft = document.getElementById('action-shear-h-left');
const actionShearVDown = document.getElementById('action-shear-v-down');
const actionShearVUp = document.getElementById('action-shear-v-up');
const actionClear = document.getElementById('action-clear');

const actionShiftU = document.getElementById('action-shift-u');
const actionShiftL = document.getElementById('action-shift-l');
const actionShiftR = document.getElementById('action-shift-r');
const actionShiftD = document.getElementById('action-shift-d');

const chkGridPixel = document.getElementById('chk-grid-pixel');
const chkGridTile = document.getElementById('chk-grid-tile');
const chkGridSprite = document.getElementById('chk-grid-sprite');
const chkPixelPerfect = document.getElementById('chk-pixel-perfect');
const chkSymmetryH = document.getElementById('chk-symmetry-h');
const chkSymmetryV = document.getElementById('chk-symmetry-v');
const chkOnionSkin = document.getElementById('chk-onion-skin');
const pickerGridColor = document.getElementById('picker-grid-color');

const btnFrameAdd = document.getElementById('frame-add');
const btnFrameDuplicate = document.getElementById('frame-duplicate');
const btnFrameDelete = document.getElementById('frame-delete');
const timelineFramesList = document.getElementById('timeline-frames');

const paletteClassic = document.getElementById('palette-classic');
const palettePocket = document.getElementById('palette-pocket');
const colorSwatches = document.querySelectorAll('.color-swatch');

const btnPlayPause = document.getElementById('btn-play-pause');
const playIcon = document.getElementById('play-icon');
const pauseIcon = document.getElementById('pause-icon');
const playBtnText = document.getElementById('play-btn-text');
const fpsRange = document.getElementById('fps-range');
const fpsVal = document.getElementById('fps-val');

const cCodeIo = document.getElementById('c-code-io');
const btnImportC = document.getElementById('btn-import-c');
const btnExportC = document.getElementById('btn-export-c');

const btnExportJson = document.getElementById('btn-export-json');
const inputImportJson = document.getElementById('input-import-json');
const btnExportPngCurrent = document.getElementById('btn-export-png-current');
const btnExportPngSheet = document.getElementById('btn-export-png-sheet');
const btnExportGif = document.getElementById('btn-export-gif');
const chkPreviewBlur = document.getElementById('chk-preview-blur');

const ditherPatternContainer = document.getElementById('dither-pattern-container');
const shadeModeContainer = document.getElementById('shade-mode-container');
const previewContainer = document.getElementById('preview-container');
// Tabs control
const tabButtons = document.querySelectorAll('.tab-btn');
const tabPanes = document.querySelectorAll('.tab-pane');

// New Layout & Zoom DOM Elements
const toolsPanel = document.querySelector('.tools-panel');
const sidebarPanel = document.querySelector('.sidebar-panel');
const timelinePanel = document.querySelector('.timeline-panel');
const workspace = document.querySelector('.workspace');
const canvasWrapper = document.getElementById('editor-canvas-wrapper');
const canvasContainer = document.getElementById('editor-canvas-container');

const btnToggleTools = document.getElementById('btn-toggle-tools');
const btnToggleTimeline = document.getElementById('btn-toggle-timeline');
const btnToggleSidebar = document.getElementById('btn-toggle-sidebar');

const resizerLeft = document.getElementById('resizer-left');
const resizerRight = document.getElementById('resizer-right');

const btnZoomOut = document.getElementById('btn-zoom-out');
const btnZoomIn = document.getElementById('btn-zoom-in');
const btnZoom100 = document.getElementById('btn-zoom-100');
const btnZoomFit = document.getElementById('btn-zoom-fit');
const zoomLevelText = document.getElementById('zoom-level-text');

// --- Initialization ---
function init() {
  // 幅・高さセレクトボックスの選択肢を動的に生成
  if (selectWidth) {
    selectWidth.innerHTML = '';
    for (let w = 8; w <= 160; w += 8) {
      const opt = document.createElement('option');
      opt.value = w;
      opt.textContent = `${w}px`;
      if (w === 16) opt.selected = true;
      selectWidth.appendChild(opt);
    }
  }
  if (selectHeight) {
    selectHeight.innerHTML = '';
    for (let h = 8; h <= 144; h += 8) {
      const opt = document.createElement('option');
      opt.value = h;
      opt.textContent = `${h}px`;
      if (h === 16) opt.selected = true;
      selectHeight.appendChild(opt);
    }
  }

  setupEventListeners();
  if (pickerGridColor) {
    pickerGridColor.value = gridPixelColor;
  }
  if (chkGridSprite) {
    chkGridSprite.checked = showGridSprite;
  }
  if (chkPixelPerfect) {
    chkPixelPerfect.checked = showPixelPerfect;
  }
  if (chkSymmetryH) {
    chkSymmetryH.checked = showSymmetryH;
  }
  if (chkSymmetryV) {
    chkSymmetryV.checked = showSymmetryV;
  }
  resetEditor(16); // Start with 16x16
  saveHistory();   // Save initial state
  
  // Set up responsive defaults and apply zoom
  handleResponsiveLayout();
  applyZoom();
}

// Reset everything to default with given width and height
function resetEditor(w, h) {
  canvasWidth = w || 16;
  canvasHeight = h || 16;
  frames = [
    { id: generateId(), data: new Uint8Array(canvasWidth * canvasHeight) }
  ];
  currentFrameIndex = 0;
  
  // Update canvas properties with aspect ratio
  const maxDim = Math.max(canvasWidth, canvasHeight);
  const displayW = Math.round((canvasWidth / maxDim) * CANVAS_DISPLAY_SIZE);
  const displayH = Math.round((canvasHeight / maxDim) * CANVAS_DISPLAY_SIZE);
  editorCanvas.width = displayW;
  editorCanvas.height = displayH;
  
  // Sync selects
  if (selectWidth) selectWidth.value = canvasWidth;
  if (selectHeight) selectHeight.value = canvasHeight;
  
  // Initial draw
  updateUI();
  updatePreviewZoom(4); // Default to 4x zoom
  
  // Apply current zoom setting
  applyZoom();
}

function generateId() {
  return Math.floor(Math.random() * 10000000);
}

// --- History Management ---
function saveHistory() {
  // Deep copy frames
  const framesCopy = frames.map(f => ({
    id: f.id,
    data: new Uint8Array(f.data)
  }));
  
  undoStack.push({
    canvasWidth: canvasWidth,
    canvasHeight: canvasHeight,
    frames: framesCopy,
    currentFrameIndex: currentFrameIndex
  });
  
  // Limit history
  if (undoStack.length > MAX_HISTORY) {
    undoStack.shift();
  }
  
  // Clear redo stack on new action
  redoStack = [];
  
  updateHistoryButtons();
}

function undo() {
  if (undoStack.length <= 1) return; // Need to keep at least initial state
  
  const currentState = undoStack.pop();
  redoStack.push(currentState);
  
  const prevState = undoStack[undoStack.length - 1];
  restoreState(prevState);
}

function redo() {
  if (redoStack.length === 0) return;
  
  const nextState = redoStack.pop();
  undoStack.push(nextState);
  restoreState(nextState);
}

function restoreState(state) {
  canvasWidth = state.canvasWidth || state.canvasSize || 16;
  canvasHeight = state.canvasHeight || state.canvasSize || 16;
  if (selectWidth) selectWidth.value = canvasWidth;
  if (selectHeight) selectHeight.value = canvasHeight;
  
  // Deep copy to current frames
  frames = state.frames.map(f => ({
    id: f.id,
    data: new Uint8Array(f.data)
  }));
  currentFrameIndex = state.currentFrameIndex;
  
  // Update canvas properties with aspect ratio
  const maxDim = Math.max(canvasWidth, canvasHeight);
  const displayW = Math.round((canvasWidth / maxDim) * CANVAS_DISPLAY_SIZE);
  const displayH = Math.round((canvasHeight / maxDim) * CANVAS_DISPLAY_SIZE);
  editorCanvas.width = displayW;
  editorCanvas.height = displayH;
  
  updateUI();
  updateHistoryButtons();
  applyZoom();
}

function updateHistoryButtons() {
  btnUndo.disabled = undoStack.length <= 1;
  btnRedo.disabled = redoStack.length === 0;
}

// --- UI rendering ---
function updateUI() {
  drawMainCanvas();
  renderTimeline();
  drawPreview();
  updateExportTab();
  updateColorSwatches();
}

// Main Editor Canvas Drawing
function drawMainCanvas() {
  editorCtx.clearRect(0, 0, editorCanvas.width, editorCanvas.height);
  
  const pixelSize = editorCanvas.width / canvasWidth;
  const currentFrame = frames[currentFrameIndex];
  if (!currentFrame) return;
  
  const colors = isGbcMode ? gbcPalettes[currentGbcPaletteIndex] : PALETTE_THEMES[activeTheme];
  
  // 1. Draw Onion Skin (if enabled and there is a previous frame)
  if (showOnionSkin && currentFrameIndex > 0) {
    const prevFrame = frames[currentFrameIndex - 1];
    editorCtx.globalAlpha = 0.25; // Transparent overlay
    for (let y = 0; y < canvasHeight; y++) {
      for (let x = 0; x < canvasWidth; x++) {
        const colorIdx = prevFrame.data[y * canvasWidth + x];
        if (colorIdx > 0) { // Only draw non-background onion skin for visibility
          editorCtx.fillStyle = colors[colorIdx];
          editorCtx.fillRect(x * pixelSize, y * pixelSize, pixelSize, pixelSize);
        }
      }
    }
    editorCtx.globalAlpha = 1.0; // Reset
  }
  
  // 2. Draw Current Frame Pixels
  for (let y = 0; y < canvasHeight; y++) {
    for (let x = 0; x < canvasWidth; x++) {
      const colorIdx = currentFrame.data[y * canvasWidth + x];
      editorCtx.fillStyle = colors[colorIdx];
      editorCtx.fillRect(x * pixelSize, y * pixelSize, pixelSize, pixelSize);
    }
  }
  
  // 2.1 Draw Floating Paste Data (if any)
  if (selection.isFloating && selection.floatingData) {
    editorCtx.save();
    editorCtx.globalAlpha = 0.8; // Blend paste preview
    for (let y = 0; y < selection.bufferHeight; y++) {
      for (let x = 0; x < selection.bufferWidth; x++) {
        const canvasX = selection.floatingX + x;
        const canvasY = selection.floatingY + y;
        if (canvasX >= 0 && canvasX < canvasWidth && canvasY >= 0 && canvasY < canvasHeight) {
          const colorIdx = selection.floatingData[y * selection.bufferWidth + x];
          editorCtx.fillStyle = colors[colorIdx];
          editorCtx.fillRect(canvasX * pixelSize, canvasY * pixelSize, pixelSize, pixelSize);
        }
      }
    }
    editorCtx.restore();
  }
  
  // 3. Draw Grid Lines
  editorCtx.lineWidth = 1;
  
  // Pixel Grid (fine lines)
  if (showGridPixel && pixelSize > 4) {
    editorCtx.strokeStyle = gridPixelColor;
    editorCtx.beginPath();
    
    // Vertical lines
    for (let i = 1; i < canvasWidth; i++) {
      const pos = Math.floor(i * pixelSize) + 0.5;
      editorCtx.moveTo(pos, 0);
      editorCtx.lineTo(pos, editorCanvas.height);
    }
    // Horizontal lines
    for (let i = 1; i < canvasHeight; i++) {
      const pos = Math.floor(i * pixelSize) + 0.5;
      editorCtx.moveTo(0, pos);
      editorCtx.lineTo(editorCanvas.width, pos);
    }
    editorCtx.stroke();
  }
  
  // Tile Grid (thick lines every 8 pixels)
  const maxDim = Math.max(canvasWidth, canvasHeight);
  if (showGridTile && maxDim > 8) {
    editorCtx.strokeStyle = 'rgba(16, 185, 129, 0.5)'; // Emerald green border
    editorCtx.lineWidth = 2; // Slightly thicker
    editorCtx.beginPath();
    
    // Vertical lines
    for (let i = 8; i < canvasWidth; i += 8) {
      const pos = Math.floor(i * pixelSize);
      editorCtx.moveTo(pos, 0);
      editorCtx.lineTo(pos, editorCanvas.height);
    }
    // Horizontal lines
    for (let i = 8; i < canvasHeight; i += 8) {
      const pos = Math.floor(i * pixelSize);
      editorCtx.moveTo(0, pos);
      editorCtx.lineTo(editorCanvas.width, pos);
    }
    editorCtx.stroke();
  }

  // Sprite Grid (thick lines 8x16)
  if (showGridSprite && maxDim > 8) {
    editorCtx.strokeStyle = 'rgba(245, 158, 11, 0.6)'; // Gold/Orange border
    editorCtx.lineWidth = 2;
    editorCtx.beginPath();
    // Vertical lines every 8 pixels
    for (let i = 8; i < canvasWidth; i += 8) {
      const pos = Math.floor(i * pixelSize);
      editorCtx.moveTo(pos, 0);
      editorCtx.lineTo(pos, editorCanvas.height);
    }
    // Horizontal lines every 16 pixels
    for (let i = 16; i < canvasHeight; i += 16) {
      const pos = Math.floor(i * pixelSize);
      editorCtx.moveTo(0, pos);
      editorCtx.lineTo(editorCanvas.width, pos);
    }
    editorCtx.stroke();
  }
  
  // 3.1 Draw Symmetry Guidelines (if enabled)
  if (showSymmetryH || showSymmetryV) {
    editorCtx.save();
    editorCtx.strokeStyle = 'rgba(56, 189, 248, 0.85)'; // Premium Sky Blue
    editorCtx.lineWidth = 2;
    editorCtx.setLineDash([4, 4]); // Dashed line
    editorCtx.beginPath();
    if (showSymmetryH) {
      // Vertical symmetry line
      const centerX = Math.floor((canvasWidth / 2) * pixelSize);
      editorCtx.moveTo(centerX, 0);
      editorCtx.lineTo(centerX, editorCanvas.height);
    }
    if (showSymmetryV) {
      // Horizontal symmetry line
      const centerY = Math.floor((canvasHeight / 2) * pixelSize);
      editorCtx.moveTo(0, centerY);
      editorCtx.lineTo(editorCanvas.width, centerY);
    }
    editorCtx.stroke();
    editorCtx.restore();
  }
  
  // 4. Draw Active Selection Border
  if (selection.active) {
    editorCtx.strokeStyle = '#3b82f6'; // Blue for selection
    editorCtx.lineWidth = 2;
    editorCtx.setLineDash([6, 4]);
    editorCtx.lineDashOffset = lineDashOffset;
    
    const x1 = Math.min(selection.startX, selection.endX);
    const y1 = Math.min(selection.startY, selection.endY);
    const w = Math.abs(selection.startX - selection.endX) + 1;
    const h = Math.abs(selection.startY - selection.endY) + 1;
    
    editorCtx.strokeRect(x1 * pixelSize, y1 * pixelSize, w * pixelSize, h * pixelSize);
    editorCtx.setLineDash([]); // Reset
  }

  // 5. Draw Floating Selection Border
  if (selection.isFloating && selection.floatingData) {
    editorCtx.strokeStyle = '#f59e0b'; // Amber for floating data
    editorCtx.lineWidth = 2;
    editorCtx.setLineDash([4, 4]);
    editorCtx.lineDashOffset = -lineDashOffset;
    
    editorCtx.strokeRect(
      selection.floatingX * pixelSize,
      selection.floatingY * pixelSize,
      selection.bufferWidth * pixelSize,
      selection.bufferHeight * pixelSize
    );
    editorCtx.setLineDash([]); // Reset
  }

  // 6. Draw Text Tool Preview
  if (activeTool === 'text' && hoverX >= 0 && hoverY >= 0) {
    const textStr = textInput.value || '';
    const fontStr = textFontSelect.value || 'Outfit';
    const sizeVal = parseInt(textSizeInput.value, 10) || 12;
    const isBold = textBold.checked;
    const isItalic = textItalic.checked;
    const thresholdVal = parseInt(textThreshold.value, 10) || 128;
    
    if (textStr) {
      const textPixels = getTextPixels(textStr, fontStr, sizeVal, isBold, isItalic, thresholdVal);
      const colors = isGbcMode ? gbcPalettes[currentGbcPaletteIndex] : PALETTE_THEMES[activeTheme];
      const previewColor = colors[primaryColorIndex];
      
      editorCtx.save();
      editorCtx.globalAlpha = 0.5; // 半透明プレビュー
      editorCtx.fillStyle = previewColor;
      
      for (let ty = 0; ty < textPixels.height; ty++) {
        for (let tx = 0; tx < textPixels.width; tx++) {
          if (textPixels.data[ty][tx] === 1) {
            const canvasX = hoverX + tx;
            const canvasY = hoverY + ty;
            if (canvasX >= 0 && canvasX < canvasWidth && canvasY >= 0 && canvasY < canvasHeight) {
              editorCtx.fillRect(canvasX * pixelSize, canvasY * pixelSize, pixelSize, pixelSize);
            }
          }
        }
      }
      
      // テキスト配置範囲の外枠（エメラルドグリーンの点線）
      editorCtx.strokeStyle = 'rgba(16, 185, 129, 0.8)';
      editorCtx.lineWidth = 1;
      editorCtx.setLineDash([2, 2]);
      editorCtx.strokeRect(
        hoverX * pixelSize,
        hoverY * pixelSize,
        textPixels.width * pixelSize,
        textPixels.height * pixelSize
      );
      
      editorCtx.restore();
    }
  }
}

// Render Timeline panel
function renderTimeline() {
  timelineFramesList.innerHTML = '';
  
  frames.forEach((frame, idx) => {
    const frameEl = document.createElement('div');
    frameEl.className = `frame-item ${idx === currentFrameIndex ? 'active' : ''}`;
    frameEl.dataset.index = idx;
    
    frameEl.draggable = true;
    
    frameEl.addEventListener('dragstart', (e) => {
      e.dataTransfer.setData('text/plain', idx);
      frameEl.classList.add('dragging');
      e.dataTransfer.effectAllowed = 'move';
    });
    
    frameEl.addEventListener('dragend', () => {
      frameEl.classList.remove('dragging');
      document.querySelectorAll('.frame-item').forEach(el => el.classList.remove('drag-over'));
    });
    
    frameEl.addEventListener('dragover', (e) => {
      e.preventDefault();
      frameEl.classList.add('drag-over');
    });
    
    frameEl.addEventListener('dragleave', () => {
      frameEl.classList.remove('drag-over');
    });
    
    frameEl.addEventListener('drop', (e) => {
      e.preventDefault();
      frameEl.classList.remove('drag-over');
      const fromIdx = parseInt(e.dataTransfer.getData('text/plain'), 10);
      const toIdx = idx;
      if (fromIdx !== toIdx && !isNaN(fromIdx)) {
        moveFrame(fromIdx, toIdx);
      }
    });
    
    // Mini canvas for preview
    const miniCanvas = document.createElement('canvas');
    miniCanvas.width = canvasWidth;
    miniCanvas.height = canvasHeight;
    miniCanvas.style.width = '72px';
    miniCanvas.style.height = '72px';
    const miniCtx = miniCanvas.getContext('2d');
    
    // Draw frame on mini canvas
    const colors = PALETTE_THEMES[activeTheme];
    for (let y = 0; y < canvasHeight; y++) {
      for (let x = 0; x < canvasWidth; x++) {
        const colorIdx = frame.data[y * canvasWidth + x];
        miniCtx.fillStyle = colors[colorIdx];
        miniCtx.fillRect(x, y, 1, 1);
      }
    }
    
    frameEl.appendChild(miniCanvas);
    
    // Frame Number Label
    const numLabel = document.createElement('div');
    numLabel.className = 'frame-number';
    numLabel.innerText = idx + 1;
    frameEl.appendChild(numLabel);
    
    // Navigation / Action Buttons inside frame item on hover
    const controls = document.createElement('div');
    controls.className = 'frame-item-controls';
    
    if (idx > 0) {
      const btnLeft = document.createElement('button');
      btnLeft.className = 'btn-frame-nav';
      btnLeft.innerText = '◀';
      btnLeft.title = '前に移動';
      btnLeft.onclick = (e) => {
        e.stopPropagation();
        moveFrame(idx, idx - 1);
      };
      controls.appendChild(btnLeft);
    }
    
    if (idx < frames.length - 1) {
      const btnRight = document.createElement('button');
      btnRight.className = 'btn-frame-nav';
      btnRight.innerText = '▶';
      btnRight.title = '後ろに移動';
      btnRight.onclick = (e) => {
        e.stopPropagation();
        moveFrame(idx, idx + 1);
      };
      controls.appendChild(btnRight);
    }
    
    frameEl.appendChild(controls);
    
    // Selection click handler
    frameEl.onclick = () => {
      selectFrame(idx);
    };
    
    timelineFramesList.appendChild(frameEl);
  });
}

function selectFrame(index) {
  currentFrameIndex = index;
  // If playing, we don't disrupt preview state, but main editor updates
  updateUI();
}

// --- Live Preview Animation Engine ---
function drawPreview() {
  const targetWidth = showPreviewTiling ? canvasWidth * 3 : canvasWidth;
  const targetHeight = showPreviewTiling ? canvasHeight * 3 : canvasHeight;

  // Keep internal canvas dimensions matching target size
  if (previewCanvas.width !== targetWidth || previewCanvas.height !== targetHeight) {
    previewCanvas.width = targetWidth;
    previewCanvas.height = targetHeight;
  }
  
  const colors = isGbcMode ? gbcPalettes[currentGbcPaletteIndex] : PALETTE_THEMES[activeTheme];
  let targetFrameIdx = currentFrameIndex;
  
  if (isPlaying) {
    targetFrameIdx = previewFrameIndex;
  }
  
  const frame = frames[targetFrameIdx];
  if (!frame) return;
  
  // Create offscreen canvas for rendering single frame
  if (!previewTempCanvas) {
    previewTempCanvas = document.createElement('canvas');
  }
  if (previewTempCanvas.width !== canvasWidth || previewTempCanvas.height !== canvasHeight) {
    previewTempCanvas.width = canvasWidth;
    previewTempCanvas.height = canvasHeight;
  }
  const tempCtx = previewTempCanvas.getContext('2d');
  
  // Draw current target frame to temp canvas
  tempCtx.clearRect(0, 0, canvasWidth, canvasHeight);
  for (let y = 0; y < canvasHeight; y++) {
    for (let x = 0; x < canvasWidth; x++) {
      const colorIdx = frame.data[y * canvasWidth + x];
      tempCtx.fillStyle = colors[colorIdx];
      tempCtx.fillRect(x, y, 1, 1);
    }
  }
  
  // Draw temp canvas to main preview canvas with optional blend blur and tiling
  const drawTiled = () => {
    for (let ty = 0; ty < 3; ty++) {
      for (let tx = 0; tx < 3; tx++) {
        previewCtx.drawImage(previewTempCanvas, tx * canvasWidth, ty * canvasHeight);
      }
    }
  };

  if (previewBlurEnabled && isPlaying) {
    // Overwrite with alpha to achieve phosphor response ghosting
    previewCtx.globalAlpha = 0.45;
    if (showPreviewTiling) {
      drawTiled();
    } else {
      previewCtx.drawImage(previewTempCanvas, 0, 0);
    }
    previewCtx.globalAlpha = 1.0; // Restore
  } else {
    previewCtx.clearRect(0, 0, targetWidth, targetHeight);
    if (showPreviewTiling) {
      drawTiled();
    } else {
      previewCtx.drawImage(previewTempCanvas, 0, 0);
    }
  }
}

function startPlayback() {
  if (frames.length <= 1) return;
  isPlaying = true;
  previewFrameIndex = currentFrameIndex;
  
  playIcon.classList.add('hidden');
  pauseIcon.classList.remove('hidden');
  playBtnText.innerText = '一時停止';
  
  runPlaybackLoop();
}

function stopPlayback() {
  isPlaying = false;
  clearInterval(previewInterval);
  previewInterval = null;
  
  playIcon.classList.remove('hidden');
  pauseIcon.classList.add('hidden');
  playBtnText.innerText = '再生';
  
  updateUI();
}

function togglePlayback() {
  if (isPlaying) {
    stopPlayback();
  } else {
    startPlayback();
  }
}

function runPlaybackLoop() {
  if (previewInterval) clearInterval(previewInterval);
  
  previewInterval = setInterval(() => {
    previewFrameIndex = (previewFrameIndex + 1) % frames.length;
    drawPreview();
  }, 1000 / fps);
}

// --- Drawing & Plotting Algorithms ---
function getLinePixels(x0, y0, x1, y1) {
  const pixels = [];
  const dx = Math.abs(x1 - x0);
  const dy = Math.abs(y1 - y0);
  const sx = (x0 < x1) ? 1 : -1;
  const sy = (y0 < y1) ? 1 : -1;
  let err = dx - dy;
  
  let x = x0;
  let y = y0;
  
  while (true) {
    pixels.push({x, y});
    if (x === x1 && y === y1) break;
    const e2 = 2 * err;
    if (e2 > -dy) {
      err -= dy;
      x += sx;
    }
    if (e2 < dx) {
      err += dx;
      y += sy;
    }
  }
  return pixels;
}

function getRectPixels(x0, y0, x1, y1) {
  const pixels = [];
  const minX = Math.min(x0, x1);
  const maxX = Math.max(x0, x1);
  const minY = Math.min(y0, y1);
  const maxY = Math.max(y0, y1);
  
  for (let x = minX; x <= maxX; x++) {
    pixels.push({x, y: minY});
    if (minY !== maxY) {
      pixels.push({x, y: maxY});
    }
  }
  for (let y = minY + 1; y < maxY; y++) {
    pixels.push({x: minX, y});
    if (minX !== maxX) {
      pixels.push({x: maxX, y});
    }
  }
  return pixels;
}

function getEllipsePixels(x0, y0, x1, y1) {
  const pixels = [];
  let x0_val = Math.min(x0, x1);
  let x1_val = Math.max(x0, x1);
  let y0_val = Math.min(y0, y1);
  let y1_val = Math.max(y0, y1);
  
  let a = Math.abs(x1_val - x0_val);
  let b = Math.abs(y1_val - y0_val);
  let b1 = b & 1;
  let dx = 4 * (1 - a) * b * b;
  let dy = 4 * (b1 + 1) * a * a;
  let err = dx + dy + b1 * a * a;
  let e2;

  y0_val += Math.floor((b + 1) / 2);
  y1_val = y0_val - b1;
  a *= 8 * a;
  b1 = 8 * b * b;

  do {
    pixels.push({x: x1_val, y: y0_val});
    pixels.push({x: x0_val, y: y0_val});
    pixels.push({x: x0_val, y: y1_val});
    pixels.push({x: x1_val, y: y1_val});
    e2 = 2 * err;
    if (e2 <= dy) {
      y0_val++;
      y1_val--;
      err += dy += a;
    }
    if (e2 >= dx || 2 * err > dy) {
      x0_val++;
      x1_val--;
      err += dx += b1;
    }
  } while (x0_val <= x1_val);
  
  while (y0_val - y1_val < b) {
    pixels.push({x: x0_val - 1, y: y0_val});
    pixels.push({x: x1_val + 1, y: y0_val++});
    pixels.push({x: x0_val - 1, y: y1_val});
    pixels.push({x: x1_val + 1, y: y1_val--});
  }
  return pixels;
}

function applyShearToPixels(pixels, shearVal, direction = 'horizontal') {
  if (pixels.length === 0 || shearVal === 0) return pixels;

  let minVal = Infinity, maxVal = -Infinity;
  pixels.forEach(pt => {
    const val = (direction === 'horizontal') ? pt.y : pt.x;
    if (val < minVal) minVal = val;
    if (val > maxVal) maxVal = val;
  });
  const anchor = (minVal + maxVal) / 2;

  const getShift = (val) => Math.round((val - anchor) * shearVal);

  const sheared = [];
  const visited = new Set();
  const addPoint = (x, y) => {
    const key = `${x},${y}`;
    if (!visited.has(key)) {
      visited.add(key);
      sheared.push({ x, y });
    }
  };

  const originalSet = new Set(pixels.map(p => `${p.x},${p.y}`));

  if (direction === 'horizontal') {
    pixels.forEach(pt => {
      const dx = getShift(pt.y);
      const xCurr = pt.x + dx;
      addPoint(xCurr, pt.y);

      // 下方向への連結性チェック
      const hasDownConnection = 
        originalSet.has(`${pt.x},${pt.y + 1}`) ||
        originalSet.has(`${pt.x - 1},${pt.y + 1}`) ||
        originalSet.has(`${pt.x + 1},${pt.y + 1}`);

      if (hasDownConnection) {
        const dxNext = getShift(pt.y + 1);
        const diff = dxNext - dx;
        if (diff > 1) {
          for (let k = 1; k < diff; k++) {
            addPoint(xCurr + k, pt.y);
          }
        } else if (diff < -1) {
          for (let k = -1; k > diff; k--) {
            addPoint(xCurr + k, pt.y);
          }
        }
      }
    });
  } else {
    // vertical
    pixels.forEach(pt => {
      const dy = getShift(pt.x);
      const yCurr = pt.y + dy;
      addPoint(pt.x, yCurr);

      // 右方向への連結性チェック
      const hasRightConnection = 
        originalSet.has(`${pt.x + 1},${pt.y}`) ||
        originalSet.has(`${pt.x + 1},${pt.y - 1}`) ||
        originalSet.has(`${pt.x + 1},${pt.y + 1}`);

      if (hasRightConnection) {
        const dyNext = getShift(pt.x + 1);
        const diff = dyNext - dy;
        if (diff > 1) {
          for (let k = 1; k < diff; k++) {
            addPoint(pt.x, yCurr + k);
          }
        } else if (diff < -1) {
          for (let k = -1; k > diff; k--) {
            addPoint(pt.x, yCurr + k);
          }
        }
      }
    });
  }

  return sheared;
}

function addPixelToPath(x, y) {
  if (pixelPerfectPath.length > 0) {
    const last = pixelPerfectPath[pixelPerfectPath.length - 1];
    if (last.x === x && last.y === y) return;
  }
  
  pixelPerfectPath.push({x, y});
  
  if (showPixelPerfect && brushSize === 1 && pixelPerfectPath.length >= 3) {
    const A = pixelPerfectPath[pixelPerfectPath.length - 3];
    const B = pixelPerfectPath[pixelPerfectPath.length - 2];
    const C = pixelPerfectPath[pixelPerfectPath.length - 1];
    
    if (Math.abs(A.x - C.x) === 1 && Math.abs(A.y - C.y) === 1) {
      if ((B.x === A.x && B.y === C.y) || (B.x === C.x && B.y === A.y)) {
        pixelPerfectPath.splice(pixelPerfectPath.length - 2, 1);
      }
    }
  }
}

function drawPixelWithSymmetry(x, y, colorVal) {
  const currentFrame = frames[currentFrameIndex];
  if (!currentFrame) return;
  
  if (showSeamless) {
    x = (x % canvasWidth + canvasWidth) % canvasWidth;
    y = (y % canvasHeight + canvasHeight) % canvasHeight;
  }
  
  // 元のピクセル
  if (x >= 0 && x < canvasWidth && y >= 0 && y < canvasHeight) {
    currentFrame.data[y * canvasWidth + x] = colorVal;
  }
  
  // 左右対称
  if (showSymmetryH) {
    const symX = canvasWidth - 1 - x;
    if (symX >= 0 && symX < canvasWidth && y >= 0 && y < canvasHeight) {
      currentFrame.data[y * canvasWidth + symX] = colorVal;
    }
  }
  
  // 上下対称
  if (showSymmetryV) {
    const symY = canvasHeight - 1 - y;
    if (x >= 0 && x < canvasWidth && symY >= 0 && symY < canvasHeight) {
      currentFrame.data[symY * canvasWidth + x] = colorVal;
    }
  }
  
  // 4方向対称 (左右かつ上下)
  if (showSymmetryH && showSymmetryV) {
    const symX = canvasWidth - 1 - x;
    const symY = canvasHeight - 1 - y;
    if (symX >= 0 && symX < canvasWidth && symY >= 0 && symY < canvasHeight) {
      currentFrame.data[symY * canvasWidth + symX] = colorVal;
    }
  }
}

function getBrushOffsetRange(size) {
  const halfSize = Math.floor((size - 1) / 2);
  const minOffset = -halfSize;
  const maxOffset = size - 1 - halfSize;
  return { minOffset, maxOffset };
}

function applyPathToData() {
  const currentFrame = frames[currentFrameIndex];
  if (!currentFrame || !drawingStartData) return;
  
  currentFrame.data.set(drawingStartData);
  
  const { minOffset, maxOffset } = getBrushOffsetRange(brushSize);
  
  if (activeTool === 'pen' || activeTool === 'eraser' || activeTool === 'dither') {
    const colorIndex = (drawingButton === 2) ? secondaryColorIndex : primaryColorIndex;
    
    pixelPerfectPath.forEach(pt => {
      for (let dy = minOffset; dy <= maxOffset; dy++) {
        for (let dx = minOffset; dx <= maxOffset; dx++) {
          const px = pt.x + dx;
          const py = pt.y + dy;
          
          let val = 0;
          if (activeTool === 'pen') {
            val = colorIndex;
          } else if (activeTool === 'eraser') {
            val = 0;
          } else if (activeTool === 'dither') {
            const threshold = ditherPattern === '25%' ? 4 : ditherPattern === '75%' ? 12 : 8;
            const isPrimary = bayer4x4[py % 4][px % 4] < threshold;
            const colorIndex1 = (drawingButton === 2) ? secondaryColorIndex : primaryColorIndex;
            const colorIndex2 = (drawingButton === 2) ? primaryColorIndex : secondaryColorIndex;
            val = isPrimary ? colorIndex1 : colorIndex2;
          }
          
          drawPixelWithSymmetry(px, py, val);
        }
      }
    });
  } else if (activeTool === 'shade') {
    // Collect all unique coordinate indices affected in this stroke (including symmetry)
    const targetPixels = new Set();
    
    pixelPerfectPath.forEach(pt => {
      for (let dy = minOffset; dy <= maxOffset; dy++) {
        for (let dx = minOffset; dx <= maxOffset; dx++) {
          const px = pt.x + dx;
          const py = pt.y + dy;
          
          // Original pixel
          if (px >= 0 && px < canvasWidth && py >= 0 && py < canvasHeight) {
            targetPixels.add(py * canvasWidth + px);
          }
          
          // Horizontal Symmetry
          if (showSymmetryH) {
            const symX = canvasWidth - 1 - px;
            if (symX >= 0 && symX < canvasWidth && py >= 0 && py < canvasHeight) {
              targetPixels.add(py * canvasWidth + symX);
            }
          }
          // Vertical Symmetry
          if (showSymmetryV) {
            const symY = canvasHeight - 1 - py;
            if (px >= 0 && px < canvasWidth && symY >= 0 && symY < canvasHeight) {
              targetPixels.add(symY * canvasWidth + px);
            }
          }
          // 4-way Symmetry
          if (showSymmetryH && showSymmetryV) {
            const symX = canvasWidth - 1 - px;
            const symY = canvasHeight - 1 - py;
            if (symX >= 0 && symX < canvasWidth && symY >= 0 && symY < canvasHeight) {
              targetPixels.add(symY * canvasWidth + symX);
            }
          }
        }
      }
    });
    
    // Apply shading to the collected pixels on top of start data
    targetPixels.forEach(idx => {
      const originalColor = drawingStartData[idx];
      let newColor = originalColor;
      if (shadingMode === 'darken') {
        newColor = Math.min(3, originalColor + 1);
      } else {
        newColor = Math.max(0, originalColor - 1);
      }
      currentFrame.data[idx] = newColor;
    });
  }
}

function applyShapePreview(x0, y0, x1, y1, shiftPressed) {
  const currentFrame = frames[currentFrameIndex];
  if (!currentFrame || !drawingStartData) return;
  
  currentFrame.data.set(drawingStartData);
  
  const colorIndex = (drawingButton === 2) ? secondaryColorIndex : primaryColorIndex;
  let shapePixels = [];
  
  if (activeTool === 'line') {
    if (shiftPressed) {
      const dx = x1 - x0;
      const dy = y1 - y0;
      if (Math.abs(dx) > Math.abs(dy) * 2) {
        x1 = x0 + dx;
        y1 = y0;
      } else if (Math.abs(dy) > Math.abs(dx) * 2) {
        x1 = x0;
        y1 = y0 + dy;
      } else {
        const r = Math.round((Math.abs(dx) + Math.abs(dy)) / 2);
        x1 = x0 + Math.sign(dx) * r;
        y1 = y0 + Math.sign(dy) * r;
      }
    }
    shapePixels = getLinePixels(x0, y0, x1, y1);
  } else if (activeTool === 'rect') {
    if (shiftPressed) {
      const side = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0));
      x1 = x0 + Math.sign(x1 - x0) * side;
      y1 = y0 + Math.sign(y1 - y0) * side;
    }
    shapePixels = getRectPixels(x0, y0, x1, y1);
  } else if (activeTool === 'ellipse') {
    if (shiftPressed) {
      const rx = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0));
      x1 = x0 + Math.sign(x1 - x0) * rx;
      y1 = y0 + Math.sign(y1 - y0) * rx;
    }
    shapePixels = getEllipsePixels(x0, y0, x1, y1);
  }
  
  if (shapeShear !== 0) {
    shapePixels = applyShearToPixels(shapePixels, shapeShear, shapeShearDir);
  }
  
  const { minOffset, maxOffset } = getBrushOffsetRange(brushSize);
  shapePixels.forEach(pt => {
    for (let dy = minOffset; dy <= maxOffset; dy++) {
      for (let dx = minOffset; dx <= maxOffset; dx++) {
        drawPixelWithSymmetry(pt.x + dx, pt.y + dy, colorIndex);
      }
    }
  });
}

// --- Drawing Interaction ---
function handleDrawEvent(e) {
  const rect = editorCanvas.getBoundingClientRect();
  const scaleX = editorCanvas.width / rect.width;
  const scaleY = editorCanvas.height / rect.height;
  
  const pixelSize = editorCanvas.width / canvasWidth;
  
  const mouseX = (e.clientX - rect.left) * scaleX;
  const mouseY = (e.clientY - rect.top) * scaleY;
  
  const x = Math.floor(mouseX / pixelSize);
  const y = Math.floor(mouseY / pixelSize);
  
  if (x >= 0 && x < canvasWidth && y >= 0 && y < canvasHeight) {
    executeToolAction(x, y, drawingButton);
  }
}

function executeToolAction(x, y, button) {
  const currentFrame = frames[currentFrameIndex];
  if (!currentFrame) return;
  
  const targetIndex = y * canvasWidth + x;
  const colorIndex = (button === 2) ? secondaryColorIndex : primaryColorIndex;
  
  if (activeTool === 'pen') {
    if (currentFrame.data[targetIndex] !== colorIndex) {
      currentFrame.data[targetIndex] = colorIndex;
      drawMainCanvas();
    }
  } else if (activeTool === 'eraser') {
    if (currentFrame.data[targetIndex] !== 0) {
      currentFrame.data[targetIndex] = 0;
      drawMainCanvas();
    }
  } else if (activeTool === 'picker') {
    const pickedColorIdx = currentFrame.data[targetIndex];
    if (button === 2) {
      secondaryColorIndex = pickedColorIdx;
    } else {
      primaryColorIndex = pickedColorIdx;
    }
    updateColorSwatches();
    // Switch tool back to pen
    setActiveTool('pen');
  } else if (activeTool === 'fill') {
    const prevColor = currentFrame.data[targetIndex];
    if (prevColor !== colorIndex) {
      floodFill(x, y, prevColor, colorIndex);
      drawMainCanvas();
    }
  }
}

function getTextPixels(text, font, size, isBold, isItalic, threshold) {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  
  const fontStyle = `${isItalic ? 'italic' : ''} ${isBold ? 'bold' : ''} ${size}px "${font}"`.trim();
  ctx.font = fontStyle;
  ctx.textBaseline = 'top';
  ctx.textAlign = 'left';
  
  const metrics = ctx.measureText(text);
  const textWidth = Math.max(1, Math.ceil(metrics.width));
  const textHeight = Math.max(1, Math.ceil(size * 1.5));
  
  canvas.width = textWidth;
  canvas.height = textHeight;
  
  // Re-apply style after resizing
  ctx.font = fontStyle;
  ctx.textBaseline = 'top';
  ctx.textAlign = 'left';
  
  ctx.fillStyle = '#000000';
  ctx.fillText(text, 0, 0);
  
  const imgData = ctx.getImageData(0, 0, textWidth, textHeight);
  const pixels = [];
  
  for (let y = 0; y < textHeight; y++) {
    const row = [];
    for (let x = 0; x < textWidth; x++) {
      const idx = (y * textWidth + x) * 4;
      const alpha = imgData.data[idx + 3];
      row.push(alpha >= threshold ? 1 : 0);
    }
    pixels.push(row);
  }
  
  return {
    width: textWidth,
    height: textHeight,
    data: pixels
  };
}

// Classic Flood Fill Algorithm
function floodFill(startX, startY, targetColor, replacementColor) {
  const currentFrame = frames[currentFrameIndex];
  if (!currentFrame) return;
  
  const queue = [[startX, startY]];
  
  while (queue.length > 0) {
    const [cx, cy] = queue.shift();
    const idx = cy * canvasWidth + cx;
    
    if (currentFrame.data[idx] === targetColor) {
      currentFrame.data[idx] = replacementColor;
      
      // Check neighbors
      if (cx > 0) queue.push([cx - 1, cy]);
      if (cx < canvasWidth - 1) queue.push([cx + 1, cy]);
      if (cy > 0) queue.push([cx, cy - 1]);
      if (cy < canvasHeight - 1) queue.push([cx, cy + 1]);
    }
  }
}

// --- Frame Actions ---
function moveFrame(fromIdx, toIdx) {
  if (toIdx < 0 || toIdx >= frames.length) return;
  if (fromIdx < 0 || fromIdx >= frames.length) return;
  
  const currentFrame = frames[currentFrameIndex];
  const targetFrame = frames[fromIdx];
  frames.splice(fromIdx, 1);
  frames.splice(toIdx, 0, targetFrame);
  
  if (currentFrame) {
    currentFrameIndex = frames.indexOf(currentFrame);
  }
  
  saveHistory();
  updateUI();
}

function addFrame() {
  const newFrame = {
    id: generateId(),
    data: new Uint8Array(canvasWidth * canvasHeight)
  };
  frames.splice(currentFrameIndex + 1, 0, newFrame);
  currentFrameIndex++;
  
  saveHistory();
  updateUI();
}

function duplicateFrame() {
  const currentFrame = frames[currentFrameIndex];
  if (!currentFrame) return;
  
  const newFrame = {
    id: generateId(),
    data: new Uint8Array(currentFrame.data)
  };
  frames.splice(currentFrameIndex + 1, 0, newFrame);
  currentFrameIndex++;
  
  saveHistory();
  updateUI();
}

function deleteFrame() {
  if (frames.length <= 1) {
    // Cannot delete last frame, clear it instead
    clearCanvas();
    return;
  }
  
  frames.splice(currentFrameIndex, 1);
  if (currentFrameIndex >= frames.length) {
    currentFrameIndex = frames.length - 1;
  }
  
  saveHistory();
  updateUI();
}

function clearCanvas() {
  const currentFrame = frames[currentFrameIndex];
  if (!currentFrame) return;
  
  currentFrame.data.fill(0);
  
  saveHistory();
  updateUI();
}

// --- Transform Operations ---
function flipHorizontal() {
  const currentFrame = frames[currentFrameIndex];
  if (!currentFrame) return;
  
  const newData = new Uint8Array(canvasWidth * canvasHeight);
  for (let y = 0; y < canvasHeight; y++) {
    for (let x = 0; x < canvasWidth; x++) {
      newData[y * canvasWidth + x] = currentFrame.data[y * canvasWidth + (canvasWidth - 1 - x)];
    }
  }
  currentFrame.data = newData;
  saveHistory();
  updateUI();
}

function flipVertical() {
  const currentFrame = frames[currentFrameIndex];
  if (!currentFrame) return;
  
  const newData = new Uint8Array(canvasWidth * canvasHeight);
  for (let y = 0; y < canvasHeight; y++) {
    for (let x = 0; x < canvasWidth; x++) {
      newData[y * canvasWidth + x] = currentFrame.data[(canvasHeight - 1 - y) * canvasWidth + x];
    }
  }
  currentFrame.data = newData;
  saveHistory();
  updateUI();
}

function rotateClockwise() {
  if (canvasWidth !== canvasHeight) {
    alert("非正方形のキャンバスは回転できません。");
    return;
  }
  const currentFrame = frames[currentFrameIndex];
  if (!currentFrame) return;
  
  const newData = new Uint8Array(canvasWidth * canvasHeight);
  for (let y = 0; y < canvasHeight; y++) {
    for (let x = 0; x < canvasWidth; x++) {
      // (x, y) becomes (width - 1 - y, x)
      newData[x * canvasWidth + (canvasWidth - 1 - y)] = currentFrame.data[y * canvasWidth + x];
    }
  }
  currentFrame.data = newData;
  saveHistory();
  updateUI();
}

function shiftCanvas(dx, dy) {
  const currentFrame = frames[currentFrameIndex];
  if (!currentFrame) return;
  
  const newData = new Uint8Array(canvasWidth * canvasHeight);
  for (let y = 0; y < canvasHeight; y++) {
    for (let x = 0; x < canvasWidth; x++) {
      const tx = x + dx;
      const ty = y + dy;
      if (tx >= 0 && tx < canvasWidth && ty >= 0 && ty < canvasHeight) {
        newData[ty * canvasWidth + tx] = currentFrame.data[y * canvasWidth + x];
      }
    }
  }
  currentFrame.data = newData;
  saveHistory();
  updateUI();
}

function shearHorizontal(direction) {
  const currentFrame = frames[currentFrameIndex];
  if (!currentFrame) return;

  let targetData, W, H, isSelection = false;

  if (selection.isFloating && selection.floatingData) {
    targetData = selection.floatingData;
    W = selection.bufferWidth;
    H = selection.bufferHeight;
    isSelection = true;
  } else {
    targetData = currentFrame.data;
    W = canvasWidth;
    H = canvasHeight;
  }

  const newData = new Uint8Array(W * H);
  const yMid = (H - 1) / 2;
  const factor = 0.25;

  for (let y = 0; y < H; y++) {
    let dx = Math.round((y - yMid) * factor);
    if (direction === 'left') {
      dx = -dx;
    }

    for (let x = 0; x < W; x++) {
      const tx = x + dx;
      if (tx >= 0 && tx < W) {
        newData[y * W + tx] = targetData[y * W + x];
      }
    }
  }

  if (isSelection) {
    selection.floatingData = newData;
    drawMainCanvas();
  } else {
    currentFrame.data = newData;
    saveHistory();
    updateUI();
  }
}

function shearVertical(direction) {
  const currentFrame = frames[currentFrameIndex];
  if (!currentFrame) return;

  let targetData, W, H, isSelection = false;

  if (selection.isFloating && selection.floatingData) {
    targetData = selection.floatingData;
    W = selection.bufferWidth;
    H = selection.bufferHeight;
    isSelection = true;
  } else {
    targetData = currentFrame.data;
    W = canvasWidth;
    H = canvasHeight;
  }

  const newData = new Uint8Array(W * H);
  const xMid = (W - 1) / 2;
  const factor = 0.25;

  for (let x = 0; x < W; x++) {
    let dy = Math.round((x - xMid) * factor);
    if (direction === 'up') {
      dy = -dy;
    }

    for (let y = 0; y < H; y++) {
      const ty = y + dy;
      if (ty >= 0 && ty < H) {
        newData[ty * W + x] = targetData[y * W + x];
      }
    }
  }

  if (isSelection) {
    selection.floatingData = newData;
    drawMainCanvas();
  } else {
    currentFrame.data = newData;
    saveHistory();
    updateUI();
  }
}

// --- Import / Export Logic (GBDK2020 C Arrays) ---

// Convert current frame & size setup to GBDK2020 format
function generateGBDK2020Code() {
  const totalTilesX = canvasWidth / 8;
  const totalTilesY = canvasHeight / 8;
  const tilesPerFrame = totalTilesX * totalTilesY;
  
  let code = `/*\n  GBDK 2020 Tile Data\n  Generated by GBDotEditor\n  Size: ${canvasWidth}x${canvasHeight} pixels (${tilesPerFrame} tiles/frame)\n  Frames: ${frames.length} (Total ${tilesPerFrame * frames.length} tiles)\n*/\n\n`;
  code += `#define my_tile_width ${canvasWidth}\n`;
  code += `#define my_tile_height ${canvasHeight}\n`;
  code += `#define my_tile_num_tiles ${tilesPerFrame}\n`;
  code += `#define my_tile_num_frames ${frames.length}\n\n`;
  code += `const unsigned char my_tile_data[] = {\n`;
  
  frames.forEach((frame, fIdx) => {
    code += `  // === FRAME ${fIdx} ===\n`;
    
    for (let ty = 0; ty < totalTilesY; ty++) {
      for (let tx = 0; tx < totalTilesX; tx++) {
        code += `  // Tile ${ty * totalTilesX + tx} (${tx},${ty})\n  `;
        
        const bytes = [];
        // Extract 8x8 pixels for this tile and convert to 16 bytes (2bpp)
        for (let py = 0; py < 8; py++) {
          let lowByte = 0;
          let highByte = 0;
          
          for (let px = 0; px < 8; px++) {
            const canvasX = tx * 8 + px;
            const canvasY = ty * 8 + py;
            const colorIdx = frame.data[canvasY * canvasWidth + canvasX];
            
            const lowBit = colorIdx & 1;
            const highBit = (colorIdx >> 1) & 1;
            
            // Shift MSB to LSB
            lowByte |= (lowBit << (7 - px));
            highByte |= (highBit << (7 - px));
          }
          
          bytes.push(lowByte);
          bytes.push(highByte);
        }
        
        // Format as hex strings
        const hexStrs = bytes.map(b => '0x' + b.toString(16).padStart(2, '0').toUpperCase());
        code += hexStrs.join(', ') + ',\n';
      }
    }
    code += '\n';
  });
  
  // Remove the last comma and newline, close braces
  code = code.trim().replace(/,$/, '') + '\n};';
  
  if (isGbcMode) {
    code += `\n\n/* GBDK 2020 Color Palette Data */\n`;
    code += `// GBC Palette macros (UWORD arrays of 4 colors)\n`;
    
    gbcPalettes.forEach((palette, pIdx) => {
      code += `const UWORD my_palette_${pIdx}[] = {\n  `;
      const macroVals = palette.map(hex => {
        // Convert hex #RRGGBB to RGB(r, g, b) where r, g, b are 0..31
        const r = parseInt(hex.substr(1, 2), 16);
        const g = parseInt(hex.substr(3, 2), 16);
        const b = parseInt(hex.substr(5, 2), 16);
        const r5 = Math.floor(r / 8);
        const g5 = Math.floor(g / 8);
        const b5 = Math.floor(b / 8);
        return `RGB(${r5}, ${g5}, ${b5})`;
      });
      code += macroVals.join(', ') + `\n};\n`;
    });
  }

  return code;
}

function importGBDK2020Code(cCodeText) {
  // 1. Detect width and height from #define
  let detectedWidth = null;
  let detectedHeight = null;
  
  const widthMatch = cCodeText.match(/#define\s+\w+_width\s+(\d+)/i);
  const heightMatch = cCodeText.match(/#define\s+\w+_height\s+(\d+)/i);
  
  if (widthMatch) detectedWidth = parseInt(widthMatch[1]);
  if (heightMatch) detectedHeight = parseInt(heightMatch[1]);
  
  let targetW = canvasWidth;
  let targetH = canvasHeight;
  if (detectedWidth && detectedHeight) {
    if (detectedWidth % 8 === 0 && detectedHeight % 8 === 0 &&
        detectedWidth >= 8 && detectedWidth <= 160 &&
        detectedHeight >= 8 && detectedHeight <= 144) {
      if (detectedWidth !== canvasWidth || detectedHeight !== canvasHeight) {
        const confirmResize = confirm(`インポートデータのサイズは ${detectedWidth}x${detectedHeight} ピクセルです。\nキャンバスサイズを変更してインポートしますか？\n（現在の描画内容は失われます）`);
        if (!confirmResize) {
          return;
        }
        targetW = detectedWidth;
        targetH = detectedHeight;
      }
    }
  }

  // 2. Clean comments from C code to avoid matching hex-like words in comments
  let cleanCode = cCodeText
    .replace(/\/\*[\s\S]*?\*\//g, '') // Remove block comments
    .replace(/\/\/.*$/gm, '');        // Remove line comments
    
  // 3. Extract content inside braces { ... }
  const braceMatch = cleanCode.match(/\{([\s\S]*?)\}/);
  let arrayDataText = braceMatch ? braceMatch[1] : cleanCode;
  
  // 4. Extract hex values
  // Prefer prefix 0x/0X first, fallback to splitting by separators if not found
  const hexWithPrefixPattern = /0[xX][0-9A-Fa-f]{1,2}/g;
  let matches = arrayDataText.match(hexWithPrefixPattern);
  
  if (!matches || matches.length === 0) {
    const tokens = arrayDataText.split(/[\s,]+/).map(t => t.trim()).filter(t => t.length > 0);
    matches = tokens.filter(t => /^[0-9A-Fa-f]{2}$/.test(t)).map(t => "0x" + t);
  }
  
  if (!matches || matches.length === 0) {
    alert("C配列内の16進数データを検出できませんでした。フォーマットをご確認ください。");
    return;
  }
  
  // Convert matches to numbers
  const bytes = matches.map(m => parseInt(m, 16));
  
  // Apply size change if necessary
  if (targetW !== canvasWidth || targetH !== canvasHeight) {
    canvasWidth = targetW;
    canvasHeight = targetH;
    if (selectWidth) selectWidth.value = canvasWidth;
    if (selectHeight) selectHeight.value = canvasHeight;
    
    // Reset canvas dimensions and stacks
    const maxDim = Math.max(canvasWidth, canvasHeight);
    const displayW = Math.round((canvasWidth / maxDim) * CANVAS_DISPLAY_SIZE);
    const displayH = Math.round((canvasHeight / maxDim) * CANVAS_DISPLAY_SIZE);
    editorCanvas.width = displayW;
    editorCanvas.height = displayH;
    
    undoStack = [];
    redoStack = [];
    updatePreviewZoom(4);
    applyZoom();
  }
  
  // Determine frames from byte counts
  const tilesPerFrame = (canvasWidth / 8) * (canvasHeight / 8);
  const bytesPerFrame = tilesPerFrame * 16;
  
  const numFramesCalculated = Math.max(1, Math.ceil(bytes.length / bytesPerFrame));
  
  // Rebuild frames array
  const importedFrames = [];
  
  for (let f = 0; f < numFramesCalculated; f++) {
    const frameData = new Uint8Array(canvasWidth * canvasHeight);
    const frameByteStart = f * bytesPerFrame;
    
    const totalTilesX = canvasWidth / 8;
    const totalTilesY = canvasHeight / 8;
    
    for (let ty = 0; ty < totalTilesY; ty++) {
      for (let tx = 0; tx < totalTilesX; tx++) {
        const tileIdx = ty * totalTilesX + tx;
        const tileByteStart = frameByteStart + tileIdx * 16;
        
        for (let py = 0; py < 8; py++) {
          const lowByteIdx = tileByteStart + py * 2;
          const highByteIdx = tileByteStart + py * 2 + 1;
          
          const lowByte = lowByteIdx < bytes.length ? bytes[lowByteIdx] : 0;
          const highByte = highByteIdx < bytes.length ? bytes[highByteIdx] : 0;
          
          for (let px = 0; px < 8; px++) {
            const lowBit = (lowByte >> (7 - px)) & 1;
            const highBit = (highByte >> (7 - px)) & 1;
            const colorIdx = (highBit << 1) | lowBit;
            
            const canvasX = tx * 8 + px;
            const canvasY = ty * 8 + py;
            frameData[canvasY * canvasWidth + canvasX] = colorIdx;
          }
        }
      }
    }
    
    importedFrames.push({
      id: generateId(),
      data: frameData
    });
  }
  
  // Apply imported frames
  frames = importedFrames;
  currentFrameIndex = 0;
  
  saveHistory();
  updateUI();
  
  alert(`C配列の読み込みが成功しました。 (${frames.length} フレーム)`);
}

function updateExportTab() {
  if (document.querySelector('.tab-btn[data-tab="tab-gbdk"]').classList.contains('active')) {
    cCodeIo.value = generateGBDK2020Code();
  }
}

// --- Import / Export JSON ---
function exportProjectJson() {
  // Serialize Uint8Arrays to standard arrays for JSON serialization
  const serializedFrames = frames.map(f => ({
    id: f.id,
    data: Array.from(f.data)
  }));
  
  const project = {
    appName: "GBDotEditor",
    version: "1.0",
    canvasWidth: canvasWidth,
    canvasHeight: canvasHeight,
    activeTheme: activeTheme,
    frames: serializedFrames
  };
  
  const blob = new Blob([JSON.stringify(project, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  
  const a = document.createElement('a');
  a.href = url;
  a.download = `gb_project_${canvasWidth}x${canvasHeight}_${Date.now()}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function importProjectJson(file) {
  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const project = JSON.parse(e.target.result);
      if (project.appName !== "GBDotEditor") {
        throw new Error("Invalid project file.");
      }
      
      canvasWidth = parseInt(project.canvasWidth || project.canvasSize || 16);
      canvasHeight = parseInt(project.canvasHeight || project.canvasSize || 16);
      if (selectWidth) selectWidth.value = canvasWidth;
      if (selectHeight) selectHeight.value = canvasHeight;
      activeTheme = project.activeTheme || 'classic';
      
      // Update canvas properties with aspect ratio
      const maxDim = Math.max(canvasWidth, canvasHeight);
      const displayW = Math.round((canvasWidth / maxDim) * CANVAS_DISPLAY_SIZE);
      const displayH = Math.round((canvasHeight / maxDim) * CANVAS_DISPLAY_SIZE);
      editorCanvas.width = displayW;
      editorCanvas.height = displayH;
      applyZoom();
      
      if (activeTheme === 'classic') {
        paletteClassic.classList.add('active');
        palettePocket.classList.remove('active');
      } else {
        paletteClassic.classList.remove('active');
        palettePocket.classList.add('active');
      }
      updatePaletteColors();
      
      frames = project.frames.map(f => ({
        id: f.id || generateId(),
        data: new Uint8Array(f.data)
      }));
      
      currentFrameIndex = 0;
      
      saveHistory();
      updateUI();
      
      alert(`プロジェクトの復元が成功しました。 (${frames.length} フレーム)`);
    } catch (err) {
      alert("プロジェクトファイルの読み込みに失敗しました。ファイル形式をご確認ください。");
    }
  };
  reader.readAsText(file);
}

// --- PNG Exports ---
function exportPngCurrent() {
  const currentFrame = frames[currentFrameIndex];
  if (!currentFrame) return;
  
  const exportCanvas = document.createElement('canvas');
  exportCanvas.width = canvasWidth;
  exportCanvas.height = canvasHeight;
  const ctx = exportCanvas.getContext('2d');
  
  const colors = PALETTE_THEMES[activeTheme];
  for (let y = 0; y < canvasHeight; y++) {
    for (let x = 0; x < canvasWidth; x++) {
      const colorIdx = currentFrame.data[y * canvasWidth + x];
      ctx.fillStyle = colors[colorIdx];
      ctx.fillRect(x, y, 1, 1);
    }
  }
  
  triggerDownload(exportCanvas.toDataURL(), `gb_tile_frame_${currentFrameIndex + 1}.png`);
}

function exportPngSheet() {
  const exportCanvas = document.createElement('canvas');
  exportCanvas.width = canvasWidth * frames.length;
  exportCanvas.height = canvasHeight;
  const ctx = exportCanvas.getContext('2d');
  
  const colors = PALETTE_THEMES[activeTheme];
  
  frames.forEach((frame, idx) => {
    const startX = idx * canvasWidth;
    for (let y = 0; y < canvasHeight; y++) {
      for (let x = 0; x < canvasWidth; x++) {
        const colorIdx = frame.data[y * canvasWidth + x];
        ctx.fillStyle = colors[colorIdx];
        ctx.fillRect(startX + x, y, 1, 1);
      }
    }
  });
  
  triggerDownload(exportCanvas.toDataURL(), `gb_tile_spritesheet_${frames.length}f.png`);
}

function triggerDownload(dataUrl, filename) {
  const a = document.createElement('a');
  a.href = dataUrl;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

// --- Event Listeners and Setup ---
function setupEventListeners() {
  // Size select
  const onSizeChange = () => {
    const newW = parseInt(selectWidth.value);
    const newH = parseInt(selectHeight.value);
    if (confirm("キャンバスサイズを変更すると現在の描画内容がクリアされます。よろしいですか？")) {
      resetEditor(newW, newH);
      undoStack = [];
      redoStack = [];
      saveHistory();
    } else {
      if (selectWidth) selectWidth.value = canvasWidth;
      if (selectHeight) selectHeight.value = canvasHeight;
    }
  };
  if (selectWidth) selectWidth.addEventListener('change', onSizeChange);
  if (selectHeight) selectHeight.addEventListener('change', onSizeChange);
  
  // Disable default context menu on canvas
  editorCanvas.addEventListener('contextmenu', (e) => {
    e.preventDefault();
  });

  // Drawing Canvas Listeners
  editorCanvas.addEventListener('mousedown', (e) => {
    const rect = editorCanvas.getBoundingClientRect();
    const scaleX = editorCanvas.width / rect.width;
    const scaleY = editorCanvas.height / rect.height;
    const pixelSize = editorCanvas.width / canvasWidth;
    
    const mouseX = (e.clientX - rect.left) * scaleX;
    const mouseY = (e.clientY - rect.top) * scaleY;
    const x = Math.floor(mouseX / pixelSize);
    const y = Math.floor(mouseY / pixelSize);
    
    if (x < 0 || x >= canvasWidth || y < 0 || y >= canvasHeight) return;
    
    if (activeTool === 'select') {
      if (e.button !== 0 && e.button !== 2) return; // Left/Right click only
      
      const x1 = Math.min(selection.startX, selection.endX);
      const y1 = Math.min(selection.startY, selection.endY);
      const x2 = Math.max(selection.startX, selection.endX);
      const y2 = Math.max(selection.startY, selection.endY);
      const isInsideSelection = selection.active && x >= x1 && x <= x2 && y >= y1 && y <= y2;

      // Check if clicked inside floating data
      if (selection.isFloating &&
          x >= selection.floatingX && x < selection.floatingX + selection.bufferWidth &&
          y >= selection.floatingY && y < selection.floatingY + selection.bufferHeight) {
        isDraggingFloating = true;
        dragStartX = x;
        dragStartY = y;
        originalFloatingX = selection.floatingX;
        originalFloatingY = selection.floatingY;
      }
      // Check if clicked inside active selection to lift and drag it (Left Click only)
      else if (isInsideSelection && e.button === 0) {
        copySelection();
        
        const currentFrame = frames[currentFrameIndex];
        if (currentFrame) {
          for (let sy = y1; sy <= y2; sy++) {
            for (let sx = x1; sx <= x2; sx++) {
              currentFrame.data[sy * canvasWidth + sx] = 0; // Clear original pixels
            }
          }
        }
        
        selection.active = false;
        selection.isFloating = true;
        selection.floatingX = x1;
        selection.floatingY = y1;
        selection.floatingData = new Uint8Array(selection.buffer);
        
        isDraggingFloating = true;
        dragStartX = x;
        dragStartY = y;
        originalFloatingX = x1;
        originalFloatingY = y1;
        
        saveHistory();
        startAntsAnimation();
      }
      else {
        // If clicked outside and was floating, confirm it
        if (selection.isFloating) {
          confirmSelection();
        }
        // Start drawing new selection rectangle
        isSelecting = true;
        selection.active = true;
        selection.startX = x;
        selection.startY = y;
        selection.endX = x;
        selection.endY = y;
        startAntsAnimation();
      }
      drawMainCanvas();
      return;
    }
    
    // If was floating and switch to other tool clicked, confirm
    if (selection.isFloating) {
      confirmSelection();
    }
    
    if (e.button !== 0 && e.button !== 2) return; // Left (0) and Right (2) clicks only
    
    const currentFrame = frames[currentFrameIndex];
    
    if (activeTool === 'text') {
      const textStr = textInput.value || '';
      const fontStr = textFontSelect.value || 'Outfit';
      const sizeVal = parseInt(textSizeInput.value, 10) || 12;
      const isBold = textBold.checked;
      const isItalic = textItalic.checked;
      const thresholdVal = parseInt(textThreshold.value, 10) || 128;
      
      if (textStr) {
        const textPixels = getTextPixels(textStr, fontStr, sizeVal, isBold, isItalic, thresholdVal);
        if (currentFrame) {
          saveHistory();
          const colorIndex = (e.button === 2) ? secondaryColorIndex : primaryColorIndex;
          for (let ty = 0; ty < textPixels.height; ty++) {
            for (let tx = 0; tx < textPixels.width; tx++) {
              if (textPixels.data[ty][tx] === 1) {
                const canvasX = x + tx;
                const canvasY = y + ty;
                if (canvasX >= 0 && canvasX < canvasWidth && canvasY >= 0 && canvasY < canvasHeight) {
                  currentFrame.data[canvasY * canvasWidth + canvasX] = colorIndex;
                }
              }
            }
          }
          drawMainCanvas();
          updateUI();
        }
      }
      return;
    }
    
    isDrawing = true;
    drawingButton = e.button;
    
    if (currentFrame) {
      drawingStartData = new Uint8Array(currentFrame.data);
    }
    pixelPerfectPath = [];
    startX = x;
    startY = y;
    lastMouseX = x;
    lastMouseY = y;
    
    if (activeTool === 'pen' || activeTool === 'eraser' || activeTool === 'dither' || activeTool === 'shade') {
      addPixelToPath(x, y);
      applyPathToData();
      drawMainCanvas();
    } else if (activeTool === 'line' || activeTool === 'rect' || activeTool === 'ellipse') {
      applyShapePreview(startX, startY, x, y, e.shiftKey);
      drawMainCanvas();
    } else {
      handleDrawEvent(e);
    }
  });
  
  editorCanvas.addEventListener('mousemove', (e) => {
    const rect = editorCanvas.getBoundingClientRect();
    const scaleX = editorCanvas.width / rect.width;
    const scaleY = editorCanvas.height / rect.height;
    const pixelSize = editorCanvas.width / canvasWidth;
    
    const mouseX = (e.clientX - rect.left) * scaleX;
    const mouseY = (e.clientY - rect.top) * scaleY;
    const x = Math.floor(mouseX / pixelSize);
    const y = Math.floor(mouseY / pixelSize);
    
    // Update hover coordinates for tools (e.g. text tool preview)
    if (x >= 0 && x < canvasWidth && y >= 0 && y < canvasHeight) {
      hoverX = x;
      hoverY = y;
      if (activeTool === 'text') {
        drawMainCanvas();
      }
    } else {
      hoverX = -1;
      hoverY = -1;
      if (activeTool === 'text') {
        drawMainCanvas();
      }
    }
    
    if (activeTool === 'select') {
      if (isDraggingFloating) {
        const dx = x - dragStartX;
        const dy = y - dragStartY;
        selection.floatingX = originalFloatingX + dx;
        selection.floatingY = originalFloatingY + dy;
        drawMainCanvas();
      } else if (isSelecting && (x >= 0 && x < canvasWidth && y >= 0 && y < canvasHeight)) {
        selection.endX = x;
        selection.endY = y;
        drawMainCanvas();
      }
      return;
    }
    
    if (isDrawing && x >= 0 && x < canvasWidth && y >= 0 && y < canvasHeight) {
      if (activeTool === 'pen' || activeTool === 'eraser' || activeTool === 'dither' || activeTool === 'shade') {
        const linePixels = getLinePixels(lastMouseX, lastMouseY, x, y);
        for (let i = 1; i < linePixels.length; i++) {
          addPixelToPath(linePixels[i].x, linePixels[i].y);
        }
        lastMouseX = x;
        lastMouseY = y;
        applyPathToData();
        drawMainCanvas();
      } else if (activeTool === 'line' || activeTool === 'rect' || activeTool === 'ellipse') {
        applyShapePreview(startX, startY, x, y, e.shiftKey);
        drawMainCanvas();
      } else {
        handleDrawEvent(e);
      }
    }
  });
  
  window.addEventListener('mouseup', () => {
    if (activeTool === 'select') {
      if (isDraggingFloating) {
        isDraggingFloating = false;
      }
      if (isSelecting) {
        isSelecting = false;
        // If it's a single click (no drag), cancel selection
        if (selection.startX === selection.endX && selection.startY === selection.endY) {
          selection.active = false;
          stopAntsAnimation();
          drawMainCanvas();
        }
      }
      return;
    }
    
    if (isDrawing) {
      isDrawing = false;
      drawingButton = null;
      saveHistory(); // Save action after pointer up
      updateUI();
    }
  });
  
  editorCanvas.addEventListener('mouseleave', () => {
    hoverX = -1;
    hoverY = -1;
    if (activeTool === 'text') {
      drawMainCanvas();
    }
  });
  
  // Tools click
  toolPen.addEventListener('click', () => setActiveTool('pen'));
  toolEraser.addEventListener('click', () => setActiveTool('eraser'));
  toolFill.addEventListener('click', () => setActiveTool('fill'));
  toolPicker.addEventListener('click', () => setActiveTool('picker'));
  toolSelect.addEventListener('click', () => setActiveTool('select'));
  toolLine.addEventListener('click', () => setActiveTool('line'));
  toolRect.addEventListener('click', () => setActiveTool('rect'));
  toolEllipse.addEventListener('click', () => setActiveTool('ellipse'));
  toolDither.addEventListener('click', () => setActiveTool('dither'));
  toolShade.addEventListener('click', () => setActiveTool('shade'));
  toolText.addEventListener('click', () => setActiveTool('text'));
  
  // Brush Size Selection
  document.querySelectorAll('.btn-size-opt').forEach(btn => {
    btn.addEventListener('click', (e) => {
      document.querySelectorAll('.btn-size-opt').forEach(b => b.classList.remove('active'));
      e.target.classList.add('active');
      brushSize = parseInt(e.target.dataset.size);
    });
  });
  
  // Dither Pattern Selection
  document.querySelectorAll('.btn-pattern-opt').forEach(btn => {
    btn.addEventListener('click', (e) => {
      document.querySelectorAll('.btn-pattern-opt').forEach(b => b.classList.remove('active'));
      e.target.classList.add('active');
      ditherPattern = e.target.dataset.pattern;
    });
  });
  
  // Shade Mode Selection
  document.querySelectorAll('.btn-shade-opt').forEach(btn => {
    btn.addEventListener('click', (e) => {
      document.querySelectorAll('.btn-shade-opt').forEach(b => b.classList.remove('active'));
      e.target.classList.add('active');
      shadingMode = e.target.dataset.mode;
    });
  });
  // Text Tool Settings events
  if (textInput) {
    textInput.addEventListener('input', () => {
      if (activeTool === 'text') drawMainCanvas();
    });
  }
  if (textFontSelect) {
    textFontSelect.addEventListener('change', () => {
      if (activeTool === 'text') drawMainCanvas();
    });
  }
  if (textSizeInput) {
    textSizeInput.addEventListener('input', () => {
      if (activeTool === 'text') drawMainCanvas();
    });
  }
  if (textBold) {
    textBold.addEventListener('change', () => {
      if (activeTool === 'text') drawMainCanvas();
    });
  }
  if (textItalic) {
    textItalic.addEventListener('change', () => {
      if (activeTool === 'text') drawMainCanvas();
    });
  }
  if (textThreshold) {
    textThreshold.addEventListener('input', (e) => {
      if (textThresholdVal) {
        textThresholdVal.innerText = e.target.value;
      }
      if (activeTool === 'text') drawMainCanvas();
    });
  }
  
  if (shapeShearInput) {
    shapeShearInput.addEventListener('input', (e) => {
      shapeShear = parseFloat(e.target.value);
      if (shapeShearVal) {
        shapeShearVal.innerText = shapeShear.toFixed(1);
      }
    });
  }
  if (shapeShearDirRadios) {
    shapeShearDirRadios.forEach(radio => {
      radio.addEventListener('change', (e) => {
        if (e.target.checked) {
          shapeShearDir = e.target.value;
        }
      });
    });
  }
  
  // Actions
  actionFlipH.addEventListener('click', flipHorizontal);
  actionFlipV.addEventListener('click', flipVertical);
  actionRotateCW.addEventListener('click', rotateClockwise);
  actionShearHRight.addEventListener('click', () => shearHorizontal('right'));
  actionShearHLeft.addEventListener('click', () => shearHorizontal('left'));
  actionShearVDown.addEventListener('click', () => shearVertical('down'));
  actionShearVUp.addEventListener('click', () => shearVertical('up'));
  actionClear.addEventListener('click', () => {
    if (confirm("現在のフレームを消去します。よろしいですか？")) {
      clearCanvas();
    }
  });
  
  actionShiftU.addEventListener('click', () => shiftCanvas(0, -1));
  actionShiftL.addEventListener('click', () => shiftCanvas(-1, 0));
  actionShiftR.addEventListener('click', () => shiftCanvas(1, 0));
  actionShiftD.addEventListener('click', () => shiftCanvas(0, 1));
  
  // Grid checks
  chkGridPixel.addEventListener('change', (e) => {
    showGridPixel = e.target.checked;
    drawMainCanvas();
  });
  if (pickerGridColor) {
    pickerGridColor.addEventListener('input', (e) => {
      gridPixelColor = e.target.value;
      localStorage.setItem('gb_grid_pixel_color', gridPixelColor);
      drawMainCanvas();
    });
  }
  chkGridTile.addEventListener('change', (e) => {
    showGridTile = e.target.checked;
    drawMainCanvas();
  });
  chkGridSprite.addEventListener('change', (e) => {
    showGridSprite = e.target.checked;
    localStorage.setItem('gb_grid_sprite', showGridSprite);
    drawMainCanvas();
  });
  chkPixelPerfect.addEventListener('change', (e) => {
    showPixelPerfect = e.target.checked;
    localStorage.setItem('gb_pixel_perfect', showPixelPerfect);
  });
  chkOnionSkin.addEventListener('change', (e) => {
    showOnionSkin = e.target.checked;
    drawMainCanvas();
  });
  chkSymmetryH.addEventListener('change', (e) => {
    showSymmetryH = e.target.checked;
    localStorage.setItem('gb_symmetry_h', showSymmetryH);
    drawMainCanvas();
  });
  chkSymmetryV.addEventListener('change', (e) => {
    showSymmetryV = e.target.checked;
    localStorage.setItem('gb_symmetry_v', showSymmetryV);
    drawMainCanvas();
  });
  
  if (chkSeamlessDraw) {
    chkSeamlessDraw.addEventListener('change', (e) => {
      showSeamless = e.target.checked;
      drawMainCanvas();
    });
  }
  if (chkPreviewTiling) {
    chkPreviewTiling.addEventListener('change', (e) => {
      showPreviewTiling = e.target.checked;
      drawPreview();
    });
  }
  
  // Timeline Actions
  btnFrameAdd.addEventListener('click', addFrame);
  btnFrameDuplicate.addEventListener('click', duplicateFrame);
  btnFrameDelete.addEventListener('click', deleteFrame);
  
  // History undo/redo
  btnUndo.addEventListener('click', undo);
  btnRedo.addEventListener('click', redo);
  
  // Keyboard Shortcuts
  window.addEventListener('keydown', (e) => {
    // Avoid shortcuts firing while typing in textarea
    if (document.activeElement.tagName === 'TEXTAREA' || document.activeElement.tagName === 'INPUT') {
      return;
    }
    
    const ctrlOrCmd = e.ctrlKey || e.metaKey;
    const key = e.key.toLowerCase();
    
    if (ctrlOrCmd && key === 'z') {
      e.preventDefault();
      undo();
    } else if (ctrlOrCmd && key === 'y') {
      e.preventDefault();
      redo();
    } else if (ctrlOrCmd && key === 'c') {
      e.preventDefault();
      copySelection();
    } else if (ctrlOrCmd && key === 'x') {
      e.preventDefault();
      cutSelection();
    } else if (ctrlOrCmd && key === 'v') {
      e.preventDefault();
      pasteSelection();
    } else if (ctrlOrCmd && (key === '+' || key === '=')) {
      e.preventDefault();
      zoomIn();
    } else if (ctrlOrCmd && key === '-') {
      e.preventDefault();
      zoomOut();
    } else if (ctrlOrCmd && key === '0') {
      e.preventDefault();
      zoomScale = 1.0;
      zoomMode = 'fixed';
      applyZoom();
    } else if (ctrlOrCmd && key === '9') {
      e.preventDefault();
      zoomMode = 'fit';
      applyZoom();
    } else if (e.altKey && key === '1') {
      e.preventDefault();
      toggleTools();
    } else if (e.altKey && key === '2') {
      e.preventDefault();
      toggleTimeline();
    } else if (e.altKey && key === '3') {
      e.preventDefault();
      toggleSidebar();
    } else if (e.altKey && key === 'f') {
      e.preventDefault();
      zoomMode = 'fit';
      applyZoom();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      cancelSelection();
    } else if (e.key === 'Enter') {
      e.preventDefault();
      confirmSelection();
    } else {
      // Palette color selections (1-4 keys)
      if (key >= '1' && key <= '4') {
        e.preventDefault();
        const colorIdx = parseInt(key) - 1;
        if (e.shiftKey) {
          secondaryColorIndex = colorIdx;
        } else {
          primaryColorIndex = colorIdx;
        }
        updateColorSwatches();
        return;
      }
      
      // Frame navigation ([ and ])
      if (e.key === '[') {
        e.preventDefault();
        if (currentFrameIndex > 0) {
          selectFrame(currentFrameIndex - 1);
        }
        return;
      } else if (e.key === ']') {
        e.preventDefault();
        if (currentFrameIndex < frames.length - 1) {
          selectFrame(currentFrameIndex + 1);
        }
        return;
      }
      
      switch (key) {
        case 'p':
          setActiveTool('pen');
          break;
        case 'e':
          setActiveTool('eraser');
          break;
        case 'g':
          setActiveTool('fill');
          break;
        case 'i':
          setActiveTool('picker');
          break;
        case 's':
          setActiveTool('select');
          break;
        case 'h':
          setActiveTool('shade');
          break;
        case 't':
          setActiveTool('text');
          break;
        case 'n':
          e.preventDefault();
          addFrame();
          break;
        case 'd':
          e.preventDefault();
          duplicateFrame();
          break;
        case 'backspace':
        case 'delete':
          e.preventDefault();
          deleteFrame();
          break;
      }
    }
  });
  
  // Palette Themes
  paletteClassic.addEventListener('click', () => {
    activeTheme = 'classic';
    paletteClassic.classList.add('active');
    palettePocket.classList.remove('active');
    updatePaletteColors();
    updateUI();
  });
  palettePocket.addEventListener('click', () => {
    activeTheme = 'pocket';
    paletteClassic.classList.remove('active');
    palettePocket.classList.add('active');
    updatePaletteColors();
    updateUI();
  });
  
  // Prevent context menu on color swatches to allow right-click selection
  colorSwatches.forEach(swatch => {
    swatch.addEventListener('contextmenu', (e) => {
      e.preventDefault();
    });
    
    swatch.addEventListener('mousedown', (e) => {
      const colorIdx = parseInt(swatch.dataset.colorIdx);
      if (e.button === 0) { // Left click
        primaryColorIndex = colorIdx;
        updateColorSwatches();
      } else if (e.button === 2) { // Right click
        secondaryColorIndex = colorIdx;
        updateColorSwatches();
      }
    });
  });
  
  // Live Preview Playback
  btnPlayPause.addEventListener('click', togglePlayback);
  
  fpsRange.addEventListener('input', (e) => {
    fps = parseInt(e.target.value);
    fpsVal.innerText = fps;
    if (isPlaying) {
      runPlaybackLoop(); // Adjust playback speed immediately
    }
  });
  
  // Import / Export Buttons
  btnExportC.addEventListener('click', () => {
    cCodeIo.value = generateGBDK2020Code();
  });
  
  btnImportC.addEventListener('click', () => {
    const code = cCodeIo.value;
    if (confirm("貼り付けられたCコードからインポートを実行します。現在のデータは上書きされますが、よろしいですか？")) {
      importGBDK2020Code(code);
    }
  });
  
  btnExportJson.addEventListener('click', exportProjectJson);
  
  inputImportJson.addEventListener('change', (e) => {
    if (e.target.files.length > 0) {
      importProjectJson(e.target.files[0]);
      // Reset input value to allow triggering change on same file again
      e.target.value = '';
    }
  });
  
  btnExportPngCurrent.addEventListener('click', exportPngCurrent);
  btnExportPngSheet.addEventListener('click', exportPngSheet);
  btnExportGif.addEventListener('click', exportGif);
  
  // Zoom control
  document.querySelectorAll('.btn-zoom').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const zoom = parseInt(e.target.dataset.zoom);
      updatePreviewZoom(zoom);
    });
  });
  
  // Preview blur (ghosting) toggle
  chkPreviewBlur.addEventListener('change', (e) => {
    previewBlurEnabled = e.target.checked;
  });
  
  // Tabs Control
  tabButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      tabButtons.forEach(b => b.classList.remove('active'));
      tabPanes.forEach(p => p.classList.remove('active'));
      
      btn.classList.add('active');
      const paneId = btn.dataset.tab;
      document.getElementById(paneId).classList.add('active');
      
      if (paneId === 'tab-gbdk') {
        updateExportTab();
      }
    });
  });

  // Layout toggles
  btnToggleTools.addEventListener('click', toggleTools);
  btnToggleTimeline.addEventListener('click', toggleTimeline);
  btnToggleSidebar.addEventListener('click', toggleSidebar);

  // Resize panels by dragging
  setupResizers();

  // Zoom controls
  setupZoomEvents();

  // Drag scroll (Panning) controls
  setupPanning();

  // Window resize handler
  window.addEventListener('resize', () => {
    if (zoomMode === 'fit') {
      applyZoom();
    }
  });
}

function setActiveTool(tool) {
  // If we are leaving select tool, confirm floating data first and cancel selection border
  if (activeTool === 'select' && tool !== 'select') {
    if (selection.isFloating) {
      confirmSelection();
    }
    selection.active = false;
    stopAntsAnimation();
    drawMainCanvas();
  }
  
  activeTool = tool;
  
  toolPen.classList.remove('active');
  toolEraser.classList.remove('active');
  toolFill.classList.remove('active');
  toolPicker.classList.remove('active');
  toolSelect.classList.remove('active');
  toolLine.classList.remove('active');
  toolRect.classList.remove('active');
  toolEllipse.classList.remove('active');
  toolDither.classList.remove('active');
  toolShade.classList.remove('active');
  toolText.classList.remove('active');
  
  if (tool === 'pen') toolPen.classList.add('active');
  else if (tool === 'eraser') toolEraser.classList.add('active');
  else if (tool === 'fill') toolFill.classList.add('active');
  else if (tool === 'picker') toolPicker.classList.add('active');
  else if (tool === 'select') toolSelect.classList.add('active');
  else if (tool === 'line') toolLine.classList.add('active');
  else if (tool === 'rect') toolRect.classList.add('active');
  else if (tool === 'ellipse') toolEllipse.classList.add('active');
  else if (tool === 'dither') toolDither.classList.add('active');
  else if (tool === 'shade') toolShade.classList.add('active');
  else if (tool === 'text') toolText.classList.add('active');
  
  // Toggle visibility of tool options
  if (ditherPatternContainer) {
    ditherPatternContainer.style.display = (tool === 'dither') ? 'flex' : 'none';
  }
  if (shadeModeContainer) {
    shadeModeContainer.style.display = (tool === 'shade') ? 'flex' : 'none';
  }
  if (textSettingsContainer) {
    textSettingsContainer.style.display = (tool === 'text') ? 'flex' : 'none';
  }
  if (shapeSettingsContainer) {
    shapeSettingsContainer.style.display = (tool === 'line' || tool === 'rect' || tool === 'ellipse') ? 'flex' : 'none';
  }
}

// --- Selection Actions & Helpers ---
function startAntsAnimation() {
  if (antsInterval) return;
  antsInterval = setInterval(() => {
    lineDashOffset = (lineDashOffset + 0.5) % 10;
    if (selection.active || selection.isFloating) {
      drawMainCanvas();
    } else {
      stopAntsAnimation();
    }
  }, 60);
}

function stopAntsAnimation() {
  if (antsInterval) {
    clearInterval(antsInterval);
    antsInterval = null;
  }
}

function copySelection() {
  if (!selection.active) return;
  
  const x1 = Math.min(selection.startX, selection.endX);
  const y1 = Math.min(selection.startY, selection.endY);
  const x2 = Math.max(selection.startX, selection.endX);
  const y2 = Math.max(selection.startY, selection.endY);
  
  const w = x2 - x1 + 1;
  const h = y2 - y1 + 1;
  
  const currentFrame = frames[currentFrameIndex];
  if (!currentFrame) return;
  
  selection.buffer = new Uint8Array(w * h);
  selection.bufferWidth = w;
  selection.bufferHeight = h;
  
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      selection.buffer[y * w + x] = currentFrame.data[(y1 + y) * canvasWidth + (x1 + x)];
    }
  }
}

function cutSelection() {
  if (!selection.active) return;
  copySelection();
  
  const x1 = Math.min(selection.startX, selection.endX);
  const y1 = Math.min(selection.startY, selection.endY);
  const x2 = Math.max(selection.startX, selection.endX);
  const y2 = Math.max(selection.startY, selection.endY);
  
  const currentFrame = frames[currentFrameIndex];
  if (!currentFrame) return;
  
  for (let y = y1; y <= y2; y++) {
    for (let x = x1; x <= x2; x++) {
      currentFrame.data[y * canvasWidth + x] = 0; // Clear to background (white)
    }
  }
  
  selection.active = false;
  stopAntsAnimation();
  
  saveHistory();
  updateUI();
}

function pasteSelection() {
  if (!selection.buffer) return;
  
  if (selection.isFloating) {
    confirmSelection();
  }
  
  selection.active = false;
  selection.isFloating = true;
  selection.floatingX = Math.floor((canvasWidth - selection.bufferWidth) / 2);
  selection.floatingY = Math.floor((canvasHeight - selection.bufferHeight) / 2);
  selection.floatingData = new Uint8Array(selection.buffer);
  
  startAntsAnimation();
  drawMainCanvas();
}

function confirmSelection() {
  if (!selection.isFloating || !selection.floatingData) return;
  
  const currentFrame = frames[currentFrameIndex];
  if (!currentFrame) return;
  
  for (let y = 0; y < selection.bufferHeight; y++) {
    for (let x = 0; x < selection.bufferWidth; x++) {
      const canvasX = selection.floatingX + x;
      const canvasY = selection.floatingY + y;
      if (canvasX >= 0 && canvasX < canvasWidth && canvasY >= 0 && canvasY < canvasHeight) {
        currentFrame.data[canvasY * canvasWidth + canvasX] = selection.floatingData[y * selection.bufferWidth + x];
      }
    }
  }
  
  selection.isFloating = false;
  selection.floatingData = null;
  stopAntsAnimation();
  
  saveHistory();
  updateUI();
}

function cancelSelection() {
  if (selection.isFloating) {
    selection.isFloating = false;
    selection.floatingData = null;
    stopAntsAnimation();
    drawMainCanvas();
  } else if (selection.active) {
    selection.active = false;
    stopAntsAnimation();
    drawMainCanvas();
  }
}

// --- Preview Zoom Action ---
function updatePreviewZoom(zoom) {
  previewZoom = zoom;
  document.querySelectorAll('.btn-zoom').forEach(btn => {
    if (parseInt(btn.dataset.zoom) === zoom) {
      btn.classList.add('active');
    } else {
      btn.classList.remove('active');
    }
  });
  
  if (previewContainer) {
    previewContainer.style.setProperty('--preview-zoom', `${zoom}px`);
  }
  
  const width = (showPreviewTiling ? canvasWidth * 3 : canvasWidth) * zoom;
  const height = (showPreviewTiling ? canvasHeight * 3 : canvasHeight) * zoom;
  previewCanvas.style.width = `${width}px`;
  previewCanvas.style.height = `${height}px`;
}

// --- GIF Export ---
function exportGif() {
  if (typeof gifshot === 'undefined') {
    alert("GIF生成ライブラリ (gifshot) が読み込まれていません。インターネット接続状況を確認してください。");
    return;
  }
  
  if (frames.length === 0) {
    alert("フレームが存在しません。");
    return;
  }
  
  const originalText = btnExportGif.innerText;
  btnExportGif.innerText = "生成中...";
  btnExportGif.disabled = true;
  
  const colors = PALETTE_THEMES[activeTheme];
  const imageW = Math.max(128, canvasWidth * 8);
  const imageH = Math.max(128, canvasHeight * 8);
  
  const exportCanvas = document.createElement('canvas');
  exportCanvas.width = imageW;
  exportCanvas.height = imageH;
  const ctx = exportCanvas.getContext('2d');
  ctx.imageRendering = 'pixelated';
  
  const psX = imageW / canvasWidth;
  const psY = imageH / canvasHeight;
  const frameImages = [];
  
  frames.forEach((frame) => {
    ctx.clearRect(0, 0, imageW, imageH);
    for (let y = 0; y < canvasHeight; y++) {
      for (let x = 0; x < canvasWidth; x++) {
        const colorIdx = frame.data[y * canvasWidth + x];
        ctx.fillStyle = colors[colorIdx];
        ctx.fillRect(x * psX, y * psY, psX, psY);
      }
    }
    frameImages.push(exportCanvas.toDataURL());
  });
  
  gifshot.createGIF({
    images: frameImages,
    gifWidth: imageW,
    gifHeight: imageH,
    interval: 1 / fps,
    numFrames: frames.length,
    sampleInterval: 10
  }, function(obj) {
    btnExportGif.innerText = originalText;
    btnExportGif.disabled = false;
    
    if (!obj.error) {
      triggerDownload(obj.image, `gb_animation_${canvasWidth}x${canvasHeight}_${Date.now()}.gif`);
    } else {
      alert("GIFアニメーションの生成に失敗しました: " + obj.error);
    }
  });
}

function updateColorSwatches() {
  colorSwatches.forEach(sw => {
    const colorIdx = parseInt(sw.dataset.colorIdx);
    
    // Primary (left click) active state
    if (colorIdx === primaryColorIndex) {
      sw.classList.add('active-primary');
    } else {
      sw.classList.remove('active-primary');
    }
    
    // Secondary (right click) active state
    if (colorIdx === secondaryColorIndex) {
      sw.classList.add('active-secondary');
    } else {
      sw.classList.remove('active-secondary');
    }
  });

  // Sync GBC color picker to selected primary color index
  if (isGbcMode && gbcColorPicker) {
    gbcColorPicker.value = gbcPalettes[currentGbcPaletteIndex][primaryColorIndex];
  }
}

function updatePaletteColors() {
  const colors = isGbcMode ? gbcPalettes[currentGbcPaletteIndex] : PALETTE_THEMES[activeTheme];
  colorSwatches.forEach((sw, idx) => {
    const preview = sw.querySelector('.color-preview');
    if (preview) {
      preview.style.backgroundColor = colors[idx];
    }
  });
}

// --- Layout & Zoom Management Functions ---

function applyZoom() {
  const maxDim = Math.max(canvasWidth, canvasHeight);
  const baseW = (canvasWidth / maxDim) * CANVAS_DISPLAY_SIZE;
  const baseH = (canvasHeight / maxDim) * CANVAS_DISPLAY_SIZE;

  if (zoomMode === 'fit') {
    canvasWrapper.classList.add('fit-mode');
    canvasContainer.style.removeProperty('--canvas-display-width');
    canvasContainer.style.removeProperty('--canvas-display-height');
    
    // Fit の場合のパーセンテージを概算表示
    setTimeout(() => {
      const containerRect = canvasContainer.getBoundingClientRect();
      if (!containerRect || containerRect.width === 0) return;
      const fitWidth = containerRect.width - 16; 
      const fitScale = fitWidth / baseW;
      zoomLevelText.innerText = `Fit (${Math.round(fitScale * 100)}%)`;
    }, 50);
    
    btnZoomFit.classList.add('active');
    btnZoom100.classList.remove('active');
  } else {
    canvasWrapper.classList.remove('fit-mode');
    const displayW = baseW * zoomScale;
    const displayH = baseH * zoomScale;
    canvasContainer.style.setProperty('--canvas-display-width', `${displayW}px`);
    canvasContainer.style.setProperty('--canvas-display-height', `${displayH}px`);
    
    zoomLevelText.innerText = `${Math.round(zoomScale * 100)}%`;
    
    btnZoomFit.classList.remove('active');
    if (zoomScale === 1.0) {
      btnZoom100.classList.add('active');
    } else {
      btnZoom100.classList.remove('active');
    }
  }
}

function updateLayoutUI() {
  if (showToolsPanel) {
    toolsPanel.classList.remove('collapsed');
    resizerLeft.style.display = 'block';
    btnToggleTools.classList.add('active');
  } else {
    toolsPanel.classList.add('collapsed');
    resizerLeft.style.display = 'none';
    btnToggleTools.classList.remove('active');
  }
  
  if (showTimelinePanel) {
    timelinePanel.classList.remove('collapsed');
    btnToggleTimeline.classList.add('active');
  } else {
    timelinePanel.classList.add('collapsed');
    btnToggleTimeline.classList.remove('active');
  }
  
  if (showSidebarPanel) {
    sidebarPanel.classList.remove('collapsed');
    resizerRight.style.display = 'block';
    btnToggleSidebar.classList.add('active');
  } else {
    sidebarPanel.classList.add('collapsed');
    resizerRight.style.display = 'none';
    btnToggleSidebar.classList.remove('active');
  }
  
  // Apply zoom to adjust size for new layout bounds
  applyZoom();
}

function toggleTools() {
  showToolsPanel = !showToolsPanel;
  updateLayoutUI();
}

function toggleTimeline() {
  showTimelinePanel = !showTimelinePanel;
  updateLayoutUI();
}

function toggleSidebar() {
  showSidebarPanel = !showSidebarPanel;
  updateLayoutUI();
}

function handleResponsiveLayout() {
  const width = window.innerWidth;
  if (width < 1024) {
    showSidebarPanel = false;
  }
  if (width < 768) {
    showToolsPanel = false;
  }
  updateLayoutUI();
}

function zoomIn() {
  if (zoomMode === 'fit') {
    const containerRect = canvasContainer.getBoundingClientRect();
    const currentScale = (containerRect.width - 16) / CANVAS_DISPLAY_SIZE;
    const stage = ZOOM_STAGES.find(s => s > currentScale) || 8.0;
    zoomScale = stage;
    zoomMode = 'fixed';
  } else {
    const idx = ZOOM_STAGES.indexOf(zoomScale);
    if (idx < ZOOM_STAGES.length - 1) {
      zoomScale = ZOOM_STAGES[idx + 1];
    }
  }
  applyZoom();
}

function zoomOut() {
  if (zoomMode === 'fit') {
    const containerRect = canvasContainer.getBoundingClientRect();
    const currentScale = (containerRect.width - 16) / CANVAS_DISPLAY_SIZE;
    const stage = [...ZOOM_STAGES].reverse().find(s => s < currentScale) || 0.25;
    zoomScale = stage;
    zoomMode = 'fixed';
  } else {
    const idx = ZOOM_STAGES.indexOf(zoomScale);
    if (idx > 0) {
      zoomScale = ZOOM_STAGES[idx - 1];
    }
  }
  applyZoom();
}

function setupResizers() {
  // Left Panel Resizer
  resizerLeft.addEventListener('mousedown', (e) => {
    e.preventDefault();
    resizerLeft.classList.add('dragging');
    document.addEventListener('mousemove', resizeLeft);
    document.addEventListener('mouseup', stopResizeLeft);
  });
  
  function resizeLeft(e) {
    const rect = workspace.getBoundingClientRect();
    let width = e.clientX - rect.left;
    if (width < 60) width = 60;   // min width
    if (width > 300) width = 300; // max width
    toolsPanel.style.width = `${width}px`;
    toolsPanel.style.minWidth = `${width}px`;
    if (zoomMode === 'fit') {
      applyZoom();
    }
  }
  
  function stopResizeLeft() {
    resizerLeft.classList.remove('dragging');
    document.removeEventListener('mousemove', resizeLeft);
    document.removeEventListener('mouseup', stopResizeLeft);
  }
  
  // Right Panel Resizer
  resizerRight.addEventListener('mousedown', (e) => {
    e.preventDefault();
    resizerRight.classList.add('dragging');
    document.addEventListener('mousemove', resizeRight);
    document.addEventListener('mouseup', stopResizeRight);
  });
  
  function resizeRight(e) {
    const rect = workspace.getBoundingClientRect();
    let width = rect.right - e.clientX;
    if (width < 160) width = 160;  // min width
    if (width > 450) width = 450;  // max width
    sidebarPanel.style.width = `${width}px`;
    sidebarPanel.style.minWidth = `${width}px`;
    if (zoomMode === 'fit') {
      applyZoom();
    }
  }
  
  function stopResizeRight() {
    resizerRight.classList.remove('dragging');
    document.removeEventListener('mousemove', resizeRight);
    document.removeEventListener('mouseup', stopResizeRight);
  }
}

function setupZoomEvents() {
  btnZoomOut.addEventListener('click', zoomOut);
  btnZoomIn.addEventListener('click', zoomIn);
  
  btnZoom100.addEventListener('click', () => {
    zoomMode = 'fixed';
    zoomScale = 1.0;
    applyZoom();
  });
  
  btnZoomFit.addEventListener('click', () => {
    zoomMode = 'fit';
    applyZoom();
  });
  
  // Mouse Wheel zoom
  canvasWrapper.addEventListener('wheel', (e) => {
    e.preventDefault();
    
    const wrapperRect = canvasWrapper.getBoundingClientRect();
    const mouseX = e.clientX - wrapperRect.left;
    const mouseY = e.clientY - wrapperRect.top;
    
    const oldScrollLeft = canvasWrapper.scrollLeft;
    const oldScrollTop = canvasWrapper.scrollTop;
    
    // Calculate current display scale before zoom
    let prevScale;
    if (zoomMode === 'fit') {
      const containerRect = canvasContainer.getBoundingClientRect();
      prevScale = (containerRect.width - 16) / CANVAS_DISPLAY_SIZE;
    } else {
      prevScale = zoomScale;
    }
    
    if (e.deltaY < 0) {
      zoomIn();
    } else {
      zoomOut();
    }
    
    if (zoomMode === 'fixed') {
      const newScale = zoomScale;
      const ratio = newScale / prevScale;
      canvasWrapper.scrollLeft = (oldScrollLeft + mouseX) * ratio - mouseX;
      canvasWrapper.scrollTop = (oldScrollTop + mouseY) * ratio - mouseY;
    }
  }, { passive: false });
}

function setupPanning() {
  // Listen for Spacebar Panning Mode
  window.addEventListener('keydown', (e) => {
    // Avoid triggering when in inputs
    if (document.activeElement.tagName === 'TEXTAREA' || document.activeElement.tagName === 'INPUT') {
      return;
    }
    
    if (e.key === ' ') {
      e.preventDefault();
      if (!spacePressed) {
        spacePressed = true;
        pannedDuringSpace = false;
        canvasWrapper.classList.add('panning');
      }
    }
  });
  
  window.addEventListener('keyup', (e) => {
    if (e.key === ' ') {
      e.preventDefault();
      spacePressed = false;
      canvasWrapper.classList.remove('panning');
      if (isPanning) {
        isPanning = false;
      }
      // If we didn't actually drag-pan during space down, treat it as a play/pause toggle
      if (!pannedDuringSpace) {
        togglePlayback();
      }
    }
  });

  // Mouse pan handlers
  canvasWrapper.addEventListener('mousedown', (e) => {
    // Space is down, OR Middle mouse click
    if (spacePressed || e.button === 1) {
      e.preventDefault();
      isPanning = true;
      panStartX = e.clientX;
      panStartY = e.clientY;
      scrollStartX = canvasWrapper.scrollLeft;
      scrollStartY = canvasWrapper.scrollTop;
      canvasWrapper.classList.add('panning');
    }
  });
  
  window.addEventListener('mousemove', (e) => {
    if (isPanning) {
      e.preventDefault();
      const dx = e.clientX - panStartX;
      const dy = e.clientY - panStartY;
      
      // If movement is detected, mark it as panned
      if (Math.abs(dx) > 2 || Math.abs(dy) > 2) {
        pannedDuringSpace = true;
      }
      
      canvasWrapper.scrollLeft = scrollStartX - dx;
      canvasWrapper.scrollTop = scrollStartY - dy;
    }
  });
  
  window.addEventListener('mouseup', (e) => {
    if (isPanning) {
      isPanning = false;
      if (!spacePressed) {
        canvasWrapper.classList.remove('panning');
      }
    }
  });

  // Mode Selection Tabs
  if (modePixelBtn) modePixelBtn.addEventListener('click', () => switchMode('pixel'));
  if (modeTilemapBtn) modeTilemapBtn.addEventListener('click', () => switchMode('tilemap'));
  if (modeMetaspriteBtn) modeMetaspriteBtn.addEventListener('click', () => switchMode('metasprite'));

  // GBC Palette UI listeners
  if (chkGbcMode) {
    chkGbcMode.addEventListener('change', (e) => {
      isGbcMode = e.target.checked;
      monoPaletteSelector.style.display = isGbcMode ? 'none' : 'flex';
      gbcPaletteSelector.style.display = isGbcMode ? 'flex' : 'none';
      gbcColorEditor.style.display = isGbcMode ? 'flex' : 'none';
      
      updateColorSwatches();
      drawMainCanvas();
      drawPreview();
    });
  }

  if (gbcPaletteSelect) {
    gbcPaletteSelect.addEventListener('change', (e) => {
      currentGbcPaletteIndex = parseInt(e.target.value);
      updateColorSwatches();
      drawMainCanvas();
      drawPreview();
    });
  }

  if (gbcColorPicker) {
    gbcColorPicker.addEventListener('input', (e) => {
      const activeSwatch = document.querySelector('.color-swatch.active-primary');
      if (activeSwatch) {
        const idx = parseInt(activeSwatch.dataset.colorIdx);
        gbcPalettes[currentGbcPaletteIndex][idx] = e.target.value;
        updateColorSwatches();
        drawMainCanvas();
        drawPreview();
        if (activeMode === 'tilemap') drawTilemap();
        if (activeMode === 'metasprite') drawMetasprite();
      }
    });
  }

  // Tilemap UI listeners
  if (tilemapToolStamp) tilemapToolStamp.addEventListener('click', () => setTilemapTool('stamp'));
  if (tilemapToolEraser) tilemapToolEraser.addEventListener('click', () => setTilemapTool('eraser'));
  if (tilemapToolFill) tilemapToolFill.addEventListener('click', () => setTilemapTool('fill'));
  if (btnRefreshTileset) btnRefreshTileset.addEventListener('click', () => {
    extractTileset();
    renderTilesetSelector();
    if (activeMode === 'tilemap') drawTilemap();
  });
  if (btnResizeTilemap) {
    btnResizeTilemap.addEventListener('click', () => {
      const w = parseInt(tilemapWidthInput.value) || 20;
      const h = parseInt(tilemapHeightInput.value) || 18;
      resizeTilemap(w, h);
    });
  }
  if (chkTilemapGrid) {
    chkTilemapGrid.addEventListener('change', () => {
      drawTilemap();
    });
  }
  if (btnTilemapExportC) {
    btnTilemapExportC.addEventListener('click', exportTilemapC);
  }
  if (btnTilemapImportC) {
    btnTilemapImportC.addEventListener('click', importTilemapC);
  }

  // Tilemap Canvas Drawing Interaction
  if (tilemapCanvas) {
    tilemapCanvas.addEventListener('mousedown', handleTilemapMouseDown);
    tilemapCanvas.addEventListener('mousemove', handleTilemapMouseMove);
  }

  // Metasprite UI listeners
  if (btnMetaspriteAddPart) {
    btnMetaspriteAddPart.addEventListener('click', () => {
      addMetaspritePart();
    });
  }
  if (chkMetaspriteSize8x16) {
    chkMetaspriteSize8x16.addEventListener('change', (e) => {
      metasprite8x16 = e.target.checked;
      extractTileset();
      renderMetaspriteTilesetSelector();
      drawMetasprite();
    });
  }
  if (chkMetaspriteGrid) {
    chkMetaspriteGrid.addEventListener('change', () => {
      drawMetasprite();
    });
  }
  if (selMetaspriteBg && metaspriteCanvas) {
    selMetaspriteBg.addEventListener('change', (e) => {
      metaspriteCanvas.className = '';
      metaspriteCanvas.classList.add(`bg-${e.target.value}`);
    });
  }
  if (metaspritePartX) {
    metaspritePartX.addEventListener('input', (e) => {
      updateActivePartProp('x', parseInt(e.target.value) || 0);
    });
  }
  if (metaspritePartY) {
    metaspritePartY.addEventListener('input', (e) => {
      updateActivePartProp('y', parseInt(e.target.value) || 0);
    });
  }
  if (metaspritePartHFlip) {
    metaspritePartHFlip.addEventListener('change', (e) => {
      updateActivePartProp('xFlip', e.target.checked);
    });
  }
  if (metaspritePartVFlip) {
    metaspritePartVFlip.addEventListener('change', (e) => {
      updateActivePartProp('yFlip', e.target.checked);
    });
  }
  if (metaspritePartPalette) {
    metaspritePartPalette.addEventListener('change', (e) => {
      updateActivePartProp('palette', parseInt(e.target.value) || 0);
    });
  }
  if (btnMetaspriteExportC) {
    btnMetaspriteExportC.addEventListener('click', exportMetaspriteC);
  }
  if (btnMetaspriteImportC) {
    btnMetaspriteImportC.addEventListener('click', importMetaspriteC);
  }

  // Metasprite Canvas Interaction
  if (metaspriteCanvas) {
    metaspriteCanvas.addEventListener('mousedown', handleMetaspriteMouseDown);
    metaspriteCanvas.addEventListener('mousemove', handleMetaspriteMouseMove);
  }

  // Hotkeys for mode switching
  window.addEventListener('keydown', (e) => {
    if (document.activeElement.tagName === 'TEXTAREA' || document.activeElement.tagName === 'INPUT') {
      return;
    }
    if (e.altKey && e.key.toLowerCase() === 'q') {
      switchMode('pixel');
    } else if (e.altKey && e.key.toLowerCase() === 'w') {
      switchMode('tilemap');
    } else if (e.altKey && e.key.toLowerCase() === 'e') {
      switchMode('metasprite');
    }
  });
}

// Run init on DOM load
window.addEventListener('DOMContentLoaded', init);

// === CUSTOM EXTENSIONS LOGIC ===

// --- Workspace Mode Selector ---
function switchMode(mode) {
  activeMode = mode;
  
  // Update UI active buttons
  if (modePixelBtn) modePixelBtn.classList.toggle('active', mode === 'pixel');
  if (modeTilemapBtn) modeTilemapBtn.classList.toggle('active', mode === 'tilemap');
  if (modeMetaspriteBtn) modeMetaspriteBtn.classList.toggle('active', mode === 'metasprite');
  
  // Display target workspace and hide others
  if (workspacePixel) workspacePixel.style.display = (mode === 'pixel') ? 'flex' : 'none';
  if (workspaceTilemap) workspaceTilemap.style.display = (mode === 'tilemap') ? 'flex' : 'none';
  if (workspaceMetasprite) workspaceMetasprite.style.display = (mode === 'metasprite') ? 'flex' : 'none';
  
  // Initializations per mode
  if (mode === 'tilemap') {
    extractTileset();
    renderTilesetSelector();
    drawTilemap();
  } else if (mode === 'metasprite') {
    extractTileset();
    renderMetaspriteTilesetSelector();
    drawMetasprite();
    renderMetaspritePartsList();
  } else {
    // Pixel mode
    updatePaletteColors();
    updateColorSwatches();
    drawMainCanvas();
    drawPreview();
  }
}

// --- Tileset Extraction (Deduplication) ---
function extractTileset() {
  tileSet = [];
  
  frames.forEach(frame => {
    const tilesAcross = canvasWidth / 8;
    const tilesDown = canvasHeight / 8;
    
    for (let ty = 0; ty < tilesDown; ty++) {
      for (let tx = 0; tx < tilesAcross; tx++) {
        // Extract 8x8 pixels block
        const block = new Uint8Array(64);
        for (let py = 0; py < 8; py++) {
          for (let px = 0; px < 8; px++) {
            const frameX = tx * 8 + px;
            const frameY = ty * 8 + py;
            block[py * 8 + px] = frame.data[frameY * canvasWidth + frameX];
          }
        }
        
        // Deduplicate
        let isDuplicate = false;
        for (let i = 0; i < tileSet.length; i++) {
          let match = true;
          for (let j = 0; j < 64; j++) {
            if (tileSet[i][j] !== block[j]) {
              match = false;
              break;
            }
          }
          if (match) {
            isDuplicate = true;
            break;
          }
        }
        
        if (!isDuplicate) {
          tileSet.push(block);
        }
      }
    }
  });

  // Ensure there is at least one blank tile
  if (tileSet.length === 0) {
    tileSet.push(new Uint8Array(64));
  }
}

// --- Tileset UI Selectors ---
function renderTilesetSelector() {
  if (!tilemapTilesetList) return;
  tilemapTilesetList.innerHTML = '';
  
  const colors = isGbcMode ? gbcPalettes[currentGbcPaletteIndex] : PALETTE_THEMES[activeTheme];
  
  tileSet.forEach((tileData, index) => {
    const item = document.createElement('div');
    item.className = 'tileset-item';
    if (index === selectedTilemapTile) item.classList.add('active');
    
    const canvas = document.createElement('canvas');
    canvas.width = 8;
    canvas.height = 8;
    const ctx = canvas.getContext('2d');
    
    for (let y = 0; y < 8; y++) {
      for (let x = 0; x < 8; x++) {
        ctx.fillStyle = colors[tileData[y * 8 + x]];
        ctx.fillRect(x, y, 1, 1);
      }
    }
    
    item.appendChild(canvas);
    
    const label = document.createElement('span');
    label.className = 'tileset-item-label';
    label.innerText = index;
    item.appendChild(label);
    
    item.addEventListener('click', () => {
      document.querySelectorAll('#tilemap-tileset-list .tileset-item').forEach(el => el.classList.remove('active'));
      item.classList.add('active');
      selectedTilemapTile = index;
    });
    
    tilemapTilesetList.appendChild(item);
  });
}

function renderMetaspriteTilesetSelector() {
  if (!metaspriteTilesetList) return;
  metaspriteTilesetList.innerHTML = '';
  
  const colors = isGbcMode ? gbcPalettes[currentGbcPaletteIndex] : PALETTE_THEMES[activeTheme];
  const h = metasprite8x16 ? 16 : 8;
  
  tileSet.forEach((tileData, index) => {
    const item = document.createElement('div');
    item.className = 'tileset-item';
    if (index === selectedMetaspriteTile) item.classList.add('active');
    
    const canvas = document.createElement('canvas');
    canvas.width = 8;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < 8; x++) {
        let colorVal = 0;
        if (metasprite8x16) {
          const isSecondTile = y >= 8;
          const localY = y % 8;
          const tileIdxOffset = isSecondTile ? (index + 1) % tileSet.length : index;
          colorVal = tileSet[tileIdxOffset][localY * 8 + x];
        } else {
          colorVal = tileData[y * 8 + x];
        }
        ctx.fillStyle = colors[colorVal];
        ctx.fillRect(x, y, 1, 1);
      }
    }
    
    item.appendChild(canvas);
    
    const label = document.createElement('span');
    label.className = 'tileset-item-label';
    label.innerText = index;
    item.appendChild(label);
    
    item.addEventListener('click', () => {
      document.querySelectorAll('#metasprite-tileset-list .tileset-item').forEach(el => el.classList.remove('active'));
      item.classList.add('active');
      selectedMetaspriteTile = index;
    });
    
    metaspriteTilesetList.appendChild(item);
  });
}

// --- Tilemap Editor Functions ---
function drawTilemap() {
  if (!tilemapCanvas || !tilemapCtx) return;
  
  tilemapCtx.clearRect(0, 0, tilemapCanvas.width, tilemapCanvas.height);
  
  const cellWidth = tilemapCanvas.width / tilemapWidth;
  const cellHeight = tilemapCanvas.height / tilemapHeight;
  const colors = isGbcMode ? gbcPalettes[currentGbcPaletteIndex] : PALETTE_THEMES[activeTheme];
  
  for (let y = 0; y < tilemapHeight; y++) {
    for (let x = 0; x < tilemapWidth; x++) {
      const tileIdx = tilemapData[y * tilemapWidth + x];
      const tileData = tileSet[tileIdx] || new Uint8Array(64);
      
      const pxSizeX = cellWidth / 8;
      const pxSizeY = cellHeight / 8;
      
      for (let ty = 0; ty < 8; ty++) {
        for (let tx = 0; tx < 8; tx++) {
          const colorVal = tileData[ty * 8 + tx];
          tilemapCtx.fillStyle = colors[colorVal];
          tilemapCtx.fillRect(
            x * cellWidth + tx * pxSizeX,
            y * cellHeight + ty * pxSizeY,
            pxSizeX + 0.1,
            pxSizeY + 0.1
          );
        }
      }
    }
  }
  
  // Draw Grid Lines
  if (chkTilemapGrid && chkTilemapGrid.checked) {
    tilemapCtx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
    tilemapCtx.lineWidth = 1;
    tilemapCtx.beginPath();
    for (let i = 1; i < tilemapWidth; i++) {
      const pos = i * cellWidth;
      tilemapCtx.moveTo(pos, 0);
      tilemapCtx.lineTo(pos, tilemapCanvas.height);
    }
    for (let i = 1; i < tilemapHeight; i++) {
      const pos = i * cellHeight;
      tilemapCtx.moveTo(0, pos);
      tilemapCtx.lineTo(tilemapCanvas.width, pos);
    }
    tilemapCtx.stroke();
  }
}

let isDrawingTilemap = false;

function setTilemapTool(tool) {
  activeTilemapTool = tool;
  if (tilemapToolStamp) tilemapToolStamp.classList.toggle('active', tool === 'stamp');
  if (tilemapToolEraser) tilemapToolEraser.classList.toggle('active', tool === 'eraser');
  if (tilemapToolFill) tilemapToolFill.classList.toggle('active', tool === 'fill');
}

function handleTilemapMouseDown(e) {
  isDrawingTilemap = true;
  handleTilemapDrawAction(e);
}

function handleTilemapMouseMove(e) {
  const rect = tilemapCanvas.getBoundingClientRect();
  const scaleX = tilemapWidth / rect.width;
  const scaleY = tilemapHeight / rect.height;
  const mapX = Math.floor((e.clientX - rect.left) * scaleX);
  const mapY = Math.floor((e.clientY - rect.top) * scaleY);
  
  if (mapX >= 0 && mapX < tilemapWidth && mapY >= 0 && mapY < tilemapHeight) {
    if (tilemapCursorCoord) {
      tilemapCursorCoord.innerText = `Tile: X: ${mapX}, Y: ${mapY}`;
    }
    if (isDrawingTilemap) {
      handleTilemapDrawAction(e);
    }
  }
}

function handleTilemapMouseUp() {
  isDrawingTilemap = false;
}

function handleTilemapDrawAction(e) {
  const rect = tilemapCanvas.getBoundingClientRect();
  const scaleX = tilemapWidth / rect.width;
  const scaleY = tilemapHeight / rect.height;
  const mapX = Math.floor((e.clientX - rect.left) * scaleX);
  const mapY = Math.floor((e.clientY - rect.top) * scaleY);
  
  if (mapX < 0 || mapX >= tilemapWidth || mapY < 0 || mapY >= tilemapHeight) return;
  
  const index = mapY * tilemapWidth + mapX;
  
  if (activeTilemapTool === 'stamp') {
    tilemapData[index] = selectedTilemapTile;
  } else if (activeTilemapTool === 'eraser') {
    tilemapData[index] = 0; // Empty/0th tile
  } else if (activeTilemapTool === 'fill') {
    const targetTile = tilemapData[index];
    const fillTile = selectedTilemapTile;
    if (targetTile !== fillTile) {
      floodFillTilemap(mapX, mapY, targetTile, fillTile);
    }
  }
  
  drawTilemap();
}

function floodFillTilemap(startX, startY, targetTile, fillTile) {
  const queue = [[startX, startY]];
  const visited = new Set();
  
  while (queue.length > 0) {
    const [x, y] = queue.shift();
    const key = `${x},${y}`;
    if (visited.has(key)) continue;
    visited.add(key);
    
    const index = y * tilemapWidth + x;
    if (tilemapData[index] === targetTile) {
      tilemapData[index] = fillTile;
      
      if (x > 0) queue.push([x - 1, y]);
      if (x < tilemapWidth - 1) queue.push([x + 1, y]);
      if (y > 0) queue.push([x, y - 1]);
      if (y < tilemapHeight - 1) queue.push([x, y + 1]);
    }
  }
}

function resizeTilemap(w, h) {
  const newData = new Uint8Array(w * h);
  for (let y = 0; y < Math.min(tilemapHeight, h); y++) {
    for (let x = 0; x < Math.min(tilemapWidth, w); x++) {
      newData[y * w + x] = tilemapData[y * tilemapWidth + x];
    }
  }
  tilemapWidth = w;
  tilemapHeight = h;
  tilemapData = newData;
  drawTilemap();
}

// --- Tilemap C Export/Import ---
function exportTilemapC() {
  if (!tilemapCodeIo) return;
  
  let code = `/* GBDotEditor - Generated Tilemap Array */\n`;
  code += `/* Map Width: ${tilemapWidth}, Height: ${tilemapHeight} */\n\n`;
  code += `const unsigned char map_data[] = {\n`;
  
  for (let y = 0; y < tilemapHeight; y++) {
    code += `    `;
    for (let x = 0; x < tilemapWidth; x++) {
      const tile = tilemapData[y * tilemapWidth + x];
      code += `0x${tile.toString(16).padStart(2, '0').toUpperCase()}, `;
    }
    code += `\n`;
  }
  code += `};\n`;
  
  tilemapCodeIo.value = code;
}

function importTilemapC() {
  if (!tilemapCodeIo) return;
  const code = tilemapCodeIo.value;
  
  const hexPattern = /0x[0-9A-Fa-f]{2}/g;
  const matches = code.match(hexPattern);
  if (!matches) {
    alert("Cコードから16進数データを検出できませんでした。");
    return;
  }
  
  const values = matches.map(m => parseInt(m, 16));
  
  const widthMatch = code.match(/Map Width:\s*(\d+)/i);
  const heightMatch = code.match(/Height:\s*(\d+)/i);
  
  let w = tilemapWidth;
  let h = tilemapHeight;
  
  if (widthMatch && heightMatch) {
    w = parseInt(widthMatch[1]);
    h = parseInt(heightMatch[1]);
  } else {
    if (values.length === 360) {
      w = 20;
      h = 18;
    } else {
      w = Math.floor(Math.sqrt(values.length));
      h = Math.ceil(values.length / w);
    }
  }
  
  tilemapWidth = w;
  tilemapHeight = h;
  if (tilemapWidthInput) tilemapWidthInput.value = w;
  if (tilemapHeightInput) tilemapHeightInput.value = h;
  
  tilemapData = new Uint8Array(w * h);
  for (let i = 0; i < Math.min(values.length, w * h); i++) {
    tilemapData[i] = values[i];
  }
  
  drawTilemap();
  alert(`マップデータをインポートしました (${w}x${h} タイル)`);
}

// --- Metasprite Editor Functions ---
let isDraggingMetaspritePart = false;
let dragPartStartX = 0;
let dragPartStartY = 0;
let partOrigX = 0;
let partOrigY = 0;

function drawMetasprite() {
  if (!metaspriteCanvas || !metaspriteCtx) return;
  
  metaspriteCtx.clearRect(0, 0, metaspriteCanvas.width, metaspriteCanvas.height);
  
  const center = metaspriteCanvas.width / 2;
  const colors = isGbcMode ? gbcPalettes[currentGbcPaletteIndex] : PALETTE_THEMES[activeTheme];
  
  // Draw Crosshair Pivot
  const isLightBg = selMetaspriteBg && selMetaspriteBg.value === 'light';
  metaspriteCtx.strokeStyle = isLightBg ? 'rgba(0, 0, 0, 0.35)' : 'rgba(255, 255, 255, 0.35)';
  metaspriteCtx.lineWidth = 1.5;
  metaspriteCtx.beginPath();
  metaspriteCtx.moveTo(center, 0);
  metaspriteCtx.lineTo(center, metaspriteCanvas.height);
  metaspriteCtx.moveTo(0, center);
  metaspriteCtx.lineTo(metaspriteCanvas.width, center);
  metaspriteCtx.stroke();
  
  const scale = 16; // 1 pixel = 16 screen pixels
  
  // Draw Grid Lines (8x8 pixels grid)
  if (chkMetaspriteGrid && chkMetaspriteGrid.checked) {
    metaspriteCtx.strokeStyle = isLightBg ? 'rgba(0, 0, 0, 0.08)' : 'rgba(255, 255, 255, 0.08)';
    metaspriteCtx.lineWidth = 1;
    metaspriteCtx.beginPath();
    
    const gridSize = 8 * scale; // 128 screen pixels
    
    // Vertical grid lines
    for (let x = center % gridSize; x < metaspriteCanvas.width; x += gridSize) {
      if (Math.abs(x - center) < 0.1) continue; // Skip center line as it is drawn by pivot
      metaspriteCtx.moveTo(x, 0);
      metaspriteCtx.lineTo(x, metaspriteCanvas.height);
    }
    // Horizontal grid lines
    for (let y = center % gridSize; y < metaspriteCanvas.height; y += gridSize) {
      if (Math.abs(y - center) < 0.1) continue; // Skip center line
      metaspriteCtx.moveTo(0, y);
      metaspriteCtx.lineTo(metaspriteCanvas.width, y);
    }
    metaspriteCtx.stroke();
  }
  
  metaspriteParts.forEach(part => {
    const tileIdx = part.tileIndex;
    const drawHeight = metasprite8x16 ? 16 : 8;
    const tileData = tileSet[tileIdx] || new Uint8Array(64);
    
    const partScreenX = center + part.x * scale;
    const partScreenY = center + part.y * scale;
    
    for (let y = 0; y < drawHeight; y++) {
      for (let x = 0; x < 8; x++) {
        const sampleX = part.xFlip ? (7 - x) : x;
        const sampleY = part.yFlip ? (drawHeight - 1 - y) : y;
        
        let colorVal = 0;
        if (metasprite8x16) {
          const isSecondTile = sampleY >= 8;
          const localY = sampleY % 8;
          const tileIdxOffset = isSecondTile ? (tileIdx + 1) % tileSet.length : tileIdx;
          colorVal = (tileSet[tileIdxOffset] || new Uint8Array(64))[localY * 8 + sampleX];
        } else {
          colorVal = tileData[sampleY * 8 + sampleX];
        }
        
        if (colorVal > 0) { // Color 0 is transparent for sprites
          const paletteColors = isGbcMode ? gbcPalettes[part.palette] : PALETTE_THEMES[activeTheme];
          metaspriteCtx.fillStyle = paletteColors[colorVal];
          metaspriteCtx.fillRect(
            partScreenX + x * scale,
            partScreenY + y * scale,
            scale,
            scale
          );
        }
      }
    }
    
    // Draw Active Border
    if (part.id === activeMetaspritePartId) {
      metaspriteCtx.strokeStyle = '#ef4444';
      metaspriteCtx.lineWidth = 2;
      metaspriteCtx.strokeRect(
        partScreenX,
        partScreenY,
        8 * scale,
        drawHeight * scale
      );
    }
  });
}

function addMetaspritePart() {
  const newPart = {
    id: Date.now().toString() + Math.random().toString(36).substr(2, 5),
    tileIndex: selectedMetaspriteTile,
    x: 0,
    y: 0,
    xFlip: false,
    yFlip: false,
    palette: 0
  };
  
  metaspriteParts.push(newPart);
  activeMetaspritePartId = newPart.id;
  
  drawMetasprite();
  renderMetaspritePartsList();
  updatePartPropertiesUI();
}

function updateActivePartProp(prop, value) {
  const part = metaspriteParts.find(p => p.id === activeMetaspritePartId);
  if (part) {
    part[prop] = value;
    drawMetasprite();
    renderMetaspritePartsList();
  }
}

function selectMetaspritePart(id) {
  activeMetaspritePartId = id;
  drawMetasprite();
  renderMetaspritePartsList();
  updatePartPropertiesUI();
}

function updatePartPropertiesUI() {
  const part = metaspriteParts.find(p => p.id === activeMetaspritePartId);
  if (!part) {
    if (metaspritePartProperties) metaspritePartProperties.style.display = 'none';
    return;
  }
  
  if (metaspritePartProperties) metaspritePartProperties.style.display = 'block';
  
  if (metaspritePartX) metaspritePartX.value = part.x;
  if (metaspritePartY) metaspritePartY.value = part.y;
  if (metaspritePartHFlip) metaspritePartHFlip.checked = part.xFlip;
  if (metaspritePartVFlip) metaspritePartVFlip.checked = part.yFlip;
  if (metaspritePartPalette) metaspritePartPalette.value = part.palette;
}

function renderMetaspritePartsList() {
  if (!metaspritePartsList) return;
  metaspritePartsList.innerHTML = '';
  
  const colors = isGbcMode ? gbcPalettes[currentGbcPaletteIndex] : PALETTE_THEMES[activeTheme];
  const h = metasprite8x16 ? 16 : 8;
  
  metaspriteParts.forEach((part, index) => {
    const item = document.createElement('div');
    item.className = 'metasprite-part-item';
    if (part.id === activeMetaspritePartId) item.classList.add('active');
    
    // Thumbnail Canvas
    const thumb = document.createElement('div');
    thumb.className = 'part-thumbnail';
    const canvas = document.createElement('canvas');
    canvas.width = 8;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    
    const tileData = tileSet[part.tileIndex] || new Uint8Array(64);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < 8; x++) {
        const sampleX = part.xFlip ? (7 - x) : x;
        const sampleY = part.yFlip ? (h - 1 - y) : y;
        
        let colorVal = 0;
        if (metasprite8x16) {
          const isSecondTile = sampleY >= 8;
          const localY = sampleY % 8;
          const tileIdxOffset = isSecondTile ? (part.tileIndex + 1) % tileSet.length : part.tileIndex;
          colorVal = (tileSet[tileIdxOffset] || new Uint8Array(64))[localY * 8 + sampleX];
        } else {
          colorVal = tileData[sampleY * 8 + sampleX];
        }
        ctx.fillStyle = colors[colorVal];
        ctx.fillRect(x, y, 1, 1);
      }
    }
    thumb.appendChild(canvas);
    item.appendChild(thumb);
    
    // Text Info
    const info = document.createElement('div');
    info.className = 'part-info';
    info.innerText = `#${index} T:${part.tileIndex} (${part.x},${part.y})`;
    item.appendChild(info);
    
    // Reorder & delete buttons
    const controls = document.createElement('div');
    controls.className = 'part-controls';
    
    const btnUp = document.createElement('button');
    btnUp.className = 'btn-part-action';
    btnUp.innerHTML = '▲';
    btnUp.onclick = (e) => {
      e.stopPropagation();
      if (index > 0) {
        const temp = metaspriteParts[index - 1];
        metaspriteParts[index - 1] = metaspriteParts[index];
        metaspriteParts[index] = temp;
        drawMetasprite();
        renderMetaspritePartsList();
      }
    };
    controls.appendChild(btnUp);
    
    const btnDown = document.createElement('button');
    btnDown.className = 'btn-part-action';
    btnDown.innerHTML = '▼';
    btnDown.onclick = (e) => {
      e.stopPropagation();
      if (index < metaspriteParts.length - 1) {
        const temp = metaspriteParts[index + 1];
        metaspriteParts[index + 1] = metaspriteParts[index];
        metaspriteParts[index] = temp;
        drawMetasprite();
        renderMetaspritePartsList();
      }
    };
    controls.appendChild(btnDown);
    
    const btnDel = document.createElement('button');
    btnDel.className = 'btn-part-action delete';
    btnDel.innerHTML = '×';
    btnDel.onclick = (e) => {
      e.stopPropagation();
      metaspriteParts.splice(index, 1);
      if (activeMetaspritePartId === part.id) activeMetaspritePartId = null;
      drawMetasprite();
      renderMetaspritePartsList();
      updatePartPropertiesUI();
    };
    controls.appendChild(btnDel);
    
    item.appendChild(controls);
    
    item.addEventListener('click', () => {
      selectMetaspritePart(part.id);
    });
    
    metaspritePartsList.appendChild(item);
  });
}

function handleMetaspriteMouseDown(e) {
  const rect = metaspriteCanvas.getBoundingClientRect();
  const center = rect.width / 2;
  const scale = 16; // Scale factor 16
  const mouseX = Math.round((e.clientX - rect.left - center) / scale);
  const mouseY = Math.round((e.clientY - rect.top - center) / scale);
  
  let found = null;
  const h = metasprite8x16 ? 16 : 8;
  for (let i = metaspriteParts.length - 1; i >= 0; i--) {
    const p = metaspriteParts[i];
    if (mouseX >= p.x && mouseX < p.x + 8 && mouseY >= p.y && mouseY < p.y + h) {
      found = p;
      break;
    }
  }
  
  if (found) {
    selectMetaspritePart(found.id);
    isDraggingMetaspritePart = true;
    dragPartStartX = e.clientX;
    dragPartStartY = e.clientY;
    partOrigX = found.x;
    partOrigY = found.y;
  } else {
    activeMetaspritePartId = null;
    drawMetasprite();
    renderMetaspritePartsList();
    updatePartPropertiesUI();
  }
}

function handleMetaspriteMouseMove(e) {
  if (isDraggingMetaspritePart && activeMetaspritePartId) {
    const scale = 16;
    const dx = Math.round((e.clientX - dragPartStartX) / scale);
    const dy = Math.round((e.clientY - dragPartStartY) / scale);
    
    const part = metaspriteParts.find(p => p.id === activeMetaspritePartId);
    if (part) {
      let targetX = partOrigX + dx;
      let targetY = partOrigY + dy;
      
      if (chkMetaspriteSnap && chkMetaspriteSnap.checked) {
        targetX = Math.round(targetX / 8) * 8;
        targetY = Math.round(targetY / 8) * 8;
      }
      
      part.x = targetX;
      part.y = targetY;
      
      part.x = Math.max(-128, Math.min(127, part.x));
      part.y = Math.max(-128, Math.min(127, part.y));
      
      if (metaspritePartX) metaspritePartX.value = part.x;
      if (metaspritePartY) metaspritePartY.value = part.y;
      
      drawMetasprite();
      renderMetaspritePartsList();
    }
  }
}

function handleMetaspriteMouseUp() {
  isDraggingMetaspritePart = false;
}

// Keyboard arrow keys fine-tuning for Metasprites
window.addEventListener('keydown', (e) => {
  if (activeMode !== 'metasprite' || !activeMetaspritePartId) return;
  if (document.activeElement.tagName === 'INPUT' || document.activeElement.tagName === 'TEXTAREA') return;
  
  let handled = false;
  let dx = 0;
  let dy = 0;
  const step = e.shiftKey ? 8 : 1;
  
  if (e.key === 'ArrowLeft') {
    dx = -step;
    handled = true;
  } else if (e.key === 'ArrowRight') {
    dx = step;
    handled = true;
  } else if (e.key === 'ArrowUp') {
    dy = -step;
    handled = true;
  } else if (e.key === 'ArrowDown') {
    dy = step;
    handled = true;
  }
  
  if (handled) {
    e.preventDefault();
    const part = metaspriteParts.find(p => p.id === activeMetaspritePartId);
    if (part) {
      part.x = Math.max(-128, Math.min(127, part.x + dx));
      part.y = Math.max(-128, Math.min(127, part.y + dy));
      
      if (metaspritePartX) metaspritePartX.value = part.x;
      if (metaspritePartY) metaspritePartY.value = part.y;
      
      drawMetasprite();
      renderMetaspritePartsList();
    }
  }
});

// --- Metasprite C Export/Import ---
function exportMetaspriteC() {
  if (!metaspriteCodeIo) return;
  
  let code = `/* GBDotEditor - Generated Metasprite Array */\n`;
  code += `/* Sprite Mode: ${metasprite8x16 ? '8x16' : '8x8'} */\n\n`;
  code += `#include <gb/gb.h>\n\n`;
  code += `const metasprite_t custom_metasprite[] = {\n`;
  
  metaspriteParts.forEach(part => {
    let prop = 0;
    if (part.xFlip) prop |= 0x20;
    if (part.yFlip) prop |= 0x40;
    prop |= (part.palette & 0x07);
    
    code += `  { ${part.y}, ${part.x}, ${part.tileIndex}, 0x${prop.toString(16).padStart(2, '0').toUpperCase()} },\n`;
  });
  
  code += `  { 128 }\n`;
  code += `};\n`;
  
  metaspriteCodeIo.value = code;
}

function importMetaspriteC() {
  if (!metaspriteCodeIo) return;
  const code = metaspriteCodeIo.value;
  
  if (code.includes('8x16')) {
    metasprite8x16 = true;
    if (chkMetaspriteSize8x16) chkMetaspriteSize8x16.checked = true;
  } else if (code.includes('8x8')) {
    metasprite8x16 = false;
    if (chkMetaspriteSize8x16) chkMetaspriteSize8x16.checked = false;
  }
  
  const regex = /\{\s*(-?\d+)\s*,\s*(-?\d+)\s*,\s*(\d+)\s*,\s*(0x[0-9a-fA-F]+|\d+)\s*\}/g;
  let match;
  const parsedParts = [];
  
  while ((match = regex.exec(code)) !== null) {
    const y = parseInt(match[1]);
    const x = parseInt(match[2]);
    const tileIndex = parseInt(match[3]);
    const propVal = match[4].startsWith('0x') ? parseInt(match[4], 16) : parseInt(match[4]);
    
    if (y === 128) break;
    
    const xFlip = (propVal & 0x20) !== 0;
    const yFlip = (propVal & 0x40) !== 0;
    const palette = propVal & 0x07;
    
    parsedParts.push({
      id: Date.now().toString() + Math.random().toString(36).substr(2, 5),
      tileIndex,
      x,
      y,
      xFlip,
      yFlip,
      palette
    });
  }
  
  if (parsedParts.length === 0) {
    alert("Cコードからメタスプライトデータを解析できませんでした。");
    return;
  }
  
  metaspriteParts = parsedParts;
  activeMetaspritePartId = metaspriteParts.length > 0 ? metaspriteParts[0].id : null;
  
  extractTileset();
  renderMetaspriteTilesetSelector();
  drawMetasprite();
  renderMetaspritePartsList();
  updatePartPropertiesUI();
  
  alert(`メタスプライトをインポートしました (${parsedParts.length} パーツ)`);
}

