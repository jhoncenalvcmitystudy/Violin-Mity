/*
Violin mobile app (columns per string)
- 4 strings: G, D, A, E (left to right)
- Each string is a vertical column of positions (open -> higher)
- Touch a note to play a bowed/violin-like sound and show solfège
*/

const context = new (window.AudioContext || window.webkitAudioContext)();

const strings = [
  {name: 'G', openMidi: 55}, // G3
  {name: 'D', openMidi: 62}, // D4
  {name: 'A', openMidi: 69}, // A4
  {name: 'E', openMidi: 76}  // E5
];

const positionsCount = 20;

const noteNamesSharp = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];
const noteNamesFlat  = ['C','Db','D','Eb','E','F','Gb','G','Ab','A','Bb','B'];
const solfegeMap = {
  'C':'do','C#':'do#','Db':'do♭',
  'D':'re','D#':'re#','Eb':'re♭',
  'E':'mi',
  'F':'fa','F#':'fa#','Gb':'fa♭',
  'G':'sol','G#':'sol#','Ab':'sol♭',
  'A':'la','A#':'la#','Bb':'la♭',
  'B':'si'
};

function midiToFreq(m){ return 440 * Math.pow(2, (m - 69) / 12); }

const container = document.querySelector('.strings');

function makePosition(idx){
  const pos = document.createElement('div');
  pos.className = 'position';
  pos.dataset.pos = idx;
  return pos;
}
function makeNoteButton(label, variant){
  const btn = document.createElement('div');
  btn.className = 'note';
  if(variant==='sharp') btn.classList.add('sharp');
  if(variant==='flat') btn.classList.add('flat');
  btn.textContent = label;
  btn.setAttribute('role','button');
  btn.setAttribute('aria-label', label);
  return btn;
}

function build(){
  // First, determine which positions in the first (G) string are natural (no sharp/flat).
  const firstColumnNaturals = new Array(positionsCount).fill(false);
  for(let p=0; p<positionsCount; p++){
    const midi = strings[0].openMidi + p;
    const noteSharp = noteNamesSharp[midi % 12];
    const noteFlat  = noteNamesFlat[midi % 12];
    const isSharp = noteSharp.includes('#');
    const isFlat = noteFlat.includes('b') && !isSharp;
    // mark true when the first column's note is natural (not sharp/flat)
    firstColumnNaturals[p] = !(isSharp || isFlat);
  }

  // create one column per string and inject horizontal indicators in rows;
  strings.forEach((s, si) => {
    const col = document.createElement('div');
    col.className = 'string-column';
    const top = document.createElement('div');
    top.className = 'string-top';
    top.textContent = s.name;
    col.appendChild(top);

    const positions = document.createElement('div');
    positions.className = 'positions';

    // render from open (top) to higher (down)
    for(let p=0;p<positionsCount;p++){
      const midi = s.openMidi + p;
      const noteSharp = noteNamesSharp[midi % 12];
      const noteFlat  = noteNamesFlat[midi % 12];
      const isSharp = noteSharp.includes('#');
      const isFlat = noteFlat.includes('b') && !isSharp;
      const sol = solfegeMap[noteSharp] || solfegeMap[noteFlat] || noteSharp.toLowerCase();
      const octave = Math.floor(midi/12)-1;
      let labelText = sol;
      if(isSharp) labelText += '#';
      else if(isFlat) labelText += 'b';

      const pos = makePosition(p);

      // (row indicators are created globally after the UI build so they span across all string columns)

      const btn = makeNoteButton(labelText, isSharp ? 'sharp' : (isFlat ? 'flat' : 'natural'));
      btn.dataset.midi = midi;
      btn.dataset.nameSharp = noteSharp;
      btn.dataset.nameFlat = noteFlat;
      btn.dataset.sol = sol;
      btn.dataset.octave = octave;
      btn.dataset.stringIndex = si;

      pos.appendChild(btn);
      // mark open string (top) positions so we can style them distinctly
      if(p === 0) btn.classList.add('open-note');
      positions.appendChild(pos);

      // start on press and hold; stop when released or touch cancels
      const startPlay = (ev) => {
        ev.preventDefault();
        resumeAudio();
        // ensure any previous lingering sound for this button is stopped
        if(btn._stop) { try { btn._stop(); } catch(e){}; btn._stop = null; }
        // pass stringIndex so playViolin can perform per-string legato crossfades
        const player = playViolin(parseInt(btn.dataset.midi), { stringIndex: Number(btn.dataset.stringIndex) });
        btn._stop = player.stop;
        flash(btn);
        showToast(`${btn.dataset.sol} — ${btn.dataset.nameSharp}${btn.dataset.octave}`);
      };

      const endPlay = (ev) => {
        if(btn._stop){ try { btn._stop(); } catch(e){}; btn._stop = null; }
      };

      btn.addEventListener('touchstart', startPlay, {passive:false});
      btn.addEventListener('mousedown', (e)=>{ e.preventDefault(); startPlay(e); });

      // touchend/touchcancel for touch, mouseup/mouseleave for mouse
      btn.addEventListener('touchend', (e)=>{ e.preventDefault(); endPlay(e); }, {passive:false});
      btn.addEventListener('touchcancel', (e)=>{ e.preventDefault(); endPlay(e); }, {passive:false});
      btn.addEventListener('mouseup', endPlay);
      btn.addEventListener('mouseleave', endPlay);

      // also stop when pointerup on the whole document (covers dragging off)
      document.addEventListener('touchend', (e)=>{
        if(btn._stop && !e.target.closest) { try { btn._stop(); } catch(e){}; btn._stop = null; }
      }, {passive:true});
    }

    col.appendChild(positions);
    container.appendChild(col);
  });
}

