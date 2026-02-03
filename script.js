const COLS = 10;
const ROWS = 20;
const BLOCK_SIZE = 30;
const LINES_PER_LEVEL = 10;

const boardCanvas = document.getElementById("board");
const boardCtx = boardCanvas.getContext("2d");
const nextCanvas = document.getElementById("next");
const nextCtx = nextCanvas.getContext("2d");
const holdCanvas = document.getElementById("hold");
const holdCtx = holdCanvas.getContext("2d");
const scoreEl = document.getElementById("score");
const levelEl = document.getElementById("level");
const linesEl = document.getElementById("lines");
const startBtn = document.getElementById("start");
const overlayEl = document.getElementById("overlay");

const COLORS = {
  I: "#5bc0eb",
  O: "#f9c74f",
  T: "#b5179e",
  S: "#43aa8b",
  Z: "#f94144",
  J: "#277da1",
  L: "#f3722c",
};

const SHAPES = {
  I: [
    [0, 0, 0, 0],
    [1, 1, 1, 1],
    [0, 0, 0, 0],
    [0, 0, 0, 0],
  ],
  O: [
    [1, 1],
    [1, 1],
  ],
  T: [
    [0, 1, 0],
    [1, 1, 1],
    [0, 0, 0],
  ],
  S: [
    [0, 1, 1],
    [1, 1, 0],
    [0, 0, 0],
  ],
  Z: [
    [1, 1, 0],
    [0, 1, 1],
    [0, 0, 0],
  ],
  J: [
    [1, 0, 0],
    [1, 1, 1],
    [0, 0, 0],
  ],
  L: [
    [0, 0, 1],
    [1, 1, 1],
    [0, 0, 0],
  ],
};

const BASE_DROP_INTERVAL = 1000;

let board = [];
let bag = [];
let currentPiece = null;
let nextPiece = null;
let holdPiece = null;
let canHold = true;
let score = 0;
let level = 1;
let lines = 0;
let dropInterval = BASE_DROP_INTERVAL;
let lastTime = 0;
let dropCounter = 0;
let isRunning = false;

const controls = {
  ArrowLeft: () => move(-1),
  ArrowRight: () => move(1),
  ArrowDown: () => softDrop(),
  ArrowUp: () => rotatePiece(1),
  KeyZ: () => rotatePiece(-1),
  Space: () => hardDrop(),
  ShiftLeft: () => hold(),
  ShiftRight: () => hold(),
};

function initBoard() {
  board = Array.from({ length: ROWS }, () => Array(COLS).fill(null));
}

function createPiece(type) {
  return {
    type,
    shape: SHAPES[type].map((row) => row.slice()),
    x: Math.floor((COLS - SHAPES[type][0].length) / 2),
    y: -1,
  };
}

function shuffleBag() {
  const types = Object.keys(SHAPES);
  bag = types.sort(() => Math.random() - 0.5);
}

function getNextPiece() {
  if (bag.length === 0) {
    shuffleBag();
  }
  const type = bag.pop();
  return createPiece(type);
}

function resetGame() {
  initBoard();
  score = 0;
  level = 1;
  lines = 0;
  dropInterval = BASE_DROP_INTERVAL;
  holdPiece = null;
  canHold = true;
  shuffleBag();
  currentPiece = getNextPiece();
  nextPiece = getNextPiece();
  updateStats();
  overlayEl.classList.add("hidden");
}

function updateStats() {
  scoreEl.textContent = score;
  levelEl.textContent = level;
  linesEl.textContent = lines;
}

function collide(piece) {
  for (let y = 0; y < piece.shape.length; y += 1) {
    for (let x = 0; x < piece.shape[y].length; x += 1) {
      if (!piece.shape[y][x]) continue;
      const boardX = piece.x + x;
      const boardY = piece.y + y;
      if (boardX < 0 || boardX >= COLS || boardY >= ROWS) {
        return true;
      }
      if (boardY >= 0 && board[boardY][boardX]) {
        return true;
      }
    }
  }
  return false;
}

function merge(piece) {
  piece.shape.forEach((row, y) => {
    row.forEach((value, x) => {
      if (value && piece.y + y >= 0) {
        board[piece.y + y][piece.x + x] = piece.type;
      }
    });
  });
}

function rotate(matrix, dir) {
  const rotated = matrix.map((row, y) => row.map((_, x) => matrix[x][y]));
  if (dir > 0) {
    rotated.forEach((row) => row.reverse());
  } else {
    rotated.reverse();
  }
  return rotated;
}

function rotatePiece(dir) {
  const rotated = rotate(currentPiece.shape, dir);
  const originalX = currentPiece.x;
  currentPiece.shape = rotated;
  let offset = 1;
  while (collide(currentPiece)) {
    currentPiece.x += offset;
    offset = -(offset + (offset > 0 ? 1 : -1));
    if (Math.abs(offset) > currentPiece.shape[0].length) {
      currentPiece.shape = rotate(currentPiece.shape, -dir);
      currentPiece.x = originalX;
      return;
    }
  }
}

