/**
 * Wave Rider - Standalone Game Engine
 * Consolidat en un sol fitxer JS
 */

const CONSTANTS = {
    GRAVITY: 1200,
    WATER_LEVEL: 0.75,
    PLAYER_SPEED_X: 400,
    BOOST_SPEED: 800,
    JUMP_VELOCITY: -600,
    FLIP_ROTATION_SPEED: Math.PI * 3,
    WAVE_AMPLITUDE: 15,
    WAVE_FREQUENCY: 0.01,
    WAVE_SPEED: 5,
};

// --- Particles ---
class ParticleSystem {
    constructor() {
        this.particles = [];
    }

    emitSplash(x, y) {
        for (let i = 0; i < 15; i++) {
            this.particles.push({
                x, y,
                vx: (Math.random() - 0.5) * 200,
                vy: -Math.random() * 400,
                life: 1.0,
                maxLife: 1.0,
                color: 'white',
                size: 2 + Math.random() * 4
            });
        }
    }

    emitExplosion(x, y) {
        for (let i = 0; i < 40; i++) {
            this.particles.push({
                x, y,
                vx: (Math.random() - 0.5) * 500,
                vy: (Math.random() - 0.5) * 500,
                life: 1.5,
                maxLife: 1.5,
                color: i % 2 === 0 ? 'orange' : 'red',
                size: 5 + Math.random() * 8
            });
        }
    }

    emitTrail(x, y, isSpecial) {
        this.particles.push({
            x, y,
            vx: -50 - Math.random() * 100,
            vy: (Math.random() - 0.5) * 30,
            life: 0.5,
            maxLife: 0.5,
            color: isSpecial ? 'cyan' : 'rgba(255,255,255,0.4)',
            size: isSpecial ? 5 : 2
        });
    }

    update(dt) {
        for (let i = this.particles.length - 1; i >= 0; i--) {
            const p = this.particles[i];
            p.x += p.vx * dt;
            p.y += p.vy * dt;
            p.vy += 800 * dt; // gravity
            p.life -= dt;
            if (p.life <= 0) this.particles.splice(i, 1);
        }
    }

