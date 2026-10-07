const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");
const hud = document.getElementById("hud");
const shopModal = document.getElementById("shopModal");
const gameOverModal = document.getElementById("gameOverModal");

const hpBar = document.getElementById("hpBar");
const heatBar = document.getElementById("heatBar");
const hpText = document.getElementById("hpText");
const heatText = document.getElementById("heatText");
const scrapText = document.getElementById("scrapText");
const killsText = document.getElementById("killsText");
const waveText = document.getElementById("waveText");
const finalKills = document.getElementById("finalKills");
const finalScrap = document.getElementById("finalScrap");

let gameState = "PLAYING";

const WORLD = { w: 3000, h: 1800 };
const clamp = (v, min, max) => Math.max(min, Math.min(max, v));
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const rand = (min, max) => min + Math.random() * (max - min);

function resize() {
  canvas.width = Math.floor(window.innerWidth * devicePixelRatio);
  canvas.height = Math.floor(window.innerHeight * devicePixelRatio);
  ctx.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0);
}
window.addEventListener("resize", resize);
resize();

const input = {
  left: stick(),
  right: stick(),
  keys: {},
  mouse: { x: 0, y: 0, down: false }
};

function stick() {
  return { id: null, active: false, ox: 0, oy: 0, x: 0, y: 0, dx: 0, dy: 0 };
}

function setStick(s, x, y) {
  s.x = x;
  s.y = y;
  const vx = x - s.ox;
  const vy = y - s.oy;
  const d = Math.hypot(vx, vy);
  if (d < 12) {
    s.dx = 0;
    s.dy = 0;
    return;
  }
  s.dx = vx / d;
  s.dy = vy / d;
}

window.addEventListener("keydown", e => input.keys[e.key.toLowerCase()] = true);
window.addEventListener("keyup", e => input.keys[e.key.toLowerCase()] = false);
window.addEventListener("mousemove", e => {
  input.mouse.x = e.clientX;
  input.mouse.y = e.clientY;
});
window.addEventListener("mousedown", () => input.mouse.down = true);
window.addEventListener("mouseup", () => input.mouse.down = false);

canvas.addEventListener("touchstart", e => {
  e.preventDefault();
  for (const t of e.changedTouches) {
    const s = t.clientX < innerWidth / 2 ? input.left : input.right;
    if (!s.active) {
      s.id = t.identifier;
      s.active = true;
      s.ox = s.x = t.clientX;
      s.oy = s.y = t.clientY;
      s.dx = s.dy = 0;
    }
  }
}, { passive: false });

canvas.addEventListener("touchmove", e => {
  e.preventDefault();
  for (const t of e.changedTouches) {
    if (t.identifier === input.left.id) setStick(input.left, t.clientX, t.clientY);
    if (t.identifier === input.right.id) setStick(input.right, t.clientX, t.clientY);
  }
}, { passive: false });

function endTouch(e) {
  for (const t of e.changedTouches) {
    for (const s of [input.left, input.right]) {
      if (t.identifier === s.id) Object.assign(s, stick());
    }
  }
}
canvas.addEventListener("touchend", endTouch);
canvas.addEventListener("touchcancel", endTouch);

const game = {
  started: true,
  cam: { x: 0, y: 0, shake: 0 },
  player: null,
  others: new Map(),
  enemies: [],
  bullets: [],
  particles: [],
  pickups: [],
  hazards: [],
  walls: [],
  kills: 0,
  wave: 1,
  spawnTimer: 0
};

class Player {
  constructor(x, y, color = "#66fcf1") {
    this.x = x;
    this.y = y;
    this.r = 18;
    this.color = color;
    this.hp = 100;
    this.heat = 0;
    this.scrap = 0;
    this.angle = 0;
    this.fireTimer = 0;
    this.overheated = false;
    this.speedBoost = 0;
    this.fireRateLevel = 0;
    this.speedLevel = 0;
  }

