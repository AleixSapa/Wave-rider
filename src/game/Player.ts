import { CONSTANTS } from './Constants';
import { ParticleSystem } from './ParticleSystem';
import { SoundManager } from './Sound';

export class Player {
  x: number = 200;
  y: number = 0;
  vx: number = CONSTANTS.PLAYER_SPEED_X;
  vy: number = 0;
  rotation: number = 0; // standard rotation looking slightly up
  
  isGrounded: boolean = false;
  isFlipping: boolean = false;
  flipCount: number = 0;
  totalRotationInAir: number = 0;

  boostTimer: number = 0;
  shieldTimer: number = 0;
  isShieldReady: boolean = false;
  shieldMaxDuration: number = 10.0;
  combo: number = 0;
  score: number = 0;
  distance: number = 0;
  coins: number = 0;
  baseSpeed: number = 200;
  equippedBike: string = 'default';
  bikeCharges: number = 1;
  maxBikeCharges: number = 1;
  
  isDead: boolean = false;
  isSuperJumping: boolean = false;

  constructor(private particles: ParticleSystem) {
    this.reset();
  }

  reset() {
    this.x = 200;
    this.y = 0; // will be set by water surface
    this.vx = this.baseSpeed;
    this.vy = 0;
    this.rotation = 0;
    this.isGrounded = false;
    this.isFlipping = false;
    this.flipCount = 0;
    this.totalRotationInAir = 0;
    this.boostTimer = 0;
    this.shieldTimer = 0;
    this.isShieldReady = false;
    this.combo = 0;
    this.score = 0;
    this.distance = 0;
    this.coins = 0;
    this.isDead = false;
    this.isSuperJumping = false;
    this.bikeCharges = this.maxBikeCharges;
  }

  update(dt: number, inputActive: boolean, getWaterHeight: (x: number) => number, forcedVx?: number) {
    if (this.isDead) return;

    // Movement
    let currentSpeed = this.baseSpeed;

    if (this.boostTimer > 0) {
      currentSpeed = this.baseSpeed * 1.5; // Boost is 1.5x base speed (approx 600 max)
      this.boostTimer -= dt;
      this.particles.emitTrail(this.x, this.y, true);
    } else if (this.isGrounded) {
      this.particles.emitTrail(this.x, this.y + 10, false);
    }

    if (this.shieldTimer > 0) {
      this.shieldTimer -= dt;
    }

    if (this.isGrounded) {
      this.vx = forcedVx ?? currentSpeed;
    } else if (this.boostTimer > 0) {
      this.vx = forcedVx ?? Math.max(this.vx, currentSpeed);
    } else {
        this.vx = forcedVx ?? this.vx;
    }
    
    this.x += this.vx * dt;
    this.distance = Math.floor(this.x / 100);

    // Gravity
    this.vy += CONSTANTS.GRAVITY * dt;
    this.y += this.vy * dt;

    const surfaceY = getWaterHeight(this.x);

    // Input handling
    if (inputActive) {
      if (this.isGrounded) {
        // Jump
        this.vy = CONSTANTS.JUMP_VELOCITY;
        this.isGrounded = false;
        this.particles.emitSplash(this.x, this.y);
        SoundManager.playJump();
      } else {
        // Flip
        this.isFlipping = true;
        this.rotation -= CONSTANTS.FLIP_ROTATION_SPEED * dt;
        this.totalRotationInAir += CONSTANTS.FLIP_ROTATION_SPEED * dt;

        // Mid-air shield activation (Cúpula)
        if (this.equippedBike === 'fire' && !this.isShieldReady && this.shieldTimer <= 0) {
          if (this.totalRotationInAir >= Math.PI * 3.8) {
            this.isShieldReady = true;
          }
        }
      }
    } else {
      this.isFlipping = false;
      // Moto Gato: Auto stabilize slightly in air if not flipping
      if (this.equippedBike === 'gato' && !this.isGrounded) {
        let normalizedRot = this.rotation % (Math.PI * 2);
        if (normalizedRot < -Math.PI) normalizedRot += Math.PI * 2;
        if (normalizedRot > Math.PI) normalizedRot -= Math.PI * 2;
        
        // If in dangerous crash zone, apply corrective rotation
        if (Math.abs(normalizedRot) > Math.PI / 3) {
            this.rotation -= normalizedRot * dt * 3;
        }
      }
    }

    // Ground Check
    if (this.y >= surfaceY) {
      if (!this.isGrounded && this.vy > 0) {
        // Just landed
        this.y = surfaceY;
        this.vy = 0;
        this.isGrounded = true;

        // Check landing angle for crash or perfect
        this.evaluateLanding();
        
        if (!this.isDead) {
            this.particles.emitSplash(this.x, this.y);
            SoundManager.playSplash();
        }
      } else {
        this.y = surfaceY;
        this.vy = 0;
        this.isGrounded = true;
      }
    } else {
      this.isGrounded = false;
    }

    // Adjust rotation while grounded
    if (this.isGrounded) {
      const nextY = getWaterHeight(this.x + 10);
      const targetRotation = Math.atan2(nextY - this.y, 10);
      // Smoothly transition rotation
      this.rotation += (targetRotation - this.rotation) * 10 * dt;
      this.totalRotationInAir = 0;
      this.flipCount = 0;
    }
  }

