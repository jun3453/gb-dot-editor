// GBDotEditor Application Logic

// --- Constants ---
const CANVAS_DISPLAY_SIZE = 512;
const PALETTE_THEMES = {
  classic: ['#e0f8d0', '#88c070', '#346856', '#081820'], // Original GB Green
  pocket: ['#ffffff', '#aaaaaa', '#555555', '#000000']   // GB Pocket Monochrome
};

// --- Application State ---
let canvasSize = 16; // 8, 16, 32, 64, 128, 256
let frames = [];     // Array of { id: number, data: Uint8Array }
let currentFrameIndex = 0;
let activeTheme = 'classic';
let activeColorIndex = 0; // 0, 1, 2, 3
let activeTool = 'pen';   // 'pen', 'eraser', 'fill', 'picker'
let isDrawing = false;
let showGridPixel = true;
let showGridTile = true;
let showOnionSkin = false;
let gridPixelColor = localStorage.getItem('gb_grid_pixel_color') || '#888888';

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

const selectSize = document.getElementById('canvas-size-select');
const btnUndo = document.getElementById('btn-undo');
const btnRedo = document.getElementById('btn-redo');

const toolPen = document.getElementById('tool-pen');
const toolEraser = document.getElementById('tool-eraser');
const toolFill = document.getElementById('tool-fill');
const toolPicker = document.getElementById('tool-picker');

const actionFlipH = document.getElementById('action-flip-h');
const actionFlipV = document.getElementById('action-flip-v');
const actionRotateCW = document.getElementById('action-rotate-cw');
const actionClear = document.getElementById('action-clear');

const actionShiftU = document.getElementById('action-shift-u');
const actionShiftL = document.getElementById('action-shift-l');
const actionShiftR = document.getElementById('action-shift-r');
const actionShiftD = document.getElementById('action-shift-d');

const chkGridPixel = document.getElementById('chk-grid-pixel');
const chkGridTile = document.getElementById('chk-grid-tile');
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

// Tabs control
const tabButtons = document.querySelectorAll('.tab-btn');
const tabPanes = document.querySelectorAll('.tab-pane');

// --- Initialization ---
function init() {
  setupEventListeners();
  if (pickerGridColor) {
    pickerGridColor.value = gridPixelColor;
  }
  resetEditor(16); // Start with 16x16
  saveHistory();   // Save initial state
}

// Reset everything to default with a given size
function resetEditor(size) {
  canvasSize = size;
  frames = [
    { id: generateId(), data: new Uint8Array(canvasSize * canvasSize) }
  ];
  currentFrameIndex = 0;
  
  // Update canvas properties
  editorCanvas.width = CANVAS_DISPLAY_SIZE;
  editorCanvas.height = CANVAS_DISPLAY_SIZE;
  
  // Initial draw
  updateUI();
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
    canvasSize: canvasSize,
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
  canvasSize = state.canvasSize;
  selectSize.value = canvasSize;
  
  // Deep copy to current frames
  frames = state.frames.map(f => ({
    id: f.id,
    data: new Uint8Array(f.data)
  }));
  currentFrameIndex = state.currentFrameIndex;
  
  updateUI();
  updateHistoryButtons();
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
}

