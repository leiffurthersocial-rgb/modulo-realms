/**
 * All audio is synthesised at runtime with the Web Audio API — no sample files,
 * no licensing questions, and every cue can be retuned from the tables below.
 */

export type MusicTrack = 'title' | 'village' | 'world' | 'forest' | 'north' | 'desert' | 'dungeon' | 'boss' | 'aegean' | 'polis' | 'storm' | 'underworld' | 'phalanx' | 'oath' | 'grove' | 'oracle' | 'seafarer' | 'lacedaemon';

interface TrackDef {
  /** Semitone offsets from the root, cycled as a chord progression. */
  chords: number[][];
  root: number;
  bpm: number;
  /** Lead synth waveform. */
  lead: OscillatorType;
  pad: OscillatorType;
  leadGain: number;
  padGain: number;
  /** Melody note pool as scale degrees. */
  scale: number[];
  drums: boolean;
  swing: number;
  /** Authored eight-note phrases; null is a rest. Old-world tracks keep their original improvisation. */
  phrases?: Array<Array<number | null>>;
  percussion?: 'frame' | 'oar' | 'march' | 'tempest';
  ambience?: 'surf' | 'wind' | 'embers' | 'shadows';
}

const TRACKS: Record<MusicTrack, TrackDef> = {
  aegean: { chords:[[0,7,12],[-2,5,10],[3,7,12],[0,5,7]],root:57,bpm:82,lead:'triangle',pad:'sine',leadGain:.085,padGain:.055,scale:[0,2,3,5,7,9,10,12],drums:false,swing:.14,
    phrases:[[0,null,7,9,7,null,3,2],[0,2,5,null,7,null,5,null],[3,null,7,10,9,7,3,null],[2,3,5,null,2,null,0,null]] },
  polis: { chords:[[0,4,7],[5,9,12],[-2,5,9],[0,7,12]],root:62,bpm:108,lead:'triangle',pad:'sine',leadGain:.08,padGain:.05,scale:[0,2,4,7,9,12],drums:true,swing:.18,
    phrases:[[0,4,7,null,9,7,4,null],[5,9,12,9,7,null,5,null],[2,5,9,null,7,5,2,null],[4,2,0,null,7,null,0,null]],percussion:'frame' },
  grove: { chords:[[0,3,7],[-2,3,8],[0,5,9],[-5,2,7]],root:57,bpm:70,lead:'sine',pad:'triangle',leadGain:.07,padGain:.052,scale:[0,2,3,5,7,9,10],drums:false,swing:.12,
    phrases:[[7,null,10,9,null,7,3,null],[5,null,3,null,2,3,5,null],[9,7,null,5,3,null,2,null],[2,null,0,null,null,7,0,null]],ambience:'wind' },
  oracle: { chords:[[0,5,7],[-2,3,8],[1,5,8],[0,7,12]],root:55,bpm:62,lead:'sine',pad:'sine',leadGain:.065,padGain:.064,scale:[0,1,3,5,7,8,10],drums:false,swing:.04,
    phrases:[[12,null,7,null,5,3,null,null],[10,null,8,7,null,3,null,null],[8,null,5,null,1,3,null,null],[7,null,5,3,1,null,0,null]],ambience:'wind' },
  seafarer: { chords:[[0,7,12],[5,9,12],[-2,5,10],[0,4,7]],root:59,bpm:88,lead:'triangle',pad:'sine',leadGain:.076,padGain:.05,scale:[0,2,4,5,7,9,10],drums:true,swing:.1,
    phrases:[[7,null,9,7,4,null,2,null],[5,9,null,12,9,null,7,null],[5,null,10,9,7,5,2,null],[4,7,9,null,7,null,0,null]],percussion:'oar',ambience:'surf' },
  lacedaemon: { chords:[[0,7,12],[-2,5,10],[0,3,7],[-5,2,7]],root:47,bpm:92,lead:'triangle',pad:'sine',leadGain:.067,padGain:.055,scale:[0,2,3,5,7,10,12],drums:true,swing:0,
    phrases:[[0,null,7,null,7,5,3,null],[2,null,5,null,10,7,5,null],[3,2,0,null,7,null,3,null],[2,null,5,3,2,null,0,null]],percussion:'march' },
  storm: { chords:[[0,1,7],[-5,0,6],[-2,3,7],[1,6,8]],root:43,bpm:114,lead:'sine',pad:'sawtooth',leadGain:.06,padGain:.043,scale:[0,1,3,6,7,10,12],drums:true,swing:0,
    phrases:[[0,1,null,7,6,null,3,1],[0,null,6,7,6,3,null,0],[10,7,6,null,3,1,0,null],[1,6,8,7,6,null,1,null]],percussion:'tempest',ambience:'surf' },
  underworld: { chords:[[0,3,8],[-1,4,7],[-5,0,6],[0,1,7]],root:40,bpm:54,lead:'sine',pad:'triangle',leadGain:.045,padGain:.055,scale:[0,1,3,5,6,8,11],drums:false,swing:.04,
    phrases:[[12,null,null,8,null,3,null,null],[11,null,7,null,null,4,null,null],[6,null,null,5,3,null,null,null],[1,null,7,null,1,null,0,null]],ambience:'shadows' },
  phalanx: { chords:[[0,7,12],[0,5,10],[-2,5,10],[0,3,7]],root:45,bpm:120,lead:'square',pad:'triangle',leadGain:.042,padGain:.047,scale:[0,3,5,7,10,12],drums:true,swing:0,
    phrases:[[0,0,7,null,0,0,7,null],[5,5,10,null,7,5,0,null],[3,3,5,7,10,null,7,null],[7,5,3,null,0,0,0,null]],percussion:'march' },
  oath: { chords:[[0,7,12],[1,5,8],[-5,0,7],[-1,3,6]],root:38,bpm:126,lead:'sawtooth',pad:'sine',leadGain:.039,padGain:.059,scale:[0,1,3,5,7,8,11,12],drums:true,swing:0,
    phrases:[[0,null,7,12,11,7,3,null],[1,5,8,null,7,5,1,null],[0,0,7,null,12,11,7,null],[3,1,6,5,3,1,0,null]],percussion:'march',ambience:'embers' },
  title: { chords: [[0, 7, 12], [-3, 4, 9], [-5, 2, 7], [-1, 4, 11]], root: 55, bpm: 64, lead: 'triangle', pad: 'sine', leadGain: 0.1, padGain: 0.09, scale: [0, 2, 3, 5, 7, 10, 12], drums: false, swing: 0.1 },
  village: { chords: [[0, 4, 7], [5, 9, 12], [7, 11, 14], [0, 4, 7]], root: 62, bpm: 96, lead: 'triangle', pad: 'sine', leadGain: 0.1, padGain: 0.06, scale: [0, 2, 4, 7, 9, 12], drums: false, swing: 0.16 },
  world: { chords: [[0, 4, 7], [-3, 2, 5], [-5, 0, 4], [2, 5, 9]], root: 58, bpm: 84, lead: 'triangle', pad: 'sine', leadGain: 0.085, padGain: 0.08, scale: [0, 2, 4, 5, 7, 9, 11], drums: false, swing: 0.12 },
  forest: { chords: [[0, 3, 7], [-2, 3, 8], [-4, 0, 7], [-5, 2, 7]], root: 57, bpm: 74, lead: 'sine', pad: 'triangle', leadGain: 0.08, padGain: 0.08, scale: [0, 2, 3, 5, 7, 9, 10], drums: false, swing: 0.2 },
  north: { chords: [[0, 3, 7], [-5, 0, 3], [-3, 2, 7], [-7, -3, 2]], root: 53, bpm: 62, lead: 'sine', pad: 'sawtooth', leadGain: 0.07, padGain: 0.05, scale: [0, 2, 3, 5, 7, 8, 10], drums: false, swing: 0.05 },
  desert: { chords: [[0, 1, 7], [-2, 3, 8], [0, 5, 7], [-4, 1, 6]], root: 59, bpm: 88, lead: 'square', pad: 'sine', leadGain: 0.055, padGain: 0.06, scale: [0, 1, 4, 5, 7, 8, 11], drums: true, swing: 0.18 },
  dungeon: { chords: [[0, 3, 6], [-2, 1, 8], [-5, 0, 3], [-1, 2, 6]], root: 45, bpm: 68, lead: 'sine', pad: 'sawtooth', leadGain: 0.05, padGain: 0.055, scale: [0, 1, 3, 5, 6, 8, 10], drums: true, swing: 0 },
  boss: { chords: [[0, 3, 7], [1, 5, 8], [-2, 3, 6], [0, 4, 7]], root: 41, bpm: 132, lead: 'sawtooth', pad: 'square', leadGain: 0.06, padGain: 0.05, scale: [0, 1, 3, 5, 6, 8, 10], drums: true, swing: 0 },
};