    draw(ctx, cameraX) {
        for (const p of this.particles) {
            ctx.globalAlpha = p.life / p.maxLife;
            ctx.fillStyle = p.color;
            ctx.beginPath();
            ctx.arc(p.x - cameraX, p.y, p.size, 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.globalAlpha = 1.0;
    }
}

// --- Player ---
class Player {
    constructor(particles) {
        this.particles = particles;
        this.reset();
    }

    reset() {
        this.x = 200;
        this.y = 0;
        this.vx = 200;
        this.vy = 0;
        this.rotation = 0;
        this.isGrounded = false;
        this.isFlipping = false;
        this.totalRotationInAir = 0;
        this.boostTimer = 0;
        this.shieldTimer = 0;
        this.isShieldReady = false;
        this.shieldMaxDuration = 10.0;
        this.combo = 0;
        this.score = 0;
        this.coins = 0;
        this.distance = 0;
        this.isDead = false;
    }

    update(dt, inputActive, getWaterHeight) {
        if (this.isDead) return;

        let currentSpeed = 200;
        if (this.boostTimer > 0) {
            currentSpeed = 400;
            this.boostTimer -= dt;
            this.particles.emitTrail(this.x, this.y, true);
        } else if (this.isGrounded) {
            this.particles.emitTrail(this.x, this.y + 10, false);
        }

        if (this.shieldTimer > 0) this.shieldTimer -= dt;

        this.vx = currentSpeed;
        this.x += this.vx * dt;
        this.distance = Math.floor(this.x / 100);

        this.vy += CONSTANTS.GRAVITY * dt;
        this.y += this.vy * dt;

        const surfaceY = getWaterHeight(this.x);

        if (inputActive) {
            if (this.isGrounded) {
                this.vy = CONSTANTS.JUMP_VELOCITY;
                this.isGrounded = false;
                this.particles.emitSplash(this.x, this.y);
            } else {
                this.isFlipping = true;
                this.rotation -= CONSTANTS.FLIP_ROTATION_SPEED * dt;
                this.totalRotationInAir += CONSTANTS.FLIP_ROTATION_SPEED * dt;

                // 720 rotation for shield
                if (!this.isShieldReady && this.shieldTimer <= 0) {
                    if (this.totalRotationInAir >= Math.PI * 3.8) {
                        this.isShieldReady = true;
                    }
                }
            }
        } else {
            this.isFlipping = false;
        }

        if (this.y >= surfaceY) {
            if (!this.isGrounded && this.vy > 0) {
                this.y = surfaceY;
                this.vy = 0;
                this.isGrounded = true;
                this.evaluateLanding();
                if (!this.isDead) this.particles.emitSplash(this.x, this.y);
            } else {
                this.y = surfaceY;
                this.vy = 0;
                this.isGrounded = true;
            }
        } else {
            this.isGrounded = false;
        }

        if (this.isGrounded) {
            const nextY = getWaterHeight(this.x + 10);
            const targetRotation = Math.atan2(nextY - this.y, 10);
            this.rotation += (targetRotation - this.rotation) * 10 * dt;
            this.totalRotationInAir = 0;
        }
    }

    evaluateLanding() {
        let normalizedRot = this.rotation % (Math.PI * 2);
        if (normalizedRot < -Math.PI) normalizedRot += Math.PI * 2;
        if (normalizedRot > Math.PI) normalizedRot -= Math.PI * 2;

        const flips = Math.floor((this.totalRotationInAir + Math.PI / 2) / (Math.PI * 2));
        const angle = Math.abs(normalizedRot);

        if (angle > Math.PI / 2) {
            this.die();
        } else {
            if (flips > 0) {
                this.combo++;
                this.boostTimer = 2.0;
                if (this.isShieldReady) {
                    this.shieldTimer = this.shieldMaxDuration;
                    this.isShieldReady = false;
                }
            } else if (this.isShieldReady) {
                this.shieldTimer = this.shieldMaxDuration;
                this.isShieldReady = false;
            } else {
                this.combo = 0;
            }
            this.rotation = 0;
        }
    }

    die() {
        if (!this.isDead) {
            this.isDead = true;
            this.particles.emitExplosion(this.x, this.y);
        }
    }

    draw(ctx, cameraX) {
        if (this.isDead) return;

        ctx.save();
        ctx.translate(this.x - cameraX, this.y);
        ctx.rotate(this.rotation);
        ctx.scale(1.5, 1.5);

        // Body
        ctx.fillStyle = '#ff6600';
        ctx.beginPath();
        ctx.moveTo(15, 0); ctx.lineTo(-15, -10); ctx.lineTo(-15, 5); ctx.lineTo(10, 5);
        ctx.closePath();
        ctx.fill();

        // Rider
        ctx.fillStyle = '#ffff00';
        ctx.beginPath();
        ctx.arc(0, -15, 6, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillRect(-5, -10, 10, 10);

        // Shield
        if (this.shieldTimer > 0 || this.isShieldReady) {
            ctx.restore();
            ctx.save();
            ctx.translate(this.x - cameraX, this.y - 10);
            const isCharging = this.isShieldReady && this.shieldTimer <= 0;
            const shieldPulse = 1.0 + Math.sin(Date.now() / 150) * 0.1;
            const gradient = ctx.createRadialGradient(0, 0, 10, 0, 0, 40 * shieldPulse);
            
            if (isCharging) {
                gradient.addColorStop(0, 'rgba(255, 255, 255, 0.2)');
                gradient.addColorStop(0.8, 'rgba(0, 255, 200, 0.4)');
                gradient.addColorStop(1, 'rgba(0, 255, 100, 0.6)');
            } else {
                gradient.addColorStop(0, 'rgba(0, 255, 255, 0.1)');
                gradient.addColorStop(0.8, 'rgba(0, 150, 255, 0.4)');
                gradient.addColorStop(1, 'rgba(0, 100, 255, 0.6)');
            }
            ctx.fillStyle = gradient;
            ctx.beginPath();
            ctx.arc(0, 0, 35 * shieldPulse, 0, Math.PI * 2);
            ctx.fill();
            ctx.strokeStyle = isCharging ? 'rgba(255, 255, 255, 0.9)' : 'rgba(255, 255, 255, 0.8)';
            ctx.lineWidth = isCharging ? 2 : 1;
            ctx.stroke();
        }
        ctx.restore();
    }
}

// --- World ---
class World {
    constructor(particles) {
        this.particles = particles;
        this.objects = [];
        this.lastX = 500;
    }

    getWaterHeight(x, time) {
        const base = window.innerHeight * CONSTANTS.WATER_LEVEL;
        return base + Math.sin(x * 0.01 + time * 5) * 15;
    }

    update(dt, time, player, cameraX) {
        while (this.lastX < cameraX + window.innerWidth * 2) {
            this.lastX += 400 + Math.random() * 400;
            const waterY = this.getWaterHeight(this.lastX, time);
            const r = Math.random();
            if (r < 0.4) {
               this.objects.push({ x: this.lastX, y: waterY - 20, w: 60, h: 40, type: 'ramp' });
            } else if (r < 0.8) {
               this.objects.push({ x: this.lastX, y: waterY - 40, w: 20, h: 20, type: 'coin' });
            } else {
               this.objects.push({ x: this.lastX, y: waterY - 20, w: 30, h: 30, type: 'mine' });
            }
        }

        this.objects = this.objects.filter(o => o.x > cameraX - 200 && !o.done);

        const playerBox = { x: player.x - 15, y: player.y - 15, w: 30, h: 30 };
        for (const o of this.objects) {
            if (o.done) continue;
            if (this.collision(playerBox, o)) {
                if (o.type === 'coin') {
                    o.done = true;
                    player.coins++;
                    player.score += 10;
                } else if (o.type === 'ramp') {
                    if (player.isGrounded) {
                        player.vy = CONSTANTS.JUMP_VELOCITY * 1.3;
                        player.isGrounded = false;
                        player.rotation = -0.5;
                    }
                } else if (o.type === 'mine') {
                    if (player.shieldTimer > 0 || player.isShieldReady) {
                        if (player.isShieldReady) player.shieldTimer = player.shieldMaxDuration;
                        player.isShieldReady = false;
                        o.done = true;
                        this.particles.emitExplosion(o.x, o.y);
                    } else {
                        player.die();
                    }
                }
            }
        }
    }

    collision(r1, r2) {
        return r1.x < r2.x + r2.w && r1.x + r1.w > r2.x && r1.y < r2.y + r2.h && r1.y + r1.h > r2.y;
    }

    draw(ctx, cameraX, time) {
        const h = window.innerHeight;
        const w = window.innerWidth;
        const waterBase = h * CONSTANTS.WATER_LEVEL;

        for (const o of this.objects) {
            ctx.fillStyle = o.type === 'coin' ? 'gold' : (o.type === 'mine' ? '#333' : '#8B4513');
            ctx.fillRect(o.x - cameraX, o.y, o.w, o.h);
        }

        ctx.fillStyle = 'rgba(0, 150, 255, 0.7)';
        ctx.beginPath();
        ctx.moveTo(0, waterBase);
        for (let x = 0; x <= w; x += 20) {
            ctx.lineTo(x, this.getWaterHeight(x + cameraX, time));
        }
        ctx.lineTo(w, h); ctx.lineTo(0, h);
        ctx.fill();
    }
}

// --- Engine ---
const canvas = document.getElementById('game-canvas');
const ctx = canvas.getContext('2d');
const particles = new ParticleSystem();
const player = new Player(particles);
const world = new World(particles);

let gameState = 'menu';
let totalTime = 0;
let lastTime = 0;
let inputActive = false;

function resize() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
}
window.addEventListener('resize', resize);
resize();

window.addEventListener('keydown', e => { if (e.code === 'Space') inputActive = true; });
window.addEventListener('keyup', e => { if (e.code === 'Space') inputActive = false; });
canvas.addEventListener('mousedown', () => inputActive = true);
canvas.addEventListener('mouseup', () => inputActive = false);
canvas.addEventListener('touchstart', (e) => { e.preventDefault(); inputActive = true; }, {passive: false});
canvas.addEventListener('touchend', () => inputActive = false);

document.getElementById('start-btn').onclick = start;
document.getElementById('retry-btn').onclick = start;

function start() {
    gameState = 'playing';
    player.reset();
    world.objects = [];
    world.lastX = 500;
    document.getElementById('overlay').classList.add('hidden');
    document.getElementById('main-menu').classList.add('hidden');
    document.getElementById('game-over').classList.add('hidden');
}

function loop(t) {
    const dt = Math.min((t - lastTime) / 1000, 0.1);
    lastTime = t;
    totalTime += dt;

    if (gameState === 'playing') {
        player.update(dt, inputActive, x => world.getWaterHeight(x, totalTime));
        world.update(dt, totalTime, player, player.x - 200);
        particles.update(dt);

        if (player.isDead) {
            setTimeout(() => {
                gameState = 'gameover';
                document.getElementById('overlay').classList.remove('hidden');
                document.getElementById('game-over').classList.remove('hidden');
                document.getElementById('final-dist').innerText = player.distance;
                document.getElementById('final-coins').innerText = player.coins;
            }, 1000);
        }

        // HUD update
        document.getElementById('distance').innerText = player.distance + ' m';
        document.getElementById('speed').innerText = Math.round(player.vx) + ' KM/H';
        document.getElementById('coins').innerText = '🪙 ' + player.coins;
        
        const shieldInd = document.getElementById('shield-indicator');
        if (player.shieldTimer > 0 || player.isShieldReady) {
            shieldInd.classList.remove('hidden');
            const label = document.getElementById('shield-label');
            const timer = document.getElementById('shield-timer-display');
            if (player.shieldTimer > 0) {
                shieldInd.classList.add('shield-active');
                label.innerText = 'CÚPULA ACTIVE';
                timer.innerText = player.shieldTimer.toFixed(1) + 's';
            } else {
                shieldInd.classList.remove('shield-active');
                label.innerText = 'CÚPULA READY';
                timer.innerText = player.shieldMaxDuration.toFixed(1) + 's';
            }
        } else {
            shieldInd.classList.add('hidden');
        }

        const comboBadge = document.getElementById('combo-badge');
        if (player.combo > 1) {
            comboBadge.classList.remove('hidden');
            comboBadge.innerText = 'X' + player.combo;
        } else {
            comboBadge.classList.add('hidden');
        }
    }

    // Draw
    ctx.clearRect(0,0, canvas.width, canvas.height);
    const cameraX = player.x - 200;
    
    // Background
    ctx.fillStyle = '#87CEEB';
    ctx.fillRect(0,0, canvas.width, canvas.height);

    world.draw(ctx, cameraX, totalTime);
    particles.draw(ctx, cameraX);
    player.draw(ctx, cameraX);

    requestAnimationFrame(loop);
}

lastTime = performance.now();
requestAnimationFrame(loop);