  activateGatoJump() {
    if (!this.isDead) {
        this.vy = -600; // Big vertical jump
        this.isGrounded = false;
        this.particles.emitSplash(this.x, this.y);
    }
  }

  activateSuperJump() {
    if (!this.isDead) {
        this.vy = -1500; // High vertical jump like rampeadora ramp
        this.vx += 200; // Increase forward boost to reach ~600 (from ~400 base)
        this.isSuperJumping = true;
        this.isGrounded = false;
        this.particles.emitSplash(this.x, this.y);
    }
  }

  evaluateLanding() {
    if (this.isSuperJumping) {
      this.isSuperJumping = false;
      this.isDead = false; // "continuar be" even if upside down
      this.rotation = 0;
      this.boostTimer = 30.0; // "potencia de la moto de fuego durant 30 segons"
      this.shieldTimer = 30.0; // Also give it 30s protection shield
      this.particles.emitSplash(this.x, this.y);
      SoundManager.playSplash();
      return;
    }

    // Normalize rotation between -PI and PI
    let normalizedRot = this.rotation % (Math.PI * 2);
    if (normalizedRot < -Math.PI) normalizedRot += Math.PI * 2;
    if (normalizedRot > Math.PI) normalizedRot -= Math.PI * 2;

    const flipsCompleted = Math.floor((this.totalRotationInAir + Math.PI/2) / (Math.PI * 2));

    // Allow rough landing up to 80 degrees
    const absoluteAngle = Math.abs(normalizedRot);
    
    // Moto Gato increase tolerance to 110 degrees instead of 90
    const tolerance = this.equippedBike === 'gato' ? (Math.PI * 0.6) : (Math.PI / 2);

    if (absoluteAngle > tolerance) {
      // Super Moto Bounce logic: if shield is active on super bike, bounce instead of dying
      if (this.equippedBike === 'super' && this.shieldTimer > 0) {
        this.vy = -800; // Bounce high
        this.vx *= 0.9; // Maintain most speed
        this.rotation = 0;
        this.totalRotationInAir = 0;
        this.isGrounded = false;
        this.particles.emitSplash(this.x, this.y);
        SoundManager.playSplash();
        return;
      }
      
      this.die();
    } else {
      // Good landing
      if (flipsCompleted > 0) {
        this.combo++;
        this.boostTimer = Math.max(this.boostTimer, 2.0); // 2 seconds boost, don't overwrite if longer
        if (this.equippedBike === 'fire' && this.isShieldReady) {
          this.shieldTimer = Math.max(this.shieldTimer, 3.0);
          this.isShieldReady = false;
        }
        if (this.equippedBike === 'super') {
          this.shieldTimer = Math.max(this.shieldTimer, 5.0);
        }
        this.score += flipsCompleted * 100 * this.combo;
      } else if (absoluteAngle < 0.2 && this.totalRotationInAir > 1) { // Near perfect landing, small jump
        // small bonus?
        if (this.equippedBike === 'fire' && this.isShieldReady) {
          this.shieldTimer = Math.max(this.shieldTimer, 3.0);
          this.isShieldReady = false;
        }
      } else if (this.isShieldReady) {
        // Even if no flips or perfect landing, if you land we activate the ready shield
        this.shieldTimer = Math.max(this.shieldTimer, this.shieldMaxDuration);
        this.isShieldReady = false;
      } else {
        // normal landing, break combo if no flips
        this.combo = 0;
      }
      this.rotation = 0;
      this.totalRotationInAir = 0;
    }
  }

