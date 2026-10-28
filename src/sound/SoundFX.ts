/**
 * Procedural Web Audio API Sound Synthesizer.
 * Generates crisp, retro-modern tactical RTS sound effects entirely in code
 * without external audio asset downloads, ensuring zero latency and 100% offline reliability.
 */
export class SoundFX {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private muted = false;
  private volume = 0.5;

  constructor() {
    try {
      const stored = localStorage.getItem("bw_muted");
      if (stored !== null) this.muted = stored === "true";
      const vol = localStorage.getItem("bw_volume");
      if (vol !== null) this.volume = Math.max(0, Math.min(1, parseFloat(vol)));
    } catch {
      // ignore localStorage security restrictions
    }
  }

  private initCtx(): AudioContext | null {
    if (typeof window === "undefined") return null;
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return null;
      this.ctx = new AudioCtx();
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.setValueAtTime(this.muted ? 0 : this.volume, this.ctx.currentTime);
      this.masterGain.connect(this.ctx.destination);
    }
    if (this.ctx.state === "suspended") {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  isMuted(): boolean {
    return this.muted;
  }

  toggleMute(): boolean {
    this.muted = !this.muted;
    try {
      localStorage.setItem("bw_muted", String(this.muted));
    } catch {}
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setValueAtTime(this.muted ? 0 : this.volume, this.ctx.currentTime);
    }
    return this.muted;
  }

  setVolume(vol: number): void {
    this.volume = Math.max(0, Math.min(1, vol));
    try {
      localStorage.setItem("bw_volume", String(this.volume));
    } catch {}
    if (this.masterGain && this.ctx && !this.muted) {
      this.masterGain.gain.setValueAtTime(this.volume, this.ctx.currentTime);
    }
  }

  /** Subtle tactical army march drum */
  playAttack(): void {
    const ctx = this.initCtx();
    if (!ctx || this.muted) return;
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = "triangle";
    osc.frequency.setValueAtTime(140, t);
    osc.frequency.exponentialRampToValueAtTime(45, t + 0.12);

    gain.gain.setValueAtTime(0.25, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.14);

    osc.connect(gain);
    gain.connect(this.masterGain!);

    osc.start(t);
    osc.stop(t + 0.15);
  }