  update(dt) {
    let mx = input.left.dx;
    let my = input.left.dy;
    if (!input.left.active) {
      mx = (input.keys.d || input.keys.arrowright ? 1 : 0) - (input.keys.a || input.keys.arrowleft ? 1 : 0);
      my = (input.keys.s || input.keys.arrowdown ? 1 : 0) - (input.keys.w || input.keys.arrowup ? 1 : 0);
      const l = Math.hypot(mx, my) || 1;
      mx /= l;
      my /= l;
    }

    let terrain = 1;
    for (const h of game.hazards) {
      if (Math.hypot(this.x - h.x, this.y - h.y) < h.r + this.r) {
        terrain = 0.55;
        this.hp = Math.max(0, this.hp - 8 * dt);
        puff(this.x, this.y, "#7dff57", 1);
      }
    }

    const speed = (235 + Math.min(this.scrap, 60)) * terrain * (this.speedBoost > 0 ? 1.4 : 1) * (1 + this.speedLevel * 0.15);
    this.x += mx * speed * dt;
    this.y += my * speed * dt;
    if (mx || my) this.angle = Math.atan2(my, mx);

    for (const w of game.walls) resolveCircleRect(this, w);
    this.x = clamp(this.x, this.r, WORLD.w - this.r);
    this.y = clamp(this.y, this.r, WORLD.h - this.r);
    this.speedBoost = Math.max(0, this.speedBoost - dt);

    let firing = false;
    if (input.right.active && (input.right.dx || input.right.dy)) {
      this.angle = Math.atan2(input.right.dy, input.right.dx);
      firing = true;
    } else if (input.mouse.down) {
      const wx = game.cam.x + input.mouse.x;
      const wy = game.cam.y + input.mouse.y;
      this.angle = Math.atan2(wy - this.y, wx - this.x);
      firing = true;
    } else if (input.keys[" "]) {
      firing = true;
    }

    this.fireTimer -= dt;
    if (this.overheated) {
      this.heat -= 45 * dt;
      if (this.heat <= 0) {
        this.heat = 0;
        this.overheated = false;
      }
    } else {
      this.heat = Math.max(0, this.heat - (firing ? 0 : 34 * dt));
      if (firing && this.fireTimer <= 0) this.fire();
    }
  }

  fire() {
    this.fireTimer = (this.scrap >= 35 ? 0.09 : 0.15) * Math.pow(0.8, this.fireRateLevel);
    this.heat += this.scrap >= 35 ? 9 : 13;
    if (this.heat >= 100) {
      this.heat = 100;
      this.overheated = true;
      this.speedBoost = 1.2;
      return;
    }
    const spread = this.scrap >= 60 ? [-0.12, 0, 0.12] : this.scrap >= 35 ? [-0.07, 0.07] : [0];
    for (const off of spread) {
      game.bullets.push({
        x: this.x + Math.cos(this.angle + off) * 24,
        y: this.y + Math.sin(this.angle + off) * 24,
        vx: Math.cos(this.angle + off) * 860,
        vy: Math.sin(this.angle + off) * 860,
        life: 1.1,
        r: 5
      });
    }
    game.cam.shake = Math.max(game.cam.shake, 4);
    puff(this.x + Math.cos(this.angle) * 24, this.y + Math.sin(this.angle) * 24, "#66fcf1", 5);
  }

  draw() {
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(this.angle);
    ctx.shadowBlur = 14;
    ctx.shadowColor = this.color;
    ctx.fillStyle = "#1a2430";
    ctx.strokeStyle = this.overheated ? "#ff255d" : this.color;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.roundRect(-18, -14, 36, 28, 7);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = this.color;
    ctx.fillRect(8, -5, 20, 10);
    ctx.fillStyle = "#ffbd59";
    ctx.fillRect(-10, -18, 18, 5);
    ctx.restore();
  }
}

