/* ---------------------------------------------------------------------------
 * Procedural audio. Every sound in the game is synthesised at runtime with the
 * Web Audio API, so the build ships zero audio files and the page stays light.
 * ------------------------------------------------------------------------- */

type Bus = 'sfx' | 'music';

class CyberAudio {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private sfxGain: GainNode | null = null;
  private musicGain: GainNode | null = null;
  private sequencer: number | null = null;
  private step = 0;

  public sfxEnabled = true;
  public musicEnabled = true;
  private masterVolume = 0.7;

  /** Must be called from a user gesture (browsers block autoplay otherwise). */
  public unlock() {
    this.ensure();
    if (this.ctx?.state === 'suspended') void this.ctx.resume();
  }

  private ensure(): boolean {
    if (typeof window === 'undefined') return false;
    if (!this.ctx) {
      const Ctor =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctor) return false;
      try {
        this.ctx = new Ctor();
      } catch {
        return false;
      }
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.value = this.masterVolume;
      this.masterGain.connect(this.ctx.destination);

      this.sfxGain = this.ctx.createGain();
      this.sfxGain.gain.value = 1;
      this.sfxGain.connect(this.masterGain);

      this.musicGain = this.ctx.createGain();
      this.musicGain.gain.value = 0.55;
      this.musicGain.connect(this.masterGain);
    }
    return true;
  }

  private bus(name: Bus): GainNode | null {
    return name === 'music' ? this.musicGain : this.sfxGain;
  }

  public setMasterVolume(v: number) {
    this.masterVolume = Math.min(1, Math.max(0, v));
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setTargetAtTime(this.masterVolume, this.ctx.currentTime, 0.02);
    }
  }

  public getMasterVolume() {
    return this.masterVolume;
  }

  /* ----------------------------------------------------------------- voices */

  private tone(
    freq: number,
    type: OscillatorType,
    duration: number,
    gainValue: number,
    bus: Bus = 'sfx',
    sweepTo?: number,
    filterHz?: number,
  ) {
    if (bus === 'sfx' && !this.sfxEnabled) return;
    if (!this.ensure() || !this.ctx) return;
    const target = this.bus(bus);
    if (!target) return;

    try {
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, now);
      if (sweepTo !== undefined) {
        osc.frequency.exponentialRampToValueAtTime(Math.max(1, sweepTo), now + duration);
      }

      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.exponentialRampToValueAtTime(Math.max(0.0001, gainValue), now + 0.012);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);

      if (filterHz) {
        const filter = this.ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(filterHz, now);
        osc.connect(filter);
        filter.connect(gain);
      } else {
        osc.connect(gain);
      }
      gain.connect(target);

      osc.start(now);
      osc.stop(now + duration + 0.02);
    } catch {
      /* audio is decorative; never let it break the game */
    }
  }

  private noise(duration: number, gainValue: number, hz: number) {
    if (!this.sfxEnabled || !this.ensure() || !this.ctx || !this.sfxGain) return;
    try {
      const now = this.ctx.currentTime;
      const frames = Math.floor(this.ctx.sampleRate * duration);
      const buffer = this.ctx.createBuffer(1, frames, this.ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < frames; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / frames);

      const src = this.ctx.createBufferSource();
      src.buffer = buffer;
      const filter = this.ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.value = hz;
      const gain = this.ctx.createGain();
      gain.gain.value = gainValue;

      src.connect(filter);
      filter.connect(gain);
      gain.connect(this.sfxGain);
      src.start(now);
    } catch {
      /* ignore */
    }
  }

  /* ------------------------------------------------------------------- sfx */

  public uiHover() {
    this.tone(1180, 'sine', 0.045, 0.035);
  }

  public uiClick() {
    this.tone(720, 'square', 0.05, 0.05);
    window.setTimeout(() => this.tone(1080, 'sine', 0.07, 0.04), 28);
  }

  public jump() {
    this.tone(190, 'sine', 0.24, 0.12, 'sfx', 620);
  }

  public land() {
    this.noise(0.12, 0.09, 320);
  }

  public footstep(running: boolean) {
    this.noise(running ? 0.07 : 0.09, running ? 0.045 : 0.03, running ? 900 : 620);
  }

  public pickup() {
    [660, 880, 1320].forEach((f, i) =>
      window.setTimeout(() => this.tone(f, 'triangle', 0.16, 0.11), i * 70),
    );
  }

  public interact() {
    this.tone(320, 'sawtooth', 0.18, 0.07, 'sfx', 780, 1600);
  }

  public modalOpen() {
    this.tone(220, 'sawtooth', 0.28, 0.07, 'sfx', 660, 1400);
    window.setTimeout(() => this.tone(880, 'sine', 0.22, 0.06), 90);
  }

  public modalClose() {
    this.tone(660, 'sine', 0.16, 0.05, 'sfx', 240);
  }

  public levelUp() {
    [523, 659, 784, 1047, 1319].forEach((f, i) =>
      window.setTimeout(() => this.tone(f, 'square', 0.24, 0.09), i * 85),
    );
  }

  public achievement() {
    [784, 988, 1175].forEach((f, i) =>
      window.setTimeout(() => this.tone(f, 'triangle', 0.36, 0.1), i * 110),
    );
  }

  public error() {
    this.tone(180, 'sawtooth', 0.22, 0.09, 'sfx', 90);
  }

  /** Heavy riser used when the secret vault opens. */
  public vaultUnlock() {
    this.tone(120, 'sawtooth', 0.6, 0.11, 'sfx', 480, 900);
    window.setTimeout(() => this.achievement(), 260);
  }

  /* ----------------------------------------------------------------- music */

  /**
   * A four-chord synthwave loop: filtered saw bass, sine pads and a sparse
   * arpeggio. Driven by setInterval rather than scheduled ahead, which is
   * accurate enough for ambience and keeps the code readable.
   */
  public startMusic() {
    if (this.sequencer !== null) return;
    if (!this.ensure()) return;

    const bass = [65.41, 77.78, 87.31, 58.27]; // C2  Eb2  F2  Bb1
    const pads = [
      [261.63, 311.13, 392.0],
      [311.13, 369.99, 466.16],
      [349.23, 440.0, 523.25],
      [233.08, 293.66, 349.23],
    ];
    const arp = [1046.5, 1244.51, 1567.98, 1244.51];

    this.sequencer = window.setInterval(() => {
      if (!this.musicEnabled) return;
      const chord = Math.floor(this.step / 8) % 4;

      // Bass on every other step.
      if (this.step % 2 === 0) {
        this.tone(bass[chord], 'sawtooth', 0.34, 0.16, 'music', undefined, 380);
      }
      // Pad swell at the top of each bar.
      if (this.step % 8 === 0) {
        pads[chord].forEach((f) => this.tone(f, 'sine', 1.7, 0.035, 'music'));
      }
      // Sparse arpeggio in the second half of each bar.
      if (this.step % 8 >= 4 && this.step % 2 === 1) {
        this.tone(arp[this.step % 4], 'triangle', 0.24, 0.025, 'music');
      }
      this.step++;
    }, 250);
  }

  public stopMusic() {
    if (this.sequencer !== null) {
      window.clearInterval(this.sequencer);
      this.sequencer = null;
    }
  }

  public setMusicEnabled(on: boolean) {
    this.musicEnabled = on;
    if (on) this.startMusic();
    else this.stopMusic();
  }

  public setSfxEnabled(on: boolean) {
    this.sfxEnabled = on;
  }
}

export const audio = new CyberAudio();
