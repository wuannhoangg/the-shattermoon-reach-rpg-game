// Bộ tổng hợp âm thanh Chiptune Dark Fantasy 16-bit bằng Web Audio API

class DarkAudioEngine {
  constructor() {
    this.ctx = null;
    this.enabled = true;
  }

  init() {
    if (!this.ctx && typeof AudioContext !== 'undefined') {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    }
  }

  toggle() {
    this.enabled = !this.enabled;
    return this.enabled;
  }

  playTone(freq, duration = 0.14, type = 'triangle', volume = 0.12, delay = 0) {
    if (!this.enabled) return;
    this.init();
    if (!this.ctx) return;
    const now = this.ctx.currentTime + delay;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, now);
    gain.gain.setValueAtTime(volume, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(now);
    osc.stop(now + duration);
  }

  playEncounter() {
    [220, 207, 196, 146].forEach((f, i) => this.playTone(f, 0.16, 'sawtooth', 0.1, i * 0.08));
  }

  playHit() {
    this.playTone(130, 0.12, 'square', 0.14, 0);
    this.playTone(85, 0.18, 'sawtooth', 0.14, 0.05);
  }

  playSealThrow() {
    [330, 440, 587, 659].forEach((f, i) => this.playTone(f, 0.15, 'triangle', 0.12, i * 0.09));
  }

  playCaptureSuccess() {
    [293.66, 349.23, 440, 587.33].forEach((f, i) => this.playTone(f, 0.25, 'triangle', 0.14, i * 0.12));
  }

  playEvolve() {
    [220, 277, 330, 440, 554, 659].forEach((f, i) => this.playTone(f, 0.22, 'sawtooth', 0.12, i * 0.1));
  }

  playHeal() {
    [392, 493.88, 587.33].forEach((f, i) => this.playTone(f, 0.22, 'sine', 0.12, i * 0.11));
  }
}

export const audio = new DarkAudioEngine();