class Enemy {
  constructor(x, y) {
    this.x = x;
    this.y = y;
    this.r = rand(13, 22);
    this.hp = this.r * 4 + game.wave * 7;
    this.speed = rand(72, 112) + game.wave * 3;
  }

  update(dt) {
    const p = game.player;
    const a = Math.atan2(p.y - this.y, p.x - this.x);
    this.x += Math.cos(a) * this.speed * dt;
    this.y += Math.sin(a) * this.speed * dt;
    for (const w of game.walls) resolveCircleRect(this, w);
    if (Math.hypot(p.x - this.x, p.y - this.y) < p.r + this.r) {
      p.hp = Math.max(0, p.hp - 18 * dt);
      game.cam.shake = Math.max(game.cam.shake, 5);
    }
  }

  hit(dmg, ang) {
    this.hp -= dmg;
    this.x += Math.cos(ang) * 13;
    this.y += Math.sin(ang) * 13;
    puff(this.x, this.y, "#ff496a", 7);
    if (this.hp <= 0) {
      game.kills++;
      for (let i = 0; i < 5; i++) game.pickups.push({ x: this.x + rand(-16, 16), y: this.y + rand(-16, 16), r: 6, v: 1 });
      return true;
    }
    return false;
  }

  draw() {
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.fillStyle = "#5c1520";
    ctx.strokeStyle = "#ff6c84";
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let i = 0; i < 8; i++) {
      const a = i / 8 * Math.PI * 2;
      const rr = this.r * (i % 2 ? 0.72 : 1);
      ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
    }
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }
}

function resolveCircleRect(c, r) {
  const nx = clamp(c.x, r.x, r.x + r.w);
  const ny = clamp(c.y, r.y, r.y + r.h);
  const dx = c.x - nx;
  const dy = c.y - ny;
  const d = Math.hypot(dx, dy);
  if (d > 0 && d < c.r) {
    c.x += dx / d * (c.r - d);
    c.y += dy / d * (c.r - d);
  }
}

function puff(x, y, color, count) {
  for (let i = 0; i < count; i++) {
    game.particles.push({ x, y, vx: rand(-120, 120), vy: rand(-120, 120), life: rand(0.18, 0.5), color });
  }
}

function makeWorld() {
  game.hazards = [
    { x: 780, y: 480, r: 90 },
    { x: 1450, y: 900, r: 120 },
    { x: 2260, y: 520, r: 100 },
    { x: 2460, y: 1350, r: 130 }
  ];
  game.walls = [
    { x: 400, y: 260, w: 420, h: 52 },
    { x: 930, y: 690, w: 70, h: 520 },
    { x: 1240, y: 260, w: 620, h: 64 },
    { x: 1550, y: 1180, w: 580, h: 64 },
    { x: 2150, y: 730, w: 80, h: 480 },
    { x: 2520, y: 260, w: 90, h: 420 }
  ];
  game.pickups = [
    { x: 560, y: 520, r: 7, v: 6 },
    { x: 1650, y: 420, r: 7, v: 9 },
    { x: 2390, y: 1100, r: 7, v: 12 }
  ];
}

function spawnEnemy() {
  const side = Math.floor(Math.random() * 4);
  const x = side === 0 ? 40 : side === 1 ? WORLD.w - 40 : rand(40, WORLD.w - 40);
  const y = side === 2 ? 40 : side === 3 ? WORLD.h - 40 : rand(40, WORLD.h - 40);
  game.enemies.push(new Enemy(x, y));
}

function start() {
  game.started = true;
  game.cam = { x: 0, y: 0, shake: 0 };
  game.player = new Player(190, 190);
  game.enemies = [];
  game.bullets = [];
  game.particles = [];
  game.kills = 0;
  game.wave = 1;
  game.spawnTimer = 0;
  makeWorld();
  for (let i = 0; i < 5; i++) spawnEnemy();
  hud.style.display = "flex";
  gameState = "PLAYING";
}

