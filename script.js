const COLS = 10;
const ROWS = 20;
const BLOCK = 30;
const LINES_PER_LEVEL = 10;

const boardCanvas = document.getElementById('board');
const nextCanvas = document.getElementById('next');
const ctx = boardCanvas.getContext('2d');
const nextCtx = nextCanvas.getContext('2d');

const scoreEl = document.getElementById('score');
const levelEl = document.getElementById('level');
const linesEl = document.getElementById('lines');
const bestEl = document.getElementById('best');
const overlayEl = document.getElementById('overlay');
const startBtn = document.getElementById('startBtn');
const pauseBtn = document.getElementById('pauseBtn');
const restartBtn = document.getElementById('restartBtn');

ctx.scale(BLOCK, BLOCK);
nextCtx.scale(32, 32);

const COLORS = {
  I: '#38bdf8',
  O: '#facc15',
  T: '#a78bfa',
  S: '#4ade80',
  Z: '#fb7185',
  J: '#60a5fa',
  L: '#fb923c'
};

const SHAPES = {
  I: [[0,0,0,0],[1,1,1,1],[0,0,0,0],[0,0,0,0]],
  O: [[1,1],[1,1]],
  T: [[0,1,0],[1,1,1],[0,0,0]],
  S: [[0,1,1],[1,1,0],[0,0,0]],
  Z: [[1,1,0],[0,1,1],[0,0,0]],
  J: [[1,0,0],[1,1,1],[0,0,0]],
  L: [[0,0,1],[1,1,1],[0,0,0]]
};

const SCORE_TABLE = [0, 100, 300, 500, 800];

let board = createBoard();
let currentPiece = null;
let nextPiece = randomPiece();
let score = 0;
let lines = 0;
let level = 1;
let best = Number(localStorage.getItem('neon-tetris-best') || 0);
let dropCounter = 0;
let dropInterval = 700;
let lastTime = 0;
let animationId = null;
let running = false;
let paused = false;
let gameOver = false;

bestEl.textContent = best;
updateStats();
draw();
drawNext();

startBtn.addEventListener('click', () => {
  if (gameOver || !running) {
    startGame();
  } else if (paused) {
    togglePause();
  }
});

pauseBtn.addEventListener('click', () => {
  if (!running || gameOver) return;
  togglePause();
});

restartBtn.addEventListener('click', () => {
  startGame();
});

document.addEventListener('keydown', (event) => {
  if (!running) return;

  if (event.code === 'KeyP') {
    togglePause();
    return;
  }

  if (paused || gameOver) return;

  switch (event.code) {
    case 'ArrowLeft':
      move(-1);
      break;
    case 'ArrowRight':
      move(1);
      break;
    case 'ArrowDown':
      softDrop();
      break;
    case 'ArrowUp':
      rotatePiece();
      break;
    case 'Space':
      event.preventDefault();
      hardDrop();
      break;
  }
});

function createBoard() {
  return Array.from({ length: ROWS }, () => Array(COLS).fill(null));
}

function randomPiece() {
  const types = Object.keys(SHAPES);
  const type = types[Math.floor(Math.random() * types.length)];
  return {
    type,
    matrix: SHAPES[type].map(row => [...row]),
    pos: { x: 0, y: 0 }
  };
}

function spawnPiece() {
  currentPiece = nextPiece;
  currentPiece.matrix = currentPiece.matrix.map(row => [...row]);
  currentPiece.pos.y = 0;
  currentPiece.pos.x = Math.floor((COLS - currentPiece.matrix[0].length) / 2);
  nextPiece = randomPiece();
  drawNext();

  if (collide(board, currentPiece)) {
    endGame();
  }
}

function startGame() {
  board = createBoard();
  score = 0;
  lines = 0;
  level = 1;
  dropInterval = 700;
  dropCounter = 0;
  lastTime = 0;
  running = true;
  paused = false;
  gameOver = false;
  nextPiece = randomPiece();
  spawnPiece();
  updateStats();
  setOverlay('遊戲開始', '堆高之前盡量多消幾行。', false);
  if (animationId) cancelAnimationFrame(animationId);
  update();
}

function update(time = 0) {
  if (!running) return;
  const deltaTime = time - lastTime;
  lastTime = time;

  if (!paused && !gameOver) {
    dropCounter += deltaTime;
    if (dropCounter > dropInterval) {
      drop();
    }
  }

  draw();
  animationId = requestAnimationFrame(update);
}

function draw() {
  ctx.fillStyle = '#020617';
  ctx.fillRect(0, 0, COLS, ROWS);
  drawGrid();
  drawMatrix(board, { x: 0, y: 0 }, true);
  if (currentPiece) {
    drawGhost();
    drawMatrix(currentPiece.matrix, currentPiece.pos, false, COLORS[currentPiece.type]);
  }
}

function drawGrid() {
  ctx.strokeStyle = 'rgba(148, 163, 184, 0.08)';
  ctx.lineWidth = 0.04;
  for (let x = 0; x <= COLS; x++) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, ROWS);
    ctx.stroke();
  }
  for (let y = 0; y <= ROWS; y++) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(COLS, y);
    ctx.stroke();
  }
}

function drawMatrix(matrix, offset, locked = false, overrideColor = null) {
  matrix.forEach((row, y) => {
    row.forEach((value, x) => {
      if (!value) return;
      const color = overrideColor || COLORS[value] || COLORS[currentPiece?.type] || '#fff';
      ctx.fillStyle = locked ? color : color;
      ctx.fillRect(x + offset.x, y + offset.y, 1, 1);
      ctx.fillStyle = 'rgba(255, 255, 255, 0.18)';
      ctx.fillRect(x + offset.x + 0.06, y + offset.y + 0.06, 0.88, 0.16);
      ctx.strokeStyle = 'rgba(15, 23, 42, 0.45)';
      ctx.lineWidth = 0.05;
      ctx.strokeRect(x + offset.x + 0.02, y + offset.y + 0.02, 0.96, 0.96);
    });
  });
}

