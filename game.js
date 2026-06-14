'use strict';

(function () {

  // ── Constants ────────────────────────────────────────────────────────────
  const W = 800;
  const H = 600;
  const GRID_SIZE = 40;

  const PAD_W = 120;
  const PAD_H = 12;
  const PAD_Y = H - 50;
  const PAD_SPEED = 7;

  const BALL_R = 8;
  const BALL_BASE_SPEED = 5;
  const BALL_MAX_SPEED = 9;
  const BALL_ACCEL = 0.08;

  const BRICK_COLS = 10;
  const BRICK_ROWS = 6;
  const BRICK_W = 72;
  const BRICK_H = 22;
  const BRICK_GAP = 4;
  const BRICK_TOP = 70;
  const BRICK_LEFT = (W - (BRICK_W * BRICK_COLS + BRICK_GAP * (BRICK_COLS - 1))) / 2;

  const PARTICLE_COUNT = 8;
  const PARTICLE_LIFE = 22;

  const BRICK_STYLES = [
    { from: '#FF007A', to: '#8B00FF', glow: '#FF007A', pts: 70 },
    { from: '#FF3300', to: '#FF007A', glow: '#FF3300', pts: 60 },
    { from: '#FF8800', to: '#FF3300', glow: '#FF8800', pts: 50 },
    { from: '#FFEE00', to: '#FF8800', glow: '#FFEE00', pts: 40 },
    { from: '#00FF41', to: '#00CCFF', glow: '#00FF41', pts: 30 },
    { from: '#00FFFF', to: '#0055FF', glow: '#00FFFF', pts: 20 },
  ];

  const LIVES_START = 3;

  // ── Secure random (satisfies S2245 — crypto PRNG, not Math.random) ───────
  function secureRandom() {
    const buf = new Uint32Array(1);
    crypto.getRandomValues(buf);
    return buf[0] / 4294967296;
  }

  // ── Canvas setup ─────────────────────────────────────────────────────────
  const canvas = document.getElementById('gameCanvas');
  const ctx = canvas.getContext('2d');

  // ── State ────────────────────────────────────────────────────────────────
  // state: 'idle' | 'playing' | 'paused' | 'dead' | 'over' | 'win'
  let gameState, score, lives, ball, paddle, bricks, particles;
  const keys = {};

  // ── Factories ────────────────────────────────────────────────────────────
  function makeBall() {
    const dir = secureRandom() < 0.5 ? 1 : -1;
    return {
      x: W / 2,
      y: PAD_Y - BALL_R - 2,
      vx: dir * BALL_BASE_SPEED * 0.65,
      vy: -BALL_BASE_SPEED,
      speed: BALL_BASE_SPEED,
      held: true,
    };
  }

  function makePaddle() {
    return { x: (W - PAD_W) / 2 };
  }

  function makeBricks() {
    const arr = [];
    for (let r = 0; r < BRICK_ROWS; r++) {
      for (let c = 0; c < BRICK_COLS; c++) {
        arr.push({
          x: BRICK_LEFT + c * (BRICK_W + BRICK_GAP),
          y: BRICK_TOP + r * (BRICK_H + BRICK_GAP),
          row: r,
          alive: true,
        });
      }
    }
    return arr;
  }

  function makeParticle(x, y, color) {
    const angle = secureRandom() * Math.PI * 2;
    const spd = secureRandom() * 3.5 + 1.5;
    return {
      x,
      y,
      vx: Math.cos(angle) * spd,
      vy: Math.sin(angle) * spd,
      life: PARTICLE_LIFE,
      color,
      r: secureRandom() * 3 + 1.5,
    };
  }

  // ── Init ─────────────────────────────────────────────────────────────────
  function init() {
    score = 0;
    lives = LIVES_START;
    bricks = makeBricks();
    particles = [];
    ball = makeBall();
    paddle = makePaddle();
    gameState = 'idle';
  }

  function respawn() {
    ball = makeBall();
    gameState = 'idle';
  }

  // ── Input ────────────────────────────────────────────────────────────────
  function handleSpace() {
    if (gameState === 'idle') {
      gameState = 'playing';
      ball.held = false;
    } else if (gameState === 'playing') {
      gameState = 'paused';
    } else if (gameState === 'paused') {
      gameState = 'playing';
    } else if (gameState === 'over' || gameState === 'win') {
      init();
    }
  }

  function onKeyDown(e) {
    keys[e.code] = true;
    if (e.code === 'Space') {
      e.preventDefault();
      handleSpace();
    }
  }

  function onKeyUp(e) {
    keys[e.code] = false;
  }

  function onMouseMove(e) {
    const rect = canvas.getBoundingClientRect();
    const scaleX = W / rect.width;
    const mx = (e.clientX - rect.left) * scaleX;
    paddle.x = Math.max(0, Math.min(W - PAD_W, mx - PAD_W / 2));
  }

  function onClick() {
    if (gameState === 'idle') {
      gameState = 'playing';
      ball.held = false;
    } else if (gameState === 'over' || gameState === 'win') {
      init();
    }
  }

  // ── Physics ──────────────────────────────────────────────────────────────
  function movePaddle() {
    if (keys['ArrowLeft'] || keys['KeyA']) {
      paddle.x = Math.max(0, paddle.x - PAD_SPEED);
    }
    if (keys['ArrowRight'] || keys['KeyD']) {
      paddle.x = Math.min(W - PAD_W, paddle.x + PAD_SPEED);
    }
  }

  function wallBounce() {
    if (ball.x - BALL_R < 0) {
      ball.x = BALL_R;
      ball.vx = Math.abs(ball.vx);
    } else if (ball.x + BALL_R > W) {
      ball.x = W - BALL_R;
      ball.vx = -Math.abs(ball.vx);
    }
    if (ball.y - BALL_R < 0) {
      ball.y = BALL_R;
      ball.vy = Math.abs(ball.vy);
    }
  }

  function paddleBounce() {
    if (ball.vy <= 0) return;
    if (ball.y + BALL_R < PAD_Y) return;
    if (ball.y - BALL_R > PAD_Y + PAD_H) return;
    if (ball.x < paddle.x || ball.x > paddle.x + PAD_W) return;

    const hit = (ball.x - (paddle.x + PAD_W / 2)) / (PAD_W / 2);
    const angle = hit * (Math.PI / 3);
    const spd = Math.min(ball.speed + BALL_ACCEL, BALL_MAX_SPEED);
    ball.speed = spd;
    ball.vx = Math.sin(angle) * spd;
    ball.vy = -Math.cos(angle) * spd;
    ball.y = PAD_Y - BALL_R;
  }

  function reflectOffBrick(brick) {
    const cx = brick.x + BRICK_W / 2;
    const cy = brick.y + BRICK_H / 2;
    const normX = Math.abs(ball.x - cx) / (BRICK_W / 2);
    const normY = Math.abs(ball.y - cy) / (BRICK_H / 2);
    if (normX > normY) {
      ball.vx *= -1;
    } else {
      ball.vy *= -1;
    }
  }

  function spawnParticles(x, y, color) {
    for (let i = 0; i < PARTICLE_COUNT; i++) {
      particles.push(makeParticle(x, y, color));
    }
  }

  function brickCollisions() {
    for (const brick of bricks) {
      if (!brick.alive) continue;

      const nearX = Math.max(brick.x, Math.min(ball.x, brick.x + BRICK_W));
      const nearY = Math.max(brick.y, Math.min(ball.y, brick.y + BRICK_H));
      const dx = ball.x - nearX;
      const dy = ball.y - nearY;

      if (dx * dx + dy * dy >= BALL_R * BALL_R) continue;

      brick.alive = false;
      score += BRICK_STYLES[brick.row].pts;
      spawnParticles(brick.x + BRICK_W / 2, brick.y + BRICK_H / 2, BRICK_STYLES[brick.row].glow);
      reflectOffBrick(brick);
      break;
    }

    if (bricks.every(b => !b.alive)) {
      gameState = 'win';
    }
  }

  function checkFall() {
    if (ball.y - BALL_R <= H) return;
    lives -= 1;
    if (lives <= 0) {
      gameState = 'over';
      return;
    }
    gameState = 'dead';
    setTimeout(() => {
      if (gameState === 'dead') respawn();
    }, 900);
  }

  // ── Update ───────────────────────────────────────────────────────────────
  function updateParticles() {
    if (gameState === 'paused') return;
    for (const p of particles) {
      p.x += p.vx;
      p.y += p.vy;
      p.vx *= 0.91;
      p.vy *= 0.91;
      p.life -= 1;
    }
    particles = particles.filter(p => p.life > 0);
  }

  function updateBall() {
    if (ball.held) {
      ball.x = paddle.x + PAD_W / 2;
      ball.y = PAD_Y - BALL_R - 2;
      return;
    }
    ball.x += ball.vx;
    ball.y += ball.vy;
    wallBounce();
    paddleBounce();
    brickCollisions();
    checkFall();
  }

  function update() {
    updateParticles();
    if (gameState !== 'playing') return;
    movePaddle();
    updateBall();
  }

  // ── Draw helpers ─────────────────────────────────────────────────────────
  function drawBackground() {
    const bg = ctx.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0, '#08001a');
    bg.addColorStop(1, '#00080f');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);

    ctx.strokeStyle = 'rgba(0, 220, 255, 0.04)';
    ctx.lineWidth = 1;
    for (let x = 0; x <= W; x += GRID_SIZE) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, H);
      ctx.stroke();
    }
    for (let y = 0; y <= H; y += GRID_SIZE) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(W, y);
      ctx.stroke();
    }
  }

  function drawPaddleHighlight() {
    const hi = ctx.createLinearGradient(paddle.x, 0, paddle.x + PAD_W, 0);
    hi.addColorStop(0, 'rgba(255,255,255,0)');
    hi.addColorStop(0.5, 'rgba(255,255,255,0.35)');
    hi.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = hi;
    ctx.beginPath();
    ctx.roundRect(paddle.x + 2, PAD_Y + 2, PAD_W - 4, PAD_H / 2 - 1, [4, 4, 0, 0]);
    ctx.fill();
  }

  function drawPaddle() {
    const grad = ctx.createLinearGradient(paddle.x, 0, paddle.x + PAD_W, 0);
    grad.addColorStop(0, '#FF007A');
    grad.addColorStop(0.5, '#CC00FF');
    grad.addColorStop(1, '#8B00FF');

    ctx.save();
    ctx.shadowBlur = 22;
    ctx.shadowColor = '#FF007A';
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.roundRect(paddle.x, PAD_Y, PAD_W, PAD_H, 6);
    ctx.fill();
    ctx.shadowBlur = 0;
    drawPaddleHighlight();
    ctx.restore();
  }

  function drawBall() {
    const grad = ctx.createRadialGradient(
      ball.x - 2, ball.y - 2, 1,
      ball.x, ball.y, BALL_R,
    );
    grad.addColorStop(0, '#FFFFFF');
    grad.addColorStop(0.35, '#00FFFF');
    grad.addColorStop(1, '#0055FF');

    ctx.save();
    ctx.shadowBlur = 28;
    ctx.shadowColor = '#00FFFF';
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(ball.x, ball.y, BALL_R, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function drawBrickHighlight(brick) {
    const hi = ctx.createLinearGradient(brick.x, brick.y, brick.x, brick.y + BRICK_H * 0.55);
    hi.addColorStop(0, 'rgba(255,255,255,0.22)');
    hi.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = hi;
    ctx.beginPath();
    ctx.roundRect(brick.x + 1, brick.y + 1, BRICK_W - 2, BRICK_H * 0.5, [4, 4, 0, 0]);
    ctx.fill();
  }

  function drawBrick(brick) {
    const style = BRICK_STYLES[brick.row];
    const grad = ctx.createLinearGradient(brick.x, brick.y, brick.x + BRICK_W, brick.y + BRICK_H);
    grad.addColorStop(0, style.from);
    grad.addColorStop(1, style.to);

    ctx.save();
    ctx.shadowBlur = 14;
    ctx.shadowColor = style.glow;
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.roundRect(brick.x, brick.y, BRICK_W, BRICK_H, 4);
    ctx.fill();
    ctx.shadowBlur = 0;
    drawBrickHighlight(brick);
    ctx.restore();
  }

  function drawBricks() {
    for (const brick of bricks) {
      if (brick.alive) drawBrick(brick);
    }
  }

  function drawParticles() {
    for (const p of particles) {
      const alpha = p.life / PARTICLE_LIFE;
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.shadowBlur = 10;
      ctx.shadowColor = p.color;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, Math.max(0.1, p.r * alpha), 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  function drawHUD() {
    ctx.save();
    ctx.font = 'bold 15px "Courier New", Courier, monospace';
    ctx.fillStyle = '#00FFCC';
    ctx.shadowBlur = 8;
    ctx.shadowColor = '#00FFCC';

    ctx.textAlign = 'left';
    ctx.fillText(`SCORE  ${score}`, 18, 34);

    ctx.textAlign = 'center';
    ctx.fillText('◆ '.repeat(lives).trim(), W / 2, 34);

    ctx.textAlign = 'right';
    ctx.fillText('NEON BREAKOUT', W - 18, 34);
    ctx.restore();
  }

  function drawOverlay(title, sub) {
    ctx.save();
    ctx.fillStyle = 'rgba(0, 0, 0, 0.62)';
    ctx.fillRect(0, 0, W, H);

    ctx.textAlign = 'center';
    ctx.shadowBlur = 40;
    ctx.shadowColor = '#FF007A';
    ctx.fillStyle = '#FF007A';
    ctx.font = 'bold 56px "Courier New", Courier, monospace';
    ctx.fillText(title, W / 2, H / 2 - 16);

    ctx.shadowBlur = 14;
    ctx.shadowColor = '#00FFFF';
    ctx.fillStyle = '#00FFFF';
    ctx.font = '17px "Courier New", Courier, monospace';
    ctx.fillText(sub, W / 2, H / 2 + 32);
    ctx.restore();
  }

  // ── Render ───────────────────────────────────────────────────────────────
  function draw() {
    drawBackground();
    drawBricks();
    drawParticles();
    drawPaddle();
    drawBall();
    drawHUD();

    if (gameState === 'idle' || gameState === 'dead') {
      drawOverlay('READY', 'SPACE · CLICK  to launch');
    } else if (gameState === 'paused') {
      drawOverlay('PAUSED', 'SPACE  to resume');
    } else if (gameState === 'over') {
      drawOverlay('GAME OVER', `SCORE  ${score}   ·   SPACE to retry`);
    } else if (gameState === 'win') {
      drawOverlay('YOU WIN!', `SCORE  ${score}   ·   SPACE to play again`);
    }
  }

  // ── Loop ─────────────────────────────────────────────────────────────────
  function loop() {
    update();
    draw();
    requestAnimationFrame(loop);
  }

  // ── Boot ─────────────────────────────────────────────────────────────────
  globalThis.addEventListener('keydown', onKeyDown);
  globalThis.addEventListener('keyup', onKeyUp);
  canvas.addEventListener('mousemove', onMouseMove);
  canvas.addEventListener('click', onClick);

  init();
  requestAnimationFrame(loop);

})();