/** Greek places use related, individually composed themes; old-region routing is untouched. */
export function aegeanMusicForRegion(region: string, town = false): MusicTrack | undefined {
  if (!region.startsWith('aegean_')) return;
  if (town) return region === 'aegean_sparta' ? 'lacedaemon' : 'polis';
  return ({
    aegean_threshold: 'aegean', aegean_rivers: 'aegean',
    aegean_arcadia: 'grove', aegean_lerna: 'grove',
    aegean_delphi: 'oracle', aegean_olympus: 'oracle',
    aegean_coast: 'seafarer', aegean_cyclades: 'seafarer',
    aegean_sparta: 'lacedaemon', aegean_ash: 'underworld',
    aegean_pelagic: 'storm', aegean_asterion: 'oath',
  } as Record<string, MusicTrack>)[region] ?? 'aegean';
}

const midi = (n: number) => 440 * Math.pow(2, (n - 69) / 12);

export class AudioManager {
  ctx: AudioContext | null = null;
  master!: GainNode;
  musicGain!: GainNode;
  sfxGain!: GainNode;
  private noiseBuffer: AudioBuffer | null = null;

  masterVolume = 0.8;
  musicVolume = 0.42;
  sfxVolume = 0.65;
  muted = false;

  private track: MusicTrack | null = null;
  private timer: number | null = null;
  private step = 0;
  private nextTime = 0;
  private started = false;

