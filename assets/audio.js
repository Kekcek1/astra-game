(function () {
  "use strict";

  const NOTES = [261.63, 293.66, 329.63, 392.0, 440.0, 523.25, 587.33, 659.25];

  class AudioEngine {
    constructor() {
      this.ctx = null;
      this.master = null;
      this.musicGain = null;
      this.sfxGain = null;
      this.musicOn = true;
      this.sfxOn = true;
      this.started = false;
      this.musicTimer = 0;
      this.nextBeat = 0;
      this.beat = 0;
      this.suspended = false;
    }

    ensure() {
      if (this.ctx) {
        if (this.ctx.state === "suspended") this.ctx.resume().catch(() => {});
        return;
      }
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      try {
        this.ctx = new AC();
        this.master = this.ctx.createGain();
        this.master.gain.value = 0.72;
        this.master.connect(this.ctx.destination);
        this.musicGain = this.ctx.createGain();
        this.musicGain.gain.value = this.musicOn ? 0.16 : 0;
        this.musicGain.connect(this.master);
        this.sfxGain = this.ctx.createGain();
        this.sfxGain.gain.value = this.sfxOn ? 0.36 : 0;
        this.sfxGain.connect(this.master);
        this.started = true;
        this.nextBeat = this.ctx.currentTime + 0.2;
        this.startMusic();
      } catch (e) {
        this.ctx = null;
      }
    }

    startMusic() {
      if (!this.ctx || this.musicTimer) return;
      this.musicTimer = window.setInterval(() => this.scheduleMusic(), 400);
    }

    scheduleMusic() {
      if (!this.ctx || !this.musicOn || this.suspended) return;
      const now = this.ctx.currentTime;
      if (this.nextBeat < now) this.nextBeat = now + 0.06;
      while (this.nextBeat < now + 1.1) {
        this.playMusicBeat(this.nextBeat);
        this.nextBeat += 0.62;
      }
    }

    playMusicBeat(time) {
      const i = this.beat++;
      // soft plucked melody
      if (i % 2 === 0 || Math.random() < 0.35) {
        const freq = NOTES[(i * 3 + (i % 4)) % NOTES.length];
        this.voice(freq, time, 1.35, 0.05, "triangle", 1.1);
        this.voice(freq * 2, time + 0.02, 0.7, 0.018, "sine", 1.2);
      }
      // low pad every 8 beats
      if (i % 8 === 0) {
        const root = i % 16 === 0 ? 130.81 : 146.83;
        this.voice(root, time, 4.6, 0.032, "sine", 0.7);
        this.voice(root * 1.5, time + 0.4, 4.2, 0.018, "sine", 0.7);
      }
      // tiny bell
      if (i % 4 === 2) {
        this.voice(NOTES[(i + 3) % NOTES.length] * 2, time + 0.1, 1.2, 0.013, "sine", 1.6);
      }
    }

    voice(freq, time, dur, gain, type, filter) {
      if (!this.ctx || !this.musicGain) return;
      const o = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      const f = this.ctx.createBiquadFilter();
      o.type = type || "sine";
      o.frequency.value = freq;
      f.type = "lowpass";
      f.frequency.value = 900 * (filter || 1);
      g.gain.setValueAtTime(0, time);
      g.gain.linearRampToValueAtTime(gain, time + 0.04);
      g.gain.exponentialRampToValueAtTime(0.0001, time + dur);
      o.connect(f);
      f.connect(g);
      g.connect(this.musicGain);
      o.start(time);
      o.stop(time + dur + 0.1);
    }

    sfx(name) {
      if (!this.ctx || !this.sfxOn || this.suspended) return;
      const now = this.ctx.currentTime + 0.01;
      const beep = (freq, dur, gain, type, slide) => {
        const o = this.ctx.createOscillator();
        const g = this.ctx.createGain();
        o.type = type || "sine";
        o.frequency.setValueAtTime(freq, now);
        if (slide) o.frequency.exponentialRampToValueAtTime(slide, now + dur);
        g.gain.setValueAtTime(gain, now);
        g.gain.exponentialRampToValueAtTime(0.0001, now + dur);
        o.connect(g);
        g.connect(this.sfxGain);
        o.start(now);
        o.stop(now + dur + 0.02);
      };
      if (name === "tap") {
        beep(520, 0.09, 0.16, "triangle", 720);
        beep(1040, 0.06, 0.05, "sine", 1200);
      } else if (name === "beam") {
        beep(880, 0.16, 0.09, "sine", 1320);
      } else if (name === "bloom") {
        beep(523.25, 0.2, 0.12, "sine", 700);
        window.setTimeout(() => beep(659.25, 0.22, 0.1, "sine", 900), 70);
        window.setTimeout(() => beep(783.99, 0.26, 0.1, "sine", 1000), 140);
      } else if (name === "star") {
        beep(880, 0.3, 0.12, "sine", 1400);
        window.setTimeout(() => beep(1318.5, 0.35, 0.09, "sine", 1800), 100);
      } else if (name === "error") {
        beep(170, 0.16, 0.1, "square", 120);
      } else if (name === "ui") {
        beep(620, 0.06, 0.07, "triangle", 700);
      } else if (name === "reward") {
        [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => {
          window.setTimeout(() => beep(f, 0.22, 0.09, "sine", f * 1.2), i * 80);
        });
      }
    }

    setMusic(on) {
      this.musicOn = !!on;
      if (this.musicGain && this.ctx) {
        this.musicGain.gain.setTargetAtTime(this.musicOn ? 0.16 : 0, this.ctx.currentTime, 0.1);
      }
      if (this.musicOn) {
        this.ensure();
        this.startMusic();
      }
    }

    setSfx(on) {
      this.sfxOn = !!on;
      if (this.sfxGain && this.ctx) {
        this.sfxGain.gain.setTargetAtTime(this.sfxOn ? 0.36 : 0, this.ctx.currentTime, 0.08);
      }
    }

    suspend() {
      this.suspended = true;
      if (this.ctx && this.ctx.state === "running") {
        this.ctx.suspend().catch(() => {});
      }
    }

    resume() {
      this.suspended = false;
      if (this.ctx && this.ctx.state === "suspended") {
        this.ctx.resume().then(() => {
          this.nextBeat = this.ctx.currentTime + 0.15;
        }).catch(() => {});
      }
    }
  }

  window.GameAudio = new AudioEngine();
})();