function flash(el){
  el.style.transform = 'scale(1.06)';
  setTimeout(()=> el.style.transform = '', 160);
}

let toastTimeout = null;
function showToast(text){
  let t = document.querySelector('.toast');
  if(!t){
    t = document.createElement('div');
    t.className = 'toast';
    t.style.position = 'absolute';
    t.style.top = '12px';
    t.style.right = '12px';
    t.style.padding = '8px 12px';
    t.style.borderRadius = '12px';
    t.style.background = 'rgba(0,0,0,0.6)';
    t.style.color = '#fff';
    t.style.fontSize = '13px';
    t.style.zIndex = 9999;
    t.style.pointerEvents = 'none';
    document.querySelector('.violin-body').appendChild(t);
  }
  t.textContent = text;
  t.style.opacity = 1;
  if(toastTimeout) clearTimeout(toastTimeout);
  toastTimeout = setTimeout(()=> t.style.opacity = 0, 1100);
}

/* Violin-like sound: bow noise sample + resonant lowpass, ADSR, subtle random vibrato and per-string legato */
let _bowSampleBuffer = null;
let _bowSampleLoading = null;
// try to load an external bow noise sample once (falls back to generated noise if unavailable)
function ensureBowSample(){
  if(_bowSampleBuffer || _bowSampleLoading) return _bowSampleLoading;
  // prefer a bow-noise sample if available to add a natural attack and bow sound
  _bowSampleLoading = fetch('https://cdn.jsdelivr.net/gh/mrdoob/three.js@dev/examples/sounds/heartbeat.ogg') // placeholder public sample; will fall back if unavailable
    .then(r => r.arrayBuffer())
    .then(a => context.decodeAudioData(a))
    .then(buf => { _bowSampleBuffer = buf; return buf; })
    .catch(()=> { _bowSampleBuffer = null; return null; });
  return _bowSampleLoading;
}

// map to hold current active players per string to enable legato crossfade instead of hard cut
const activePerString = new Map();

