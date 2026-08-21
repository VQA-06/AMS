/**
 * Audio and Haptic feedback helper with loud resonant chimes and mobile browser autoplay unlocker
 */
class FeedbackManager {
  private audioCtx: AudioContext | null = null;
  private isUnlocked: boolean = false;

  constructor() {
    this.setupUnlocker();
  }

  /**
   * Mobile browsers require an initial user gesture (tap/click) to unlock Web Audio.
   */
  private setupUnlocker(): void {
    if (typeof window === 'undefined') return;

    const unlock = () => {
      if (this.isUnlocked) return;
      try {
        const ctx = this.getAudioContext();
        if (ctx) {
          if (ctx.state === 'suspended') {
            ctx.resume();
          }
          // Play 1ms silent buffer to fully unlock audio channel on iOS/Android
          const buffer = ctx.createBuffer(1, 1, 22050);
          const source = ctx.createBufferSource();
          source.buffer = buffer;
          source.connect(ctx.destination);
          source.start(0);
          this.isUnlocked = true;
        }
      } catch {
        // ignore
      }
    };

    ['touchstart', 'touchend', 'click', 'pointerdown'].forEach((evt) => {
      window.addEventListener(evt, unlock, { once: true, passive: true });
    });
  }

  private getAudioContext(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    if (!this.audioCtx) {
      const AudioContextClass =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioContextClass) {
        this.audioCtx = new AudioContextClass();
      }
    }
    if (this.audioCtx && this.audioCtx.state === 'suspended') {
      this.audioCtx.resume();
    }
    return this.audioCtx;
  }

  /**
   * Play loud, punchy high-pitch double chime for successful scan + firm double haptic pulse
   */
  playSuccess(): void {
    // Haptic Vibrate (Punchy double pulse on mobile phones)
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      try {
        navigator.vibrate([100, 50, 100]);
      } catch {
        // ignore
      }
    }

    // Loud High-Resonance Barcode Scanner Chime
    try {
      const ctx = this.getAudioContext();
      if (!ctx) return;

      if (ctx.state === 'suspended') {
        ctx.resume();
      }

      const now = ctx.currentTime;

      // Note 1 (1760 Hz - A6) with Triangle wave for loud speaker resonance
      const osc1 = ctx.createOscillator();
      const gain1 = ctx.createGain();
      osc1.type = 'triangle';
      osc1.frequency.setValueAtTime(1760, now);
      gain1.gain.setValueAtTime(0.85, now);
      gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
      osc1.connect(gain1);
      gain1.connect(ctx.destination);
      osc1.start(now);
      osc1.stop(now + 0.12);
      osc1.onended = () => {
        try {
          osc1.disconnect();
          gain1.disconnect();
        } catch {
          // ignore
        }
      };

      // Note 2 (2637 Hz - E7) loud high chime
      const osc2 = ctx.createOscillator();
      const gain2 = ctx.createGain();
      osc2.type = 'triangle';
      osc2.frequency.setValueAtTime(2637, now + 0.08);
      gain2.gain.setValueAtTime(0.9, now + 0.08);
      gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.26);
      osc2.connect(gain2);
      gain2.connect(ctx.destination);
      osc2.start(now + 0.08);
      osc2.stop(now + 0.26);
      osc2.onended = () => {
        try {
          osc2.disconnect();
          gain2.disconnect();
        } catch {
          // ignore
        }
      };
    } catch {
      // Audio playback failed
    }
  }

  /**
   * Play loud descending buzz for failed scan + error haptic pattern
   */
  playError(): void {
    // Haptic Vibrate (long double error buzz)
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      try {
        navigator.vibrate([180, 80, 220]);
      } catch {
        // ignore
      }
    }

    // Web Audio Loud Sawtooth Buzz
    try {
      const ctx = this.getAudioContext();
      if (!ctx) return;

      if (ctx.state === 'suspended') {
        ctx.resume();
      }

      const now = ctx.currentTime;

      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(220, now);
      osc.frequency.linearRampToValueAtTime(110, now + 0.28);
      gain.gain.setValueAtTime(0.8, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.28);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.28);
      osc.onended = () => {
        try {
          osc.disconnect();
          gain.disconnect();
        } catch {
          // ignore
        }
      };
    } catch {
      // ignore
    }
  }
}

export const feedback = new FeedbackManager();