function drawGhost() {
  const ghost = {
    matrix: currentPiece.matrix,
    pos: { ...currentPiece.pos }
  };
  while (!collide(board, ghost)) {
    ghost.pos.y++;
  }
  ghost.pos.y--;

  ctx.save();
  ctx.globalAlpha = 0.2;
  drawMatrix(ghost.matrix, ghost.pos, false, '#e2e8f0');
  ctx.restore();
}

function drawNext() {
  nextCtx.clearRect(0, 0, nextCanvas.width, nextCanvas.height);
  nextCtx.fillStyle = '#020617';
  nextCtx.fillRect(0, 0, nextCanvas.width, nextCanvas.height);
  if (!nextPiece) return;

  const matrix = nextPiece.matrix;
  const size = matrix.length;
  const offsetX = (5 - size) / 2 + 0.5;
  const offsetY = (5 - size) / 2 + 0.5;

  matrix.forEach((row, y) => {
    row.forEach((value, x) => {
      if (!value) return;
      nextCtx.fillStyle = COLORS[nextPiece.type];
      nextCtx.fillRect(x + offsetX, y + offsetY, 1, 1);
      nextCtx.fillStyle = 'rgba(255,255,255,0.18)';
      nextCtx.fillRect(x + offsetX + 0.06, y + offsetY + 0.06, 0.88, 0.16);
    });
  });
}

function collide(board, piece) {
  const { matrix, pos } = piece;
  for (let y = 0; y < matrix.length; y++) {
    for (let x = 0; x < matrix[y].length; x++) {
      if (!matrix[y][x]) continue;
      const boardX = x + pos.x;
      const boardY = y + pos.y;
      if (boardX < 0 || boardX >= COLS || boardY >= ROWS) return true;
      if (boardY >= 0 && board[boardY][boardX]) return true;
    }
  }
  return false;
}

function merge() {
  currentPiece.matrix.forEach((row, y) => {
    row.forEach((value, x) => {
      if (value) {
        board[y + currentPiece.pos.y][x + currentPiece.pos.x] = currentPiece.type;
      }
    });
  });
};

function move(dir) {
  currentPiece.pos.x += dir;
  if (collide(board, currentPiece)) {
    currentPiece.pos.x -= dir;
  } else {
    draw();
  }
}

function drop() {
  currentPiece.pos.y++;
  if (collide(board, currentPiece)) {
    currentPiece.pos.y--;
    lockPiece();
  }
  dropCounter = 0;
}

function softDrop() {
  score += 1;
  drop();
  updateStats();
}

function hardDrop() {
  let distance = 0;
  while (!collide(board, currentPiece)) {
    currentPiece.pos.y++;
    distance++;
  }
  currentPiece.pos.y--;
  distance--;
  score += Math.max(distance, 0) * 2;
  lockPiece();
  updateStats();
}

function lockPiece() {
  merge();
  clearLines();
  spawnPiece();
  updateStats();
}

function clearLines() {
  let cleared = 0;
  outer: for (let y = ROWS - 1; y >= 0; y--) {
    for (let x = 0; x < COLS; x++) {
      if (!board[y][x]) {
        continue outer;
      }
    }
    const row = board.splice(y, 1)[0].fill(null);
    board.unshift(row);
    cleared++;
    y++;
  }

  if (cleared > 0) {
    lines += cleared;
    score += SCORE_TABLE[cleared] * level;
    level = Math.floor(lines / LINES_PER_LEVEL) + 1;
    dropInterval = Math.max(120, 700 - (level - 1) * 55);
  }
}

function rotate(matrix) {
  return matrix[0].map((_, index) => matrix.map(row => row[index]).reverse());
}

function rotatePiece() {
  const original = currentPiece.matrix;
  const rotated = rotate(original);
  const posX = currentPiece.pos.x;
  let offset = 1;
  currentPiece.matrix = rotated;

  while (collide(board, currentPiece)) {
    currentPiece.pos.x += offset;
    offset = -(offset + (offset > 0 ? 1 : -1));
    if (Math.abs(offset) > currentPiece.matrix[0].length) {
      currentPiece.matrix = original;
      currentPiece.pos.x = posX;
      return;
    }
  }
}

function togglePause() {
  paused = !paused;
  if (paused) {
    setOverlay('已暫停', '按 P 或點擊「開始遊戲」繼續。', true);
  } else {
    hideOverlay();
  }
}

function endGame() {
  gameOver = true;
  running = false;
  if (animationId) cancelAnimationFrame(animationId);
  best = Math.max(best, score);
  localStorage.setItem('neon-tetris-best', String(best));
  bestEl.textContent = best;
  setOverlay('Game Over', `本局分數 ${score}，按重新開始再戰一場。`, true);
}

function updateStats() {
  if (score > best) {
    best = score;
    localStorage.setItem('neon-tetris-best', String(best));
  }
  scoreEl.textContent = score;
  levelEl.textContent = level;
  linesEl.textContent = lines;
  bestEl.textContent = best;
}

function setOverlay(title, message, visible = true) {
  overlayEl.innerHTML = `<h2>${title}</h2><p>${message}</p>`;
  overlayEl.classList.toggle('visible', visible);
}

function hideOverlay() {
  overlayEl.classList.remove('visible');
}