function closeShop() {
  shopModal.classList.add("hidden");
  if (gameState === "SHOP") gameState = "PLAYING";
}

function buyUpgrade(cost, apply) {
  const player = game.player;
  if (gameState !== "SHOP" || player.scrap < cost) return;
  player.scrap -= cost;
  apply(player);
}

document.getElementById("openShopBtn").addEventListener("click", () => {
  if (gameState !== "PLAYING") return;
  gameState = "SHOP";
  shopModal.classList.remove("hidden");
});

document.getElementById("closeShopBtn").addEventListener("click", closeShop);
document.getElementById("buyHealBtn").addEventListener("click", () => buyUpgrade(40, player => {
  player.hp = Math.min(player.maxHp || 100, player.hp + 40);
}));
document.getElementById("buyFireRateBtn").addEventListener("click", () => buyUpgrade(50, player => {
  player.fireRateLevel++;
}));
document.getElementById("buySpeedBtn").addEventListener("click", () => buyUpgrade(45, player => {
  player.speedLevel++;
}));
document.getElementById("restartBtn").addEventListener("click", () => {
  gameOverModal.classList.add("hidden");
  start();
});

window.addEventListener("keydown", event => {
  if (event.key === "Escape") closeShop();
});

let last = performance.now();
function loop(now) {
  const dt = Math.min(0.033, (now - last) / 1000);
  last = now;
  update(dt);
  draw(dt);
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);

function update(dt) {
  if (!game.started || gameState !== "PLAYING") return;
  const p = game.player;
  p.update(dt);
  if (p.hp <= 0) {
    gameState = "GAMEOVER";
    finalKills.textContent = game.kills;
    finalScrap.textContent = p.scrap;
    gameOverModal.classList.remove("hidden");
    return;
  }
  game.spawnTimer -= dt;
  if (game.spawnTimer <= 0 && game.enemies.length < 8 + game.wave * 2) {
    game.spawnTimer = Math.max(0.55, 1.8 - game.wave * 0.08);
    spawnEnemy();
  }
  if (game.kills >= game.wave * 8) game.wave++;

  for (const b of game.bullets) {
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    b.life -= dt;
    for (const e of game.enemies) {
      if (Math.hypot(b.x - e.x, b.y - e.y) < b.r + e.r) {
        b.life = 0;
        if (e.hit(34 + Math.min(p.scrap, 40), Math.atan2(b.vy, b.vx))) e.dead = true;
        game.cam.shake = Math.max(game.cam.shake, 6);
        break;
      }
    }
  }
  game.bullets = game.bullets.filter(b => b.life > 0 && b.x > 0 && b.y > 0 && b.x < WORLD.w && b.y < WORLD.h);
  game.enemies = game.enemies.filter(e => !e.dead);
  for (const e of game.enemies) e.update(dt);

  for (const s of game.pickups) {
    const d = Math.hypot(p.x - s.x, p.y - s.y);
    if (d < 130) {
      s.x += (p.x - s.x) / Math.max(1, d) * 360 * dt;
      s.y += (p.y - s.y) / Math.max(1, d) * 360 * dt;
    }
    if (d < p.r + s.r) {
      p.scrap += s.v;
      p.speedBoost = 0.7;
      s.dead = true;
      puff(s.x, s.y, "#ffdf52", 9);
    }
  }
  game.pickups = game.pickups.filter(s => !s.dead);

  for (const part of game.particles) {
    part.x += part.vx * dt;
    part.y += part.vy * dt;
    part.life -= dt;
  }
  game.particles = game.particles.filter(part => part.life > 0);

  game.cam.x = clamp(p.x - innerWidth / 2, 0, WORLD.w - innerWidth);
  game.cam.y = clamp(p.y - innerHeight / 2, 0, WORLD.h - innerHeight);
  game.cam.shake = Math.max(0, game.cam.shake - 30 * dt);

  hpBar.style.width = `${p.hp}%`;
  heatBar.style.width = `${p.heat}%`;
  hpText.textContent = Math.round(p.hp);
  heatText.textContent = Math.round(p.heat);
  scrapText.textContent = p.scrap;
  killsText.textContent = game.kills;
  waveText.textContent = game.wave;
}

