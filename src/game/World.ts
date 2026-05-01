import { CONSTANTS } from './Constants';
import { ParticleSystem } from './ParticleSystem';
import { Player } from './Player';
import { SoundManager } from './Sound';

export interface GameObject {
  x: number;
  y: number;
  width: number;
  height: number;
  type: 'coin' | 'ramp' | 'mine' | 'barrel';
  collected: boolean;
}

export class World {
  objects: GameObject[] = [];
  lastObjectX: number = 500;

  constructor(private particles: ParticleSystem) {}

  getWaterHeight(x: number, time: number): number {
    const baseHeight = window.innerHeight * CONSTANTS.WATER_LEVEL;
    const wave1 = Math.sin(x * CONSTANTS.WAVE_FREQUENCY + time * CONSTANTS.WAVE_SPEED) * CONSTANTS.WAVE_AMPLITUDE;
    const wave2 = Math.sin(x * CONSTANTS.WAVE_FREQUENCY * 2.5 - time * CONSTANTS.WAVE_SPEED * 1.5) * (CONSTANTS.WAVE_AMPLITUDE * 0.4);
    return baseHeight + wave1 + wave2;
  }

  update(dt: number, time: number, player: Player, cameraX: number, isMenu: boolean = false) {
    // Generate new objects
    while (this.lastObjectX < cameraX + window.innerWidth * 2) {
      this.generateChunk(time);
    }

    // Clean up old objects
    this.objects = this.objects.filter(obj => obj.x > cameraX - 200 && !obj.collected);

    if (isMenu) return; // No collisions during menu

    // Collision detection
    const playerRect = {
      x: player.x - 15, y: player.y - 15, w: 30, h: 30
    };

    for (const obj of this.objects) {
      if (obj.collected) continue;

      const objRect = { x: obj.x, y: obj.y, w: obj.width, h: obj.height };
      
      if (this.checkAABB(playerRect, objRect)) {
        this.handleCollision(player, obj);
      }
    }
  }

  generateChunk(time: number) {
    this.lastObjectX += 400 + Math.random() * 400; // Gap between chunks

    const waterY = this.getWaterHeight(this.lastObjectX, time);

    const rand = Math.random();
    if (rand < 0.4) {
      // Spawn Ramp
      this.objects.push({ x: this.lastObjectX, y: 0, width: 60, height: 40, type: 'ramp', collected: false });
      
      // Spawn coins in an arc over the ramp
      for(let i=1; i<=3; i++) {
          this.objects.push({ x: this.lastObjectX + i * 50, y: waterY - 80 - Math.sin(i / 4 * Math.PI) * 60, width: 20, height: 20, type: 'coin', collected: false });
      }
    } else if (rand < 0.7) {
      // Spawn Coins
      for(let i=0; i<5; i++) {
        this.objects.push({ x: this.lastObjectX + i * 40, y: waterY - 40, width: 20, height: 20, type: 'coin', collected: false });
      }
    } else if (rand < 0.85) {
      // Spawn Mine
      this.objects.push({ x: this.lastObjectX, y: 0, width: 24, height: 24, type: 'mine', collected: false });
    } else {
      // Spawn Barrel
      this.objects.push({ x: this.lastObjectX, y: 0, width: 30, height: 40, type: 'barrel', collected: false });
    }
  }

  spawnGiantRamp(x: number) {
    // Add a very large ramp (15x size)
    const rampWidth = 900;
    const rampHeight = 400;
    const giantRamp: GameObject = { 
        x: x, 
        y: 0, 
        width: rampWidth, 
        height: rampHeight, 
        type: 'ramp', 
        collected: false 
    };
    (giantRamp as any).isGiant = true; // Flag for special collision
    this.objects.push(giantRamp);
    
    // Add 15 coins above it across the span
    for(let i=1; i<=15; i++) {
        this.objects.push({ 
            x: x + i * 55, 
            y: -250, 
            width: 30, 
            height: 30, 
            type: 'coin', 
            collected: false 
        });
    }
  }

