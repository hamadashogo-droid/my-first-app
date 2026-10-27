const canvas = document.querySelector("#game");
const ctx = canvas.getContext("2d");

const WIDTH = canvas.width;
const HEIGHT = canvas.height;
const WORLD_WIDTH = 3600;
const GRAVITY = 1550;

const platforms = [
  { x: 0, y: 470, w: 600, h: 100 },
  { x: 720, y: 470, w: 580, h: 100 },
  { x: 1420, y: 470, w: 600, h: 100 },
  { x: 2160, y: 470, w: 640, h: 100 },
  { x: 2940, y: 470, w: 660, h: 100 },
  { x: 350, y: 375, w: 140, h: 22 },
  { x: 900, y: 360, w: 135, h: 22 },
  { x: 1080, y: 300, w: 130, h: 22 },
  { x: 1540, y: 370, w: 150, h: 22 },
  { x: 1780, y: 305, w: 140, h: 22 },
  { x: 2290, y: 365, w: 140, h: 22 },
  { x: 2490, y: 300, w: 135, h: 22 },
  { x: 3060, y: 365, w: 150, h: 22 },
  { x: 3300, y: 305, w: 140, h: 22 },
];

const coinSpots = [
  [290, 420], [390, 330], [555, 420], [805, 420], [940, 315],
  [1130, 255], [1240, 420], [1500, 420], [1600, 325], [1845, 260],
  [1970, 420], [2230, 420], [2350, 320], [2555, 255], [2700, 420],
  [3000, 420], [3120, 320], [3365, 260], [3480, 420],
].map(([x, y]) => ({ x, y, collected: false }));

const enemySpots = [
  { x: 470, min: 430, max: 560, speed: 75 },
  { x: 1000, min: 770, max: 1230, speed: 90 },
  { x: 1660, min: 1460, max: 1960, speed: 82 },
  { x: 2390, min: 2200, max: 2730, speed: 95 },
  { x: 3180, min: 2980, max: 3460, speed: 88 },
];

const input = { left: false, right: false, jumpQueued: false };
const player = {
  x: 72,
  y: 0,
  w: 34,
  h: 48,
  vx: 0,
  vy: 0,
  facing: 1,
  grounded: false,
  invulnerable: 0,
};

let enemies = [];
let cameraX = 0;
let lives = 3;
let score = 0;
let gameState = "playing";
let previousTime = 0;

function resetGame() {
  player.x = 72;
  player.y = 470 - player.h;
  player.vx = 0;
  player.vy = 0;
  player.facing = 1;
  player.grounded = false;
  player.invulnerable = 0;
  lives = 3;
  score = 0;
  cameraX = 0;
  gameState = "playing";
  for (const coin of coinSpots) coin.collected = false;
  enemies = enemySpots.map((enemy) => ({
    ...enemy,
    w: 34,
    h: 32,
    direction: 1,
    alive: true,
  }));
}

function overlaps(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x
    && a.y < b.y + b.h && a.y + a.h > b.y;
}

function handleInput(event, pressed) {
  const key = event.key.toLowerCase();
  if (["arrowleft", "arrowright", " ", "arrowup"].includes(key)) {
    event.preventDefault();
  }

  if (key === "arrowleft" || key === "a") input.left = pressed;
  if (key === "arrowright" || key === "d") input.right = pressed;
  if (pressed && !event.repeat && [" ", "arrowup", "w"].includes(key)) {
    input.jumpQueued = true;
  }
  if (pressed && key === "r") resetGame();
}

window.addEventListener("keydown", (event) => handleInput(event, true));
window.addEventListener("keyup", (event) => handleInput(event, false));
window.addEventListener("blur", () => {
  input.left = false;
  input.right = false;
  input.jumpQueued = false;
});

for (const button of document.querySelectorAll("[data-control]")) {
  const control = button.dataset.control;
  const press = (event) => {
    event.preventDefault();
    if (control === "jump") input.jumpQueued = true;
    else input[control] = true;
    button.setPointerCapture?.(event.pointerId);
  };
  const release = (event) => {
    event.preventDefault();
    if (control !== "jump") input[control] = false;
  };
  button.addEventListener("pointerdown", press);
  button.addEventListener("pointerup", release);
  button.addEventListener("pointercancel", release);
  button.addEventListener("lostpointercapture", release);
}

