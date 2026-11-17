// Every sound in Motekeeper is synthesized with WebAudio at the moment it is needed: no audio
// files, nothing to load. Short bright blips for gathering (rising in pitch with the combo
// chain), a deep bloom for the pulse, a thud for a hit, chimes for pickups and anchors, a
// small arpeggio for victory and a falling figure for defeat, over a slow two-chord pad that
// loops while the game runs. The context opens on the first user gesture, as browsers require;
// the M key and the shell's mute flag silence everything.

/** Create the sound engine. All methods are safe to call before the context opens. */
export function createAudio() {
  let context = null;
  let master = null;
  let musicGain = null;
  let muted = false;
  let musicTimer = null;
  let chordIndex = 0;

  /** Open the context (first gesture) and start the pad loop. Safe to call again. */
  function unlock() {
    if (context) {
      if (context.state === 'suspended') void context.resume();
      return;
    }
    const AudioCtor = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtor) return;
    context = new AudioCtor();
    master = context.createGain();
    master.gain.value = muted ? 0 : 0.5;
    master.connect(context.destination);
    musicGain = context.createGain();
    musicGain.gain.value = 0.16;
    musicGain.connect(master);
    startPad();
  }

  /** One oscillator note with an envelope, on the effects bus or the music bus. */
  function tone(freq, seconds, type, volume, when = 0, slideTo = null, music = false) {
    if (!context || muted) return;
    const start = context.currentTime + when;
    const osc = context.createOscillator();
    const gain = context.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, start);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, start + seconds);
    gain.gain.setValueAtTime(0, start);
    gain.gain.linearRampToValueAtTime(volume, start + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + seconds);
    osc.connect(gain);
    gain.connect(music ? musicGain : master);
    osc.start(start);
    osc.stop(start + seconds + 0.05);
  }

  /** A breath of filtered noise, for pulses and impacts. */
  function noise(seconds, volume, freq, when = 0) {
    if (!context || muted) return;
    const start = context.currentTime + when;
    const length = Math.max(1, Math.floor(context.sampleRate * seconds));
    const buffer = context.createBuffer(1, length, context.sampleRate);
    const data = buffer.getChannelData(0);
    for (let index = 0; index < length; index += 1) data[index] = (Math.random() * 2 - 1) * (1 - index / length);
    const source = context.createBufferSource();
    source.buffer = buffer;
    const filter = context.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = freq;
    const gain = context.createGain();
    gain.gain.value = volume;
    source.connect(filter);
    filter.connect(gain);
    gain.connect(master);
    source.start(start);
  }

  // The pad: two slow chords (A minor add9, F major 7) breathing in and out, eight seconds each.
  const CHORDS = [
    [110, 164.81, 220, 246.94],
    [87.31, 130.81, 174.61, 220],
  ];

  function startPad() {
    const playChord = () => {
      if (!context) return;
      const chord = CHORDS[chordIndex % CHORDS.length];
      chordIndex += 1;
      for (const freq of chord) tone(freq, 7.5, 'sine', 0.05, 0, null, true);
      tone(chord[0] / 2, 7.5, 'triangle', 0.04, 0, null, true);
    };
    playChord();
    musicTimer = window.setInterval(playChord, 7000);
  }

  return {
    unlock,
    /** Gathering a mote: the pitch climbs a pentatonic ladder as the chain grows. */
    collect(chain) {
      const ladder = [523.25, 587.33, 659.25, 783.99, 880, 1046.5, 1174.66, 1318.51];
      const freq = ladder[Math.min(ladder.length - 1, Math.floor(chain / 2))];
      tone(freq, 0.16, 'sine', 0.22);
      tone(freq * 2, 0.1, 'sine', 0.06);
    },
    /** A shard breaks inside the ring. */
    kill() {
      noise(0.14, 0.2, 2400);
      tone(320, 0.14, 'square', 0.08, 0, 90);
    },
    /** The pulse blooms. */
    pulse() {
      noise(0.3, 0.16, 700);
      tone(98, 0.32, 'sine', 0.3, 0, 49);
      tone(392, 0.2, 'sine', 0.07, 0.02, 784);
    },
    /** The dash whooshes. */
    dash() {
      noise(0.16, 0.1, 3200);
    },
    /** A shard lands a hit. */
    hit() {
      tone(140, 0.3, 'sawtooth', 0.22, 0, 55);
      noise(0.22, 0.24, 500);
    },
    /** A pickup is gathered. */
    pickup() {
      tone(659.25, 0.14, 'sine', 0.18);
      tone(987.77, 0.22, 'sine', 0.18, 0.08);
    },
    /** An anchor lights: a small bell chord. */
    anchor() {
      tone(440, 0.5, 'sine', 0.16);
      tone(554.37, 0.5, 'sine', 0.14, 0.05);
      tone(659.25, 0.7, 'sine', 0.14, 0.1);
    },
    /** Dawn breaks: the victory arpeggio. */
    win() {
      const notes = [523.25, 659.25, 783.99, 1046.5, 1318.51];
      notes.forEach((freq, index) => tone(freq, 0.5, 'triangle', 0.2, index * 0.11));
    },
    /** The night wins: a falling figure. */
    over() {
      const notes = [392, 329.63, 261.63, 196];
      notes.forEach((freq, index) => tone(freq, 0.45, 'triangle', 0.18, index * 0.16));
    },
    /** A menu confirm tick. */
    confirm() {
      tone(783.99, 0.09, 'sine', 0.14);
    },
    /** Toggle the mute; returns the new state. */
    toggleMute() {
      muted = !muted;
      if (master && context) master.gain.setTargetAtTime(muted ? 0 : 0.5, context.currentTime, 0.02);
      return muted;
    },
    /** Whether the engine is currently muted. */
    isMuted() {
      return muted;
    },
    /** Stop the pad timer (the page is going away). */
    dispose() {
      if (musicTimer) window.clearInterval(musicTimer);
    },
  };
}
