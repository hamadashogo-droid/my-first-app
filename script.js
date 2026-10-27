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
  { x: 220, min: 190, max: 310, speed: 45 },
  { x: 470, min: 430, max: 560, speed: 75 },
  { x: 1000, min: 770, max: 1230, speed: 90 },
  { x: 1660, min: 1460, max: 1960, speed: 82 },
  { x: 2390, min: 2200, max: 2730, speed: 95 },
  { x: 3180, min: 2980, max: 3460, speed: 88 },
];

const bossStart = {
  x: 3330,
  min: 3240,
  max: 3430,
  y: 404,
  w: 60,
  h: 66,
  speed: 42,
  direction: -1,
  hp: 5,
  maxHp: 5,
  hitCooldown: 0,
  alive: true,
};

const input = { left: false, right: false, jumpQueued: false, attackQueued: false };
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
  attackTimer: 0,
};

let enemies = [];
let boss = null;
let hitEffects = [];
let celebrationParticles = [];
let celebrationTime = 0;
let nextFirework = 0;
let cameraX = 0;
let lives = 3;
let score = 0;
let defeated = 0;
let gameState = "playing";
let previousTime = 0;
let worldTime = 0;
let audioContext = null;
let musicTimer = null;
let musicStep = 0;
let musicEnabled = false;
let musicMutedByUser = false;
let musicUnavailable = false;

const melody = [523, 659, 784, 880, 784, 659, 587, 784, 880, 1047, 880, 784, 659, 587, 523, 659];

function playTone(frequency, duration = 0.14, volume = 0.035, type = "triangle") {
  if (!audioContext || !musicEnabled) return;
  const oscillator = audioContext.createOscillator();
  const gain = audioContext.createGain();
  const now = audioContext.currentTime;
  oscillator.type = type;
  oscillator.frequency.setValueAtTime(frequency, now);
  gain.gain.setValueAtTime(volume, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + duration);
  oscillator.connect(gain);
  gain.connect(audioContext.destination);
  oscillator.start(now);
  oscillator.stop(now + duration);
}

function updateMusicButton() {
  const button = document.querySelector("#music-toggle");
  if (!button) return;
  button.textContent = musicEnabled ? "♫ 音 ON" : "♫ 音 OFF";
  button.setAttribute("aria-pressed", String(musicEnabled));
}

function startMusic() {
  if (musicEnabled || musicMutedByUser || musicUnavailable) return;
  try {
    const AudioContextClass = window.AudioContext;
    if (!AudioContextClass) throw new Error("このブラウザはWeb Audioに対応していません。");
    audioContext ??= new AudioContextClass();
    audioContext.resume().catch((error) => console.error("BGMを再生できませんでした。", error));
    musicEnabled = true;
    updateMusicButton();
    musicTimer = window.setInterval(() => {
      const note = melody[musicStep % melody.length];
      playTone(note, 0.22, 0.025);
      if (musicStep % 4 === 0) playTone(melody[musicStep % melody.length] / 2, 0.38, 0.018, "sine");
      musicStep += 1;
    }, 190);
  } catch (error) {
    console.error("BGMを初期化できませんでした。", error);
    musicUnavailable = true;
    const button = document.querySelector("#music-toggle");
    if (button) button.textContent = "音を再生できません";
  }
}

function stopMusic() {
  musicEnabled = false;
  if (musicTimer !== null) {
    window.clearInterval(musicTimer);
    musicTimer = null;
  }
  updateMusicButton();
}

document.querySelector("#music-toggle")?.addEventListener("click", () => {
  if (musicEnabled) {
    stopMusic();
    musicMutedByUser = true;
  } else {
    musicMutedByUser = false;
    startMusic();
  }
});