  checkAABB(rect1: {x:number, y:number, w:number, h:number}, rect2: {x:number, y:number, w:number, h:number}) {
    return (
      rect1.x < rect2.x + rect2.w &&
      rect1.x + rect1.w > rect2.x &&
      rect1.y < rect2.y + rect2.h &&
      rect1.y + rect1.h > rect2.y
    );
  }

  handleCollision(player: Player, obj: GameObject) {
    if (obj.type === 'coin') {
      obj.collected = true;
      player.coins += 1;
      SoundManager.playCoin();
      // Add small particle burst
      this.particles.particles.push({
        x: obj.x, y: obj.y, vx: 0, vy: -50, life: 0.5, maxLife: 0.5, color: 'gold', size: 3
      });
    } else if (obj.type === 'ramp') {
      // Allow jumping off the ramp if moving forward
      if (player.x > obj.x && player.x < obj.x + obj.width) {
        if (!(obj as any).hasTriggered) {
            const boostFactor = (obj as any).isGiant ? 2.5 : 1.3;
            player.vy = CONSTANTS.JUMP_VELOCITY * boostFactor;
            player.isGrounded = false;
            player.y = obj.y - 20; 
            player.rotation = -Math.PI / 4; 
            SoundManager.playJump();
            (obj as any).hasTriggered = true;
        }
      }
    } else if (obj.type === 'mine' || obj.type === 'barrel') {
      if (player.shieldTimer > 0) {
        obj.collected = true; 
        this.particles.emitExplosion(obj.x, obj.y);
        SoundManager.playCrash(); 
        player.coins += 5;
      } else if (player.isShieldReady) {
        // TRIGGER SHIELD TIMER NOW!
        player.shieldTimer = player.shieldMaxDuration;
        player.isShieldReady = false;
        obj.collected = true;
        this.particles.emitExplosion(obj.x, obj.y);
        SoundManager.playCrash();
        player.coins += 5;
      } else if (player.equippedBike === 'fire' && player.boostTimer > 0) {
        obj.collected = true; // remove the object
        this.particles.emitExplosion(obj.x, obj.y);
        SoundManager.playCrash(); // play sound but player survives
        player.coins += 5; // Reward
      } else {
        player.die();
      }
    }
  }