function draw(dt) {
  ctx.clearRect(0, 0, innerWidth, innerHeight);
  if (!game.started) {
    drawBackground(0, 0);
    return;
  }
  ctx.save();
  const sx = (Math.random() - 0.5) * game.cam.shake;
  const sy = (Math.random() - 0.5) * game.cam.shake;
  ctx.translate(-game.cam.x + sx, -game.cam.y + sy);
  drawBackground(game.cam.x, game.cam.y);
  for (const h of game.hazards) drawHazard(h);
  for (const w of game.walls) drawWall(w);
  for (const s of game.pickups) drawPickup(s);
  for (const b of game.bullets) drawBullet(b);
  for (const e of game.enemies) e.draw();
  game.player.draw();
  for (const part of game.particles) drawParticle(part);
  ctx.restore();
  drawSticks();
}

function drawBackground() {
  ctx.fillStyle = "#17120d";
  ctx.fillRect(game.cam.x || 0, game.cam.y || 0, innerWidth, innerHeight);
  ctx.save();
  ctx.globalAlpha = 0.35;
  for (let x = 0; x < WORLD.w; x += 90) {
    for (let y = 0; y < WORLD.h; y += 90) {
      ctx.fillStyle = (x + y) % 180 ? "#302218" : "#3a2a1c";
      ctx.fillRect(x, y, 88, 88);
    }
  }
  ctx.restore();
}

function drawHazard(h) {
  const g = ctx.createRadialGradient(h.x, h.y, 6, h.x, h.y, h.r);
  g.addColorStop(0, "rgba(91,255,58,.62)");
  g.addColorStop(1, "rgba(91,255,58,.04)");
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(h.x, h.y, h.r, 0, Math.PI * 2);
  ctx.fill();
}

function drawWall(w) {
  ctx.fillStyle = "#2d333b";
  ctx.strokeStyle = "#925f3d";
  ctx.lineWidth = 3;
  ctx.fillRect(w.x, w.y, w.w, w.h);
  ctx.strokeRect(w.x, w.y, w.w, w.h);
}

function drawPickup(s) {
  ctx.save();
  ctx.translate(s.x, s.y);
  ctx.rotate(performance.now() / 280);
  ctx.fillStyle = "#ffdf52";
  ctx.strokeStyle = "#7d4b0d";
  ctx.lineWidth = 2;
  ctx.fillRect(-s.r, -s.r, s.r * 2, s.r * 2);
  ctx.strokeRect(-s.r, -s.r, s.r * 2, s.r * 2);
  ctx.restore();
}

function drawBullet(b) {
  ctx.strokeStyle = "#66fcf1";
  ctx.shadowBlur = 12;
  ctx.shadowColor = "#66fcf1";
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(b.x - b.vx * 0.018, b.y - b.vy * 0.018);
  ctx.lineTo(b.x, b.y);
  ctx.stroke();
  ctx.shadowBlur = 0;
}

function drawParticle(p) {
  ctx.globalAlpha = clamp(p.life * 3, 0, 1);
  ctx.fillStyle = p.color;
  ctx.fillRect(p.x, p.y, 4, 4);
  ctx.globalAlpha = 1;
}

function drawSticks() {
  for (const s of [input.left, input.right]) {
    if (!s.active) continue;
    ctx.strokeStyle = "rgba(255,255,255,.32)";
    ctx.fillStyle = "rgba(255,255,255,.08)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(s.ox, s.oy, 58, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = "rgba(102,252,241,.55)";
    ctx.beginPath();
    ctx.arc(s.ox + s.dx * 42, s.oy + s.dy * 42, 22, 0, Math.PI * 2);
    ctx.fill();
  }
}

start();