function playViolin(midi, opts = {}){
  // opts may include stringIndex to support legato per string
  const freq = midiToFreq(midi);
  const now = context.currentTime;

  // ADSR parameters tuned for bowed instrument
  const ADSR = {
    attack: 0.18,   // slightly longer attack to better emulate bow engagement
    decay: 0.28,
    sustain: 0.7,   // modest sustain level
    release: 1.05
  };

  // create main oscillator bank (two detuned saws for richness)
  const oscA = context.createOscillator();
  oscA.type = 'sawtooth';
  oscA.frequency.value = freq * 0.9985;

  const oscB = context.createOscillator();
  oscB.type = 'sawtooth';
  oscB.frequency.value = freq * 1.0025;

  // gain for full voice (used for ADSR)
  const amp = context.createGain();
  amp.gain.setValueAtTime(0.0001, now);

  // schedule ADSR: attack -> decay -> sustain
  // use a linear attack to simulate the bow ramp and a smooth exponential decay to sustain
  amp.gain.linearRampToValueAtTime(1.0, now + ADSR.attack);
  amp.gain.exponentialRampToValueAtTime(Math.max(0.0001, ADSR.sustain), now + ADSR.attack + ADSR.decay);

  // resonant lowpass to emulate body warmth (tuned a bit lower + Q for wood resonance)
  const bodyLP = context.createBiquadFilter();
  bodyLP.type = 'lowpass';
  bodyLP.frequency.value = Math.max(1400, freq * 2.4);
  bodyLP.Q.value = 1.5;

  // subtle dynamic band emphasis to mimic resonance around fundamental
  const bodyBP = context.createBiquadFilter();
  bodyBP.type = 'peaking';
  bodyBP.frequency.value = Math.max(200, freq * 0.95);
  bodyBP.Q.value = 2.2;
  bodyBP.gain.value = 2.2;

  // vibrato LFO with slight randomized rate/depth for organic feel (lower depth on higher notes)
  const lfo = context.createOscillator();
  lfo.type = 'sine';
  const lfoRate = 4.2 + (Math.random() - 0.5) * 1.6; // ~4.2–5.8 Hz
  lfo.frequency.value = lfoRate;
  const lfoGain = context.createGain();
  // vibrato depth scales inversely with frequency for naturalness
  const vibratoDepthFactor = 0.0012 + (Math.random() * 0.0010);
  lfoGain.gain.value = freq * vibratoDepthFactor * Math.max(0.6, 880 / freq);
  lfo.connect(lfoGain);

  // apply vibrato to oscillators
  lfoGain.connect(oscA.frequency);
  lfoGain.connect(oscB.frequency);

  // create final mix for oscillators
  const oscMix = context.createGain();
  oscMix.gain.value = 0.9;
  oscA.connect(oscMix);
  oscB.connect(oscMix);

  // Bow noise: prefer sample if loaded, otherwise generate a low-level noise buffer
  const noiseGain = context.createGain();
  noiseGain.gain.value = 0.0; // start silent, ramp up slightly after attack
  let noiseSource = null;
  // helper to create generated noise buffer source
  function createGeneratedNoise(){
    const noiseLen = Math.floor(context.sampleRate * 0.5);
    const noiseBuf = context.createBuffer(1, noiseLen, context.sampleRate);
    const nd = noiseBuf.getChannelData(0);
    for(let i=0;i<noiseLen;i++){
      const env = 1 - Math.abs((i / noiseLen) - 0.5) * 1.8;
      nd[i] = (Math.random() * 2 - 1) * 0.05 * env;
    }
    const src = context.createBufferSource();
    src.buffer = noiseBuf;
    src.loop = true;
    return src;
  }

  // schedule noise start once we know if sample available
  const bowPromise = ensureBowSample();
  const startNoise = (buf) => {
    if(buf){
      noiseSource = context.createBufferSource();
      noiseSource.buffer = buf;
      noiseSource.loop = true;
      // filter sampled noise to remove low rumble and excessive highs
      const nHP = context.createBiquadFilter();
      nHP.type = 'highpass';
      nHP.frequency.value = 250;
      const nLP = context.createBiquadFilter();
      nLP.type = 'lowpass';
      nLP.frequency.value = 5500;

      noiseSource.connect(nHP);
      nHP.connect(nLP);
      nLP.connect(noiseGain);
    }else{
      noiseSource = createGeneratedNoise();
      const nHP = context.createBiquadFilter();
      nHP.type = 'highpass';
      nHP.frequency.value = 280;
      const nLP = context.createBiquadFilter();
      nLP.type = 'lowpass';
      nLP.frequency.value = 4200;
      noiseSource.connect(nHP);
      nHP.connect(nLP);
      nLP.connect(noiseGain);
    }
    try { noiseSource.start(now); } catch(e){}
  };
  // immediately create a noise source synchronously for lowest latency if sample not yet loaded
  if(_bowSampleBuffer === null && !_bowSampleLoading){
    // kick sample loading but create generated noise meanwhile
    ensureBowSample();
    startNoise(null);
  } else if(_bowSampleBuffer){
    startNoise(_bowSampleBuffer);
  } else {
    // sample is loading; wait for promise but also create generated fallback now
    startNoise(null);
    bowPromise.then(buf => {
      // if loaded later, swap to sample for future notes (we won't swap running source to avoid clicks)
      if(buf) _bowSampleBuffer = buf;
    }).catch(()=>{});
  }

  // moderate noise level: ramp to a modest level after attack to emulate bow engagement
  noiseGain.gain.setValueAtTime(0.0001, now);
  noiseGain.gain.linearRampToValueAtTime(0.12, now + Math.min(0.18, ADSR.attack + 0.05));

  // route: oscMix -> bodyBP -> bodyLP -> amp -> destination (with noise mixed into amp)
  oscMix.connect(bodyBP);
  bodyBP.connect(bodyLP);
  bodyLP.connect(amp);
  noiseGain.connect(amp);
  amp.connect(context.destination);

  // start oscillators and LFO
  try { oscA.start(now); } catch(e){}
  try { oscB.start(now); } catch(e){}
  try { lfo.start(now); } catch(e){}

  // legato handling: if there's an active voice for this string, crossfade instead of abrupt stop
  let stringIndex = (opts && Number.isFinite(opts.stringIndex)) ? opts.stringIndex : null;
  if(stringIndex !== null){
    const prev = activePerString.get(stringIndex);
    if(prev && prev !== null){
      // crossfade previous down over short time to create legato
      const t = context.currentTime;
      try {
        prev.amp.gain.cancelScheduledValues(t);
        prev.amp.gain.setValueAtTime(prev.amp.gain.value, t);
        prev.amp.gain.exponentialRampToValueAtTime(0.0001, t + 0.12);
        // also stop its noise source slightly after
        if(prev.noiseSource) try { prev.noiseSource.stop(t + 0.18); } catch(e){}
        if(prev.oscA) try { prev.oscA.stop(t + 0.22); } catch(e){}
        if(prev.oscB) try { prev.oscB.stop(t + 0.22); } catch(e){}
      } catch(e){}
    }
    // store references for potential future legato
    activePerString.set(stringIndex, { amp, noiseSource, oscA, oscB });
  }

  let released = false;
  function stop(){
    if(released) return;
    released = true;
    const t = context.currentTime;
    // release ADSR
    amp.gain.cancelScheduledValues(t);
    amp.gain.setValueAtTime(amp.gain.value, t);
    amp.gain.exponentialRampToValueAtTime(0.0001, t + ADSR.release);

    // fade down noise
    noiseGain.gain.cancelScheduledValues(t);
    noiseGain.gain.setValueAtTime(noiseGain.gain.value, t);
    noiseGain.gain.exponentialRampToValueAtTime(0.0001, t + ADSR.release * 0.9);

    // stop sources after release completes
    const stopAt = t + ADSR.release + 0.15;
    try { oscA.stop(stopAt); } catch(e){}
    try { oscB.stop(stopAt); } catch(e){}
    try { lfo.stop(stopAt); } catch(e){}
    try { if(noiseSource) noiseSource.stop(stopAt); } catch(e){}

    // cleanup
    setTimeout(() => {
      try { oscA.disconnect(); } catch(e){}
      try { oscB.disconnect(); } catch(e){}
      try { lfo.disconnect(); } catch(e){}
      try { lfoGain.disconnect(); } catch(e){}
      try { oscMix.disconnect(); } catch(e){}
      try { bodyBP.disconnect(); } catch(e){}
      try { bodyLP.disconnect(); } catch(e){}
      try { amp.disconnect(); } catch(e){}
      try { noiseGain.disconnect(); } catch(e){}
      try { if(noiseSource) noiseSource.disconnect(); } catch(e){}
    }, 1500);

    // clear active mapping for this string if we were the stored active voice
    if(stringIndex !== null){
      const cur = activePerString.get(stringIndex);
      if(cur && cur.amp === amp){
        activePerString.delete(stringIndex);
      }
    }
  }

  // return stop method so caller can hold note until release
  return { stop, amp, noiseSource, oscA, oscB };
}