function hurtPlayer() {
  if (player.invulnerable > 0) return;
  lives -= 1;
  if (lives <= 0) {
    gameState = "gameover";
    return;
  }
  player.x = Math.max(72, player.x - 120);
  player.y = 470 - player.h;
  player.vx = 0;
  player.vy = 0;
  player.invulnerable = 1.4;
}

function update(delta) {
  if (gameState !== "playing") return;

  const previousBottom = player.y + player.h;
  player.vx = (Number(input.right) - Number(input.left)) * 285;
  if (player.vx !== 0) player.facing = Math.sign(player.vx);
  if (input.jumpQueued && player.grounded) {
    player.vy = -640;
    player.grounded = false;
  }
  input.jumpQueued = false;

  player.x += player.vx * delta;
  for (const platform of platforms) {
    if (!overlaps(player, platform)) continue;
    if (player.vx > 0) player.x = platform.x - player.w;
    else if (player.vx < 0) player.x = platform.x + platform.w;
  }
  player.x = Math.max(0, Math.min(WORLD_WIDTH - player.w, player.x));

  player.vy += GRAVITY * delta;
  player.y += player.vy * delta;
  player.grounded = false;
  for (const platform of platforms) {
    if (!overlaps(player, platform)) continue;
    if (player.vy > 0) {
      player.y = platform.y - player.h;
      player.grounded = true;
    } else if (player.vy < 0) {
      player.y = platform.y + platform.h;
    }
    player.vy = 0;
  }

  if (player.invulnerable > 0) player.invulnerable -= delta;
  if (player.y > HEIGHT + 100) {
    hurtPlayer();
    if (lives > 0) player.y = 470 - player.h;
  }

  for (const coin of coinSpots) {
    if (!coin.collected && overlaps(player, { x: coin.x - 12, y: coin.y - 12, w: 24, h: 24 })) {
      coin.collected = true;
      score += 1;
    }
  }

  for (const enemy of enemies) {
    if (!enemy.alive) continue;
    enemy.x += enemy.speed * enemy.direction * delta;
    if (enemy.x < enemy.min || enemy.x + enemy.w > enemy.max) enemy.direction *= -1;
    if (!overlaps(player, enemy)) continue;

    if (player.vy > 0 && previousBottom <= enemy.y + 14) {
      enemy.alive = false;
      player.vy = -390;
    } else {
      hurtPlayer();
    }
  }

  if (player.x > 3450) gameState = "won";
  cameraX = Math.max(0, Math.min(WORLD_WIDTH - WIDTH, player.x - WIDTH * 0.36));
}

function drawBackground() {
  const sky = ctx.createLinearGradient(0, 0, 0, HEIGHT);
  sky.addColorStop(0, "#75c9e8");
  sky.addColorStop(1, "#daf5e8");
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  ctx.fillStyle = "#fff4bd";
  ctx.beginPath();
  ctx.arc(790, 105, 42, 0, Math.PI * 2);
  ctx.fill();

  for (let layer = 0; layer < 2; layer += 1) {
    const parallax = layer === 0 ? 0.16 : 0.3;
    const baseY = layer === 0 ? 380 : 430;
    const color = layer === 0 ? "#a4dbcf" : "#75c5b2";
    const offset = (cameraX * parallax) % 420;
    ctx.fillStyle = color;
    for (let x = -420 - offset; x < WIDTH + 420; x += 420) {
      ctx.beginPath();
      ctx.moveTo(x, HEIGHT);
      ctx.quadraticCurveTo(x + 190, baseY - 180 + layer * 35, x + 420, HEIGHT);
      ctx.fill();
    }
  }
}

function drawPlatform(platform) {
  ctx.fillStyle = "#7a503c";
  ctx.fillRect(platform.x, platform.y, platform.w, platform.h);
  ctx.fillStyle = "#55bb70";
  ctx.fillRect(platform.x, platform.y, platform.w, 10);
  ctx.fillStyle = "#8b6045";
  for (let x = platform.x + 14; x < platform.x + platform.w; x += 34) {
    ctx.fillRect(x, platform.y + 22, 3, 10);
  }
}

