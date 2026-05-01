import { Player } from './Player';
import { World } from './World';
import { ParticleSystem } from './ParticleSystem';
import { SoundManager } from './Sound';
import { Network } from './Network';

export class GameEngine {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  player: Player;
  world: World;
  particles: ParticleSystem;
  network: Network;

  lastTime: number = 0;
  totalTime: number = 0;
  animationFrameId: number = 0;
  
  isInputActive: boolean = false;
  gameState: 'menu' | 'shop' | 'multiplayer_lobby' | 'playing' | 'gameover' = 'menu';

  shakeTimer: number = 0;
  isMultiplayer: boolean = false;
  hasNotifiedDeath: boolean = false;
  playerName: string = 'Anonymous';

  setPlayerBaseSpeed(speed: number) {
    this.player.baseSpeed = speed;
  }

  // Callbacks for React UI
  onScoreUpdate?: (distance: number, combo: number, speed: number, coins: number, fireCharges: number, shieldTimer: number, shieldReady: boolean, boostTimer: number) => void;
  onGameOver?: (finalScore: number, allPlayersData?: any, sessionCoins?: number) => void;
  onLobbyUpdate?: (roomId: string, players: Record<string, any>, isHost: boolean) => void;
  onGameCountdown?: (startTime: number) => void;
  onError?: (msg: string) => void;

  resizeObserver: ResizeObserver | null = null;
  
  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d')!;
    
    this.particles = new ParticleSystem();
    this.player = new Player(this.particles);
    this.world = new World(this.particles);
    this.network = new Network();

    this.setupNetwork();

    this.resizeObserver = new ResizeObserver((entries) => {
      for (let entry of entries) {
        if (entry.target === this.canvas.parentElement) {
          this.canvas.width = entry.contentRect.width;
          this.canvas.height = entry.contentRect.height;
        }
      }
    });
    
    if (this.canvas.parentElement) {
      this.resizeObserver.observe(this.canvas.parentElement);
      this.canvas.width = this.canvas.parentElement.clientWidth;
      this.canvas.height = this.canvas.parentElement.clientHeight;
    } else {
      this.canvas.width = window.innerWidth;
      this.canvas.height = window.innerHeight;
      window.addEventListener('resize', this.resize);
    }
    