function resetGame() {
  input.jumpQueued = false;
  input.attackQueued = false;
  player.x = 72;
  player.y = 470 - player.h;
  player.vx = 0;
  player.vy = 0;
  player.facing = 1;
  player.grounded = false;
  player.invulnerable = 0;
  player.attackTimer = 0;
  lives = 3;
  score = 0;
  defeated = 0;
  hitEffects = [];
  celebrationParticles = [];
  celebrationTime = 0;
  nextFirework = 0;
  cameraX = 0;
  gameState = "playing";
  for (const coin of coinSpots) coin.collected = false;
  enemies = enemySpots.map((enemy) => ({
    ...enemy,
    y: 470 - 32,
    w: 34,
    h: 32,
    direction: 1,
    alive: true,
  }));
  boss = { ...bossStart };
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
  if (pressed && ["arrowleft", "arrowright", "a", "d", " ", "arrowup", "w", "j"].includes(key)) {
    startMusic();
  }

  if (key === "arrowleft" || key === "a") input.left = pressed;
  if (key === "arrowright" || key === "d") input.right = pressed;
  if (pressed && !event.repeat && [" ", "arrowup", "w"].includes(key)) {
    input.jumpQueued = true;
  }
  if (pressed && !event.repeat && key === "j") input.attackQueued = true;
  if (pressed && key === "r") resetGame();
}

window.addEventListener("keydown", (event) => handleInput(event, true));
window.addEventListener("keyup", (event) => handleInput(event, false));
window.addEventListener("blur", () => {
  input.left = false;
  input.right = false;
  input.jumpQueued = false;
  input.attackQueued = false;
});

