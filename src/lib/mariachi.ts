"use client";

/**
 * A tiny original mariachi-style tune made from scratch with the Web Audio API, so there is no
 * audio file to host or license. Trumpets play a melody in thirds over a guitarrón bass, strummed
 * guitar on the off-beats and shakers. It loops until stopped, and can finish with a sad trombone.
 */

const BPM = 132;
const BEAT = 60 / BPM;

const mtof = (m: number) => 440 * Math.pow(2, (m - 69) / 12);

// One bar is two beats. Chords: bass root, bass fifth, and the strummed voicing.
interface Chord {
  root: number;
  fifth: number;
  strum: number[];
}
const C: Chord = { root: 36, fifth: 43, strum: [60, 64, 67, 72] };
const F: Chord = { root: 41, fifth: 48, strum: [57, 60, 65, 69] };
const G7: Chord = { root: 43, fifth: 50, strum: [59, 62, 65, 67] };
const AM: Chord = { root: 45, fifth: 52, strum: [57, 60, 64, 69] };
const D7: Chord = { root: 38, fifth: 45, strum: [57, 62, 66, 69] };

const CHORDS: Chord[] = [C, C, G7, C, C, F, G7, C, C, AM, D7, G7, C, F, G7, C];

// Melody per bar as [midi note, beats]. Each bar adds up to two beats.
const MELODY: [number, number][][] = [
  [
    [76, 0.5],
    [79, 0.5],
    [84, 1],
  ],
  [
    [83, 0.5],
    [79, 0.5],
    [76, 1],
  ],
  [
    [74, 0.5],
    [77, 0.5],
    [79, 1],
  ],
  [
    [76, 1],
    [72, 1],
  ],
  [
    [76, 0.5],
    [79, 0.5],
    [84, 0.5],
    [83, 0.5],
  ],
  [
    [81, 1],
    [77, 1],
  ],
  [
    [79, 0.5],
    [77, 0.5],
    [74, 1],
  ],
  [[72, 2]],
  [
    [79, 0.5],
    [79, 0.5],
    [76, 0.5],
    [79, 0.5],
  ],
  [
    [81, 1],
    [76, 1],
  ],
  [
    [78, 0.5],
    [81, 0.5],
    [86, 1],
  ],
  [
    [83, 0.5],
    [79, 0.5],
    [74, 1],
  ],
  [
    [76, 0.5],
    [79, 0.5],
    [84, 0.5],
    [88, 0.5],
  ],
  [
    [84, 1],
    [81, 1],
  ],
  [
    [83, 0.5],
    [81, 0.5],
    [79, 1],
  ],
  [[84, 2]],
];

const SCALE = [60, 62, 64, 65, 67, 69, 71, 72, 74, 76, 77, 79, 81, 83, 84, 86, 88];

/** The note two steps below in C major, for the second trumpet. */
function thirdBelow(midi: number): number {
  let i = SCALE.length - 1;
  while (i > 0 && SCALE[i] > midi) i--;
  return SCALE[Math.max(0, i - 2)];
}

type Ctx = AudioContext;