/* Build UI and then create row-wide indicators that align with the first column positions */
build();

/* create row indicators that span across the strings container for natural rows only */
const rowIndicators = [];
function createRowIndicators(){
  // remove old indicators
  rowIndicators.forEach(r => r.remove());
  rowIndicators.length = 0;

  const stringsEl = document.querySelector('.strings');
  const firstColumn = stringsEl.querySelector('.string-column');
  if(!firstColumn) return;
  const firstPositions = Array.from(firstColumn.querySelectorAll('.position'));
  firstPositions.forEach((posEl, idx) => {
    // only create indicator if first column position had a visible marker (we used firstColumnNaturals)
    // detect natural by checking computed note content (no '#' or 'b') in that first column button
    const btn = posEl.querySelector('.note');
    if(!btn) return;
    const label = btn.textContent || '';
    if(label.includes('#') || label.includes('b')) return;

    const indicator = document.createElement('div');
    indicator.className = 'h-indicator visible';
    // append to strings container and position absolutely to match the row center
    stringsEl.appendChild(indicator);
    rowIndicators.push(indicator);
  });

  updateRowIndicators();
}

function updateRowIndicators(){
  const stringsEl = document.querySelector('.strings');
  if(!stringsEl) return;
  const firstColumn = stringsEl.querySelector('.string-column');
  if(!firstColumn) return;
  const firstPositions = Array.from(firstColumn.querySelectorAll('.position'));
  // collect bounding rects relative to .strings
  const containerRect = stringsEl.getBoundingClientRect();
  let ri = 0;
  firstPositions.forEach((posEl) => {
    const btn = posEl.querySelector('.note');
    if(!btn) return;
    const label = btn.textContent || '';
    if(label.includes('#') || label.includes('b')) return;
    const rect = posEl.getBoundingClientRect();
    const top = rect.top - containerRect.top;
    const height = rect.height;
    const indicator = rowIndicators[ri++];
    if(indicator){
      indicator.style.top = (top + (height - parseFloat(getComputedStyle(indicator).height || 48)) / 2) + 'px';
      indicator.style.height = Math.max(40, height) + 'px';
    }
  });
}

 // update on resize and after next frame to ensure layout ready