  die() {
    if (!this.isDead) {
      this.isDead = true;
      this.particles.emitExplosion(this.x, this.y);
      SoundManager.playCrash();
    }
  }

  draw(ctx: CanvasRenderingContext2D, cameraX: number) {
    if (this.isDead) return;

    ctx.save();
    ctx.translate(this.x - cameraX, this.y);
    ctx.rotate(this.rotation);

    // Scale up slightly as requested (+20 pixels roughly, say 1.5x scale)
    ctx.scale(1.5, 1.5);

    // If boosting with fire bike or super bike, draw a fire aura around it
    if ((this.equippedBike === 'fire' || this.equippedBike === 'super') && this.boostTimer > 0) {
      ctx.save();
      // Animate pulsing aura
      const pulse = 1.0 + Math.sin(Date.now() / 100) * 0.2;
      ctx.scale(pulse, pulse);
      ctx.fillStyle = 'rgba(255, 100, 0, 0.4)';
      ctx.beginPath();
      ctx.arc(0, -5, 25, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = 'rgba(255, 200, 0, 0.6)';
      ctx.beginPath();
      ctx.arc(0, -5, 18, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // Draw JetSki (simplified)
    if (this.equippedBike === 'fire') ctx.fillStyle = '#ff6600';
    else if (this.equippedBike === 'super') ctx.fillStyle = '#a855f7'; // purple-500
    else if (this.equippedBike === 'gato') ctx.fillStyle = '#444444';
    else if (this.equippedBike === 'rampeadora') ctx.fillStyle = '#3366ff';
    else ctx.fillStyle = '#ff3366';

    ctx.beginPath();
    ctx.moveTo(15, 0); // nose
    ctx.lineTo(-15, -10); // tail top
    ctx.lineTo(-15, 5); // tail bottom
    ctx.lineTo(10, 5); // bottom nose
    ctx.closePath();
    ctx.fill();

    // Rider
    if (this.equippedBike === 'fire') ctx.fillStyle = '#ffff00';
    else if (this.equippedBike === 'super') ctx.fillStyle = '#ffffff';
    else if (this.equippedBike === 'gato') ctx.fillStyle = '#00ff66';
    else if (this.equippedBike === 'rampeadora') ctx.fillStyle = '#ffffff';
    else ctx.fillStyle = '#33ccff';
    ctx.beginPath();
    ctx.arc(0, -15, 6, 0, Math.PI * 2); // head
    ctx.fill();
    ctx.fillRect(-5, -10, 10, 10); // body

    // Shield (Cúpula)
    if (this.shieldTimer > 0 || this.isShieldReady) {
      ctx.restore();
      ctx.save();
      ctx.translate(this.x - cameraX, this.y - 10);
      
      const isCharging = this.isShieldReady && this.shieldTimer <= 0;
      const shieldPulse = 1.0 + Math.sin(Date.now() / 150) * 0.1;
      const gradient = ctx.createRadialGradient(0, 0, 10, 0, 0, 40 * shieldPulse);
      
      if (isCharging) {
        // Glowing cyan for "Ready" state
        gradient.addColorStop(0, 'rgba(255, 255, 255, 0.2)');
        gradient.addColorStop(0.8, 'rgba(0, 255, 200, 0.4)');
        gradient.addColorStop(1, 'rgba(0, 255, 100, 0.6)');
      } else {
        // Normal blue shield when active/draining
        gradient.addColorStop(0, 'rgba(0, 255, 255, 0.1)');
        gradient.addColorStop(0.8, 'rgba(0, 150, 255, 0.4)');
        gradient.addColorStop(1, 'rgba(0, 100, 255, 0.6)');
      }
      
      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(0, 0, 35 * shieldPulse, 0, Math.PI * 2);
      ctx.fill();
      
      // Border
      ctx.strokeStyle = isCharging ? 'rgba(255, 255, 255, 0.9)' : 'rgba(255, 255, 255, 0.8)';
      ctx.lineWidth = isCharging ? 3 : 2;
      ctx.setLineDash([5, 5]);
      ctx.lineDashOffset = -Date.now() / 50;
      ctx.stroke();

      if (this.shieldTimer > 0 && !isCharging) {
        ctx.fillStyle = 'white';
        ctx.font = 'bold 20px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(Math.ceil(this.shieldTimer).toString(), 0, 0);
      }
    }

    ctx.restore();
  }
}