for (const button of document.querySelectorAll("[data-control]")) {
  const control = button.dataset.control;
  const press = (event) => {
    event.preventDefault();
    startMusic();
    if (control === "jump") input.jumpQueued = true;
    else if (control === "attack") input.attackQueued = true;
    else input[control] = true;
    button.setPointerCapture?.(event.pointerId);
  };
  const release = (event) => {
    event.preventDefault();
    if (control === "left" || control === "right") input[control] = false;
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

function spawnHitEffect(target, count = 9, duration = 0.48) {
  hitEffects.push({
    x: target.x + target.w / 2,
    y: target.y + target.h / 2,
    age: 0,
    duration,
    particles: Array.from({ length: count }, (_, index) => {
      const angle = (Math.PI * 2 * index) / count;
      const speed = 65 + (index % 3) * 28;
      return {
        x: target.x + target.w / 2,
        y: target.y + target.h / 2,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 35,
        size: index % 3 === 0 ? 6 : 4,
        color: ["#a94332", "#e7c66f", "#718565"][index % 3],
      };
    }),
  });
}

function launchFirework(x, y) {
  const color = ["#e6c46f", "#bd6049", "#84946b", "#f0e2bd", "#ffffff"][
    Math.floor(Math.random() * 5)
  ];
  const count = 30;
  for (let index = 0; index < count; index += 1) {
    const angle = (Math.PI * 2 * index) / count + (Math.random() - 0.5) * 0.12;
    const speed = 75 + Math.random() * 140;
    celebrationParticles.push({
      x,
      y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      age: 0,
      duration: 0.85 + Math.random() * 0.65,
      size: 2 + Math.random() * 3,
      color,
      kind: "spark",
    });
  }
}

function launchConfetti() {
  const colors = ["#e6c46f", "#bd6049", "#84946b", "#f0e2bd", "#ffffff"];
  celebrationParticles.push({
    x: Math.random() * WIDTH,
    y: -8,
    vx: (Math.random() - 0.5) * 65,
    vy: 70 + Math.random() * 90,
    age: 0,
    duration: 2.8 + Math.random() * 1.8,
    size: 4 + Math.random() * 5,
    rotation: Math.random() * Math.PI,
    spin: (Math.random() - 0.5) * 8,
    color: colors[Math.floor(Math.random() * colors.length)],
    kind: "confetti",
  });
}

function updateCelebration(delta) {
  celebrationTime += delta;
  nextFirework -= delta;
  if (nextFirework <= 0) {
    launchFirework(90 + Math.random() * (WIDTH - 180), 90 + Math.random() * 190);
    nextFirework = 0.42 + Math.random() * 0.38;
  }
  if (Math.random() < delta * 24) launchConfetti();

  for (const particle of celebrationParticles) {
    particle.age += delta;
    particle.x += particle.vx * delta;
    particle.y += particle.vy * delta;
    if (particle.kind === "spark") {
      particle.vx *= 1 - delta * 0.7;
      particle.vy += 90 * delta;
    } else {
      particle.vx += Math.sin(celebrationTime * 4 + particle.x) * 12 * delta;
      particle.vy += 35 * delta;
      particle.rotation += particle.spin * delta;
    }
  }
  celebrationParticles = celebrationParticles.filter(
    (particle) => particle.age < particle.duration && particle.y < HEIGHT + 20,
  );
}

function defeatEnemy(enemy) {
  enemy.alive = false;
  defeated += 1;
  spawnHitEffect(enemy);
  playTone(1047, 0.12, 0.045, "sawtooth");
}

function update(delta) {
  worldTime += delta;
  player.attackTimer = Math.max(0, player.attackTimer - delta);
  for (const effect of hitEffects) {
    effect.age += delta;
    for (const particle of effect.particles) {
      particle.x += particle.vx * delta;
      particle.y += particle.vy * delta;
      particle.vy += 260 * delta;
    }
  }
  hitEffects = hitEffects.filter((effect) => effect.age < effect.duration);
  if (gameState === "won") {
    updateCelebration(delta);
    return;
  }
  if (gameState !== "playing") return;
  if (boss?.alive) {
    boss.hitCooldown = Math.max(0, boss.hitCooldown - delta);
    boss.x += boss.speed * boss.direction * delta;
    if (boss.x < boss.min || boss.x + boss.w > boss.max) boss.direction *= -1;
  }

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

  if (input.attackQueued && player.attackTimer === 0) {
    player.attackTimer = 0.24;
    const slash = {
      x: player.facing > 0 ? player.x + player.w - 4 : player.x - 64,
      y: player.y - 2,
      w: 68,
      h: player.h + 4,
    };
    for (const enemy of enemies) {
      if (enemy.alive && overlaps(slash, enemy)) {
        defeatEnemy(enemy);
      }
    }
    if (boss?.alive && boss.hitCooldown === 0 && overlaps(slash, boss)) {
      boss.hp -= 1;
      boss.hitCooldown = 0.55;
      spawnHitEffect(boss, boss.hp === 0 ? 20 : 8, boss.hp === 0 ? 0.72 : 0.3);
      playTone(boss.hp === 0 ? 523 : 784, 0.2, 0.055, "sawtooth");
      if (boss.hp === 0) {
        boss.alive = false;
        defeated += 1;
      }
    }
  }
  input.attackQueued = false;

  for (const enemy of enemies) {
    if (!enemy.alive) continue;
    enemy.x += enemy.speed * enemy.direction * delta;
    if (enemy.x < enemy.min || enemy.x + enemy.w > enemy.max) enemy.direction *= -1;
    if (!overlaps(player, enemy)) continue;

    if (player.vy > 0 && previousBottom <= enemy.y + 14) {
      defeatEnemy(enemy);
      player.vy = -390;
    } else {
      hurtPlayer();
    }
  }

  if (boss?.alive && overlaps(player, boss)) hurtPlayer();
  if (player.x > 3450 && !boss?.alive) {
    gameState = "won";
    celebrationTime = 0;
    nextFirework = 0;
  }
  cameraX = Math.max(0, Math.min(WORLD_WIDTH - WIDTH, player.x - WIDTH * 0.36));
}

function drawCloud(x, y, scale = 1) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(scale, scale);
  ctx.fillStyle = "rgb(255 247 224 / 62%)";
  ctx.beginPath();
  ctx.ellipse(0, 8, 48, 13, 0, 0, Math.PI * 2);
  ctx.ellipse(-18, 1, 21, 17, 0, 0, Math.PI * 2);
  ctx.ellipse(5, -8, 26, 23, 0, 0, Math.PI * 2);
  ctx.ellipse(29, 2, 19, 16, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawBackground() {
  const sky = ctx.createLinearGradient(0, 0, 0, HEIGHT);
  sky.addColorStop(0, "#d5c49e");
  sky.addColorStop(0.56, "#eadab5");
  sky.addColorStop(1, "#c98f67");
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  const sunGlow = ctx.createRadialGradient(752, 174, 18, 752, 174, 128);
  sunGlow.addColorStop(0, "rgb(255 244 206 / 62%)");
  sunGlow.addColorStop(1, "rgb(255 244 206 / 0%)");
  ctx.fillStyle = sunGlow;
  ctx.beginPath();
  ctx.arc(752, 174, 128, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#f6e8bd";
  ctx.beginPath();
  ctx.arc(752, 174, 43, 0, Math.PI * 2);
  ctx.fill();

  for (let layer = 0; layer < 3; layer += 1) {
    const parallax = [0.08, 0.17, 0.28][layer];
    const baseY = [330, 385, 445][layer];
    const color = ["#a99a78", "#83775b", "#657052"][layer];
    const offset = (cameraX * parallax) % 360;
    ctx.fillStyle = color;
    for (let x = -360 - offset; x < WIDTH + 360; x += 360) {
      ctx.beginPath();
      ctx.moveTo(x, HEIGHT);
      ctx.lineTo(x, baseY + 70);
      ctx.lineTo(x + 64, baseY - 8);
      ctx.lineTo(x + 108, baseY - 44 - layer * 8);
      ctx.lineTo(x + 153, baseY + 10);
      ctx.lineTo(x + 225, baseY - 75 + layer * 10);
      ctx.lineTo(x + 268, baseY - 30);
      ctx.lineTo(x + 360, baseY + 70);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = "rgb(247 236 210 / 28%)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(x + 64, baseY - 8);
      ctx.lineTo(x + 108, baseY - 44 - layer * 8);
      ctx.lineTo(x + 137, baseY - 9);
      ctx.stroke();
    }
  }

  for (let i = 0; i < 3; i += 1) {
    const x = ((i * 401 - cameraX * 0.19 + 1600) % (WIDTH + 240) + WIDTH + 240) % (WIDTH + 240) - 100;
    drawTorii(x, 355 + (i % 2) * 24, 0.55 + (i % 2) * 0.18);
  }

  for (let i = 0; i < 5; i += 1) {
    const x = ((i * 247 - cameraX * 0.42 + 1800) % (WIDTH + 180) + WIDTH + 180) % (WIDTH + 180) - 70;
    drawCloud(x, 245 + (i % 3) * 42, 0.65 + (i % 2) * 0.16);
  }
}

function drawTorii(x, y, scale = 1) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(scale, scale);
  ctx.fillStyle = "#873c2d";
  ctx.fillRect(0, 0, 8, 92);
  ctx.fillRect(62, 0, 8, 92);
  ctx.fillRect(-12, 12, 94, 8);
  ctx.fillRect(-6, 25, 82, 6);
  ctx.fillStyle = "#5f3528";
  ctx.fillRect(-16, 8, 102, 6);
  ctx.fillRect(28, 20, 12, 12);
  ctx.restore();
}

function drawPlatform(platform) {
  ctx.fillStyle = "#594536";
  ctx.fillRect(platform.x, platform.y, platform.w, platform.h);
  ctx.fillStyle = "#8b9360";
  ctx.fillRect(platform.x, platform.y, platform.w, 8);
  ctx.fillStyle = "#796146";
  for (let x = platform.x + 14; x < platform.x + platform.w; x += 34) {
    ctx.fillRect(x, platform.y + 20, 3, 9);
    ctx.fillStyle = "#9b7952";
    ctx.fillRect(x + 7, platform.y + 37, 3, 4);
    ctx.fillStyle = "#796146";
  }
}

function drawCoin(coin) {
  if (coin.collected) return;
  const width = 8 + Math.abs(Math.sin(worldTime * 4 + coin.x)) * 4;
  ctx.fillStyle = "#d5a846";
  ctx.beginPath();
  ctx.ellipse(coin.x, coin.y, width, 13, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "#f7e2a0";
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.strokeStyle = "#9d6d31";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.ellipse(coin.x, coin.y, width * 0.58, 8, 0, 0, Math.PI * 2);
  ctx.stroke();
  ctx.fillStyle = "#815627";
  ctx.fillRect(coin.x - 2, coin.y - 5, 4, 10);
}

function drawEnemy(enemy) {
  if (!enemy.alive) return;
  const bob = Math.sin(worldTime * 8 + enemy.x) * 2;
  ctx.save();
  ctx.translate(enemy.x, enemy.y + bob);
  ctx.fillStyle = "#4d5540";
  ctx.beginPath();
  ctx.moveTo(2, 13);
  ctx.lineTo(6, 2);
  ctx.lineTo(14, 9);
  ctx.lineTo(23, 5);
  ctx.lineTo(30, 15);
  ctx.lineTo(29, 26);
  ctx.quadraticCurveTo(17, 36, 4, 26);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = "#a64b37";
  ctx.beginPath();
  ctx.moveTo(5, 12);
  ctx.lineTo(8, 3);
  ctx.lineTo(14, 11);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = "#ede0c1";
  ctx.fillRect(9, 16, 4, 3);
  ctx.fillRect(21, 16, 4, 3);
  ctx.fillStyle = "#382c24";
  ctx.fillRect(11, 16, 2, 3);
  ctx.fillRect(23, 16, 2, 3);
  ctx.fillStyle = "#bd8b52";
  ctx.fillRect(9, 27, 6, 5);
  ctx.fillRect(20, 27, 6, 5);
  ctx.fillStyle = "#493729";
  ctx.fillRect(12, 23, 10, 2);
  ctx.restore();
}

function drawBoss() {
  if (!boss?.alive) return;
  const bob = Math.sin(worldTime * 5) * 2;
  ctx.save();
  ctx.translate(boss.x, boss.y + bob);
  if (boss.hitCooldown > 0 && Math.floor(boss.hitCooldown * 24) % 2 === 0) {
    ctx.globalAlpha = 0.48;
  }
  ctx.fillStyle = "rgb(143 55 39 / 17%)";
  ctx.beginPath();
  ctx.ellipse(boss.w / 2, boss.h / 2, 48, 48, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#4c3025";
  ctx.beginPath();
  ctx.moveTo(6, 24);
  ctx.lineTo(3, 0);
  ctx.lineTo(22, 14);
  ctx.lineTo(30, 3);
  ctx.lineTo(40, 14);
  ctx.lineTo(58, 0);
  ctx.lineTo(54, 27);
  ctx.lineTo(60, 53);
  ctx.quadraticCurveTo(30, 76, 0, 53);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = "#d0a45d";
  ctx.beginPath();
  ctx.moveTo(7, 18);
  ctx.lineTo(0, 0);
  ctx.lineTo(20, 15);
  ctx.closePath();
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(53, 18);
  ctx.lineTo(60, 0);
  ctx.lineTo(40, 15);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = "#a64735";
  ctx.beginPath();
  ctx.moveTo(8, 24);
  ctx.lineTo(21, 17);
  ctx.lineTo(30, 24);
  ctx.lineTo(40, 17);
  ctx.lineTo(53, 24);
  ctx.lineTo(49, 52);
  ctx.quadraticCurveTo(30, 67, 11, 52);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = "#f4e3ba";
  ctx.fillRect(14, 29, 13, 4);
  ctx.fillRect(34, 29, 13, 4);
  ctx.fillStyle = "#30241e";
  ctx.fillRect(18, 30, 5, 3);
  ctx.fillRect(38, 30, 5, 3);
  ctx.fillStyle = "#33241f";
  ctx.beginPath();
  ctx.moveTo(22, 43);
  ctx.lineTo(38, 43);
  ctx.lineTo(30, 54);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = "#d0a45d";
  ctx.fillRect(19, 56, 22, 5);
  ctx.restore();

  const barWidth = 100;
  const barX = boss.x + boss.w / 2 - barWidth / 2;
  const barY = boss.y - 19;
  ctx.fillStyle = "rgb(54 38 29 / 88%)";
  ctx.beginPath();
  ctx.roundRect(barX - 2, barY - 2, barWidth + 4, 10, 5);
  ctx.fill();
  ctx.fillStyle = "#a94332";
  ctx.beginPath();
  ctx.roundRect(barX, barY, barWidth * (boss.hp / boss.maxHp), 6, 3);
  ctx.fill();
}

function drawHitEffects() {
  for (const effect of hitEffects) {
    const progress = effect.age / effect.duration;
    const alpha = 1 - progress;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.strokeStyle = "#f2d783";
    ctx.lineWidth = 4 * alpha + 1;
    ctx.beginPath();
    ctx.arc(effect.x, effect.y, 8 + progress * 28, 0, Math.PI * 2);
    ctx.stroke();
    for (const particle of effect.particles) {
      ctx.fillStyle = particle.color;
      ctx.beginPath();
      ctx.arc(particle.x, particle.y, particle.size * alpha, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = "#f8edd0";
    ctx.font = "900 16px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("命中！", effect.x, effect.y - 16 - progress * 36);
    ctx.restore();
  }
}

function drawCelebration() {
  for (const particle of celebrationParticles) {
    const alpha = Math.min(1, (particle.duration - particle.age) * 2);
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.fillStyle = particle.color;
    if (particle.kind === "confetti") {
      ctx.translate(particle.x, particle.y);
      ctx.rotate(particle.rotation);
      ctx.fillRect(-particle.size / 2, -particle.size / 3, particle.size, particle.size * 0.65);
    } else {
      ctx.shadowColor = particle.color;
      ctx.shadowBlur = 10;
      ctx.beginPath();
      ctx.arc(particle.x, particle.y, particle.size * alpha, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }
}

function drawPlayer() {
  if (player.invulnerable > 0 && Math.floor(player.invulnerable * 12) % 2 === 0) return;
  const run = player.grounded && player.vx !== 0 ? Math.sin(worldTime * 18) * 2 : 0;
  ctx.save();
  ctx.translate(player.x + player.w / 2, player.y);
  ctx.scale(player.facing, 1);
  ctx.fillStyle = "#8b3c30";
  ctx.beginPath();
  ctx.moveTo(-8, 17);
  ctx.quadraticCurveTo(-23 - run, 12, -24 - run, 4);
  ctx.quadraticCurveTo(-14, 9, -8, 10);
  ctx.fill();
  ctx.fillStyle = "#a43f32";
  ctx.beginPath();
  ctx.moveTo(-14, 17);
  ctx.lineTo(14, 17);
  ctx.lineTo(17, 43);
  ctx.lineTo(9, 45);
  ctx.lineTo(0, 39);
  ctx.lineTo(-9, 45);
  ctx.lineTo(-17, 43);
  ctx.fill();
  ctx.fillStyle = "#f2e5c7";
  ctx.beginPath();
  ctx.moveTo(-8, 18);
  ctx.lineTo(0, 24);
  ctx.lineTo(8, 18);
  ctx.lineTo(4, 37);
  ctx.lineTo(0, 40);
  ctx.lineTo(-4, 37);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = "#d0a45d";
  ctx.fillRect(-14, 35, 28, 4);
  ctx.fillRect(4, 37, 4, 10);
  ctx.fillStyle = "#e4bd91";
  ctx.beginPath();
  ctx.ellipse(0, 11, 10, 11, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#33251e";
  ctx.beginPath();
  ctx.ellipse(0, 4, 11, 7, 0, Math.PI, Math.PI * 2);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = "#f2e5c7";
  ctx.fillRect(-12, 8, 24, 3);
  ctx.fillStyle = "#34251e";
  ctx.fillRect(3, 12, 2, 2);
  ctx.fillStyle = "#74513b";
  ctx.fillRect(-12, 43 + run, 10, 5);
  ctx.fillRect(3, 43 - run, 10, 5);
  ctx.fillStyle = "#c8d0d0";
  ctx.beginPath();
  ctx.moveTo(10, 26);
  ctx.lineTo(25, 4);
  ctx.lineTo(22, 2);
  ctx.lineTo(7, 25);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = "#d0a45d";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(8, 28);
  ctx.lineTo(4, 32);
  ctx.stroke();
  ctx.restore();

  if (player.attackTimer > 0.08) {
    ctx.save();
    ctx.translate(player.x + player.w / 2, player.y + player.h / 2);
    ctx.scale(player.facing, 1);
    ctx.strokeStyle = "rgb(242 220 157 / 95%)";
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.arc(18, -2, 38, -0.95, 0.95);
    ctx.stroke();
    ctx.restore();
  }
}

function drawGoal() {
  ctx.fillStyle = "#74382b";
  ctx.fillRect(3500, 325, 10, 145);
  ctx.fillRect(3560, 325, 10, 145);
  ctx.fillRect(3490, 336, 90, 10);
  ctx.fillRect(3496, 352, 78, 7);
  ctx.fillStyle = "#b74b37";
  ctx.fillRect(3484, 331, 102, 8);
  ctx.fillStyle = "#e5cb8d";
  ctx.fillRect(3520, 353, 30, 5);
}

function drawHud() {
  ctx.fillStyle = "rgb(57 43 31 / 82%)";
  ctx.beginPath();
  ctx.roundRect(20, 18, 350, 54, 8);
  ctx.fill();
  ctx.strokeStyle = "rgb(232 206 148 / 65%)";
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.fillStyle = "#f4e6c6";
  ctx.font = "700 20px system-ui, sans-serif";
  ctx.fillText(`${"♥".repeat(lives)}${"♡".repeat(3 - lives)}`, 36, 53);
  ctx.fillStyle = "#e7c66f";
  ctx.fillText(`小判 ${score} / ${coinSpots.length}`, 155, 53);
  ctx.fillStyle = "#d99176";
  ctx.fillText(`鬼 ${defeated}`, 290, 53);
}

function drawEndMessage(title, subtitle) {
  ctx.fillStyle = gameState === "won" ? "rgb(49 38 29 / 42%)" : "rgb(43 32 25 / 76%)";
  ctx.fillRect(0, 0, WIDTH, HEIGHT);
  if (gameState === "won") drawCelebration();
  ctx.textAlign = "center";
  if (gameState === "won") {
    const bounce = Math.sin(celebrationTime * 5) * 5;
    ctx.fillStyle = "rgb(57 43 31 / 93%)";
    ctx.beginPath();
    ctx.roundRect(180, 175, 600, 190, 26);
    ctx.fill();
    ctx.strokeStyle = "rgb(231 198 111 / 90%)";
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.fillStyle = "#e7c66f";
    ctx.font = "900 22px system-ui, sans-serif";
    ctx.fillText("✿　旅の終わり　✿", WIDTH / 2, 218);
    ctx.fillStyle = "#fff4dc";
    ctx.font = "900 48px system-ui, sans-serif";
    ctx.fillText("クリア！おめでとう！", WIDTH / 2, 277 + bounce);
    ctx.fillStyle = "#eadbb9";
    ctx.font = "600 19px system-ui, sans-serif";
    ctx.fillText(`コイン ${score} / ${coinSpots.length} 枚　・　Rキーで再挑戦`, WIDTH / 2, 324);
  } else {
    ctx.fillStyle = "#fff4dc";
    ctx.font = "800 54px system-ui, sans-serif";
    ctx.fillText(title, WIDTH / 2, HEIGHT / 2 - 16);
    ctx.fillStyle = "#eadbb9";
    ctx.font = "500 21px system-ui, sans-serif";
    ctx.fillText(subtitle, WIDTH / 2, HEIGHT / 2 + 28);
  }
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
  drawBoss();
  drawHitEffects();
  drawPlayer();
  ctx.restore();

  drawHud();
  if (boss?.alive && player.x > 3000) {
    ctx.fillStyle = "rgb(57 43 31 / 88%)";
    ctx.beginPath();
    ctx.roundRect(WIDTH - 190, 18, 170, 54, 12);
    ctx.fill();
    ctx.fillStyle = "#e7c66f";
    ctx.font = "900 13px system-ui, sans-serif";
    ctx.fillText("大鬼", WIDTH - 174, 38);
    ctx.fillStyle = "#f4e6c6";
    ctx.font = "700 12px system-ui, sans-serif";
    ctx.fillText(`HP ${boss.hp} / ${boss.maxHp}`, WIDTH - 174, 57);
  }
  if (gameState === "won") drawEndMessage("旅の終わり", `小判 ${score} / ${coinSpots.length} 枚　・　Rキーで再び旅へ`);
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