window.addEventListener('resize', () => requestAnimationFrame(updateRowIndicators));

// ensure loader hides only after UI layout and bow sample attempts to load
requestAnimationFrame(() => {
  createRowIndicators();
  // also observe mutations to reposition if layout changes (e.g., fonts or dynamic content)
  const ro = new ResizeObserver(() => updateRowIndicators());
  const stringsEl = document.querySelector('.strings');
  if(stringsEl) ro.observe(stringsEl);

  // hide loader after bow sample load attempt (or after a short fallback timeout)
  const loaderEl = document.getElementById('loader');

  // loader harmonic tone: a gentle harmonic/violin-like pad while intro visible
  let _loaderTone = null;
  function startLoaderTone(){
    if(_loaderTone) return;
    try { resumeAudio(); } catch(e){}
    const now = context.currentTime;
    // create two oscillators detuned and a bandpass to make it more violin-like
    const osc1 = context.createOscillator();
    const osc2 = context.createOscillator();
    const gain = context.createGain();
    const bp = context.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 880; // centered high to feel harmonic/airy
    bp.Q.value = 6;

    // slight detune to create chorus
    osc1.type = 'sawtooth';
    osc1.frequency.value = 440; // A4
    osc2.type = 'sawtooth';
    osc2.frequency.value = 440 * 1.0025;

    // gentle amplitude envelope and low overall level
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.linearRampToValueAtTime(0.12, now + 0.6);
    gain.gain.exponentialRampToValueAtTime(0.06, now + 1.2);

    // subtle slow LFO to modulate filter frequency for organic movement
    const lfo = context.createOscillator();
    const lfoGain = context.createGain();
    lfo.type = 'sine';
    lfo.frequency.value = 0.25;
    lfoGain.gain.value = 40; // Hz
    lfo.connect(lfoGain);
    lfoGain.connect(bp.frequency);

    osc1.connect(bp);
    osc2.connect(bp);
    bp.connect(gain);
    gain.connect(context.destination);

    try { osc1.start(now); osc2.start(now); lfo.start(now); } catch(e){}

    _loaderTone = { osc1, osc2, gain, bp, lfo, lfoGain };
  }

  function stopLoaderTone(){
    if(!_loaderTone) return;
    const t = context.currentTime;
    try {
      _loaderTone.gain.gain.cancelScheduledValues(t);
      _loaderTone.gain.gain.setValueAtTime(_loaderTone.gain.gain.value, t);
      _loaderTone.gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.9);
      // stop sources after fade
      _loaderTone.osc1.stop(t + 1.1);
      _loaderTone.osc2.stop(t + 1.1);
      _loaderTone.lfo.stop(t + 1.1);
      setTimeout(()=> {
        try { _loaderTone.osc1.disconnect(); _loaderTone.osc2.disconnect(); _loaderTone.lfo.disconnect(); _loaderTone.lfoGain.disconnect(); _loaderTone.bp.disconnect(); _loaderTone.gain.disconnect(); } catch(e){}
        _loaderTone = null;
      }, 1300);
    } catch(e){ _loaderTone = null; }
  }

  function hideLoaderSoon(delay=220){
    if(!loaderEl) return;
    setTimeout(()=> {
      loaderEl.setAttribute('aria-hidden','true');
      loaderEl.classList.add('hidden');
      // stop loader tone when hiding
      stopLoaderTone();
    }, delay);
  }

  // start loader tone immediately for the intro
  startLoaderTone();

  // Keep intro visible for 4 seconds (then hide loader); still trigger sample load but don't delay UI beyond 4s
  ensureBowSample().catch(()=>null);
  setTimeout(()=> hideLoaderSoon(200), 4000);
});