// Main Editor Canvas Drawing
function drawMainCanvas() {
  editorCtx.clearRect(0, 0, CANVAS_DISPLAY_SIZE, CANVAS_DISPLAY_SIZE);
  
  const pixelSize = CANVAS_DISPLAY_SIZE / canvasSize;
  const currentFrame = frames[currentFrameIndex];
  if (!currentFrame) return;
  
  const colors = PALETTE_THEMES[activeTheme];
  
  // 1. Draw Onion Skin (if enabled and there is a previous frame)
  if (showOnionSkin && currentFrameIndex > 0) {
    const prevFrame = frames[currentFrameIndex - 1];
    editorCtx.globalAlpha = 0.25; // Transparent overlay
    for (let y = 0; y < canvasSize; y++) {
      for (let x = 0; x < canvasSize; x++) {
        const colorIdx = prevFrame.data[y * canvasSize + x];
        if (colorIdx > 0) { // Only draw non-background onion skin for visibility
          editorCtx.fillStyle = colors[colorIdx];
          editorCtx.fillRect(x * pixelSize, y * pixelSize, pixelSize, pixelSize);
        }
      }
    }
    editorCtx.globalAlpha = 1.0; // Reset
  }
  
  // 2. Draw Current Frame Pixels
  for (let y = 0; y < canvasSize; y++) {
    for (let x = 0; x < canvasSize; x++) {
      const colorIdx = currentFrame.data[y * canvasSize + x];
      editorCtx.fillStyle = colors[colorIdx];
      editorCtx.fillRect(x * pixelSize, y * pixelSize, pixelSize, pixelSize);
    }
  }
  
  // 3. Draw Grid Lines
  editorCtx.lineWidth = 1;
  
  // Pixel Grid (fine lines)
  if (showGridPixel && pixelSize > 4) {
    editorCtx.strokeStyle = gridPixelColor;
    editorCtx.beginPath();
    for (let i = 1; i < canvasSize; i++) {
      const pos = Math.floor(i * pixelSize) + 0.5;
      // Vertical lines
      editorCtx.moveTo(pos, 0);
      editorCtx.lineTo(pos, CANVAS_DISPLAY_SIZE);
      // Horizontal lines
      editorCtx.moveTo(0, pos);
      editorCtx.lineTo(CANVAS_DISPLAY_SIZE, pos);
    }
    editorCtx.stroke();
  }
  
  // Tile Grid (thick lines every 8 pixels)
  if (showGridTile && canvasSize > 8) {
    editorCtx.strokeStyle = 'rgba(16, 185, 129, 0.5)'; // Emerald green border
    editorCtx.lineWidth = 2; // Slightly thicker
    editorCtx.beginPath();
    for (let i = 8; i < canvasSize; i += 8) {
      const pos = Math.floor(i * pixelSize);
      // Vertical lines
      editorCtx.moveTo(pos, 0);
      editorCtx.lineTo(pos, CANVAS_DISPLAY_SIZE);
      // Horizontal lines
      editorCtx.moveTo(0, pos);
      editorCtx.lineTo(CANVAS_DISPLAY_SIZE, pos);
    }
    editorCtx.stroke();
  }
}

