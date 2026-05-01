export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  color: string;
  size: number;
}

export class ParticleSystem {
  particles: Particle[] = [];

  emitSplash(x: number, y: number) {
    for (let i = 0; i < 15; i++) {
      this.particles.push({
        x, y,
        vx: (Math.random() - 0.5) * 200,
        vy: -Math.random() * 300 - 100,
        life: 0.5 + Math.random() * 0.5,
        maxLife: 1.0,
        color: 'rgba(255, 255, 255, 0.8)',
        size: Math.random() * 4 + 2,
      });
    }
  }

  emitTrail(x: number, y: number, isBoosting: boolean) {
    this.particles.push({
      x, y,
      vx: -200 - Math.random() * 100,
      vy: (Math.random() - 0.5) * 50,
      life: 0.3 + Math.random() * 0.3,
      maxLife: 0.6,
      color: isBoosting ? 'rgba(255, 150, 0, 0.8)' : 'rgba(200, 240, 255, 0.6)',
      size: Math.random() * 5 + 3,
    });
  }

  emitExplosion(x: number, y: number) {
    for (let i = 0; i < 30; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = Math.random() * 400 + 100;
      this.particles.push({
        x, y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 0.5 + Math.random() * 0.5,
        maxLife: 1.0,
        color: Math.random() > 0.5 ? '#ff4400' : '#ffaa00',
        size: Math.random() * 6 + 4,
      });
    }
  }

  update(dt: number) {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += 600 * dt; // gravity
      p.life -= dt;
      if (p.life <= 0) {
        this.particles.splice(i, 1);
      }
    }
  }

  draw(ctx: CanvasRenderingContext2D, cameraX: number) {
    for (const p of this.particles) {
      ctx.fillStyle = p.color;
      ctx.globalAlpha = p.life / p.maxLife;
      ctx.beginPath();
      ctx.arc(p.x - cameraX, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1.0;
  }
}