  init(): void {
    if (this.ctx) return;
    const Ctor = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return;
    this.ctx = new Ctor();
    this.master = this.ctx.createGain();
    this.master.gain.value = this.muted ? 0 : this.masterVolume;
    this.master.connect(this.ctx.destination);
    this.musicGain = this.ctx.createGain();
    this.musicGain.gain.value = this.musicVolume;
    this.musicGain.connect(this.master);
    this.sfxGain = this.ctx.createGain();
    this.sfxGain.gain.value = this.sfxVolume;
    this.sfxGain.connect(this.master);

    const len = this.ctx.sampleRate * 1.2;
    this.noiseBuffer = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const data = this.noiseBuffer.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
  }

  resume(): void {
    this.init();
    if (this.ctx?.state === 'suspended') void this.ctx.resume();
    if (!this.started && this.track) this.startLoop();
  }

  setVolumes(master: number, music: number, sfx: number): void {
    this.masterVolume = master;
    this.musicVolume = music;
    this.sfxVolume = sfx;
    if (!this.ctx) return;
    this.master.gain.value = this.muted ? 0 : master;
    this.musicGain.gain.value = music;
    this.sfxGain.gain.value = sfx;
  }

  setMuted(m: boolean): void {
    this.muted = m;
    if (this.ctx) this.master.gain.value = m ? 0 : this.masterVolume;
  }

  playMusic(track: MusicTrack): void {
    if (this.track === track) return;
    this.track = track;
    this.step = 0;
    this.init();
    if (!this.ctx) return;
    this.nextTime = this.ctx.currentTime + 0.1;
    if (!this.started) this.startLoop();
  }

  stopMusic(): void {
    this.track = null;
    if (this.timer !== null) {
      window.clearInterval(this.timer);
      this.timer = null;
      this.started = false;
    }
  }

  private startLoop(): void {
    if (!this.ctx || this.timer !== null) return;
    this.started = true;
    this.nextTime = this.ctx.currentTime + 0.1;
    this.timer = window.setInterval(() => this.schedule(), 90);
  }