// Render Timeline panel
function renderTimeline() {
  timelineFramesList.innerHTML = '';
  
  frames.forEach((frame, idx) => {
    const frameEl = document.createElement('div');
    frameEl.className = `frame-item ${idx === currentFrameIndex ? 'active' : ''}`;
    frameEl.dataset.index = idx;
    
    // Mini canvas for preview
    const miniCanvas = document.createElement('canvas');
    miniCanvas.width = canvasSize;
    miniCanvas.height = canvasSize;
    miniCanvas.style.width = '72px';
    miniCanvas.style.height = '72px';
    const miniCtx = miniCanvas.getContext('2d');
    
    // Draw frame on mini canvas
    const colors = PALETTE_THEMES[activeTheme];
    for (let y = 0; y < canvasSize; y++) {
      for (let x = 0; x < canvasSize; x++) {
        const colorIdx = frame.data[y * canvasSize + x];
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
  previewCanvas.width = canvasSize;
  previewCanvas.height = canvasSize;
  previewCanvas.style.width = '128px';
  previewCanvas.style.height = '128px';
  
  const colors = PALETTE_THEMES[activeTheme];
  let targetFrameIdx = currentFrameIndex;
  
  if (isPlaying) {
    targetFrameIdx = previewFrameIndex;
  }
  
  const frame = frames[targetFrameIdx];
  if (!frame) return;
  
  previewCtx.clearRect(0, 0, canvasSize, canvasSize);
  for (let y = 0; y < canvasSize; y++) {
    for (let x = 0; x < canvasSize; x++) {
      const colorIdx = frame.data[y * canvasSize + x];
      previewCtx.fillStyle = colors[colorIdx];
      previewCtx.fillRect(x, y, 1, 1);
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

// --- Drawing Interaction ---
function handleDrawEvent(e) {
  const rect = editorCanvas.getBoundingClientRect();
  const scaleX = editorCanvas.width / rect.width;
  const scaleY = editorCanvas.height / rect.height;
  
  const pixelSize = CANVAS_DISPLAY_SIZE / canvasSize;
  
  const mouseX = (e.clientX - rect.left) * scaleX;
  const mouseY = (e.clientY - rect.top) * scaleY;
  
  const x = Math.floor(mouseX / pixelSize);
  const y = Math.floor(mouseY / pixelSize);
  
  if (x >= 0 && x < canvasSize && y >= 0 && y < canvasSize) {
    executeToolAction(x, y);
  }
}

function executeToolAction(x, y) {
  const currentFrame = frames[currentFrameIndex];
  if (!currentFrame) return;
  
  const targetIndex = y * canvasSize + x;
  
  if (activeTool === 'pen') {
    if (currentFrame.data[targetIndex] !== activeColorIndex) {
      currentFrame.data[targetIndex] = activeColorIndex;
      drawMainCanvas();
    }
  } else if (activeTool === 'eraser') {
    if (currentFrame.data[targetIndex] !== 0) {
      currentFrame.data[targetIndex] = 0;
      drawMainCanvas();
    }
  } else if (activeTool === 'picker') {
    activeColorIndex = currentFrame.data[targetIndex];
    updateColorSwatches();
    // Switch tool back to pen
    setActiveTool('pen');
  } else if (activeTool === 'fill') {
    const prevColor = currentFrame.data[targetIndex];
    if (prevColor !== activeColorIndex) {
      floodFill(x, y, prevColor, activeColorIndex);
      drawMainCanvas();
    }
  }
}

// Classic Flood Fill Algorithm
function floodFill(startX, startY, targetColor, replacementColor) {
  const currentFrame = frames[currentFrameIndex];
  if (!currentFrame) return;
  
  const queue = [[startX, startY]];
  
  while (queue.length > 0) {
    const [cx, cy] = queue.shift();
    const idx = cy * canvasSize + cx;
    
    if (currentFrame.data[idx] === targetColor) {
      currentFrame.data[idx] = replacementColor;
      
      // Check neighbors
      if (cx > 0) queue.push([cx - 1, cy]);
      if (cx < canvasSize - 1) queue.push([cx + 1, cy]);
      if (cy > 0) queue.push([cx, cy - 1]);
      if (cy < canvasSize - 1) queue.push([cx, cy + 1]);
    }
  }
}

// --- Frame Actions ---
function moveFrame(fromIdx, toIdx) {
  if (toIdx < 0 || toIdx >= frames.length) return;
  
  const targetFrame = frames[fromIdx];
  frames.splice(fromIdx, 1);
  frames.splice(toIdx, 0, targetFrame);
  
  if (currentFrameIndex === fromIdx) {
    currentFrameIndex = toIdx;
  } else if (currentFrameIndex === toIdx) {
    currentFrameIndex = fromIdx;
  }
  
  saveHistory();
  updateUI();
}

function addFrame() {
  const newFrame = {
    id: generateId(),
    data: new Uint8Array(canvasSize * canvasSize)
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
  
  const newData = new Uint8Array(canvasSize * canvasSize);
  for (let y = 0; y < canvasSize; y++) {
    for (let x = 0; x < canvasSize; x++) {
      newData[y * canvasSize + x] = currentFrame.data[y * canvasSize + (canvasSize - 1 - x)];
    }
  }
  currentFrame.data = newData;
  saveHistory();
  updateUI();
}

function flipVertical() {
  const currentFrame = frames[currentFrameIndex];
  if (!currentFrame) return;
  
  const newData = new Uint8Array(canvasSize * canvasSize);
  for (let y = 0; y < canvasSize; y++) {
    for (let x = 0; x < canvasSize; x++) {
      newData[y * canvasSize + x] = currentFrame.data[(canvasSize - 1 - y) * canvasSize + x];
    }
  }
  currentFrame.data = newData;
  saveHistory();
  updateUI();
}

function rotateClockwise() {
  const currentFrame = frames[currentFrameIndex];
  if (!currentFrame) return;
  
  const newData = new Uint8Array(canvasSize * canvasSize);
  for (let y = 0; y < canvasSize; y++) {
    for (let x = 0; x < canvasSize; x++) {
      // (x, y) becomes (size - 1 - y, x)
      newData[x * canvasSize + (canvasSize - 1 - y)] = currentFrame.data[y * canvasSize + x];
    }
  }
  currentFrame.data = newData;
  saveHistory();
  updateUI();
}

function shiftCanvas(dx, dy) {
  const currentFrame = frames[currentFrameIndex];
  if (!currentFrame) return;
  
  const newData = new Uint8Array(canvasSize * canvasSize);
  for (let y = 0; y < canvasSize; y++) {
    for (let x = 0; x < canvasSize; x++) {
      const tx = x + dx;
      const ty = y + dy;
      if (tx >= 0 && tx < canvasSize && ty >= 0 && ty < canvasSize) {
        newData[ty * canvasSize + tx] = currentFrame.data[y * canvasSize + x];
      }
    }
  }
  currentFrame.data = newData;
  saveHistory();
  updateUI();
}

// --- Import / Export Logic (GBDK2020 C Arrays) ---

// Convert current frame & size setup to GBDK2020 format
function generateGBDK2020Code() {
  const totalTilesX = canvasSize / 8;
  const totalTilesY = canvasSize / 8;
  const tilesPerFrame = totalTilesX * totalTilesY;
  
  let code = `/*\n  GBDK 2020 Tile Data\n  Generated by GBDotEditor\n  Size: ${canvasSize}x${canvasSize} pixels (${tilesPerFrame} tiles/frame)\n  Frames: ${frames.length} (Total ${tilesPerFrame * frames.length} tiles)\n*/\n\n`;
  code += `#define my_tile_width ${canvasSize}\n`;
  code += `#define my_tile_height ${canvasSize}\n`;
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
            const colorIdx = frame.data[canvasY * canvasSize + canvasX];
            
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
  
  return code;
}

function importGBDK2020Code(cCodeText) {
  // Regex to match Hex values (e.g. 0x3C, 3C)
  const hexPattern = /0[xX][0-9A-Fa-f]{1,2}|[0-9A-Fa-f]{2}/g;
  const matches = cCodeText.match(hexPattern) || [];
  
  if (matches.length === 0) {
    alert("C配列内の16進数データを検出できませんでした。フォーマットをご確認ください。");
    return;
  }
  
  // Convert matches to numbers
  const bytes = matches.map(m => {
    if (m.toLowerCase().startsWith('0x')) {
      return parseInt(m, 16);
    } else {
      return parseInt(m, 16);
    }
  });
  
  // Determine frames from byte counts
  const tilesPerFrame = (canvasSize / 8) * (canvasSize / 8);
  const bytesPerFrame = tilesPerFrame * 16;
  
  const numFramesCalculated = Math.max(1, Math.ceil(bytes.length / bytesPerFrame));
  
  // Rebuild frames array
  const importedFrames = [];
  
  for (let f = 0; f < numFramesCalculated; f++) {
    const frameData = new Uint8Array(canvasSize * canvasSize);
    const frameByteStart = f * bytesPerFrame;
    
    const totalTilesX = canvasSize / 8;
    const totalTilesY = canvasSize / 8;
    
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
            frameData[canvasY * canvasSize + canvasX] = colorIdx;
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
    canvasSize: canvasSize,
    activeTheme: activeTheme,
    frames: serializedFrames
  };
  
  const blob = new Blob([JSON.stringify(project, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  
  const a = document.createElement('a');
  a.href = url;
  a.download = `gb_project_${canvasSize}x${canvasSize}_${Date.now()}.json`;
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
      
      canvasSize = parseInt(project.canvasSize);
      selectSize.value = canvasSize;
      activeTheme = project.activeTheme || 'classic';
      
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
  exportCanvas.width = canvasSize;
  exportCanvas.height = canvasSize;
  const ctx = exportCanvas.getContext('2d');
  
  const colors = PALETTE_THEMES[activeTheme];
  for (let y = 0; y < canvasSize; y++) {
    for (let x = 0; x < canvasSize; x++) {
      const colorIdx = currentFrame.data[y * canvasSize + x];
      ctx.fillStyle = colors[colorIdx];
      ctx.fillRect(x, y, 1, 1);
    }
  }
  
  triggerDownload(exportCanvas.toDataURL(), `gb_tile_frame_${currentFrameIndex + 1}.png`);
}

function exportPngSheet() {
  const exportCanvas = document.createElement('canvas');
  exportCanvas.width = canvasSize * frames.length;
  exportCanvas.height = canvasSize;
  const ctx = exportCanvas.getContext('2d');
  
  const colors = PALETTE_THEMES[activeTheme];
  
  frames.forEach((frame, idx) => {
    const startX = idx * canvasSize;
    for (let y = 0; y < canvasSize; y++) {
      for (let x = 0; x < canvasSize; x++) {
        const colorIdx = frame.data[y * canvasSize + x];
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
  selectSize.addEventListener('change', (e) => {
    const newSize = parseInt(e.target.value);
    if (confirm("キャンバスサイズを変更すると現在の描画内容がクリアされます。よろしいですか？")) {
      resetEditor(newSize);
      undoStack = [];
      redoStack = [];
      saveHistory();
    } else {
      selectSize.value = canvasSize;
    }
  });
  
  // Drawing Canvas Listeners
  editorCanvas.addEventListener('mousedown', (e) => {
    if (e.button !== 0) return; // Left click only
    isDrawing = true;
    handleDrawEvent(e);
  });
  
  editorCanvas.addEventListener('mousemove', (e) => {
    if (isDrawing) {
      handleDrawEvent(e);
    }
  });
  
  window.addEventListener('mouseup', () => {
    if (isDrawing) {
      isDrawing = false;
      saveHistory(); // Save action after pointer up
      updateUI();
    }
  });
  
  // Tools click
  toolPen.addEventListener('click', () => setActiveTool('pen'));
  toolEraser.addEventListener('click', () => setActiveTool('eraser'));
  toolFill.addEventListener('click', () => setActiveTool('fill'));
  toolPicker.addEventListener('click', () => setActiveTool('picker'));
  
  // Actions
  actionFlipH.addEventListener('click', flipHorizontal);
  actionFlipV.addEventListener('click', flipVertical);
  actionRotateCW.addEventListener('click', rotateClockwise);
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
  chkOnionSkin.addEventListener('change', (e) => {
    showOnionSkin = e.target.checked;
    drawMainCanvas();
  });
  
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
    
    if (ctrlOrCmd && e.key.toLowerCase() === 'z') {
      e.preventDefault();
      undo();
    } else if (ctrlOrCmd && e.key.toLowerCase() === 'y') {
      e.preventDefault();
      redo();
    } else {
      switch (e.key.toLowerCase()) {
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
        case ' ': // Space key to toggle animation playback
          e.preventDefault();
          togglePlayback();
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
  
  // Swatches Selection
  colorSwatches.forEach(swatch => {
    swatch.addEventListener('click', () => {
      activeColorIndex = parseInt(swatch.dataset.colorIdx);
      updateColorSwatches();
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
}

function setActiveTool(tool) {
  activeTool = tool;
  
  toolPen.classList.remove('active');
  toolEraser.classList.remove('active');
  toolFill.classList.remove('active');
  toolPicker.classList.remove('active');
  
  if (tool === 'pen') toolPen.classList.add('active');
  else if (tool === 'eraser') toolEraser.classList.add('active');
  else if (tool === 'fill') toolFill.classList.add('active');
  else if (tool === 'picker') toolPicker.classList.add('active');
}

function updateColorSwatches() {
  colorSwatches.forEach(sw => {
    if (parseInt(sw.dataset.colorIdx) === activeColorIndex) {
      sw.classList.add('active');
    } else {
      sw.classList.remove('active');
    }
  });
}

function updatePaletteColors() {
  const colors = PALETTE_THEMES[activeTheme];
  colorSwatches.forEach((sw, idx) => {
    const preview = sw.querySelector('.color-preview');
    if (preview) {
      preview.style.backgroundColor = colors[idx];
    }
  });
}

// Run init on DOM load
window.addEventListener('DOMContentLoaded', init);