function trumpet(ctx: Ctx, out: AudioNode, midi: number, at: number, dur: number, vol: number) {
  const freq = mtof(midi);
  const gain = ctx.createGain();
  const filter = ctx.createBiquadFilter();
  filter.type = "lowpass";
  filter.Q.value = 2.5;
  filter.frequency.setValueAtTime(freq * 1.6, at);
  filter.frequency.linearRampToValueAtTime(freq * 5, at + 0.07);
  filter.frequency.exponentialRampToValueAtTime(freq * 3, at + Math.max(dur, 0.2));

  gain.gain.setValueAtTime(0.0001, at);
  gain.gain.exponentialRampToValueAtTime(vol, at + 0.03);
  gain.gain.setValueAtTime(vol, at + 0.03); // hold, so nothing keeps extrapolating the ramp
  gain.gain.setTargetAtTime(vol * 0.72, at + 0.06, 0.08);
  // State the level where the release begins instead of relying on how each browser fills the gap.
  const releaseAt = at + dur * 0.92;
  const level = vol * 0.72 + (vol - vol * 0.72) * Math.exp(-(releaseAt - (at + 0.06)) / 0.08);
  gain.gain.setValueAtTime(level, releaseAt);
  gain.gain.setTargetAtTime(0.0001, releaseAt, 0.04);

  const vibrato = ctx.createGain();
  vibrato.gain.setValueAtTime(0, at);
  vibrato.gain.linearRampToValueAtTime(8, at + 0.3);
  const lfo = ctx.createOscillator();
  lfo.frequency.value = 5.6;
  lfo.connect(vibrato);

  for (const detune of [-7, 7]) {
    const osc = ctx.createOscillator();
    osc.type = "sawtooth";
    osc.frequency.value = freq;
    osc.detune.value = detune;
    vibrato.connect(osc.detune);
    osc.connect(filter);
    osc.start(at);
    osc.stop(at + dur + 0.25);
  }
  filter.connect(gain);
  gain.connect(out);
  lfo.start(at);
  lfo.stop(at + dur + 0.25);
}

function pluck(
  ctx: Ctx,
  out: AudioNode,
  midi: number,
  at: number,
  vol: number,
  decay: number,
  low = false,
) {
  const gain = ctx.createGain();
  const filter = ctx.createBiquadFilter();
  filter.type = "lowpass";
  filter.frequency.setValueAtTime(low ? 900 : 3200, at);
  filter.frequency.exponentialRampToValueAtTime(low ? 250 : 900, at + decay);
  gain.gain.setValueAtTime(vol, at);
  gain.gain.exponentialRampToValueAtTime(0.0001, at + decay);

  const body = ctx.createOscillator();
  body.type = low ? "sine" : "triangle";
  body.frequency.value = mtof(midi);
  const edge = ctx.createOscillator();
  edge.type = "sawtooth";
  edge.frequency.value = mtof(midi);
  const edgeGain = ctx.createGain();
  edgeGain.gain.value = low ? 0.25 : 0.5;
  body.connect(filter);
  edge.connect(edgeGain);
  edgeGain.connect(filter);
  filter.connect(gain);
  gain.connect(out);
  for (const o of [body, edge]) {
    o.start(at);
    o.stop(at + decay + 0.1);
  }
}

function shaker(ctx: Ctx, out: AudioNode, noise: AudioBuffer, at: number, vol: number) {
  const src = ctx.createBufferSource();
  src.buffer = noise;
  const filter = ctx.createBiquadFilter();
  filter.type = "highpass";
  filter.frequency.value = 6000;
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0.0001, at);
  gain.gain.linearRampToValueAtTime(vol, at + 0.008);
  gain.gain.setValueAtTime(vol, at + 0.008);
  gain.gain.exponentialRampToValueAtTime(0.0001, at + 0.07);
  src.connect(filter);
  filter.connect(gain);
  gain.connect(out);
  src.start(at);
  src.stop(at + 0.1);
}

/** The classic descending "wah wah waaah". */
function sadTrombone(ctx: Ctx, out: AudioNode, at: number) {
  const notes: [number, number, number][] = [
    [233, 0.42, 0.5],
    [220, 0.42, 0.5],
    [196, 1.1, 0.9],
  ];
  let t = at;
  for (const [freq, dur, hold] of notes) {
    const osc = ctx.createOscillator();
    osc.type = "sawtooth";
    osc.frequency.setValueAtTime(freq, t);
    osc.frequency.linearRampToValueAtTime(freq * 0.9, t + dur);
    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.Q.value = 4;
    filter.frequency.setValueAtTime(400, t);
    filter.frequency.linearRampToValueAtTime(1400, t + 0.12);
    filter.frequency.linearRampToValueAtTime(500, t + dur);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(0.38, t + 0.05);
    gain.gain.setValueAtTime(0.38, t + 0.05); // hold, so nothing keeps extrapolating the ramp
    gain.gain.setValueAtTime(0.38, t + hold); // state the level where the release begins
    gain.gain.setTargetAtTime(0.0001, t + hold, 0.08);
    osc.connect(filter);
    filter.connect(gain);
    gain.connect(out);
    osc.start(t);
    osc.stop(t + dur + 0.3);
    t += dur + 0.06;
  }
}