function move(dir) {
  currentPiece.x += dir;
  if (collide(currentPiece)) {
    currentPiece.x -= dir;
  }
}

function softDrop() {
  currentPiece.y += 1;
  if (collide(currentPiece)) {
    currentPiece.y -= 1;
    lockPiece();
  }
  dropCounter = 0;
}

function hardDrop() {
  while (!collide(currentPiece)) {
    currentPiece.y += 1;
  }
  currentPiece.y -= 1;
  lockPiece();
}

function hold() {
  if (!canHold) return;
  if (holdPiece) {
    const temp = holdPiece;
    holdPiece = currentPiece;
    currentPiece = createPiece(temp.type);
  } else {
    holdPiece = currentPiece;
    currentPiece = nextPiece;
    nextPiece = getNextPiece();
  }
  currentPiece.x = Math.floor((COLS - currentPiece.shape[0].length) / 2);
  currentPiece.y = -1;
  canHold = false;
}

function lockPiece() {
  merge(currentPiece);
  clearLines();
  currentPiece = nextPiece;
  nextPiece = getNextPiece();
  canHold = true;
  if (collide(currentPiece)) {
    isRunning = false;
    overlayEl.classList.remove("hidden");
  }
}

function clearLines() {
  let cleared = 0;
  board = board.filter((row) => {
    const full = row.every((cell) => cell);
    if (full) {
      cleared += 1;
      return false;
    }
    return true;
  });
  while (board.length < ROWS) {
    board.unshift(Array(COLS).fill(null));
  }
  if (cleared > 0) {
    const points = [0, 100, 300, 500, 800];
    score += points[cleared] * level;
    lines += cleared;
    level = Math.floor(lines / LINES_PER_LEVEL) + 1;
    dropInterval = Math.max(100, BASE_DROP_INTERVAL - (level - 1) * 80);
    updateStats();
  }
}

function drawCell(ctx, x, y, color) {
  ctx.fillStyle = color;
  ctx.fillRect(x * BLOCK_SIZE, y * BLOCK_SIZE, BLOCK_SIZE, BLOCK_SIZE);
  ctx.strokeStyle = "rgba(255,255,255,0.1)";
  ctx.strokeRect(x * BLOCK_SIZE, y * BLOCK_SIZE, BLOCK_SIZE, BLOCK_SIZE);
}

function drawBoard() {
  boardCtx.clearRect(0, 0, boardCanvas.width, boardCanvas.height);
  board.forEach((row, y) => {
    row.forEach((cell, x) => {
      if (cell) {
        drawCell(boardCtx, x, y, COLORS[cell]);
      }
    });
  });
}

function drawPiece(ctx, piece) {
  piece.shape.forEach((row, y) => {
    row.forEach((value, x) => {
      if (value && piece.y + y >= 0) {
        drawCell(ctx, piece.x + x, piece.y + y, COLORS[piece.type]);
      }
    });
  });
}

function drawGhost() {
  const ghost = {
    ...currentPiece,
    y: currentPiece.y,
    shape: currentPiece.shape,
  };
  while (!collide(ghost)) {
    ghost.y += 1;
  }
  ghost.y -= 1;
  boardCtx.save();
  boardCtx.globalAlpha = 0.3;
  ghost.shape.forEach((row, y) => {
    row.forEach((value, x) => {
      if (value && ghost.y + y >= 0) {
        drawCell(boardCtx, ghost.x + x, ghost.y + y, COLORS[ghost.type]);
      }
    });
  });
  boardCtx.restore();
}

function drawMini(ctx, piece) {
  ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
  if (!piece) return;
  const shape = piece.shape;
  const offsetX = Math.floor((4 - shape[0].length) / 2);
  const offsetY = Math.floor((4 - shape.length) / 2);
  shape.forEach((row, y) => {
    row.forEach((value, x) => {
      if (value) {
        ctx.fillStyle = COLORS[piece.type];
        ctx.fillRect((x + offsetX) * 30, (y + offsetY) * 30, 30, 30);
        ctx.strokeStyle = "rgba(255,255,255,0.15)";
        ctx.strokeRect((x + offsetX) * 30, (y + offsetY) * 30, 30, 30);
      }
    });
  });
}

function update(time = 0) {
  if (!isRunning) return;
  const delta = time - lastTime;
  lastTime = time;
  dropCounter += delta;
  if (dropCounter > dropInterval) {
    softDrop();
  }
  drawBoard();
  drawGhost();
  drawPiece(boardCtx, currentPiece);
  drawMini(nextCtx, nextPiece);
  drawMini(holdCtx, holdPiece);
  requestAnimationFrame(update);
}

function startGame() {
  resetGame();
  isRunning = true;
  lastTime = 0;
  dropCounter = 0;
  update();
}

boardCanvas.width = COLS * BLOCK_SIZE;
boardCanvas.height = ROWS * BLOCK_SIZE;

startBtn.addEventListener("click", startGame);

window.addEventListener("keydown", (event) => {
  if (!isRunning) return;
  const action = controls[event.code];
  if (action) {
    event.preventDefault();
    action();
  }
});

resetGame();
