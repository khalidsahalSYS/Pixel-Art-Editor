const canvas = document.querySelector('#art');
const ctx = canvas.getContext('2d', { willReadFrequently: true });
const colorInput = document.querySelector('#color');
const status = document.querySelector('#status');
const paletteColors = ['#171923', '#ffffff', '#f4a261', '#e76f51', '#e63946', '#ffbe0b', '#8ac926', '#2a9d8f', '#00b4d8', '#4361ee', '#6c63ff', '#b5179e'];
let drawing = false;
let activeTool = 'pencil';
let undoStack = [];
let redoStack = [];
let currentColor = colorInput.value;

function announce(message) { status.textContent = message; }
function snapshot() {
  undoStack.push({ width: canvas.width, height: canvas.height, data: ctx.getImageData(0, 0, canvas.width, canvas.height) });
  if (undoStack.length > 50) undoStack.shift();
  redoStack = [];
  updateHistoryButtons();
}
function updateHistoryButtons() {
  document.querySelector('#undo').disabled = undoStack.length === 0;
  document.querySelector('#redo').disabled = redoStack.length === 0;
}
function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.imageSmoothingEnabled = false;
  // Repaint stored pixel data over the checkerboard CSS background.
  const saved = pixelData;
  if (saved) ctx.putImageData(saved, 0, 0);
}
let pixelData = ctx.getImageData(0, 0, canvas.width, canvas.height);
function capturePixels() { pixelData = ctx.getImageData(0, 0, canvas.width, canvas.height); }
function restorePixels(data) { canvas.width = data.width; canvas.height = data.height; ctx.putImageData(data.data, 0, 0); capturePixels(); updateDimensions(); }
function updateDimensions() {
  document.querySelector('#canvas-info').textContent = `${canvas.width} × ${canvas.height} pixels`;
  document.querySelector('#canvas-width').value = canvas.width;
  document.querySelector('#canvas-height').value = canvas.height;
  applyZoom();
}
function applyZoom() {
  const zoom = Number(document.querySelector('#zoom').value);
  canvas.style.width = `${Math.max(180, Math.min(640, canvas.width * 12)) * zoom / 100}px`;
  canvas.style.height = `${Math.max(180, Math.min(640, canvas.height * 12)) * zoom / 100}px`;
  document.querySelector('#zoom-value').textContent = `${zoom}%`;
}
function getPixel(event) {
  const rect = canvas.getBoundingClientRect();
  return {
    x: Math.floor((event.clientX - rect.left) / rect.width * canvas.width),
    y: Math.floor((event.clientY - rect.top) / rect.height * canvas.height)
  };
}
function putPixel(x, y, color) {
  if (x < 0 || y < 0 || x >= canvas.width || y >= canvas.height) return;
  ctx.fillStyle = color;
  ctx.fillRect(x, y, 1, 1);
  capturePixels();
}
function hexToRgba(hex) {
  const value = hex.replace('#', '');
  return [parseInt(value.slice(0, 2), 16), parseInt(value.slice(2, 4), 16), parseInt(value.slice(4, 6), 16), 255];
}
function floodFill(startX, startY, fillColor) {
  const image = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const data = image.data;
  const start = (startY * canvas.width + startX) * 4;
  const target = Array.from(data.slice(start, start + 4));
  const replacement = hexToRgba(fillColor);
  if (target.every((value, i) => value === replacement[i])) return;
  const stack = [[startX, startY]];
  while (stack.length) {
    const [x, y] = stack.pop();
    if (x < 0 || y < 0 || x >= canvas.width || y >= canvas.height) continue;
    const offset = (y * canvas.width + x) * 4;
    if (data[offset] !== target[0] || data[offset + 1] !== target[1] || data[offset + 2] !== target[2] || data[offset + 3] !== target[3]) continue;
    data.set(replacement, offset);
    stack.push([x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]);
  }
  ctx.putImageData(image, 0, 0);
  capturePixels();
}
function useTool(event) {
  const { x, y } = getPixel(event);
  if (activeTool === 'picker') {
    const rgba = ctx.getImageData(x, y, 1, 1).data;
    if (rgba[3]) {
      const hex = `#${[...rgba].slice(0, 3).map(v => v.toString(16).padStart(2, '0')).join('')}`;
      setColor(hex);
    }
    announce('Color picked.');
  } else if (activeTool === 'fill') {
    floodFill(x, y, currentColor);
    announce('Area filled.');
  } else {
    putPixel(x, y, activeTool === 'eraser' ? 'rgba(0,0,0,0)' : currentColor);
  }
}
function setColor(value) {
  currentColor = value;
  colorInput.value = value;
  document.querySelector('#color-value').textContent = value.toUpperCase();
}
function saveLocal() {
  try {
    localStorage.setItem('pixel-art-editor', JSON.stringify({ width: canvas.width, height: canvas.height, pixels: Array.from(pixelData.data) }));
    announce('Artwork saved in this browser.');
  } catch { announce('Could not save artwork in this browser.'); }
}
function loadLocal() {
  try {
    const saved = JSON.parse(localStorage.getItem('pixel-art-editor'));
    if (!saved || !saved.width || !saved.height || !saved.pixels) return;
    canvas.width = saved.width;
    canvas.height = saved.height;
    const image = new ImageData(new Uint8ClampedArray(saved.pixels), saved.width, saved.height);
    ctx.putImageData(image, 0, 0);
    capturePixels();
    updateDimensions();
    announce('Saved artwork restored.');
  } catch { /* Start with a blank canvas if saved data is unavailable. */ }
}

