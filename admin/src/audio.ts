type CatSoundKind = "soft" | "happy" | "surprised";

type OscillatorShape = OscillatorType;

function createNoiseBuffer(context: AudioContext, seconds: number) {
  const length = Math.max(1, Math.floor(context.sampleRate * seconds));
  const buffer = context.createBuffer(1, length, context.sampleRate);
  const channel = buffer.getChannelData(0);

  for (let index = 0; index < length; index += 1) {
    channel[index] = (Math.random() * 2 - 1) * 0.22;
  }

  return buffer;
}

export class CatAudioEngine {
  private context: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private noiseBuffer: AudioBuffer | null = null;
  async ensureReady() {
    if (!this.context) {
      const AudioCtor = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtor) {
        throw new Error("当前浏览器不支持 Web Audio。");
      }

      this.context = new AudioCtor();
      this.masterGain = this.context.createGain();
      this.masterGain.gain.value = 0.7;
      this.masterGain.connect(this.context.destination);
      this.noiseBuffer = createNoiseBuffer(this.context, 1.4);
    }

    if (this.context.state === "suspended") {
      await this.context.resume();
    }

    return this.context;
  }

  private getOutput() {
    if (!this.context || !this.masterGain) {
      throw new Error("音频上下文尚未初始化。");
    }

    return {
      context: this.context,
      masterGain: this.masterGain,
    };
  }

  private scheduleVoice(now: number, options: { start: number; peak: number; end: number; duration: number; gain: number; type: OscillatorShape; detune?: number; }) {
    const { context, masterGain } = this.getOutput();
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    const filter = context.createBiquadFilter();

    oscillator.type = options.type;
    oscillator.frequency.setValueAtTime(options.start, now);
    oscillator.frequency.exponentialRampToValueAtTime(options.peak, now + options.duration * 0.28);
    oscillator.frequency.exponentialRampToValueAtTime(options.end, now + options.duration);
    oscillator.detune.value = options.detune ?? 0;

    filter.type = "lowpass";
    filter.frequency.setValueAtTime(2400, now);
    filter.frequency.exponentialRampToValueAtTime(1200, now + options.duration);

    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(options.gain, now + options.duration * 0.2);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + options.duration);

    oscillator.connect(filter);
    filter.connect(gain);
    gain.connect(masterGain);

    oscillator.start(now);
    oscillator.stop(now + options.duration + 0.02);
  }

  async playMeow(kind: CatSoundKind) {
    const context = await this.ensureReady();
    const now = context.currentTime + 0.01;

    if (kind === "soft") {
      this.scheduleVoice(now, {
        start: 420,
        peak: 700,
        end: 240,
        duration: 0.34,
        gain: 0.06,
        type: "triangle",
      });
      this.scheduleVoice(now + 0.018, {
        start: 820,
        peak: 1060,
        end: 460,
        duration: 0.24,
        gain: 0.025,
        type: "sine",
      });
      return;
    }

    if (kind === "happy") {
      this.scheduleVoice(now, {
        start: 520,
        peak: 880,
        end: 260,
        duration: 0.38,
        gain: 0.08,
        type: "triangle",
      });
      this.scheduleVoice(now + 0.03, {
        start: 940,
        peak: 1320,
        end: 540,
        duration: 0.28,
        gain: 0.034,
        type: "sine",
      });
      return;
    }

    this.scheduleVoice(now, {
      start: 640,
      peak: 1180,
      end: 310,
      duration: 0.26,
      gain: 0.085,
      type: "square",
      detune: 40,
    });
    this.scheduleVoice(now + 0.012, {
      start: 1280,
      peak: 1760,
      end: 620,
      duration: 0.21,
      gain: 0.03,
      type: "triangle",
    });
  }

  async playPurr(seconds = 0.7) {
    const context = await this.ensureReady();
    const { masterGain } = this.getOutput();
    const now = context.currentTime + 0.01;
    const duration = Math.max(0.35, seconds);
    const carrier = context.createOscillator();
    const rumble = context.createOscillator();
    const modulator = context.createOscillator();
    const modGain = context.createGain();
    const filter = context.createBiquadFilter();
    const gain = context.createGain();

    carrier.type = "sawtooth";
    carrier.frequency.setValueAtTime(96, now);
    rumble.type = "triangle";
    rumble.frequency.setValueAtTime(52, now);
    modulator.type = "sine";
    modulator.frequency.setValueAtTime(24, now);
    modGain.gain.value = 0.32;
    modulator.connect(modGain);
    modGain.connect(gain.gain);

    filter.type = "lowpass";
    filter.frequency.setValueAtTime(520, now);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.07, now + 0.08);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);

    carrier.connect(filter);
    rumble.connect(filter);
    filter.connect(gain);
    gain.connect(masterGain);

    carrier.start(now);
    rumble.start(now);
    modulator.start(now);
    carrier.stop(now + duration + 0.02);
    rumble.stop(now + duration + 0.02);
    modulator.stop(now + duration + 0.02);
  }

  async playMunch() {
    const context = await this.ensureReady();
    const { masterGain } = this.getOutput();
    const now = context.currentTime + 0.01;

    for (let bite = 0; bite < 3; bite += 1) {
      const start = now + bite * 0.08;
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      oscillator.type = "triangle";
      oscillator.frequency.setValueAtTime(420 + bite * 38, start);
      oscillator.frequency.exponentialRampToValueAtTime(220, start + 0.07);
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(0.045, start + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.08);
      oscillator.connect(gain);
      gain.connect(masterGain);
      oscillator.start(start);
      oscillator.stop(start + 0.1);
    }
  }

  async playChime() {
    const context = await this.ensureReady();
    const { masterGain } = this.getOutput();
    const now = context.currentTime + 0.01;
    const notes = [660, 880, 1120];

    notes.forEach((frequency, index) => {
      const start = now + index * 0.06;
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      oscillator.type = "sine";
      oscillator.frequency.setValueAtTime(frequency, start);
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(0.04, start + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.26);
      oscillator.connect(gain);
      gain.connect(masterGain);
      oscillator.start(start);
      oscillator.stop(start + 0.28);
    });
  }

  async playSwipe() {
    const context = await this.ensureReady();
    const { masterGain } = this.getOutput();
    const now = context.currentTime + 0.01;
    const source = context.createBufferSource();
    const gain = context.createGain();
    const filter = context.createBiquadFilter();

    source.buffer = this.noiseBuffer;
    filter.type = "bandpass";
    filter.frequency.setValueAtTime(900, now);
    filter.Q.value = 0.8;
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.032, now + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.14);

    source.connect(filter);
    filter.connect(gain);
    gain.connect(masterGain);

    source.start(now);
    source.stop(now + 0.16);
  }

  dispose() {
    return;
  }
}