function drawCoin(coin) {
  if (coin.collected) return;
  ctx.fillStyle = "#ffca45";
  ctx.beginPath();
  ctx.ellipse(coin.x, coin.y, 10, 14, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "#fff1a4";
  ctx.lineWidth = 3;
  ctx.stroke();
}

function drawEnemy(enemy) {
  if (!enemy.alive) return;
  ctx.fillStyle = "#e86b68";
  ctx.beginPath();
  ctx.roundRect(enemy.x, enemy.y, enemy.w, enemy.h, 12);
  ctx.fill();
  ctx.fillStyle = "#fff";
  ctx.fillRect(enemy.x + 8, enemy.y + 9, 6, 8);
  ctx.fillRect(enemy.x + 21, enemy.y + 9, 6, 8);
  ctx.fillStyle = "#27334b";
  ctx.fillRect(enemy.x + 10, enemy.y + 12, 3, 4);
  ctx.fillRect(enemy.x + 23, enemy.y + 12, 3, 4);
}

function drawPlayer() {
  if (player.invulnerable > 0 && Math.floor(player.invulnerable * 12) % 2 === 0) return;
  ctx.fillStyle = "#3359cb";
  ctx.beginPath();
  ctx.roundRect(player.x, player.y + 12, player.w, player.h - 12, 9);
  ctx.fill();
  ctx.fillStyle = "#ffd1a3";
  ctx.beginPath();
  ctx.roundRect(player.x + 4, player.y, player.w - 8, 24, 8);
  ctx.fill();
  ctx.fillStyle = "#26324c";
  const eyeX = player.facing > 0 ? player.x + 24 : player.x + 8;
  ctx.fillRect(eyeX, player.y + 9, 4, 5);
  ctx.fillStyle = "#26324c";
  ctx.fillRect(player.x + 5, player.y + player.h - 5, 10, 5);
  ctx.fillRect(player.x + 20, player.y + player.h - 5, 10, 5);
}

function drawGoal() {
  ctx.fillStyle = "#f4f6ff";
  ctx.fillRect(3500, 330, 7, 140);
  ctx.fillStyle = "#ff6d77";
  ctx.beginPath();
  ctx.moveTo(3507, 332);
  ctx.lineTo(3568, 350);
  ctx.lineTo(3507, 368);
  ctx.closePath();
  ctx.fill();
}

function drawHud() {
  ctx.fillStyle = "rgb(16 23 43 / 78%)";
  ctx.beginPath();
  ctx.roundRect(20, 18, 245, 54, 14);
  ctx.fill();
  ctx.fillStyle = "#fff";
  ctx.font = "700 20px system-ui, sans-serif";
  ctx.fillText(`${"♥".repeat(lives)}${"♡".repeat(3 - lives)}`, 36, 53);
  ctx.fillStyle = "#ffdf74";
  ctx.fillText(`★ ${score} / ${coinSpots.length}`, 155, 53);
}

function drawEndMessage(title, subtitle) {
  ctx.fillStyle = "rgb(11 17 34 / 72%)";
  ctx.fillRect(0, 0, WIDTH, HEIGHT);
  ctx.textAlign = "center";
  ctx.fillStyle = "#fff";
  ctx.font = "800 54px system-ui, sans-serif";
  ctx.fillText(title, WIDTH / 2, HEIGHT / 2 - 16);
  ctx.fillStyle = "#dbe6ff";
  ctx.font = "500 21px system-ui, sans-serif";
  ctx.fillText(subtitle, WIDTH / 2, HEIGHT / 2 + 28);
  ctx.textAlign = "start";
}

function draw() {
  drawBackground();
  ctx.save();
  ctx.translate(-cameraX, 0);
  for (const platform of platforms) drawPlatform(platform);
  drawGoal();
  for (const coin of coinSpots) drawCoin(coin);
  for (const enemy of enemies) drawEnemy(enemy);
  drawPlayer();
  ctx.restore();

  drawHud();
  if (gameState === "won") drawEndMessage("ゴール！", `コイン ${score} / ${coinSpots.length} 枚　・　Rキーで再挑戦`);
  if (gameState === "gameover") drawEndMessage("ゲームオーバー", "Rキーでリスタート");
}

function frame(time) {
  const delta = Math.min((time - previousTime) / 1000 || 0, 0.032);
  previousTime = time;
  update(delta);
  draw();
  requestAnimationFrame(frame);
}

resetGame();
requestAnimationFrame(frame);
