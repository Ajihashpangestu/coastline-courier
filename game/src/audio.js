// Procedural sound: a WebAudio engine hum tied to throttle, soft wind noise,
// and short chimes for rings, cargo and touchdown. Everything is synthesised
// in code, so the game ships no audio files and loads nothing.

export function createAudio() {
  let context = null;
  let engineOscillator = null;
  let engineGain = null;
  let windGain = null;
  function ensureContext() {
    if (context) return true;
    const AudioCtor = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtor) return false;
    context = new AudioCtor();
    engineOscillator = context.createOscillator();
    engineOscillator.type = 'sawtooth';
    const filter = context.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 420;
    engineGain = context.createGain();
    engineGain.gain.value = 0;
    engineOscillator.connect(filter);
    filter.connect(engineGain);
    engineGain.connect(context.destination);
    engineOscillator.start();
    const noiseBuffer = context.createBuffer(1, context.sampleRate, context.sampleRate);
    const data = noiseBuffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    const noise = context.createBufferSource();
    noise.buffer = noiseBuffer;
    noise.loop = true;
    const noiseFilter = context.createBiquadFilter();
    noiseFilter.type = 'bandpass';
    noiseFilter.frequency.value = 900;
    windGain = context.createGain();
    windGain.gain.value = 0;
    noise.connect(noiseFilter);
    noiseFilter.connect(windGain);
    windGain.connect(context.destination);
    noise.start();
    return true;
  }
  function chime(frequency, seconds, type = 'sine', volume = 0.16) {
    if (!ensureContext()) return;
    const osc = context.createOscillator();
    const gain = context.createGain();
    osc.type = type;
    osc.frequency.value = frequency;
    gain.gain.setValueAtTime(volume, context.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, context.currentTime + seconds);
    osc.connect(gain);
    gain.connect(context.destination);
    osc.start();
    osc.stop(context.currentTime + seconds);
  }
  return {
    unlock() {
      if (ensureContext() && context.state === 'suspended') context.resume();
    },
    updateEngine(throttle, speed, engineOn) {
      if (!context) return;
      const target = engineOn ? 0.015 + throttle * 0.05 : 0;
      engineGain.gain.setTargetAtTime(target, context.currentTime, 0.1);
      engineOscillator.frequency.setTargetAtTime(52 + throttle * 95, context.currentTime, 0.1);
      windGain.gain.setTargetAtTime(Math.min(0.05, speed * 0.0007), context.currentTime, 0.2);
    },
    ring() {
      chime(880, 0.35);
      setTimeout(() => chime(1318, 0.4), 90);
    },
    cargo() {
      chime(523, 0.3, 'triangle');
    },
    touchdown() {
      chime(120, 0.25, 'triangle', 0.22);
    },
    warning() {
      chime(660, 0.18, 'square', 0.06);
    },
  };
}