  /** Naval horn and water splash for troop transports and warships */
  playBoatLaunch(): void {
    const ctx = this.initCtx();
    if (!ctx || this.muted) return;
    const t = ctx.currentTime;

    // Dual-tone ship horn
    [130, 165].forEach((freq) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sawtooth";
      osc.frequency.setValueAtTime(freq, t);
      osc.frequency.exponentialRampToValueAtTime(freq * 0.96, t + 0.35);

      gain.gain.setValueAtTime(0.08, t);
      gain.gain.linearRampToValueAtTime(0.12, t + 0.08);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.38);

      osc.connect(gain);
      gain.connect(this.masterGain!);

      osc.start(t);
      osc.stop(t + 0.4);
    });
  }

  /** Naval artillery cannon boom */
  playCannon(): void {
    const ctx = this.initCtx();
    if (!ctx || this.muted) return;
    const t = ctx.currentTime;

    // Low explosive punch
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(120, t);
    osc.frequency.exponentialRampToValueAtTime(25, t + 0.28);

    gain.gain.setValueAtTime(0.4, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.3);

    osc.connect(gain);
    gain.connect(this.masterGain!);
    osc.start(t);
    osc.stop(t + 0.32);

    // Filtered noise crackle
    this.playNoiseBurst(0.2, 0.22, 600);
  }

  /** Bright multi-tone chime when trade gold is received */
  playTradeGold(): void {
    const ctx = this.initCtx();
    if (!ctx || this.muted) return;
    const t = ctx.currentTime;
    const notes = [523.25, 659.25, 783.99, 1046.5]; // C5, E5, G5, C6 arpeggio

    notes.forEach((freq, i) => {
      const delay = i * 0.055;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = "sine";
      osc.frequency.setValueAtTime(freq, t + delay);

      gain.gain.setValueAtTime(0, t);
      gain.gain.setValueAtTime(0.18, t + delay);
      gain.gain.exponentialRampToValueAtTime(0.001, t + delay + 0.25);

      osc.connect(gain);
      gain.connect(this.masterGain!);

      osc.start(t + delay);
      osc.stop(t + delay + 0.28);
    });
  }

  /** Crystal clear tactical sonar ping */
  playPing(): void {
    const ctx = this.initCtx();
    if (!ctx || this.muted) return;
    const t = ctx.currentTime;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = "sine";
    osc.frequency.setValueAtTime(1480, t);
    osc.frequency.exponentialRampToValueAtTime(880, t + 0.4);

    gain.gain.setValueAtTime(0.35, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.45);

    osc.connect(gain);
    gain.connect(this.masterGain!);

    osc.start(t);
    osc.stop(t + 0.48);
  }

  /** Mechanical upgrade chime */
  playUpgrade(): void {
    const ctx = this.initCtx();
    if (!ctx || this.muted) return;
    const t = ctx.currentTime;

    [440, 554.37, 659.25].forEach((freq, idx) => {
      const delay = idx * 0.04;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = "triangle";
      osc.frequency.setValueAtTime(freq, t + delay);

      gain.gain.setValueAtTime(0.15, t + delay);
      gain.gain.exponentialRampToValueAtTime(0.001, t + delay + 0.2);

      osc.connect(gain);
      gain.connect(this.masterGain!);

      osc.start(t + delay);
      osc.stop(t + delay + 0.22);
    });
  }

  /** Ascending rocket engine blast */
  playNukeLaunch(): void {
    const ctx = this.initCtx();
    if (!ctx || this.muted) return;
    const t = ctx.currentTime;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = "sawtooth";
    osc.frequency.setValueAtTime(60, t);
    osc.frequency.exponentialRampToValueAtTime(480, t + 1.2);

    gain.gain.setValueAtTime(0.1, t);
    gain.gain.linearRampToValueAtTime(0.35, t + 0.4);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 1.3);

    osc.connect(gain);
    gain.connect(this.masterGain!);

    osc.start(t);
    osc.stop(t + 1.35);
  }

  /** Deep apocalyptic shockwave explosion */
  playNukeExplosion(): void {
    const ctx = this.initCtx();
    if (!ctx || this.muted) return;
    const t = ctx.currentTime;

    // Sub-bass rumble
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = "sine";
    osc.frequency.setValueAtTime(95, t);
    osc.frequency.exponentialRampToValueAtTime(18, t + 1.8);

    gain.gain.setValueAtTime(0.6, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 2.0);

    osc.connect(gain);
    gain.connect(this.masterGain!);

    osc.start(t);
    osc.stop(t + 2.1);

    // Firestorm noise
    this.playNoiseBurst(0.45, 1.6, 350);
  }

  /** Crisp UI click */
  playClick(): void {
    const ctx = this.initCtx();
    if (!ctx || this.muted) return;
    const t = ctx.currentTime;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = "sine";
    osc.frequency.setValueAtTime(800, t);
    osc.frequency.exponentialRampToValueAtTime(200, t + 0.04);

    gain.gain.setValueAtTime(0.15, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.045);

    osc.connect(gain);
    gain.connect(this.masterGain!);

    osc.start(t);
    osc.stop(t + 0.05);
  }

  /** Jet fighter flyby roar */
  playAirstrike(): void {
    const ctx = this.initCtx();
    if (!ctx || this.muted) return;
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = "sawtooth";
    osc.frequency.setValueAtTime(320, t);
    osc.frequency.linearRampToValueAtTime(740, t + 0.25);
    osc.frequency.exponentialRampToValueAtTime(180, t + 0.6);

    gain.gain.setValueAtTime(0.01, t);
    gain.gain.linearRampToValueAtTime(0.18, t + 0.22);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.65);

    osc.connect(gain);
    gain.connect(this.masterGain!);

    osc.start(t);
    osc.stop(t + 0.7);
  }

  /** Aerial bomb detonation */
  playBombDetonate(): void {
    const ctx = this.initCtx();
    if (!ctx || this.muted) return;
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = "sine";
    osc.frequency.setValueAtTime(120, t);
    osc.frequency.exponentialRampToValueAtTime(25, t + 0.35);

    gain.gain.setValueAtTime(0.35, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.4);

    osc.connect(gain);
    gain.connect(this.masterGain!);

    osc.start(t);
    osc.stop(t + 0.45);
    this.playNoiseBurst(0.25, 0.3, 400);
  }

  /** Central Bank cash collection chime */
  playCash(): void {
    const ctx = this.initCtx();
    if (!ctx || this.muted) return;
    const t = ctx.currentTime;
    [659.25, 987.77].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const st = t + i * 0.07;
      osc.type = "sine";
      osc.frequency.setValueAtTime(freq, st);
      gain.gain.setValueAtTime(0.15, st);
      gain.gain.exponentialRampToValueAtTime(0.001, st + 0.2);
      osc.connect(gain);
      gain.connect(this.masterGain!);
      osc.start(st);
      osc.stop(st + 0.22);
    });
  }

  private playNoiseBurst(gainVal: number, duration: number, cutoffFreq: number): void {
    if (!this.ctx || this.muted) return;
    const bufferSize = Math.floor(this.ctx.sampleRate * duration);
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }

    const noise = this.ctx.createBufferSource();
    noise.buffer = buffer;

    const filter = this.ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.setValueAtTime(cutoffFreq, this.ctx.currentTime);
    filter.frequency.exponentialRampToValueAtTime(60, this.ctx.currentTime + duration);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(gainVal, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + duration);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain!);

    noise.start();
  }
}

export const sound = new SoundFX();
