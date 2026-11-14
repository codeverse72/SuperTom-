/**
 * Web Audio API synthesizer for mobile game sound effects
 * Zero external audio file dependencies.
 * Features an organic, responsive cat meow sound for every UI click.
 */

class SoundController {
  private ctx: AudioContext | null = null;
  public enabled: boolean = true;
  private lastMeowTime: number = 0;
  private meowIndex: number = 0;

  private initCtx() {
    if (!this.ctx && typeof window !== 'undefined') {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
  }

  /**
   * Synthesizes an adorable, responsive cat "Meow / Mew" sound using Web Audio API formants.
   * Responsive (~160ms), snappy and pleasant for every click/tap in the mini app.
   */
  public playCatMeow(forcedPitch?: number) {
    if (!this.enabled) return;
    const nowMs = Date.now();
    if (nowMs - this.lastMeowTime < 60) return; // Prevent double-trigger flutter within 60ms
    this.lastMeowTime = nowMs;

    try {
      this.initCtx();
      if (!this.ctx) return;
      const now = this.ctx.currentTime;

      // Rotate through subtle pitch variants for cute dynamic feline character
      this.meowIndex = (this.meowIndex + 1) % 4;
      const pitchVariants = [1.0, 1.07, 0.95, 1.03];
      const pitchMult = forcedPitch ?? pitchVariants[this.meowIndex];

      const startFreq = 420 * pitchMult;  // "m" vocal onset
      const peakFreq = 780 * pitchMult;   // "ee" pitch apex
      const endFreq = 490 * pitchMult;    // "ow" gentle vocal drop
      const duration = 0.16;

      // 1. Primary vocal body oscillator (Sine for warm cat vocalization)
      const osc1 = this.ctx.createOscillator();
      const gain1 = this.ctx.createGain();
      osc1.type = 'sine';
      osc1.frequency.setValueAtTime(startFreq, now);
      osc1.frequency.exponentialRampToValueAtTime(peakFreq, now + 0.055);
      osc1.frequency.exponentialRampToValueAtTime(endFreq, now + duration);

      gain1.gain.setValueAtTime(0.001, now);
      gain1.gain.linearRampToValueAtTime(0.18, now + 0.025);
      gain1.gain.exponentialRampToValueAtTime(0.001, now + duration);

      // 2. Harmonic overtone oscillator (adds vocal throat / purr texture)
      const osc2 = this.ctx.createOscillator();
      const gain2 = this.ctx.createGain();
      osc2.type = 'triangle';
      osc2.frequency.setValueAtTime(startFreq * 2.05, now);
      osc2.frequency.exponentialRampToValueAtTime(peakFreq * 2.0, now + 0.055);
      osc2.frequency.exponentialRampToValueAtTime(endFreq * 1.9, now + duration);

      gain2.gain.setValueAtTime(0.001, now);
      gain2.gain.linearRampToValueAtTime(0.05, now + 0.03);
      gain2.gain.exponentialRampToValueAtTime(0.001, now + duration);

      // 3. Low-pass filter to soften high frequencies and keep the meow silky and organic
      const filter = this.ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(3000, now);
      filter.frequency.exponentialRampToValueAtTime(1800, now + duration);

      osc1.connect(gain1);
      osc2.connect(gain2);
      gain1.connect(filter);
      gain2.connect(filter);
      filter.connect(this.ctx.destination);

      osc1.start(now);
      osc2.start(now);
      osc1.stop(now + duration + 0.01);
      osc2.stop(now + duration + 0.01);
    } catch {
      // AudioContext policy suppression fallback
    }
  }

  public playTap() {
    this.playCatMeow();
  }

  public playClick() {
    this.playCatMeow();
  }

  public playTabSwitch() {
    this.playCatMeow(1.08); // Slightly higher perkier mew for tab navigation
  }

  public playCoin() {
    if (!this.enabled) return;
    try {
      this.initCtx();
      if (!this.ctx) return;
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(987.77, now); // B5
      osc.frequency.setValueAtTime(1318.51, now + 0.08); // E6

      gain.gain.setValueAtTime(0.15, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.28);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start(now);
      osc.stop(now + 0.28);
    } catch {
      // ignore
    }
  }

  public playMunch() {
    if (!this.enabled) return;
    try {
      this.initCtx();
      if (!this.ctx) return;
      const now = this.ctx.currentTime;
      // 2 short crunch sounds
      [0, 0.08, 0.16].forEach((offset, idx) => {
        if (!this.ctx) return;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'square';
        osc.frequency.setValueAtTime(220 + idx * 80, now + offset);
        osc.frequency.exponentialRampToValueAtTime(120, now + offset + 0.05);

        gain.gain.setValueAtTime(0.1, now + offset);
        gain.gain.exponentialRampToValueAtTime(0.001, now + offset + 0.05);

        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start(now + offset);
        osc.stop(now + offset + 0.05);
      });
    } catch {
      // ignore
    }
  }

  public playWheelTick() {
    if (!this.enabled) return;
    try {
      this.initCtx();
      if (!this.ctx) return;
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(600, now);
      osc.frequency.exponentialRampToValueAtTime(400, now + 0.03);

      gain.gain.setValueAtTime(0.08, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.03);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start(now);
      osc.stop(now + 0.03);
    } catch {
      // ignore
    }
  }

  public playWin() {
    if (!this.enabled) return;
    try {
      this.initCtx();
      if (!this.ctx) return;
      const now = this.ctx.currentTime;
      const notes = [523.25, 659.25, 783.99, 1046.50]; // C5, E5, G5, C6
      notes.forEach((freq, i) => {
        if (!this.ctx) return;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, now + i * 0.08);

        gain.gain.setValueAtTime(0.18, now + i * 0.08);
        gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.08 + 0.35);

        osc.connect(gain);
        gain.connect(this.ctx.destination);

        osc.start(now + i * 0.08);
        osc.stop(now + i * 0.08 + 0.35);
      });
    } catch {
      // ignore
    }
  }

  public playReward() {
    this.playWin();
  }

  public playClick() {
    this.playTap();
  }
}

export const sound = new SoundController();