    this.setupInputs();
  }

  setupNetwork() {
    this.network.connect();
    
    this.network.onRoomState = (state) => {
      if (this.gameState !== 'playing' && this.gameState !== 'gameover') {
        this.gameState = 'multiplayer_lobby';
        this.isMultiplayer = true;
        // Check if we are host (first player might be arbitrarily host, actually anyone can start for simplicity)
        if (this.onLobbyUpdate) {
            this.onLobbyUpdate(state.id, state.players, true);
        }
      }
    };

    this.network.onGameStarting = (startTime) => {
      if (this.onGameCountdown) {
        this.onGameCountdown(startTime);
      }
      
      const checkStart = () => {
        if (Date.now() >= startTime) {
          this.startGame(true);
        } else {
          setTimeout(checkStart, 100);
        }
      };
      checkStart();
    };

    this.network.onError = (msg) => {
      if (this.onError) this.onError(msg);
    };

    this.network.onGameFinished = (players) => {
        if (this.gameState === 'gameover' && this.onGameOver) {
            this.onGameOver(this.player.distance, players, this.player.coins);
        }
    }
  }

  createMultiplayerRoom(roomId?: string) {
    this.network.createRoom(roomId, this.playerName);
  }

  joinMultiplayerRoom(roomId: string) {
    this.network.joinRoom(roomId, this.playerName);
  }

  startMultiplayerGame() {
    this.network.startGame();
  }

  resize = () => {
    if (this.canvas.parentElement) {
      this.canvas.width = this.canvas.parentElement.clientWidth;
      this.canvas.height = this.canvas.parentElement.clientHeight;
    } else {
      this.canvas.width = window.innerWidth;
      this.canvas.height = window.innerHeight;
    }
  }

  setupInputs() {
    const handleDown = (e: Event) => {
      // prevent default if it's touch to avoid scrolling
      if (e.cancelable) e.preventDefault();
      SoundManager.init();
      this.isInputActive = true;
      if (this.gameState === 'menu' && !this.isMultiplayer) {
         // Single player immediate start only if we are in main menu strictly, handled by UI mostly now, so let's ignore it here and explicitly call startGame from UI
      }
    };
    
    const handleUp = (e: Event) => {
      if (e.cancelable) e.preventDefault();
      this.isInputActive = false;
    };

    window.addEventListener('keydown', (e) => {
      if (e.code === 'Space') handleDown(e);
      if (e.code === 'Enter' && this.gameState === 'playing' && !this.player.isDead) {
        if (this.player.equippedBike === 'fire') {
          if (this.player.bikeCharges > 0 && this.player.boostTimer <= 0) {
              this.player.bikeCharges--;
              this.player.boostTimer = 30.0;
              SoundManager.init();
          }
        } else if (this.player.equippedBike === 'rampeadora') {
          if (this.player.bikeCharges > 0) {
              this.player.bikeCharges--;
              this.world.spawnGiantRamp(this.player.x + 200);
              SoundManager.init();
              SoundManager.playJump();
          }
        } else if (this.player.equippedBike === 'super') {
          if (this.player.bikeCharges > 0) {
              this.player.bikeCharges--;
              this.player.activateSuperJump();
              SoundManager.init();
              SoundManager.playJump();
          }
        } else if (this.player.equippedBike === 'gato') {
          if (this.player.bikeCharges > 0) {
              this.player.bikeCharges--;
              this.player.activateGatoJump();
              SoundManager.init();
              SoundManager.playJump();
          }
        }
      }
    });
    window.addEventListener('keyup', (e) => {
      if (e.code === 'Space') handleUp(e);
    });
    
    this.canvas.addEventListener('touchstart', handleDown, { passive: false });
    this.canvas.addEventListener('touchend', handleUp, { passive: false });
    this.canvas.addEventListener('mousedown', handleDown);
    this.canvas.addEventListener('mouseup', handleUp);
  }

  startGame(isMultiplayer: boolean = false) {
    this.gameState = 'playing';
    this.isMultiplayer = isMultiplayer;
    this.hasNotifiedDeath = false;
    this.isInputActive = false; // Reset input to avoid UI clicks carrying over
    this.player.reset();
    this.world.objects = [];
    this.world.lastObjectX = 500;
    this.particles.particles = [];
    this.totalTime = 0;
    this.lastTime = performance.now();
    
    // Put player on the water immediately so it doesn't fall from y=0
    this.player.y = this.world.getWaterHeight(this.player.x, this.totalTime);
    this.player.isGrounded = true;
  }

  start() {
    this.lastTime = performance.now();
    this.loop(this.lastTime);
  }

  stop() {
    cancelAnimationFrame(this.animationFrameId);
    window.removeEventListener('resize', this.resize);
    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
    }
    // cleanup event listeners in a real app
  }

  loop = (currentTime: number) => {
    const dt = Math.min((currentTime - this.lastTime) / 1000, 0.1); // Cap dt at 100ms
    this.lastTime = currentTime;
    this.totalTime += dt;

    this.update(dt);
    this.draw();

    this.animationFrameId = requestAnimationFrame(this.loop);
  }

  update(dt: number) {
    if (this.gameState !== 'playing') {
       // Float the player on water during menu
       this.player.y = this.world.getWaterHeight(this.player.x, this.totalTime);
       const nextY = this.world.getWaterHeight(this.player.x + 10, this.totalTime);
       this.player.rotation = Math.atan2(nextY - this.player.y, 10);
       this.world.update(dt, this.totalTime, this.player, this.player.x - 200, true);
       this.particles.update(dt);
       return;
    }

    const previousDead = this.player.isDead;

    this.player.update(dt, this.isInputActive, (x) => this.world.getWaterHeight(x, this.totalTime));
    
    if (this.isMultiplayer) {
      this.network.updatePlayer({
        x: this.player.x,
        y: this.player.y,
        rotation: this.player.rotation,
        score: this.player.score,
        distance: this.player.distance,
        isDead: this.player.isDead,
        name: this.playerName
      });
    }

    // camera X aims to keep player at 200px from left
    const cameraX = this.player.x - 200;
    
    this.world.update(dt, this.totalTime, this.player, cameraX);
    this.particles.update(dt);

    // Score callback
    if (this.onScoreUpdate) {
      this.onScoreUpdate(this.player.distance, this.player.combo, Math.round(this.player.vx), this.player.coins, this.player.bikeCharges, this.player.shieldTimer, this.player.isShieldReady, this.player.boostTimer);
    }

    // Check game over transition
    if (this.player.isDead && !previousDead) {
      this.shakeTimer = 0.5; // shake for 0.5s
      this.gameState = 'gameover';
      if (this.isMultiplayer && !this.hasNotifiedDeath) {
        this.network.notifyDeath();
        this.hasNotifiedDeath = true;
      }
      
      if (!this.isMultiplayer) {
          if (this.onGameOver) {
            setTimeout(() => this.onGameOver!(this.player.distance, undefined, this.player.coins), 1000);
          }
      }
    }
    
    if (this.shakeTimer > 0) {
      this.shakeTimer -= dt;
    }
  }

  draw() {
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    this.ctx.save();
    if (this.shakeTimer > 0) {
      const rx = (Math.random() - 0.5) * 20;
      const ry = (Math.random() - 0.5) * 20;
      this.ctx.translate(rx, ry);
    }

    const cameraX = this.player.x - 200;

    this.world.drawBackground(this.ctx, cameraX);
    
    // Speed lines if boosting
    if (this.player.boostTimer > 0) {
      this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
      this.ctx.lineWidth = 2;
      this.ctx.beginPath();
      for (let i = 0; i < 20; i++) {
        const y = Math.random() * this.canvas.height;
        const x = Math.random() * this.canvas.width;
        const len = 100 + Math.random() * 200;
        this.ctx.moveTo(x, y);
        this.ctx.lineTo(x + len, y);
      }
      this.ctx.stroke();
    }

    this.particles.draw(this.ctx, cameraX);
    this.world.draw(this.ctx, cameraX, this.totalTime);

    // Draw other players if multiplayer
    if (this.isMultiplayer) {
      this.ctx.globalAlpha = 0.5;
      for (const id in this.network.players) {
        const p = this.network.players[id];
        if (!p.isDead) {
          this.ctx.save();
          this.ctx.translate(p.x - cameraX, p.y);
          this.ctx.rotate(p.rotation || 0);
          this.ctx.scale(1.5, 1.5);

          // Draw Ghost JetSki
          this.ctx.fillStyle = '#66cc33'; // green for other players
          this.ctx.beginPath();
          this.ctx.moveTo(15, 0);
          this.ctx.lineTo(-15, -10);
          this.ctx.lineTo(-15, 5);
          this.ctx.lineTo(10, 5);
          this.ctx.closePath();
          this.ctx.fill();

          // Rider
          this.ctx.fillStyle = '#99ff66';
          this.ctx.beginPath();
          this.ctx.arc(0, -15, 6, 0, Math.PI * 2);
          this.ctx.fill();
          this.ctx.fillRect(-5, -10, 10, 10);
          this.ctx.restore();

          // Draw Name
          if (p.name) {
              this.ctx.font = 'bold 12px monospace';
              this.ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
              this.ctx.textAlign = 'center';
              this.ctx.fillText(p.name, p.x - cameraX, p.y - 40);
          }
        }
      }
      this.ctx.globalAlpha = 1.0;
    }

    this.player.draw(this.ctx, cameraX);

    if (this.isMultiplayer) {
      this.ctx.font = 'bold 12px monospace';
      this.ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
      this.ctx.textAlign = 'center';
      this.ctx.fillText(this.playerName, this.player.x - cameraX, this.player.y - 40);
    }
    
    this.ctx.restore();
  }
}