export interface Mariachi {
  setMuted: (muted: boolean) => void;
  /** Ends the music. With `funny`, finishes with a sad trombone. */
  stop: (funny?: boolean) => void;
}

/** Starts the tune. Call it from a click or key press so the browser allows sound. */
export function startMariachi(): Mariachi | null {
  const AudioCtor =
    window.AudioContext ??
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AudioCtor) return null;

  const ctx = new AudioCtor();
  void ctx.resume();

  const master = ctx.createGain();
  master.gain.value = 0.55;
  const compressor = ctx.createDynamicsCompressor();
  master.connect(compressor);
  compressor.connect(ctx.destination);

  const noise = ctx.createBuffer(1, Math.floor(ctx.sampleRate * 0.12), ctx.sampleRate);
  const data = noise.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;

  // A short fanfare, then the tune starts on the downbeat after it.
  const start = ctx.currentTime + 0.1;
  for (const [midi, offset, dur] of [
    [79, 0, 0.16],
    [79, 0.2, 0.16],
    [84, 0.4, 0.2],
    [88, 0.7, 0.6],
  ] as const) {
    trumpet(ctx, master, midi, start + offset, dur, 0.13);
    trumpet(ctx, master, midi - 4, start + offset, dur, 0.1);
  }

  let nextBar = start + 1.5;
  let bar = 0;
  const scheduleBar = (at: number, index: number) => {
    const chord = CHORDS[index % CHORDS.length];
    // Bass on the beats, chords and shakers on the off-beats: the oom-pah.
    pluck(ctx, master, chord.root, at, 0.34, 0.32, true);
    pluck(ctx, master, chord.fifth, at + BEAT, 0.3, 0.3, true);
    for (const off of [0.5, 1.5]) {
      chord.strum.forEach((note, n) =>
        pluck(ctx, master, note, at + off * BEAT + n * 0.012, 0.075, 0.16),
      );
    }
    for (let s = 0; s < 4; s++)
      shaker(ctx, master, noise, at + s * 0.5 * BEAT, s % 2 ? 0.05 : 0.09);

    let beat = 0;
    for (const [midi, beats] of MELODY[index % MELODY.length]) {
      const when = at + beat * BEAT;
      const dur = beats * BEAT * 0.94;
      trumpet(ctx, master, midi, when, dur, 0.1);
      trumpet(ctx, master, thirdBelow(midi), when, dur, 0.075);
      beat += beats;
    }
  };

  // Schedules a little ahead of the clock, so the loop never gaps or stutters.
  const timer = setInterval(() => {
    while (nextBar < ctx.currentTime + 0.6) {
      scheduleBar(nextBar, bar++);
      nextBar += 2 * BEAT;
    }
  }, 60);

  let stopped = false;
  return {
    setMuted(muted) {
      master.gain.setTargetAtTime(muted ? 0.0001 : 0.55, ctx.currentTime, 0.05);
    },
    stop(funny = false) {
      if (stopped) return;
      stopped = true;
      clearInterval(timer);
      const now = ctx.currentTime;
      master.gain.cancelScheduledValues(now);
      master.gain.setValueAtTime(master.gain.value, now);
      if (funny) {
        master.gain.setTargetAtTime(0.0001, now, 0.15);
        const out = ctx.createGain();
        out.gain.value = 0.5;
        out.connect(compressor);
        sadTrombone(ctx, out, now + 0.25);
        setTimeout(() => void ctx.close(), 3200);
      } else {
        master.gain.setTargetAtTime(0.0001, now, 0.1);
        setTimeout(() => void ctx.close(), 600);
      }
    },
  };
}