  private schedule(): void {
    if (!this.ctx || !this.track) return;
    const def = TRACKS[this.track];
    const beat = 60 / def.bpm / 2;
    while (this.nextTime < this.ctx.currentTime + 0.6) {
      this.playStep(def, this.step, this.nextTime);
      this.nextTime += beat;
      this.step++;
    }
  }

  private playStep(def: TrackDef, step: number, when: number): void {
    const bar = Math.floor(step / 8) % def.chords.length;
    const chord = def.chords[bar];
    const inBar = step % 8;

    // pad chord on the downbeat
    if (inBar === 0) {
      for (const semi of chord) {
        this.tone(def.pad, midi(def.root + semi), when, 8 * (60 / def.bpm / 2) * 0.98, def.padGain, this.musicGain, 0.4);
      }
    }
    // bass
    if (inBar % 4 === 0) {
      this.tone('triangle', midi(def.root + chord[0] - 12), when, 0.42, def.padGain * 1.5, this.musicGain, 0.02);
    }
    // melody
    const melodyChance = def.drums ? 0.45 : 0.55;
    if (def.phrases) {
      const phrase = def.phrases[Math.floor(step / 8) % def.phrases.length];
      const semi = phrase[inBar];
      if (semi !== null && semi !== undefined) {
        const jitter = def.swing * (inBar % 2) * (60 / def.bpm / 2);
        const sustained = phrase[(inBar + 1) % 8] === null;
        this.tone(def.lead, midi(def.root + 12 + semi), when + jitter,
          (60 / def.bpm / 2) * (sustained ? 1.65 : .8), def.leadGain * (inBar % 2 ? .82 : 1), this.musicGain, .018);
      }
      // Sparse filtered air gives each setting room; one finite voice every
      // four bars, with no additional timers or downloaded audio buffers.
      if (step % 32 === 0 && def.ambience) {
        const [duration, gain, filter] = def.ambience === 'surf' ? [2.6,.023,420]
          : def.ambience === 'wind' ? [2.2,.012,1600]
          : def.ambience === 'embers' ? [1.8,.016,800] : [3,.017,220];
        this.noise(when, duration, gain, filter, 'lowpass');
      }
    } else if ((inBar % 2 === 0 || Math.random() < 0.28) && Math.random() < melodyChance) {
      const deg = def.scale[Math.floor(Math.random() * def.scale.length)];
      const octave = Math.random() < 0.3 ? 12 : 0;
      const jitter = def.swing * (inBar % 2) * (60 / def.bpm / 2);
      this.tone(def.lead, midi(def.root + 12 + deg + octave), when + jitter, 0.26, def.leadGain, this.musicGain, 0.01);
    }
    // percussion
    if (def.percussion) {
      if (inBar === 0 || inBar === 4) {
        this.tone('sine', def.percussion === 'march' ? 78 : 105, when, .19, .045, this.musicGain, .008);
        this.noise(when, .08, .045, 320, 'lowpass');
      }
      if (def.percussion === 'frame' && (inBar === 3 || inBar === 6)) this.noise(when, .055, .026, 1900, 'bandpass');
      if (def.percussion === 'oar' && (inBar === 2 || inBar === 6)) this.noise(when, .19, .019, 700, 'lowpass');
      if (def.percussion === 'march' && (inBar === 2 || inBar === 6 || inBar === 7)) this.noise(when, .065, .032, 1350, 'bandpass');
      if (def.percussion === 'tempest' && (inBar === 1 || inBar === 3 || inBar === 6)) this.noise(when, .17, .035, 480, 'lowpass');
    } else if (def.drums) {
      if (inBar === 0 || inBar === 4) this.noise(when, 0.14, 0.09, 180, 'lowpass');
      if (inBar === 2 || inBar === 6) this.noise(when, 0.07, 0.045, 5000, 'highpass');
    }
  }

  private tone(type: OscillatorType, freq: number, when: number, dur: number, gain: number, dest: AudioNode, attack = 0.01): void {
    const ctx = this.ctx!;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    g.gain.setValueAtTime(0.0001, when);
    g.gain.linearRampToValueAtTime(gain, when + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, when + dur);
    osc.connect(g);
    g.connect(dest);
    osc.start(when);
    osc.stop(when + dur + 0.05);
  }