/* Audio resume helper */
function resumeAudio(){
  if(context.state === 'suspended') context.resume();
  window.removeEventListener('touchstart', resumeAudio);
  window.removeEventListener('mousedown', resumeAudio);
}
window.addEventListener('touchstart', resumeAudio, {passive:true});
window.addEventListener('mousedown', resumeAudio, {passive:true});

/* --- Metronome implementation ---
   Uses the AudioContext for precise scheduling. Provides a short high/low click,
   adjustable BPM, and start/stop tied to settings UI.
*/
const metronome = {
  isRunning: false,
  bpm: 90,
  lookahead: 0.1,
  scheduleInterval: null,
  nextTickTime: 0,
  currentBeat: 0,
  // create a short percussive click (impulse) using oscillator + envelope
  clickAt(time, isDownbeat){
    const osc = context.createOscillator();
    const g = context.createGain();
    osc.type = 'square';
    osc.frequency.value = isDownbeat ? 1200 : 1000;
    g.gain.setValueAtTime(0.0001, time);
    g.gain.exponentialRampToValueAtTime(isDownbeat ? 0.7 : 0.45, time + 0.001);
    g.gain.exponentialRampToValueAtTime(0.0001, time + 0.08);
    const hp = context.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = 800;
    osc.connect(hp);
    hp.connect(g);
    g.connect(context.destination);
    try { osc.start(time); } catch(e){}
    try { osc.stop(time + 0.1); } catch(e){}
    // cleanup later
    setTimeout(()=>{ try{ osc.disconnect(); g.disconnect(); hp.disconnect(); }catch(e){} }, 300);
  },
  scheduler(){
    while(metronome.nextTickTime < context.currentTime + metronome.lookahead){
      // compute whether this is the downbeat and which string index to highlight
      const isDownbeat = (metronome.currentBeat % 4) === 0;
      const stringIndexToFlash = metronome.currentBeat % 4; // 0..3 -> G,D,A,E

      // schedule audio click
      metronome.clickAt(metronome.nextTickTime, isDownbeat);

      // visual: flash the corresponding string-top in sync (short-lived)
      try {
        const tops = document.querySelectorAll('.string-top');
        const top = tops[stringIndexToFlash];
        if(top){
          top.classList.add('beat');
          // remove shortly after to match click envelope
          setTimeout(()=> top.classList.remove('beat'), 140);
        }
      } catch(e){}

      // advance scheduler timings
      const secondsPerBeat = 60.0 / metronome.bpm;
      metronome.nextTickTime += secondsPerBeat;
      metronome.currentBeat = (metronome.currentBeat + 1) % 4;
    }
  },
  start(){
    if(metronome.isRunning) return;
    resumeAudio();
    metronome.isRunning = true;
    metronome.currentBeat = 0;
    metronome.nextTickTime = context.currentTime + 0.02;
    metronome.scheduleInterval = setInterval(()=> metronome.scheduler(), 25);
  },
  stop(){
    if(!metronome.isRunning) return;
    metronome.isRunning = false;
    if(metronome.scheduleInterval) { clearInterval(metronome.scheduleInterval); metronome.scheduleInterval = null; }
  },
  setBpm(b){
    metronome.bpm = Math.max(30, Math.min(240, Math.round(b)));
  }
};

