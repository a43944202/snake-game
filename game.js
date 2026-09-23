// ─── Snake Game Engine ───────────────────────────────────────────────
(() => {
  'use strict';

  /* ── DOM ── */
  const canvas      = document.getElementById('gameCanvas');
  const ctx         = canvas.getContext('2d');
  const scoreEl     = document.getElementById('score');
  const highScoreEl = document.getElementById('highScore');
  const startOverlay   = document.getElementById('startOverlay');
  const gameOverOverlay = document.getElementById('gameOverOverlay');
  const finalScoreEl   = document.getElementById('finalScore');
  const startBtn       = document.getElementById('startBtn');
  const restartBtn     = document.getElementById('restartBtn');
  const diffBtns       = document.querySelectorAll('.diff-btn');

  /* ── Constants ── */
  const GRID  = 20;
  const CELL  = () => parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--cell-px'));

  const SPEEDS = { easy: 130, normal: 95, hard: 60 };
  let difficulty = 'normal';

  /* ── State ── */
  let snake, direction, nextDirection, food, score, highScore, running, loopId, lastTime, interval;
  let trail = [];            // fading tail trail
  let particles = [];        // burst particles

  /* ── Init canvas size ── */
  function resizeCanvas() {
    const cell = CELL();
    canvas.width  = GRID * cell;
    canvas.height = GRID * cell;
  }

  /* ── High score persistence ── */
  function loadHighScore() {
    highScore = parseInt(localStorage.getItem('snake_hs') || '0', 10);
    highScoreEl.textContent = highScore;
  }
  function saveHighScore() {
    if (score > highScore) {
      highScore = score;
      localStorage.setItem('snake_hs', highScore);
      highScoreEl.textContent = highScore;
    }
  }

  /* ── Random grid position ── */
  function randPos() {
    return { x: Math.floor(Math.random() * GRID), y: Math.floor(Math.random() * GRID) };
  }

  /* ── Place food avoiding snake ── */
  function placeFood() {
    let pos;
    do { pos = randPos(); } while (snake.some(s => s.x === pos.x && s.y === pos.y));
    food = pos;
  }

  /* ── Particles ── */
  function spawnParticles(cx, cy) {
    const cell = CELL();
    const containerRect = canvas.parentElement.getBoundingClientRect();
    const canvasRect    = canvas.getBoundingClientRect();
    const offsetX = canvasRect.left - containerRect.left;
    const offsetY = canvasRect.top  - containerRect.top;

    for (let i = 0; i < 8; i++) {
      const el = document.createElement('div');
      el.className = 'particle';
      const angle = (Math.PI * 2 / 8) * i + Math.random() * .5;
      const dist  = 18 + Math.random() * 22;
      el.style.setProperty('--tx', `${Math.cos(angle) * dist}px`);
      el.style.setProperty('--ty', `${Math.sin(angle) * dist}px`);
      el.style.left = `${offsetX + cx * cell + cell / 2}px`;
      el.style.top  = `${offsetY + cy * cell + cell / 2}px`;
      el.style.background = ['#22d97f','#7c5cfc','#38bdf8','#fbbf24','#ff5ca1'][Math.floor(Math.random()*5)];
      canvas.parentElement.appendChild(el);
      el.addEventListener('animationend', () => el.remove());
    }
  }

  /* ── Reset ── */
  function resetGame() {
    const mid = Math.floor(GRID / 2);
    snake = [{ x: mid, y: mid }, { x: mid - 1, y: mid }, { x: mid - 2, y: mid }];
    direction = { x: 1, y: 0 };
    nextDirection = { ...direction };
    score = 0;
    scoreEl.textContent = '0';
    trail = [];
    particles = [];
    interval = SPEEDS[difficulty];
    placeFood();
  }

  /* ── Game loop ── */
  function gameLoop(timestamp) {
    if (!running) return;
    loopId = requestAnimationFrame(gameLoop);
    if (!lastTime) lastTime = timestamp;
    if (timestamp - lastTime < interval) { draw(); return; }
    lastTime = timestamp;
    update();
    draw();
  }

  /* ── Update ── */
  function update() {
    direction = { ...nextDirection };

    const head = { x: snake[0].x + direction.x, y: snake[0].y + direction.y };

    // Wall collision
    if (head.x < 0 || head.x >= GRID || head.y < 0 || head.y >= GRID) { gameOver(); return; }

    // Self collision
    if (snake.some(s => s.x === head.x && s.y === head.y)) { gameOver(); return; }

    snake.unshift(head);

    // Eat food
    if (head.x === food.x && head.y === food.y) {
      score++;
      scoreEl.textContent = score;
      spawnParticles(food.x, food.y);
      placeFood();
      // Slight speed-up
      interval = Math.max(45, interval - 1);
    } else {
      const removed = snake.pop();
      trail.push({ ...removed, alpha: .45 });
    }

    // Fade trail
    trail = trail.filter(t => { t.alpha -= .06; return t.alpha > 0; });
  }

  /* ── Draw ── */
  function draw() {
    const cell = CELL();
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Grid dots
    ctx.fillStyle = 'rgba(255,255,255,.025)';
    for (let x = 0; x < GRID; x++)
      for (let y = 0; y < GRID; y++)
        ctx.fillRect(x * cell + cell / 2 - .5, y * cell + cell / 2 - .5, 1, 1);

    // Trail
    trail.forEach(t => {
      ctx.globalAlpha = t.alpha * .35;
      ctx.fillStyle = '#7c5cfc';
      roundRect(ctx, t.x * cell + 1, t.y * cell + 1, cell - 2, cell - 2, 4);
      ctx.fill();
    });
    ctx.globalAlpha = 1;

    // Snake body
    snake.forEach((seg, i) => {
      const t = i / snake.length;
      const r = lerp(34, 124, t);
      const g = lerp(217, 92, t);
      const b = lerp(127, 252, t);
      ctx.fillStyle = `rgb(${r},${g},${b})`;

      // Glow on head
      if (i === 0) {
        ctx.shadowColor = 'rgba(34,217,127,.6)';
        ctx.shadowBlur  = 14;
      }
      roundRect(ctx, seg.x * cell + 1, seg.y * cell + 1, cell - 2, cell - 2, i === 0 ? 6 : 4);
      ctx.fill();
      ctx.shadowBlur = 0;

      // Eyes on head
      if (i === 0) {
        drawEyes(seg, cell);
      }
    });

    // Food
    drawFood(cell);
  }

  /* ── Draw food ── */
  function drawFood(cell) {
    const cx = food.x * cell + cell / 2;
    const cy = food.y * cell + cell / 2;
    const r  = cell * .38;

    // Outer glow
    ctx.shadowColor = 'rgba(255,77,109,.55)';
    ctx.shadowBlur  = 16;

    // Pulsing
    const pulse = 1 + Math.sin(Date.now() / 200) * .1;

    ctx.beginPath();
    ctx.arc(cx, cy, r * pulse, 0, Math.PI * 2);
    ctx.fillStyle = '#ff4d6d';
    ctx.fill();

    // Inner highlight
    ctx.beginPath();
    ctx.arc(cx - r * .25, cy - r * .25, r * .3 * pulse, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255,255,255,.35)';
    ctx.fill();

    ctx.shadowBlur = 0;
  }

  /* ── Draw eyes ── */
  function drawEyes(head, cell) {
    const cx = head.x * cell + cell / 2;
    const cy = head.y * cell + cell / 2;
    const size = cell * .13;
    const offset = cell * .22;

    let e1, e2;
    if (direction.x === 1)       { e1 = { x: cx + offset * .6, y: cy - offset }; e2 = { x: cx + offset * .6, y: cy + offset }; }
    else if (direction.x === -1) { e1 = { x: cx - offset * .6, y: cy - offset }; e2 = { x: cx - offset * .6, y: cy + offset }; }
    else if (direction.y === -1) { e1 = { x: cx - offset, y: cy - offset * .6 }; e2 = { x: cx + offset, y: cy - offset * .6 }; }
    else                         { e1 = { x: cx - offset, y: cy + offset * .6 }; e2 = { x: cx + offset, y: cy + offset * .6 }; }

    [e1, e2].forEach(e => {
      ctx.beginPath();
      ctx.arc(e.x, e.y, size, 0, Math.PI * 2);
      ctx.fillStyle = '#fff';
      ctx.fill();
      ctx.beginPath();
      ctx.arc(e.x, e.y, size * .5, 0, Math.PI * 2);
      ctx.fillStyle = '#111';
      ctx.fill();
    });
  }

  /* ── Helpers ── */
  function lerp(a, b, t) { return a + (b - a) * t; }

  function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
  }

  /* ── Game over ── */
  function gameOver() {
    running = false;
    cancelAnimationFrame(loopId);
    saveHighScore();
    finalScoreEl.textContent = score;
    gameOverOverlay.classList.remove('hidden');

    // Flash canvas border
    canvas.parentElement.style.boxShadow = '0 0 0 2px rgba(255,77,109,.6), 0 0 40px rgba(255,77,109,.25)';
    setTimeout(() => {
      canvas.parentElement.style.boxShadow = '';
    }, 400);
  }

  /* ── Start ── */
  function startGame() {
    startOverlay.classList.add('hidden');
    gameOverOverlay.classList.add('hidden');
    resetGame();
    running  = true;
    lastTime = null;
    loopId   = requestAnimationFrame(gameLoop);
  }

  /* ── Input ── */
  const KEY_MAP = {
    ArrowUp:    { x:  0, y: -1 }, w: { x:  0, y: -1 }, W: { x:  0, y: -1 },
    ArrowDown:  { x:  0, y:  1 }, s: { x:  0, y:  1 }, S: { x:  0, y:  1 },
    ArrowLeft:  { x: -1, y:  0 }, a: { x: -1, y:  0 }, A: { x: -1, y:  0 },
    ArrowRight: { x:  1, y:  0 }, d: { x:  1, y:  0 }, D: { x:  1, y:  0 },
  };

  document.addEventListener('keydown', e => {
    const dir = KEY_MAP[e.key];
    if (!dir) return;
    e.preventDefault();
    // Prevent 180° turn
    if (dir.x !== -direction.x || dir.y !== -direction.y) {
      nextDirection = dir;
    }
  });

  // Space / Enter to start / restart
  document.addEventListener('keydown', e => {
    if ((e.key === ' ' || e.key === 'Enter') && !running) {
      e.preventDefault();
      startGame();
    }
  });

  /* ── Mobile D-Pad ── */
  const DPAD_DIRS = {
    up:    { x:  0, y: -1 },
    down:  { x:  0, y:  1 },
    left:  { x: -1, y:  0 },
    right: { x:  1, y:  0 },
  };

  document.querySelectorAll('.dpad-btn').forEach(btn => {
    // Use pointerdown — works for touch, mouse, and pen on all platforms
    btn.addEventListener('pointerdown', e => {
      e.preventDefault();
      const dir = DPAD_DIRS[btn.dataset.dir];
      if (dir && (dir.x !== -direction.x || dir.y !== -direction.y)) {
        nextDirection = dir;
      }
    });
    // Prevent long-press context menu on mobile
    btn.addEventListener('contextmenu', e => e.preventDefault());
  });

  /* ── Touch swipe support ── */
  let touchStartX = 0, touchStartY = 0;
  canvas.addEventListener('touchstart', e => {
    e.preventDefault();           // prevent scroll / zoom
    touchStartX = e.touches[0].clientX;
    touchStartY = e.touches[0].clientY;
  }, { passive: false });

  // Prevent scrolling while dragging over the canvas
  canvas.addEventListener('touchmove', e => {
    e.preventDefault();
  }, { passive: false });

  canvas.addEventListener('touchend', e => {
    e.preventDefault();
    const dx = e.changedTouches[0].clientX - touchStartX;
    const dy = e.changedTouches[0].clientY - touchStartY;
    const absDx = Math.abs(dx);
    const absDy = Math.abs(dy);
    if (Math.max(absDx, absDy) < 20) return; // too small

    let dir;
    if (absDx > absDy) dir = dx > 0 ? { x: 1, y: 0 } : { x: -1, y: 0 };
    else               dir = dy > 0 ? { x: 0, y: 1 } : { x: 0, y: -1 };

    if (dir.x !== -direction.x || dir.y !== -direction.y) nextDirection = dir;
  }, { passive: false });

  /* ── Difficulty selector ── */
  diffBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      diffBtns.forEach(b => {
        b.classList.remove('active');
        b.setAttribute('aria-pressed', 'false');
      });
      btn.classList.add('active');
      btn.setAttribute('aria-pressed', 'true');
      difficulty = btn.dataset.diff;
      if (!running) interval = SPEEDS[difficulty];
    });
  });

  /* ── Button wiring ── */
  startBtn.addEventListener('click', startGame);
  restartBtn.addEventListener('click', startGame);

  /* ── Resize handling ── */
  window.addEventListener('resize', () => {
    resizeCanvas();
    if (!running) draw();
  });

  /* ── Boot ── */
  loadHighScore();
  resizeCanvas();
  resetGame();
  draw();                 // draw initial state behind overlay
})();