  private noise(when: number, dur: number, gain: number, freq: number, type: BiquadFilterType, dest?: AudioNode): void {
    const ctx = this.ctx!;
    if (!this.noiseBuffer) return;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    const filter = ctx.createBiquadFilter();
    filter.type = type;
    filter.frequency.value = freq;
    const g = ctx.createGain();
    g.gain.setValueAtTime(gain, when);
    g.gain.exponentialRampToValueAtTime(0.0001, when + dur);
    src.connect(filter);
    filter.connect(g);
    g.connect(dest ?? this.musicGain);
    src.start(when);
    src.stop(when + dur + 0.02);
  }

  /** One-shot sound effects, all synthesised. */
  play(name: string, volume = 1): void {
    if (!this.ctx) return;
    const ctx = this.ctx;
    const t = ctx.currentTime;
    const out = this.sfxGain;
    const v = volume;
    switch (name) {
      case 'ship_oar':
        this.noise(t, .22, .06 * v, 560, 'lowpass', out);
        this.tone('triangle', 130, t, .08, .022 * v, out);
        break;
      case 'ship_ram':
        this.noise(t, .28, .19 * v, 430, 'lowpass', out);
        this.tone('triangle', 90, t, .27, .12 * v, out);
        this.tone('sine', 186, t + .035, .35, .035 * v, out);
        break;
      case 'ship_dock':
        this.noise(t, .2, .08 * v, 320, 'lowpass', out);
        this.tone('triangle', 210, t + .08, .16, .045 * v, out);
        break;
      case 'storm_thunder':
        this.noise(t, .85, .2 * v, 300, 'lowpass', out);
        this.noise(t + .13, .6, .08 * v, 680, 'lowpass', out);
        break;
      case 'bronze_gate':
      case 'oath_bell':
        [196, 392, 529].forEach((f, i) => this.tone('sine', f, t, 1.05 - i * .16, (.09 - i * .024) * v, out, .008));
        break;
      case 'phalanx_horn':
        [147, 196, 220].forEach((f, i) => this.tone('triangle', f, t + i * .22, .45, .075 * v, out, .06));
        break;
      case 'swing':
        this.noise(t, 0.13, 0.16 * v, 1400, 'bandpass', out);
        break;
      case 'hit':
        this.noise(t, 0.09, 0.22 * v, 900, 'lowpass', out);
        this.tone('square', 150, t, 0.09, 0.09 * v, out);
        break;
      case 'crit':
        this.noise(t, 0.12, 0.26 * v, 1800, 'bandpass', out);
        this.tone('sawtooth', 320, t, 0.14, 0.12 * v, out);
        this.tone('sawtooth', 480, t + 0.03, 0.12, 0.1 * v, out);
        break;
      case 'hurt':
        this.tone('sawtooth', 190, t, 0.2, 0.14 * v, out);
        this.tone('sawtooth', 120, t + 0.04, 0.22, 0.11 * v, out);
        break;
      case 'shoot':
        this.tone('triangle', 720, t, 0.11, 0.09 * v, out);
        this.noise(t, 0.07, 0.07 * v, 2600, 'highpass', out);
        break;
      case 'cast':
        this.tone('sine', 480, t, 0.26, 0.11 * v, out);
        this.tone('sine', 720, t + 0.05, 0.26, 0.08 * v, out);
        break;
      case 'die':
        this.tone('square', 220, t, 0.3, 0.12 * v, out);
        this.tone('square', 110, t + 0.08, 0.36, 0.1 * v, out);
        this.noise(t, 0.3, 0.14 * v, 700, 'lowpass', out);
        break;
      case 'levelup':
        [523, 659, 784, 1047].forEach((f, i) => this.tone('triangle', f, t + i * 0.09, 0.32, 0.13 * v, out, 0.01));
        break;
      case 'loot':
        [880, 1175].forEach((f, i) => this.tone('triangle', f, t + i * 0.06, 0.18, 0.1 * v, out));
        break;
      case 'gold':
        [1200, 1600, 2000].forEach((f, i) => this.tone('square', f, t + i * 0.035, 0.08, 0.05 * v, out));
        break;
      case 'ui':
        this.tone('square', 660, t, 0.05, 0.05 * v, out);
        break;
      case 'ui_big':
        this.tone('triangle', 440, t, 0.12, 0.08 * v, out);
        this.tone('triangle', 660, t + 0.05, 0.12, 0.06 * v, out);
        break;
      case 'quest':
        [587, 740, 880, 1109].forEach((f, i) => this.tone('triangle', f, t + i * 0.1, 0.34, 0.1 * v, out, 0.02));
        break;
      case 'door':
        this.noise(t, 0.28, 0.14 * v, 420, 'lowpass', out);
        this.tone('sine', 90, t, 0.24, 0.08 * v, out);
        break;
      case 'step':
        this.noise(t, 0.05, 0.05 * v, 900, 'lowpass', out);
        break;
      case 'boss_windup':
        this.tone('sawtooth', 110, t, 0.5, 0.1 * v, out, 0.2);
        break;
      case 'boss_hit':
        this.noise(t, 0.4, 0.3 * v, 380, 'lowpass', out);
        this.tone('square', 70, t, 0.4, 0.14 * v, out);
        break;
      case 'boss_phase':
        [220, 165, 110].forEach((f, i) => this.tone('sawtooth', f, t + i * 0.12, 0.6, 0.12 * v, out, 0.05));
        this.noise(t, 0.6, 0.2 * v, 500, 'lowpass', out);
        break;
      case 'heal':
        [659, 880, 1047].forEach((f, i) => this.tone('sine', f, t + i * 0.07, 0.3, 0.09 * v, out, 0.03));
        break;
      case 'drink':
        this.tone('sine', 300, t, 0.18, 0.08 * v, out);
        this.noise(t + 0.05, 0.14, 0.05 * v, 600, 'lowpass', out);
        break;
      /* ---- the Gilded Spade's wheel ---- */
      // A bolt going home: a short wooden tick with a little brass over it.
      case 'wheel_clack':
        this.noise(t, 0.05, 0.18 * v, 2600, 'bandpass', out);
        this.tone('square', 880, t, 0.04, 0.05 * v, out);
        break;
      // The head coming up to speed: filtered noise under a rising fifth.
      case 'wheel_spin':
        this.noise(t, 0.85, 0.07 * v, 900, 'bandpass', out);
        this.tone('triangle', 220, t, 0.5, 0.035 * v, out, 0.12);
        this.tone('triangle', 330, t + 0.22, 0.45, 0.028 * v, out, 0.1);
        break;
      // The ivory hopping across the frets.
      case 'wheel_ball':
        this.noise(t, 0.035, 0.14 * v, 4200, 'bandpass', out);
        this.tone('sine', 1560, t, 0.03, 0.04 * v, out);
        break;
      // A year of dust off a fixture nobody has touched.
      case 'wheel_dust':
        this.noise(t, 0.34, 0.07 * v, 480, 'lowpass', out);
        break;
      // The head seating on the spindle: one heavy brass thump and a ring.
      case 'wheel_lock':
        this.noise(t, 0.14, 0.2 * v, 420, 'lowpass', out);
        this.tone('triangle', 165, t, 0.22, 0.09 * v, out);
        [330, 494].forEach((f, i) => this.tone('sine', f, t + 0.04 + i * 0.05, 0.6, 0.05 * v, out, 0.01));
        break;
      // A dozen people at a dozen tables, all at once and none of them clear.
      case 'crowd_cheer':
        this.noise(t, 0.6, 0.09 * v, 760, 'bandpass', out);
        this.noise(t + 0.12, 0.45, 0.06 * v, 1250, 'bandpass', out);
        [262, 330, 392].forEach((f, i) => this.tone('sine', f, t + i * 0.06, 0.3, 0.025 * v, out, 0.03));
        break;
      case 'discover':
        [440, 554, 659, 880].forEach((f, i) => this.tone('sine', f, t + i * 0.12, 0.5, 0.09 * v, out, 0.04));
        break;
      default:
        break;
    }
  }
}

export const audio = new AudioManager();