const palette = document.querySelector('#palette');
paletteColors.forEach(value => {
  const button = document.createElement('button');
  button.type = 'button'; button.className = 'swatch'; button.style.backgroundColor = value;
  button.title = value; button.setAttribute('aria-label', `Choose ${value}`);
  button.addEventListener('click', () => setColor(value));
  palette.append(button);
});

document.querySelectorAll('.tool-button').forEach(button => button.addEventListener('click', () => {
  activeTool = button.dataset.tool;
  document.querySelectorAll('.tool-button').forEach(item => { const selected = item === button; item.classList.toggle('active', selected); item.setAttribute('aria-pressed', selected); });
  announce(`${button.querySelector('small').textContent} selected.`);
}));
colorInput.addEventListener('input', () => setColor(colorInput.value));
canvas.addEventListener('pointerdown', event => { event.preventDefault(); canvas.setPointerCapture(event.pointerId); drawing = true; snapshot(); useTool(event); });
canvas.addEventListener('pointermove', event => { if (drawing && (activeTool === 'pencil' || activeTool === 'eraser')) useTool(event); });
canvas.addEventListener('pointerup', () => { if (drawing) { drawing = false; capturePixels(); } });
canvas.addEventListener('pointercancel', () => { drawing = false; });
document.querySelector('#show-grid').addEventListener('change', event => canvas.classList.toggle('no-grid', !event.target.checked));
document.querySelector('#zoom').addEventListener('input', applyZoom);
document.querySelector('#resize').addEventListener('click', () => {
  const width = Number(document.querySelector('#canvas-width').value);
  const height = Number(document.querySelector('#canvas-height').value);
  if (!Number.isInteger(width) || !Number.isInteger(height) || width < 8 || height < 8 || width > 128 || height > 128) { announce('Canvas dimensions must be between 8 and 128 pixels.'); return; }
  snapshot();
  const old = document.createElement('canvas'); old.width = canvas.width; old.height = canvas.height; old.getContext('2d').putImageData(pixelData, 0, 0);
  canvas.width = width; canvas.height = height;
  ctx.drawImage(old, 0, 0, Math.min(old.width, width), Math.min(old.height, height));
  capturePixels(); updateDimensions(); announce(`Canvas resized to ${width} × ${height}.`);
});
document.querySelector('#clear').addEventListener('click', () => { snapshot(); ctx.clearRect(0, 0, canvas.width, canvas.height); capturePixels(); announce('Canvas cleared.'); });
document.querySelector('#save').addEventListener('click', saveLocal);
document.querySelector('#export').addEventListener('click', () => {
  const output = document.createElement('canvas'); output.width = canvas.width; output.height = canvas.height;
  output.getContext('2d').putImageData(pixelData, 0, 0);
  output.toBlob(blob => { if (!blob) { announce('PNG export failed.'); return; } const link = document.createElement('a'); link.href = URL.createObjectURL(blob); link.download = 'pixel-art.png'; link.click(); URL.revokeObjectURL(link.href); announce('PNG exported.'); }, 'image/png');
});
document.querySelector('#undo').addEventListener('click', () => {
  if (!undoStack.length) return;
  redoStack.push({ width: canvas.width, height: canvas.height, data: ctx.getImageData(0, 0, canvas.width, canvas.height) });
  restorePixels(undoStack.pop()); updateHistoryButtons(); announce('Last change undone.');
});
document.querySelector('#redo').addEventListener('click', () => {
  if (!redoStack.length) return;
  undoStack.push({ width: canvas.width, height: canvas.height, data: ctx.getImageData(0, 0, canvas.width, canvas.height) });
  restorePixels(redoStack.pop()); updateHistoryButtons(); announce('Change restored.');
});
document.addEventListener('keydown', event => {
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'z') { event.preventDefault(); document.querySelector(event.shiftKey ? '#redo' : '#undo').click(); }
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'y') { event.preventDefault(); document.querySelector('#redo').click(); }
});
loadLocal(); updateHistoryButtons(); applyZoom();
