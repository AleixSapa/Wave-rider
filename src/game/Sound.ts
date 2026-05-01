export class SoundManager {
  private static audioCtx: AudioContext | null = null;

  static init() {
    if (!this.audioCtx) {
      this.audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    if (this.audioCtx && this.audioCtx.state === 'suspended') {
      this.audioCtx.resume();
    }
  }

  static playJump() {
    // this.playTone(300, 600, 'sine', 0.1, 0.3);
  }

  static playSplash() {
    // this.playNoise(0.2);
  }

  static playCrash() {
    // this.playNoise(0.5, 'lowpass');
  }

  static playCoin() {
    // this.playTone(800, 1200, 'sine', 0.05, 0.1);
  }

  private static playTone(startFreq: number, endFreq: number, type: OscillatorType, fadeIn: number, fadeOut: number) {
    if (!this.audioCtx) return;
    const osc = this.audioCtx.createOscillator();
    const gain = this.audioCtx.createGain();
    
    osc.type = type;
    osc.frequency.setValueAtTime(startFreq, this.audioCtx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(endFreq, this.audioCtx.currentTime + fadeIn + fadeOut);
    
    gain.gain.setValueAtTime(0, this.audioCtx.currentTime);
    gain.gain.linearRampToValueAtTime(0.3, this.audioCtx.currentTime + fadeIn);
    gain.gain.linearRampToValueAtTime(0, this.audioCtx.currentTime + fadeIn + fadeOut);
    
    osc.connect(gain);
    gain.connect(this.audioCtx.destination);
    
    osc.start();
    osc.stop(this.audioCtx.currentTime + fadeIn + fadeOut);
  }

  private static playNoise(duration: number, filterType?: BiquadFilterType) {
    if (!this.audioCtx) return;
    const bufferSize = this.audioCtx.sampleRate * duration;
    const buffer = this.audioCtx.createBuffer(1, bufferSize, this.audioCtx.sampleRate);
    const data = buffer.getChannelData(0);
    
    for (let i = 0; i < bufferSize; i++) {
        data[i] = Math.random() * 2 - 1;
    }
    
    const noise = this.audioCtx.createBufferSource();
    noise.buffer = buffer;
    
    const gain = this.audioCtx.createGain();
    gain.gain.setValueAtTime(0.5, this.audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, this.audioCtx.currentTime + duration);

    if (filterType) {
        const filter = this.audioCtx.createBiquadFilter();
        filter.type = filterType;
        filter.frequency.value = 1000;
        noise.connect(filter);
        filter.connect(gain);
    } else {
        noise.connect(gain);
    }

    gain.connect(this.audioCtx.destination);
    noise.start();
  }
}
