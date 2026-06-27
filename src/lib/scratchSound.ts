"use client";

/**
 * Tiny Web-Audio sound bank for the Scratch-like studio — every sound is
 * synthesized on the fly, so there are zero audio files to ship. Returns the
 * approximate duration (seconds) so "play until done" can await it.
 */

let ctx: AudioContext | null = null;
function ac(): AudioContext {
  if (!ctx) {
    const Ctor = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    ctx = new Ctor();
  }
  return ctx;
}

export const SOUND_NAMES = ["pop", "beep", "meow", "laser", "drum", "chime", "zap"] as const;

export function playSound(name: string): number {
  let a: AudioContext;
  try {
    a = ac();
  } catch {
    return 0.15;
  }
  if (a.state === "suspended") a.resume().catch(() => {});
  const now = a.currentTime;
  const master = a.createGain();
  master.gain.value = 0.2;
  master.connect(a.destination);

  const tone = (freq: number, start: number, dur: number, type: OscillatorType = "sine", vol = 1) => {
    const o = a.createOscillator();
    const g = a.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, now + start);
    g.gain.setValueAtTime(0.0001, now + start);
    g.gain.linearRampToValueAtTime(vol, now + start + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0008, now + start + dur);
    o.connect(g);
    g.connect(master);
    o.start(now + start);
    o.stop(now + start + dur + 0.03);
  };
  const sweep = (f0: number, f1: number, dur: number, type: OscillatorType, vol = 0.5) => {
    const o = a.createOscillator();
    const g = a.createGain();
    o.type = type;
    o.frequency.setValueAtTime(f0, now);
    o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), now + dur);
    g.gain.setValueAtTime(vol, now);
    g.gain.exponentialRampToValueAtTime(0.0008, now + dur);
    o.connect(g);
    g.connect(master);
    o.start(now);
    o.stop(now + dur + 0.03);
  };

  switch (name) {
    case "pop":
      tone(440, 0, 0.12, "sine");
      return 0.15;
    case "beep":
      tone(680, 0, 0.18, "square", 0.55);
      return 0.2;
    case "meow":
      sweep(640, 360, 0.4, "sawtooth", 0.25);
      return 0.42;
    case "laser":
      sweep(960, 120, 0.25, "square", 0.2);
      return 0.28;
    case "zap":
      sweep(140, 1200, 0.18, "sawtooth", 0.2);
      return 0.2;
    case "chime":
      tone(880, 0, 0.45, "sine", 0.5);
      tone(1320, 0.08, 0.5, "sine", 0.4);
      return 0.5;
    case "drum": {
      const len = Math.floor(a.sampleRate * 0.18);
      const buf = a.createBuffer(1, len, a.sampleRate);
      const d = buf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2);
      const src = a.createBufferSource();
      src.buffer = buf;
      const g = a.createGain();
      g.gain.value = 0.5;
      src.connect(g);
      g.connect(master);
      src.start(now);
      return 0.2;
    }
    default:
      tone(440, 0, 0.15);
      return 0.18;
  }
}