  draw(ctx: CanvasRenderingContext2D, cameraX: number, time: number) {
    const screenWidth = window.innerWidth;
    const waterLevelBase = window.innerHeight * CONSTANTS.WATER_LEVEL;

    // Draw objects
    for (const obj of this.objects) {
      if (obj.type === 'ramp') {
        const y = this.getWaterHeight(obj.x, time) - obj.height/2;
        obj.y = y; // update collision Y
        
        // Shadow/Side
        ctx.fillStyle = '#5D2E0A';
        ctx.beginPath();
        ctx.moveTo(obj.x - cameraX, y + obj.height);
        if ((obj as any).isGiant) {
          ctx.quadraticCurveTo(obj.x + obj.width * 0.5 - cameraX, y + obj.height, obj.x + obj.width - cameraX, y);
        } else {
          ctx.lineTo(obj.x + obj.width - cameraX, y);
        }
        ctx.lineTo(obj.x + obj.width - cameraX, y + obj.height);
        ctx.fill();

        // Main surface
        ctx.fillStyle = '#8B4513';
        ctx.beginPath();
        ctx.moveTo(obj.x - cameraX, y + obj.height);
        if ((obj as any).isGiant) {
          ctx.quadraticCurveTo(obj.x + obj.width * 0.5 - cameraX, y + obj.height, obj.x + obj.width - cameraX, y);
        } else {
          ctx.lineTo(obj.x + obj.width - cameraX, y);
        }
        ctx.lineTo(obj.x + obj.width - 5 - cameraX, y + obj.height); // Small offset for 3D look
        ctx.fill();

        // Decorative stripes for giant ramp
        if ((obj as any).isGiant) {
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
            ctx.lineWidth = 4;
            for (let i = 1; i < 5; i++) {
                const sx = obj.x + (obj.width / 5) * i - cameraX;
                ctx.beginPath();
                ctx.moveTo(sx, y + obj.height);
                ctx.lineTo(sx, y + obj.height - 40);
                ctx.stroke();
            }
        }
        
      } else if (obj.type === 'coin') {
        // Floating coin animation
        const floatY = obj.y + Math.sin(time * 5 + obj.x) * 5;
        // Don't update collision Y for simple float, or we can just draw it floating.
        ctx.fillStyle = 'gold';
        ctx.beginPath();
        ctx.arc(obj.x - cameraX + obj.width/2, floatY + obj.height/2, obj.width/2, 0, Math.PI*2);
        ctx.fill();
        ctx.strokeStyle = '#B8860B';
        ctx.lineWidth = 2;
        ctx.stroke();

      } else if (obj.type === 'mine') {
        const y = this.getWaterHeight(obj.x, time) - obj.height/2;
        obj.y = y;
        ctx.fillStyle = '#333';
        ctx.beginPath();
        ctx.arc(obj.x - cameraX + obj.width/2, y + obj.height/2, obj.width/2, 0, Math.PI*2);
        ctx.fill();
        ctx.fillStyle = 'red';
        ctx.beginPath();
        ctx.arc(obj.x - cameraX + obj.width/2, y + obj.height/4, 3, 0, Math.PI*2);
        ctx.fill();

      } else if (obj.type === 'barrel') {
        const y = this.getWaterHeight(obj.x, time) - obj.height;
        obj.y = y;
        ctx.fillStyle = '#B22222';
        ctx.fillRect(obj.x - cameraX, y, obj.width, obj.height);
        ctx.strokeStyle = '#000';
        ctx.lineWidth = 2;
        ctx.strokeRect(obj.x - cameraX, y, obj.width, obj.height);
      }
    }

    // Draw Water
    ctx.fillStyle = 'rgba(0, 150, 255, 0.7)';
    ctx.beginPath();
    ctx.moveTo(0, waterLevelBase);
    
    for (let x = 0; x <= screenWidth; x += 20) {
      const worldX = x + cameraX;
      const y = this.getWaterHeight(worldX, time);
      ctx.lineTo(x, y);
    }
    ctx.lineTo(screenWidth, window.innerHeight);
    ctx.lineTo(0, window.innerHeight);
    ctx.fill();

    // Darker deeper water
    const gradient = ctx.createLinearGradient(0, waterLevelBase, 0, window.innerHeight);
    gradient.addColorStop(0, 'rgba(0, 100, 200, 0.0)');
    gradient.addColorStop(1, 'rgba(0, 50, 150, 0.9)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, waterLevelBase, screenWidth, window.innerHeight - waterLevelBase);
  }

  drawBackground(ctx: CanvasRenderingContext2D, cameraX: number) {
    const width = window.innerWidth;
    const height = window.innerHeight;

    // Sky gradient
    const skyGrad = ctx.createLinearGradient(0, 0, 0, height * CONSTANTS.WATER_LEVEL);
    skyGrad.addColorStop(0, '#87CEEB');
    skyGrad.addColorStop(1, '#E0F6FF');
    ctx.fillStyle = skyGrad;
    ctx.fillRect(0, 0, width, height * CONSTANTS.WATER_LEVEL);

    // Parallax clouds
    ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
    const cloudOffset = (cameraX * 0.1) % 400;
    for (let i = -1; i < width / 400 + 1; i++) {
        const cx = i * 400 - cloudOffset + 100;
        ctx.beginPath();
        ctx.arc(cx, 100, 30, 0, Math.PI * 2);
        ctx.arc(cx + 40, 100, 40, 0, Math.PI * 2);
        ctx.arc(cx + 80, 100, 30, 0, Math.PI * 2);
        ctx.fill();
    }
    
    // Parallax Mountains
    const mountainOffset = (cameraX * 0.3) % 800;
    ctx.fillStyle = '#A0C0D0';
    ctx.beginPath();
    for (let i = -1; i < width / 800 + 1; i++) {
      const mx = i * 800 - mountainOffset;
      ctx.moveTo(mx, height * CONSTANTS.WATER_LEVEL);
      ctx.lineTo(mx + 400, height * CONSTANTS.WATER_LEVEL - 200);
      ctx.lineTo(mx + 800, height * CONSTANTS.WATER_LEVEL);
    }
    ctx.fill();
  }
}