// wire metronome UI controls
const metOn = document.getElementById('metronome-on');
const metBpmInput = document.getElementById('metronome-bpm');
const metSlider = document.getElementById('metronome-slider');

if(metBpmInput && metSlider && metOn){
  metBpmInput.addEventListener('change', (e)=>{
    const v = Number(e.target.value) || 90;
    metronome.setBpm(v);
    metSlider.value = metronome.bpm;
  });
  metSlider.addEventListener('input', (e)=>{
    const v = Number(e.target.value) || 90;
    metronome.setBpm(v);
    metBpmInput.value = metronome.bpm;
  });
  metOn.addEventListener('change', (e)=>{
    if(e.target.checked) metronome.start();
    else metronome.stop();
  });
  // ensure UI initial value sync
  metronome.setBpm(Number(metBpmInput.value || metSlider.value || 90));
  metBpmInput.value = metronome.bpm;
  metSlider.value = metronome.bpm;
}

/* Settings panel logic: gear button toggles temporary panel; checkboxes hide/show variants */
const settingsBtn = document.getElementById('settings-btn');
const settingsPanel = document.getElementById('settings-panel');
const closeSettings = document.getElementById('close-settings');

function openSettings(){
  settingsPanel.setAttribute('aria-hidden', 'false');
}
function closeSettingsPanel(){
  settingsPanel.setAttribute('aria-hidden', 'true');
}
settingsBtn.addEventListener('click', (e)=>{ e.preventDefault(); const cur = settingsPanel.getAttribute('aria-hidden')==='false'; settingsPanel.setAttribute('aria-hidden', cur ? 'true' : 'false'); });

closeSettings.addEventListener('click', ()=> closeSettingsPanel());

/* checkboxes control display mode for accidentals; sharps/flats are mutually exclusive
   and will not hide buttons but will change the displayed label (sharp vs flat).
   The "Natural" checkbox still toggles visibility of natural notes. */
const showNatural = document.getElementById('show-natural');
const showSharp = document.getElementById('show-sharp');
const showFlat = document.getElementById('show-flat');
const bodyEl = document.querySelector('.violin-body');

function updateNaturalVisibility(){
  bodyEl.classList.toggle('hide-natural', !showNatural.checked);
}

// Ensure sharps and flats are mutually exclusive and update labels accordingly
function enforceMutualExclusivity(changed){
  if(changed === 'sharp' && showSharp.checked && showFlat.checked){
    showFlat.checked = false;
  } else if(changed === 'flat' && showFlat.checked && showSharp.checked){
    showSharp.checked = false;
  }
}

// Update all note button labels to show sharp or flat variant (or natural/solfège)
function updateLabels(){
  const notes = document.querySelectorAll('.note');
  notes.forEach(btn => {
    const nameSharp = btn.dataset.nameSharp || '';
    const nameFlat = btn.dataset.nameFlat || '';
    const sol = btn.dataset.sol || '';
    const octave = btn.dataset.octave || '';
    const isSharp = nameSharp.includes('#');
    const isFlat = nameFlat.includes('b') && !isSharp;

    // If the note is a true accidental (has # or b), show sharp or flat according to settings.
    if(isSharp || isFlat){
      if(showSharp.checked && !showFlat.checked){
        // prefer sharp display
        btn.textContent = (sol ? sol : nameSharp) + (nameSharp.includes('#') ? '#' : '');
      } else if(showFlat.checked && !showSharp.checked){
        // prefer flat display
        // use flat name if available, otherwise fall back to sharp representation
        const flatLabel = nameFlat || nameSharp;
        // convert solfege where possible (map flat to diatonic label if solfegeMap has it)
        const solFlat = Object.keys(solfegeMap).includes(flatLabel.replace(/[#b]/,'')) ? (solfegeMap[flatLabel.replace(/[#b]/,'')] || flatLabel) : flatLabel;
        btn.textContent = solFlat + (flatLabel.includes('b') ? 'b' : (flatLabel.includes('#') ? '#' : ''));
      } else {
        // neither or both unchecked: show a combined/neutral marker (prefer sharp text by default)
        btn.textContent = nameSharp || nameFlat || sol;
      }
    } else {
      // natural note: show solfege (and don't alter visibility here)
      btn.textContent = sol;
    }
  });
}

// wire up events: Natural still toggles visibility; sharp/flat are exclusive and update labels
showNatural.addEventListener('change', () => {
  updateNaturalVisibility();
  // No label changes needed for natural toggle, but update in case some notes rely on solfege mapping
  updateLabels();
});

showSharp.addEventListener('change', () => {
  enforceMutualExclusivity('sharp');
  updateLabels();
});

showFlat.addEventListener('change', () => {
  enforceMutualExclusivity('flat');
  updateLabels();
});

// initialize states and labels
updateNaturalVisibility();
updateLabels();

/* close panel when tapping outside it */
document.addEventListener('click', (e)=>{
  if(settingsPanel.getAttribute('aria-hidden')==='false'){
    if(!settingsPanel.contains(e.target) && !settingsBtn.contains(e.target)){
      closeSettingsPanel();
    }
  }
});