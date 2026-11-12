// E-SCOOTER WHEELIE - Handy-Version (läuft im Browser und als Android-App)
//
// Die Physik ist 1:1 aus code.py (PyBadge-Version) übernommen: gleicher Wheelie,
// gleicher Burnout und Boost. Nur die Höchstgeschwindigkeit hat jeder Scooter seine eigene.
'use strict';
(() => {
  // ------------------------------------------------------------------
  // EINSTELLUNGEN - gleiche Werte wie in code.py
  // ------------------------------------------------------------------
  const MAX_KMH = 100;        // Höchstgeschwindigkeit vom Original (jeder Scooter hat seine eigene, siehe SCOOTERS)
  const ACCEL = 6.0;          // Beschleunigung beim Anfahren (m/s²)
  const POWER = 75.0;         // Motorkraft: wie gut er bei hohem Tempo noch zieht
  const BOOST_ACCEL = 14.0;   // Beschleunigung im Boost (m/s²)
  const BRAKE = 8.0;          // Bremse (m/s²), im Wheelie nur halb so stark
  const ROLL = 0.2;           // Rollwiderstand (m/s²)
  const AERO = 0.0025;        // Luftwiderstand (wächst mit Tempo mal Tempo)
  const BURNOUT_TIME = 1.0;   // so lange muss der Burnout dauern, bis der Boost bereit ist
  const POP = 1.8;            // wie kräftig der Wheelie-Knopf das Vorderrad hochreißt
  const BALANCE_DEG = 42;     // Gleichgewichtspunkt des Wheelies (Grad)
  const CRASH_DEG = 68;       // ab hier kippst du nach hinten um (Grad)
  const GRAVITY = 4.0;        // wie stark das Vorderrad nach unten will
  const LIFT = 6.5;           // wie stark Gas das Vorderrad hochzieht
  const BRAKE_TORQUE = 6.0;   // wie stark die Bremse es runterdrückt
  const DAMPING = 1.8;        // Dämpfung (höher = gutmütiger)
  const LAND_TORQUE = 5.0;    // sanftes Landen mit nochmal Wheelie-Knopf
  const LAND_SPEED = 1.6;     // so schnell senkt sich das Vorderrad dabei (rad/s)
  const BOUNCE = 1.0;         // wie stark das Vorderrad beim Aufsetzen nachfedert
  const MIN_WHEELIE = 0.5;    // so viele Meter muss ein Wheelie mindestens haben

  // ------------------------------------------------------------------
  // SCOOTER und TUNING
  // ------------------------------------------------------------------
  // name = so heißt der Scooter im Spiel, kmh = Höchstgeschwindigkeit ohne Tuning,
  // accel = Beschleunigung beim Anfahren (m/s², das Original hat 6.0),
  // dual = hat schon ab Werk zwei Motoren, price = Preis in Münzen,
  // gain = km/h pro Motor-Stufe, cost = Tuning-Teile sind so viel mal teurer
  const SCOOTERS = [
    { name: 'NINEBOT MAX G3', kmh: 80, accel: 6.0, dual: false, price: 0, gain: 5, cost: 1, r: 5.0, wb: 26, dy: 0, color: 0 },
    { name: 'KUKIRIN G4', kmh: 105, accel: 7.5, dual: false, price: 300, gain: 8, cost: 1.5, r: 5.6, wb: 27, dy: 0.6, color: 9 },
    { name: 'DUALTRON X LIMITED', kmh: 125, accel: 10.5, dual: true, price: 1200, gain: 12, cost: 2.5, r: 6.6, wb: 30, dy: 1.5, color: 3 },
  ];
  const PARTS = [
    { name: 'MOTOR', info: g => '+' + g + ' KM/H' },
    { name: 'CONTROLLER', info: () => '+2 KM/H, MEHR ANZUG' },
    { name: 'AKKU', info: () => '+2 KM/H, BOOST STÄRKER' },
    { name: 'REIFEN', info: () => '+2 KM/H, BREMST BESSER' },
    { name: 'DUAL MOTOR', max: 1, info: () => '+5 KM/H, VIEL MEHR ANZUG' },
  ];
  const DUAL = 4;                         // Nummer vom Dual-Motor in PARTS
  const DUAL_PRICE = 400;                 // Preis vom zweiten Motor (mal "cost" vom Scooter)
  const DUAL_ACCEL = 2.5;                 // so viel mehr Beschleunigung bringt er (m/s²)
  const DUAL_POWER = 1.6;                 // und so viel mal mehr Kraft bei hohem Tempo
  const PART_LEVELS = 3;
  const levels = k => PARTS[k].max || PART_LEVELS;
  const PART_PRICE = [60, 150, 300];      // Preis für Stufe 1, 2, 3 (mal "cost" vom Scooter)
  const COIN_PER_M = 2;                   // Münzen pro Meter Wheelie (Trick-Punkte kommen dazu)

  const COLORS = [['MINT', 0x19C2A0], ['BLAU', 0x2F7DE1], ['PINK', 0xFF5FA2], ['FEUER-ROT', 0xE8322B],
    ['SCHWARZ', 0x3A3A46], ['GOLD', 0xFFC83D], ['REGENBOGEN', -1], ['NEON-GRÜN', 0x9DFF3A],
    ['LILA', 0x9B5DE5], ['ORANGE', 0xFF8A1F], ['WEISS', 0xF2F2F6], ['EIS-BLAU', 0x8FE8FF]];

  // ------------------------------------------------------------------
  // Feste Werte
  // ------------------------------------------------------------------
  const PX_PER_M = 26;                    // 26 Einheiten = 1 Meter
  const VMAX0 = MAX_KMH / 3.6;
  const rad = d => d * Math.PI / 180;
  const PHI0 = rad(90 - BALANCE_DEG);
  const CRASH_RAD = rad(CRASH_DEG);
  const CTRL = [1.0, 0.7, 0.4];           // so gut drückt die Bremse das Vorderrad mit 2 / 1 / 0 Händen runter
  const WOBBLE = [0.0, 0.7, 1.6];         // so stark schwankt es dabei
  const RATE = [0, 1, 3, 1, 4, 8];        // Trick-Punkte pro Meter (Arme 0-2, +3 für Knie)
  const NAMES = ['', 'EINHÄNDER', 'NO-HANDER', 'KNIE-TRICK', 'KNIE-EINHÄNDER', 'KNIE-NO-HANDER'];
  const LEG_REACH = 18.5;                 // so lang ist das freie Bein
  const BTN_B = 1, BTN_A = 2, BTN_START = 4, BTN_RIGHT = 16, BTN_DOWN = 32, BTN_UP = 64, BTN_LEFT = 128;
  const MENU = 0, PLAY = 1, PAUSE = 2, CRASH = 3;

  // Töne: [Frequenz, Dauer]
  const SND_START = [[523, 0.07], [784, 0.1]];
  const SND_TICK = [[660, 0.04]];
  const SND_TRICK = [[1047, 0.05], [1568, 0.08]];
  const SND_LAND = [[880, 0.06], [1175, 0.1]];
  const SND_RECORD = [[523, 0.09], [659, 0.09], [784, 0.09], [1047, 0.25]];
  const SND_CRASH = [[220, 0.08], [165, 0.08], [110, 0.12], [70, 0.2]];
  const SND_READY = [[988, 0.05], [1319, 0.1]];
  const SND_BOOST = [[392, 0.05], [587, 0.05], [784, 0.05], [1175, 0.15]];
  const SND_OFF = [[300, 0.1], [200, 0.15]];
  const SND_BUY = [[784, 0.06], [988, 0.06], [1319, 0.12]];

  // Fahrer (gleiche Maße wie in tools/bilder.py)
  const LEAN = 0.7;                       // der Fahrer lehnt sich weniger weit zurück als der Scooter
  const POSES = [[-0.5, 17.5, -11.0], [-2.2, 14.3, -19.0], [-3.8, 11.0, -27.0]];
  const LEG = 8.7, ARM = 6.2, TORSO = 10.3;

  const { sin, cos, min, max, floor, random, PI } = Math;
  const clamp = (x, a, b) => (x < a ? a : x > b ? b : x);
  const randint = (a, b) => a + floor(random() * (b - a + 1));
  const hex = c => '#' + (c & 0xFFFFFF).toString(16).padStart(6, '0');

  // ------------------------------------------------------------------
  // Speicher (Rekorde, Münzen, Scooter, Tuning)
  // ------------------------------------------------------------------
  const KEY = 'escooter-wheelie-1';
  const store = {
    best: 0, tbest: 0, sound: true, coins: 0, scooter: 0,
    owned: SCOOTERS.map(s => s.price === 0),
    color: SCOOTERS.map(s => s.color),
    tune: SCOOTERS.map(() => PARTS.map(() => 0)),
  };
  try {
    const d = JSON.parse(localStorage.getItem(KEY) || '{}');
    if (d.best >= 0) store.best = +d.best;
    if (d.tbest >= 0) store.tbest = floor(d.tbest);
    if (d.coins >= 0) store.coins = floor(d.coins);
    if (typeof d.sound === 'boolean') store.sound = d.sound;
    if (d.scooter >= 0 && d.scooter < SCOOTERS.length) store.scooter = floor(d.scooter);
    SCOOTERS.forEach((s, i) => {
      if (d.owned && d.owned[i]) store.owned[i] = true;
      if (d.color && d.color[i] >= 0 && d.color[i] < COLORS.length) store.color[i] = floor(d.color[i]);
      PARTS.forEach((p, k) => {
        const v = d.tune && d.tune[i] && d.tune[i][k];
        if (v >= 0 && v <= levels(k)) store.tune[i][k] = floor(v);
      });
    });
  } catch (e) { /* kein Speicher: dann eben ohne */ }
  SCOOTERS.forEach((s, i) => { if (s.dual) store.tune[i][DUAL] = 1; });   // ab Werk eingebaut
  const m = /[?&]coins=(\d+)/.exec(location.search);      // zum Testen: ?coins=5000
  if (m) store.coins = +m[1];
  function saveStore() {
    try { localStorage.setItem(KEY, JSON.stringify(store)); } catch (e) { /* egal */ }
  }

  // So fährt der gewählte Scooter (ohne Tuning = genau die Werte von oben)
  const car = { vmax: VMAX0, kmh: MAX_KMH, accel: ACCEL, power: POWER, boost: BOOST_ACCEL, brake: BRAKE };
  function topSpeed(i) {
    const t = store.tune[i];
    return SCOOTERS[i].kmh + SCOOTERS[i].gain * t[0] + 2 * (t[1] + t[2] + t[3]) +
      (SCOOTERS[i].dual ? 0 : 5 * t[DUAL]);
  }
  function applyTuning() {
    const t = store.tune[store.scooter], mdl = SCOOTERS[store.scooter];
    car.kmh = topSpeed(store.scooter);
    car.vmax = car.kmh / 3.6;
    const k = car.kmh / MAX_KMH;
    car.power = POWER * k * k * k * (t[DUAL] ? DUAL_POWER : 1);   // genug Kraft für das neue Tempo
    car.accel = mdl.accel + 0.8 * t[1] + (t[DUAL] && !mdl.dual ? DUAL_ACCEL : 0);
    car.boost = BOOST_ACCEL + 2.0 * t[2];
    car.brake = BRAKE + 1.0 * t[3];
  }

  // ------------------------------------------------------------------
  // Bildschirm
  // ------------------------------------------------------------------
  const canvas = document.getElementById('c');
  const ctx = canvas.getContext('2d');
  let W = 160, H = 120, SC = 1, GY = 92, RX = 60, IL = 0, IR = 0, skyGrad = null, roadGrad = null;

  function resize() {
    const cw = window.innerWidth || 320, ch = window.innerHeight || 240;
    const dpr = min(window.devicePixelRatio || 1, max(1, 1080 / ch));
    canvas.width = Math.round(cw * dpr);
    canvas.height = Math.round(ch * dpr);
    SC = min(canvas.width / 160, canvas.height / 120);
    W = canvas.width / SC;
    H = canvas.height / SC;
    GY = H - 28;                          // hier berühren die Räder die Straße
    const safe = document.getElementById('safe').getBoundingClientRect();
    IL = max(0, safe.left) * dpr / SC;    // Platz für die Kamera-Kerbe
    IR = max(0, cw - safe.right) * dpr / SC;
    RX = max(60, W * 0.36);
    skyGrad = ctx.createLinearGradient(0, 0, 0, GY - 16);
    skyGrad.addColorStop(0, '#2f7fd6');
    skyGrad.addColorStop(0.6, '#6fb4ee');
    skyGrad.addColorStop(1, '#bfe3f8');
    roadGrad = ctx.createLinearGradient(0, GY - 7, 0, H);
    roadGrad.addColorStop(0, '#43434e');
    roadGrad.addColorStop(1, '#2b2b34');
  }
  window.addEventListener('resize', resize);
  resize();

  // ------------------------------------------------------------------
  // Eingabe: Finger, Maus und Tastatur
  // ------------------------------------------------------------------
  const pointers = new Map();
  let taps = [];
  let keys = 0, keyPressed = 0, touchHeld = 0, held = 0, pressed = 0;
  let usedTouch = false;
  const toUnits = e => ({ x: e.clientX * canvas.width / (window.innerWidth || 1) / SC,
    y: e.clientY * canvas.height / (window.innerHeight || 1) / SC });
  canvas.addEventListener('pointerdown', e => {
    e.preventDefault();
    audioInit();
    if (e.pointerType !== 'mouse') usedTouch = true;
    const p = toUnits(e);
    pointers.set(e.pointerId, p);
    taps.push(p);
    try { canvas.setPointerCapture(e.pointerId); } catch (err) { /* egal */ }
  });
  canvas.addEventListener('pointermove', e => {
    if (pointers.has(e.pointerId)) pointers.set(e.pointerId, toUnits(e));
  });
  const up = e => pointers.delete(e.pointerId);
  canvas.addEventListener('pointerup', up);
  canvas.addEventListener('pointercancel', up);
  canvas.addEventListener('contextmenu', e => e.preventDefault());

  const KEYMAP = { ArrowUp: BTN_UP, ArrowDown: BTN_DOWN, ArrowLeft: BTN_LEFT, ArrowRight: BTN_RIGHT,
    KeyX: BTN_A, Space: BTN_A, KeyC: BTN_B, KeyB: BTN_B, Enter: BTN_START, KeyP: BTN_START, Escape: BTN_START };
  window.addEventListener('keydown', e => {
    const b = KEYMAP[e.code];
    if (!b) return;
    e.preventDefault();
    audioInit();
    if (!(keys & b)) keyPressed |= b;
    keys |= b;
  });
  window.addEventListener('keyup', e => { keys &= ~(KEYMAP[e.code] || 0); });
  window.addEventListener('blur', () => { keys = 0; pointers.clear(); });

  // Die Knöpfe auf dem Bildschirm. Ein Finger zählt für den Knopf, der am nächsten ist.
  // Zwischen GAS und BREMSE liegt ein Feld für beide zusammen (Burnout).
  let pads = [];
  function layoutPads() {
    const cx = IL + 31, cy = H - 31, ax = W - IR - 20, ay = H - 26, bx = ax - 31, by = H - 17;
    pads = [
      { bit: BTN_UP, x: cx, y: cy - 17, r: 10.5, t: 'WHEELIE', c: '#ffd23f' },
      { bit: BTN_LEFT, x: cx - 18, y: cy, r: 10.5, t: '1 HAND', c: '#ffffff' },
      { bit: BTN_RIGHT, x: cx + 18, y: cy, r: 10.5, t: '0 HAND', c: '#ffffff' },
      { bit: BTN_DOWN, x: cx, y: cy + 17, r: 10.5, t: 'KNIE', c: '#ffffff' },
      { bit: BTN_DOWN | BTN_LEFT, x: cx - 15.5, y: cy + 15.5, r: 5, t: '', c: '#ffffff' },
      { bit: BTN_DOWN | BTN_RIGHT, x: cx + 15.5, y: cy + 15.5, r: 5, t: '', c: '#ffffff' },
      { bit: BTN_A, x: ax, y: ay, r: 15, t: 'GAS', c: '#3ccb5a' },
      { bit: BTN_B, x: bx, y: by, r: 12, t: 'BREMSE', c: '#e84a3c' },
      { bit: BTN_A | BTN_B, x: (ax + bx) / 2 - 3.5, y: (ay + by) / 2 - 11.5, r: 6.5, t: 'BURN', c: '#ff8a1f' },
    ];
  }
  function readPads() {
    let bits = 0;
    for (const p of pointers.values()) {
      let best = null, bd = 1.45;
      for (const b of pads) {
        const d = Math.hypot(p.x - b.x, p.y - b.y) / b.r;
        if (d < bd) { bd = d; best = b; }
      }
      if (best) bits |= best.bit;
    }
    return bits;
  }
  function tapped(x, y, w, h) {
    for (const p of taps) if (p.x >= x && p.x <= x + w && p.y >= y && p.y <= y + h) return true;
    return false;
  }

  // ------------------------------------------------------------------
  // Ton
  // ------------------------------------------------------------------
  let ac = null, engOsc = null, engGain = null, beeps = [];
  function audioInit() {
    try {
      if (ac) { if (ac.state === 'suspended') ac.resume(); return; }
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      ac = new AC();
      engOsc = ac.createOscillator();
      engOsc.type = 'sawtooth';
      engOsc.frequency.value = 120;
      const lp = ac.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = 1600;
      engGain = ac.createGain();
      engGain.gain.value = 0;
      engOsc.connect(lp); lp.connect(engGain); engGain.connect(ac.destination);
      engOsc.start();
    } catch (e) { ac = null; }
  }
  function play(notes) {
    if (!ac || !store.sound) return;
    try {
      for (const o of beeps) { try { o.stop(); } catch (e) { /* schon fertig */ } }
      beeps = [];
      let t = ac.currentTime + 0.005;
      for (const [f, d] of notes) {
        const o = ac.createOscillator(), g = ac.createGain();
        o.type = 'square';
        o.frequency.value = f;
        g.gain.setValueAtTime(0.07, t);
        g.gain.setValueAtTime(0.07, t + d - 0.01);
        g.gain.linearRampToValueAtTime(0, t + d + 0.02);
        o.connect(g); g.connect(ac.destination);
        o.start(t); o.stop(t + d + 0.03);
        beeps.push(o);
        t += d;
      }
    } catch (e) { /* egal */ }
  }
  function engineSound(speed, gas, wild) {
    // speed 0..1; wild = 1 Burnout, 2 Boost (Motor heult, Reifen quietscht)
    if (!ac) return;
    let amp = 0.0, freq = 150 + 600 * speed + (gas ? 50 : 0);
    if (wild === 1) { amp = 0.12; freq = 650 + randint(-80, 80); }
    else if (wild) { amp = 0.14; freq += 300; }
    else if (speed > 0.02) amp = 0.04 + (gas ? 0.05 : 0.0);
    try {
      engGain.gain.setTargetAtTime(store.sound ? amp * 0.6 : 0, ac.currentTime, 0.03);
      engOsc.frequency.setTargetAtTime(freq, ac.currentTime, 0.03);
    } catch (e) { /* egal */ }
  }
  function buzz(ms) {
    try { if (navigator.vibrate) navigator.vibrate(ms); } catch (e) { /* egal */ }
  }

  // ------------------------------------------------------------------
  // Zeichen-Helfer
  // ------------------------------------------------------------------
  function seg(a, b, w, c) {
    ctx.strokeStyle = c; ctx.lineWidth = w; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke();
  }
  function circ(p, r, c) {
    ctx.fillStyle = c; ctx.beginPath(); ctx.arc(p[0], p[1], r, 0, 2 * PI); ctx.fill();
  }
  function poly(pts, c) {
    ctx.fillStyle = c; ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
    ctx.closePath(); ctx.fill();
  }
  function rrect(x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
  }
  const FONT = ' system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif';
  function text(s, x, y, size, color, align, outline) {
    // y = Oberkante der Schrift; align: 0 links, 1 Mitte, 2 rechts
    ctx.font = '900 ' + size + 'px' + FONT;
    ctx.textAlign = align === 1 ? 'center' : align === 2 ? 'right' : 'left';
    ctx.textBaseline = 'top';
    if (outline !== false) {
      ctx.lineJoin = 'round'; ctx.lineWidth = size * 0.24;
      ctx.strokeStyle = outline || '#101018';
      ctx.strokeText(s, x, y);
    }
    ctx.fillStyle = color;
    ctx.fillText(s, x, y);
  }
  function textWidth(s, size) {
    ctx.font = '900 ' + size + 'px' + FONT;
    return ctx.measureText(s).width;
  }
  function coins(n, x, y, size, align, color) {
    // Münz-Symbol + Zahl
    const s = String(n), w = textWidth(s, size) + size * 1.15;
    const x0 = align === 1 ? x - w / 2 : align === 2 ? x - w : x;
    circ([x0 + size * 0.45, y + size * 0.5], size * 0.45, '#b8860b');
    circ([x0 + size * 0.45, y + size * 0.5], size * 0.33, '#ffd23f');
    text(s, x0 + size * 1.15, y, size, color || '#ffffff', 0);
  }
  function hash(n, k) {
    let x = Math.imul(n | 0, 374761393) + Math.imul(k | 0, 668265263);
    x = Math.imul(x ^ (x >>> 13), 1274126177);
    x ^= x >>> 16;
    return (x >>> 0) / 4294967296;
  }
  function rainbow(h) {
    const x = floor(h * 1530) % 1530, i = floor(x / 255), f = x % 255;
    if (i === 0) return 0xFF0000 | (f << 8);
    if (i === 1) return ((255 - f) << 16) | 0xFF00;
    if (i === 2) return 0x00FF00 | f;
    if (i === 3) return ((255 - f) << 8) | 0xFF;
    if (i === 4) return (f << 16) | 0xFF;
    return 0xFF0000 | (255 - f);
  }
  function shade(c, k) {
    // k < 0 dunkler, k > 0 heller
    let r = (c >> 16) & 255, g = (c >> 8) & 255, b = c & 255;
    if (k < 0) { r *= 1 + k; g *= 1 + k; b *= 1 + k; }
    else { r += (255 - r) * k; g += (255 - g) * k; b += (255 - b) * k; }
    return 'rgb(' + (r | 0) + ',' + (g | 0) + ',' + (b | 0) + ')';
  }

  // ------------------------------------------------------------------
  // Scooter und Fahrer zeichnen (Nullpunkt = Hinterachse)
  // ------------------------------------------------------------------
  function joint(a, b, l1, l2, px, py) {
    // Gelenk (Knie, Ellbogen) zwischen a und b; px/py = dorthin soll es zeigen
    const dx = b[0] - a[0], dy = b[1] - a[1], d = Math.hypot(dx, dy) || 0.001;
    if (d >= l1 + l2) { const k = l1 / (l1 + l2); return [a[0] + dx * k, a[1] + dy * k]; }
    const x = (l1 * l1 - l2 * l2 + d * d) / (2 * d);
    let h = Math.sqrt(max(0, l1 * l1 - x * x));
    const ux = dx / d, uy = dy / d;
    if (-uy * px + ux * py < 0) h = -h;
    return [a[0] + ux * x - uy * h, a[1] + uy * x + ux * h];
  }

  function body(th, pose, lean, dy) {
    // die wichtigen Punkte: S = Scooter-Koordinaten (x nach vorn, y nach oben),
    // hip = Hüfte, psi = Neigung vom Oberkörper (Grad)
    const ct = cos(th), st = sin(th), cp = cos(th * lean), sp = sin(th * lean);
    const S = (x, y) => [x * ct - y * st, -(x * st + y * ct)];
    const mx = 9.5 * ct - (0.6 + dy) * st, my = -9.5 * st - (0.6 + dy) * ct;
    const p = clamp(pose, 0, 2), i = p >= 1 ? 1 : 0, f = p - i, A = POSES[i], B = POSES[i + 1];
    const hx = A[0] + (B[0] - A[0]) * f, hy = A[1] + (B[1] - A[1]) * f;
    const hip = [mx + hx * cp - hy * sp, my - hx * sp - hy * cp];
    return { S, hip, cp, sp, th, psi: th * 180 / PI * lean + A[2] + (B[2] - A[2]) * f };
  }

  function wheel(p, r, rot, kind, col, motor) {
    // kind: 0 normal, 1 Stollen (Gelände), 2 extra breit
    circ(p, r, '#17171c');
    if (kind === 1) {
      ctx.strokeStyle = '#2c2c34'; ctx.lineWidth = 1.1; ctx.lineCap = 'butt';
      ctx.setLineDash([1.1, 1.3]); ctx.lineDashOffset = -rot * r;
      ctx.beginPath(); ctx.arc(p[0], p[1], r - 0.45, 0, 2 * PI); ctx.stroke();
      ctx.setLineDash([]);
    }
    const ri = r * (kind === 2 ? 0.46 : 0.56);
    if (kind === 2) circ(p, ri + 0.7, col);
    circ(p, ri, '#a8aeb6');
    ctx.strokeStyle = '#5d636e'; ctx.lineWidth = 0.7; ctx.lineCap = 'butt';
    ctx.beginPath();
    for (let k = 0; k < 3; k++) {
      const a = rot + k * PI / 3;
      ctx.moveTo(p[0] - cos(a) * ri, p[1] - sin(a) * ri);
      ctx.lineTo(p[0] + cos(a) * ri, p[1] + sin(a) * ri);
    }
    ctx.stroke();
    if (motor) { circ(p, r * 0.36, '#3a3b44'); circ(p, r * 0.27, '#17171c'); circ(p, r * 0.1, '#a8aeb6'); }
    else circ(p, r * 0.2, '#17171c');
    ctx.strokeStyle = 'rgba(255,255,255,0.13)'; ctx.lineWidth = 0.6;     // Glanz auf dem Reifen
    ctx.beginPath(); ctx.arc(p[0], p[1], r - 0.8, -2.4, -1.2); ctx.stroke();
  }

  function fender(S, th, x, r, a0, a1, c) {
    // Schutzblech: Bogen um das Rad, Winkel in Grad (0 = nach vorn, 90 = oben)
    const p = S(x, 0);
    ctx.strokeStyle = c; ctx.lineWidth = 1.5; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.arc(p[0], p[1], r + 1.5, -(rad(a1) + th), -(rad(a0) + th)); ctx.stroke();
  }

  function drawScooter(model, S, th, col, rotF, rotR, dual) {
    const c = hex(col), cd = shade(col, -0.3), cl = shade(col, 0.35);
    const D = '#17171c', D2 = '#2a2b33', M = '#a8aeb6', r = model.r, wb = model.wb;
    if (model === SCOOTERS[0]) {
      // --- Ninebot Max G3: schlank, Pendler-Scooter ---
      wheel(S(0, 0), r, rotR, 0, c, true);
      wheel(S(wb, 0), r, rotF, 0, c, dual);
      fender(S, th, 0, r, 35, 150, D2);
      circ(S(-5.4, 3.6), 0.9, '#ff3b30');                       // Rücklicht
      fender(S, th, wb, r, 40, 140, D2);
      seg(S(26, 0), S(24.3, 5.5), 2.2, D);                      // Gabel
      poly([S(1, 0.9), S(21, 0.9), S(21.8, -0.6), S(20.6, -2.4), S(1.6, -2.4), S(0.6, -0.8)], c);   // Trittbrett
      poly([S(1.4, -1.2), S(21, -1.2), S(20.6, -2.4), S(1.6, -2.4)], cd);
      seg(S(3, 0.9), S(19, 0.9), 0.9, D2);                      // Gummi-Matte
      seg(S(19.5, -0.8), S(24.3, 5.0), 3.0, c);                 // Hals
      seg(S(24.3, 5.0), S(21.3, 22.5), 2.4, D2);                // Lenkstange
      seg(S(24.0, 6.6), S(23.1, 12), 2.5, c);
      seg(S(18.6, 22.8), S(23.8, 22.8), 2.4, D);                // Lenker
      seg(S(20.6, 24.2), S(22.6, 24.2), 1.2, '#2bd4ff');        // Display
      seg(S(23.5, 17.0), S(23.9, 19.3), 2.2, '#fff3b8');        // Licht
    } else if (model === SCOOTERS[1]) {
      // --- Kukirin G4: kräftig, Gelände-Reifen, Federung ---
      seg(S(0, 0), S(5, 0.2), 2.6, D2);                         // Schwinge hinten
      seg(S(wb, 0), S(22.4, 2.6), 2.6, D2);                     // Schwinge vorn
      wheel(S(0, 0), r, rotR, 1, c, true);
      wheel(S(wb, 0), r, rotF, 1, c, dual);
      fender(S, th, 0, r, 50, 135, D);
      fender(S, th, wb, r, 45, 140, D);
      seg(S(25.4, 1.6), S(23.4, 7.6), 1.9, '#e8322b');          // Feder vorn
      seg(S(25.4, 1.6), S(23.4, 7.6), 0.6, '#ffb0a8');
      poly([S(-5.2, 6.2), S(-3.6, 7.4), S(3.4, 1.6), S(0.6, 1.4)], D2);       // Fußstütze hinten
      seg(S(-4.6, 6.6), S(-3.6, 5.8), 1.0, '#ff3b30');
      poly([S(1, 1.5), S(21.4, 1.5), S(22.6, -0.6), S(21, -3.3), S(2.4, -3.3), S(0.6, -0.8)], c);   // Trittbrett
      poly([S(1.8, -1.9), S(21.8, -1.9), S(21, -3.3), S(2.4, -3.3)], cd);
      seg(S(4.6, -0.3), S(18.6, -0.3), 1.3, D);                 // Seitenstreifen
      seg(S(3, 1.5), S(19.6, 1.5), 0.9, D2);
      seg(S(20.4, 0.2), S(24.6, 6.5), 3.8, D2);                 // Klapp-Gelenk
      seg(S(24.6, 6.5), S(21.4, 22.6), 3.0, c);                 // Lenkstange
      seg(S(24.9, 6.5), S(21.7, 22.6), 0.7, cl);
      circ(S(26.0, 9.6), 1.6, D);                               // Scheinwerfer
      circ(S(26.3, 9.6), 1.0, '#fff3b8');
      seg(S(18.2, 23.0), S(24.0, 23.0), 2.6, D);                // Lenker
      seg(S(20.2, 24.6), S(22.8, 24.6), 1.5, '#2bd4ff');
    } else {
      // --- Dualtron X Limited: riesig, doppelte Lenkstange, fette Reifen ---
      seg(S(0, 0), S(6, 1.2), 3.6, D2);                         // Schwingen
      seg(S(wb, 0), S(23.4, 1.4), 3.6, D2);
      wheel(S(0, 0), r, rotR, 2, c, true);
      wheel(S(wb, 0), r, rotF, 2, c, dual);
      fender(S, th, wb, r, 55, 135, D);
      seg(S(27.6, 1.6), S(24.6, 8.4), 2.2, '#ffc83d');          // Federbein vorn
      seg(S(27.6, 1.6), S(24.6, 8.4), 0.7, '#fff3b8');
      seg(S(2.6, 1.4), S(5.4, 3.2), 2.2, '#ffc83d');            // Federbein hinten
      poly([S(-3.4, 8.8), S(-1.6, 9.8), S(5.6, 3.0), S(2.6, 2.4), S(-3.2, 6.2)], D2);   // Fußstütze hinten
      seg(S(-3.3, 8.4), S(-3.1, 6.8), 1.1, '#ff3b30');
      poly([S(3.4, 2.4), S(23, 2.4), S(24.4, 0.2), S(22.8, -3.7), S(4.6, -3.7), S(2.8, -0.9)], D2);   // Akku-Kasten
      seg(S(5.2, 0.4), S(22.2, 0.4), 1.7, c);                   // Farb-Streifen
      seg(S(5.6, -2.5), S(21.6, -2.5), 0.6, cl);                // LED-Leiste
      seg(S(4.4, 2.4), S(21.6, 2.4), 0.9, '#3a3b44');
      seg(S(22.6, 2.0), S(19.9, 23.0), 2.0, c);                 // doppelte Lenkstange
      seg(S(25.6, 2.6), S(22.7, 23.0), 2.0, c);
      seg(S(24.0, 8.0), S(22.0, 8.0), 1.3, D);
      seg(S(22.9, 15.5), S(21.0, 15.5), 1.3, D);
      circ(S(27.1, 7.6), 1.5, D); circ(S(27.4, 7.6), 0.95, '#fff3b8');      // zwei Scheinwerfer
      circ(S(26.6, 11.2), 1.5, D); circ(S(26.9, 11.2), 0.95, '#fff3b8');
      seg(S(17.8, 23.4), S(24.6, 23.4), 2.9, D);                // Lenker
      seg(S(20.0, 25.2), S(23.0, 25.2), 1.6, '#2bd4ff');
    }
    void M;
  }

  const SKIN = '#f4c7a1', SKIN_D = '#d79f7a', SHIRT = '#e84a3c', SHIRT_D = '#b8372d';
  const LEG_F = '#33509a', LEG_B = '#25356e', SHOE = '#ededf2';

  function drawLeg(g, model, front) {
    const S = g.S, ax = front ? 14.5 : 5.5, c = front ? LEG_F : LEG_B, dy = model.dy;
    const ankle = S(ax, 2.3 + dy);
    const knee = joint(ankle, g.hip, LEG, LEG, g.cp, -g.sp);
    seg(ankle, knee, 3.2, c);
    seg(knee, g.hip, 3.8, c);
    seg(S(ax - 1.6, 1.7 + dy), S(ax + 2.2, 1.7 + dy), 2.4, SHOE);
    seg(S(ax - 1.8, 0.8 + dy), S(ax + 2.4, 0.8 + dy), 0.6, '#9a9aa6');
  }

  function drawSwing(hip, ph) {
    // das freie Bein im Wheelie: hängt an der Hüfte, ph = Winkel nach hinten
    const knee = [hip[0] - 8.6 * sin(ph), hip[1] + 8.6 * cos(ph)], q = ph + 0.3;
    const foot = [knee[0] - 8.4 * sin(q), knee[1] + 8.4 * cos(q)];
    seg(hip, knee, 3.8, LEG_F);
    seg(knee, foot, 3.2, LEG_F);
    seg([foot[0] - 1.0 * cos(q), foot[1] - 1.0 * sin(q)], [foot[0] + 2.6 * cos(q), foot[1] + 2.6 * sin(q)], 2.4, SHOE);
  }

  function drawTorso(hip, psi, col) {
    const a = rad(psi), ux = -sin(a), uy = -cos(a), fx = cos(a), fy = -sin(a);
    const P = (al, fr) => [hip[0] + ux * al + fx * (fr || 0), hip[1] + uy * al + fy * (fr || 0)];
    seg(P(0.6), P(TORSO - 0.6), 5.6, SHIRT);                    // Shirt
    seg(P(0.6, -2.0), P(TORSO - 0.8, -2.0), 1.5, SHIRT_D);      // Schatten am Rücken
    seg(P(3.2, 0.9), P(TORSO - 2.6, 0.9), 0.9, '#ffffff');      // Streifen
    seg(P(TORSO + 0.2, 0.3), P(TORSO + 2.4, 0.5), 2.4, SKIN_D);  // Hals
    const head = P(16.1, 0.5);
    circ(head, 3.7, SKIN);
    ctx.fillStyle = hex(col);                                   // Helm: von der Stirn bis in den Nacken
    ctx.beginPath();
    for (let k = -1; k < 12; k++) {
      const w = rad(8 + k * 17) - a;
      const x = head[0] + 4.5 * cos(w), y = head[1] - 4.5 * sin(w) - 0.2;
      if (k < 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.closePath(); ctx.fill();
    seg(P(17.6, 2.0), P(19.3, 0.4), 1.0, 'rgba(255,255,255,0.75)');       // Glanzlicht
    seg(P(16.7, 2.6), P(16.3, 5.9), 1.3, '#20202a');            // Schirm
    circ(P(15.0, 3.0), 0.55, '#20202a');                        // Auge
    seg(P(13.4, -2.6), P(13.0, 0.4), 0.6, '#20202a');           // Kinnriemen
    return P(TORSO);
  }

  function drawBarArm(sh, grip, psi) {
    const a = rad(psi);
    const el = joint(sh, grip, ARM, ARM, sin(a) - 0.7 * cos(a), cos(a) + 0.7 * sin(a));
    seg(sh, el, 2.6, SHIRT);
    seg(el, grip, 2.2, SKIN);
    circ(grip, 1.5, SKIN);
  }

  function drawUpArm(sh, phi, o) {
    // hochgestreckter Arm (o = -1 hinten, 1 vorn), phi in Grad
    const cp = cos(rad(phi)), sp = sin(rad(phi));
    const el = [sh[0] + o * 3.5 * cp - 5.5 * sp, sh[1] - o * 3.5 * sp - 5.5 * cp];
    const hand = [sh[0] + o * 5.5 * cp - 11.5 * sp, sh[1] - o * 5.5 * sp - 11.5 * cp];
    seg(sh, el, 2.6, o < 0 ? SHIRT_D : SHIRT);
    seg(el, hand, 2.2, o < 0 ? SKIN_D : SKIN);
    circ(hand, 1.5, o < 0 ? SKIN_D : SKIN);
  }

  function drawRider(x, y, o) {
    // o: model, col, th, pose, arms, swing (Winkel oder null), lean, rotF, rotR
    const model = o.model, g = body(o.th, o.pose, o.lean, model.dy);
    ctx.save();
    ctx.translate(x, y);
    drawScooter(model, g.S, o.th, o.col, o.rotF, o.rotR, o.dual);
    drawLeg(g, model, false);
    if (o.swing !== null) drawSwing(g.hip, o.swing); else drawLeg(g, model, true);
    const sh = drawTorso(g.hip, g.psi, o.col);
    circ(g.hip, 2.2, LEG_F);
    const phi = o.th * 180 / PI * o.lean;
    if (o.arms === 2) drawUpArm(sh, phi, 1);
    else drawBarArm(sh, g.S(20.3, 22.8), g.psi);
    if (o.arms) drawUpArm(sh, phi, -1);
    ctx.restore();
  }

  // ------------------------------------------------------------------
  // Hintergrund: mehrere Ebenen, die verschieden schnell vorbeiziehen
  // ------------------------------------------------------------------
  const WALLS = ['#f0e7d3', '#f3c9a2', '#c3e0cc', '#cbd8ea', '#e8c7d0', '#f6e3a8'];
  function cells(off, cw, fn) {
    const n0 = floor(off / cw) - 1, n1 = floor((off + W) / cw) + 1;
    for (let n = n0; n <= n1; n++) fn(n, n * cw - off);
  }

  function drawWorld(dist, t) {
    const base = GY - 16;
    ctx.fillStyle = skyGrad;
    ctx.fillRect(0, 0, W, base + 1);
    const sx = W * 0.8, sy = max(13, base * 0.26);            // Sonne mit Schein
    const sg = ctx.createRadialGradient(sx, sy, 2, sx, sy, 30);
    sg.addColorStop(0, 'rgba(255,240,170,0.9)');
    sg.addColorStop(0.3, 'rgba(255,236,150,0.35)');
    sg.addColorStop(1, 'rgba(255,236,150,0)');
    ctx.fillStyle = sg;
    ctx.fillRect(sx - 30, sy - 30, 60, 60);
    circ([sx, sy], 8, '#ffe27a');

    ctx.fillStyle = 'rgba(255,255,255,0.92)';                   // Wolken
    cells(dist * 0.02 + t * 1.5, 70, (n, x) => {
      const cx = x + hash(n, 1) * 40, cy = 5 + hash(n, 2) * base * 0.42, s = 0.6 + hash(n, 3) * 0.7;
      ctx.beginPath();
      for (const [dx, dy, r] of [[0, 4, 5], [6, 1, 6], [13, 3, 5], [19, 5, 4], [7, 6, 5]]) {
        ctx.moveTo(cx + dx * s + r * s, cy + dy * s);
        ctx.arc(cx + dx * s, cy + dy * s, r * s, 0, 2 * PI);
      }
      ctx.fill();
    });

    cells(dist * 0.06, 15, (n, x) => {                          // Hochhäuser ganz hinten
      const w = 9 + hash(n, 4) * 7, h = 20 + hash(n, 5) * 34;
      ctx.fillStyle = '#a9c4e4';
      ctx.fillRect(x, base - h, w, h + 1);
      ctx.fillStyle = '#c4d9f0';
      for (let wy = base - h + 3; wy < base - 6; wy += 5)
        for (let wx = x + 2; wx < x + w - 2.5; wx += 4)
          if (hash(n * 31 + (wx - x | 0), wy - base | 0) < 0.6) ctx.fillRect(wx, wy, 2, 2);
    });
    cells(dist * 0.16, 24, (n, x) => {                          // Hochhäuser in der Mitte
      const w = 14 + hash(n, 6) * 9, h = 14 + hash(n, 7) * 26;
      ctx.fillStyle = '#8fabd2';
      ctx.fillRect(x, base - h, w, h + 1);
      if (hash(n, 8) < 0.4) ctx.fillRect(x + w / 2 - 0.5, base - h - 6, 1, 6);    // Antenne
      ctx.fillStyle = '#b6cdea';
      for (let wy = base - h + 3; wy < base - 5; wy += 6)
        for (let wx = x + 2; wx < x + w - 3.5; wx += 5)
          if (hash(n * 17 + (wx - x | 0), wy - base | 0) < 0.65) ctx.fillRect(wx, wy, 3, 3);
    });
    ctx.fillStyle = 'rgba(191,227,248,0.35)';                   // Dunst
    ctx.fillRect(0, base - 40, W, 41);

    cells(dist * 0.45, 54, (n, x) => {                          // Häuser an der Straße
      const w = 30 + floor(hash(n, 9) * 3) * 6, h = 22 + hash(n, 10) * 17, hx = x + 2, top = base - h;
      const flat = hash(n, 11) < 0.45, shop = hash(n, 13) < 0.3;
      ctx.fillStyle = WALLS[floor(hash(n, 12) * WALLS.length)];
      ctx.fillRect(hx, top, w, h + 1);
      ctx.fillStyle = 'rgba(0,0,0,0.07)';
      ctx.fillRect(hx + w - 3, top, 3, h + 1);
      if (flat) {
        ctx.fillStyle = '#5c6781';
        ctx.fillRect(hx - 1, top - 2, w + 2, 2.5);
      } else {
        poly([[hx - 2, top + 0.5], [hx + w / 2, top - w * 0.3], [hx + w + 2, top + 0.5]], '#b04e3e');
        poly([[hx + w / 2, top - w * 0.3], [hx + w + 2, top + 0.5], [hx + w - 2, top + 0.5]], '#8f3d30');
      }
      const low = shop ? base - 14 : base - 4;
      for (let wy = top + 4; wy + 7 < low; wy += 10)
        for (let wx = hx + 4; wx + 6 < hx + w - 2; wx += 9) {
          ctx.fillStyle = '#ffffff'; ctx.fillRect(wx - 0.7, wy - 0.7, 6.4, 7.4);
          ctx.fillStyle = '#6c8db8'; ctx.fillRect(wx, wy, 5, 6);
          ctx.fillStyle = '#9fc0e4'; ctx.fillRect(wx, wy, 5, 2.2);
        }
      if (shop) {                                               // Laden mit Markise
        ctx.fillStyle = '#4a5d7a'; ctx.fillRect(hx + 3, base - 10, w - 6, 10);
        ctx.fillStyle = '#9fc0e4'; ctx.fillRect(hx + 4, base - 9, w - 15, 7);
        ctx.fillStyle = '#7a4e36'; ctx.fillRect(hx + w - 9.5, base - 9, 5, 9.5);
        for (let k = 0; k * 3 < w - 2; k++) {
          ctx.fillStyle = k & 1 ? '#ffffff' : '#e84a3c';
          ctx.fillRect(hx + 1 + k * 3, base - 13.5, min(3, w - 2 - k * 3), 3.5);
        }
      } else {
        ctx.fillStyle = '#7a4e36'; ctx.fillRect(hx + 5 + hash(n, 14) * (w - 16), base - 9, 6, 9.5);
      }
      const tx = hx + w + (54 - w) / 2;                         // Baum in der Lücke
      ctx.fillStyle = '#6b4a2b'; ctx.fillRect(tx - 1, base - 13, 2.4, 13.5);
      circ([tx, base - 19], 8, '#3d8f4b');
      circ([tx - 2, base - 22], 5, '#55b462');
      circ([tx + 4, base - 17], 3, '#55b462');
    });

    ctx.fillStyle = '#b9b9c3'; ctx.fillRect(0, base, W, 7.5);    // Gehweg
    ctx.fillStyle = '#9d9da8';
    cells(dist, 20, (n, x) => ctx.fillRect(x, base + 0.5, 0.7, 6.5));
    ctx.fillStyle = '#d0d0d8'; ctx.fillRect(0, base, W, 0.7);
    ctx.fillStyle = '#7a7a86'; ctx.fillRect(0, base + 7, W, 2.6);    // Bordstein
    ctx.fillStyle = roadGrad; ctx.fillRect(0, base + 9.5, W, H - base);
    ctx.fillStyle = '#8e8e99'; ctx.fillRect(0, base + 9.5, W, 0.8);
    ctx.fillStyle = '#ededed';                                  // Mittelstreifen
    cells(dist * 1.25, 64, (n, x) => ctx.fillRect(x, GY + 12, 32, 2.2));
    ctx.fillStyle = 'rgba(237,237,237,0.55)';
    ctx.fillRect(0, H - 3.4, W, 1.6);
    cells(dist, 330, (n, x) => {                                // Kanaldeckel
      ctx.fillStyle = '#26262e'; ctx.beginPath();
      ctx.ellipse(x + 40 + hash(n, 15) * 200, GY + 5, 5, 1.4, 0, 0, 2 * PI); ctx.fill();
    });

    cells(dist, 80, (n, x) => {                                 // Laternen und Bäume am Gehweg
      const by = base + 6;
      if (((n % 3) + 3) % 3 === 1) {
        ctx.fillStyle = '#6b4a2b'; ctx.fillRect(x + 6.5, by - 16, 3, 16);
        circ([x + 8, by - 21], 8.5, '#3d8f4b');
        circ([x + 6, by - 24], 5.4, '#55b462');
        circ([x + 12, by - 19], 3.4, '#55b462');
      } else {
        ctx.fillStyle = '#2e323a'; ctx.fillRect(x + 3, by - 4, 4, 4);
        ctx.fillStyle = '#4a4f5a'; ctx.fillRect(x + 4.2, by - 33, 1.7, 30);
        ctx.fillStyle = '#2e323a'; ctx.fillRect(x + 1, by - 40, 8, 7);
        ctx.fillStyle = '#fff3b8'; ctx.fillRect(x + 2, by - 39, 6, 4.4);
        ctx.fillStyle = '#2e323a'; ctx.fillRect(x + 2, by - 41.5, 6, 2);
      }
    });
  }

  // ------------------------------------------------------------------
  // Rauch, Staub und Boost-Flammen
  // ------------------------------------------------------------------
  const puffs = [];
  function emitPuff(x, y, vx, vy, life, kind) {
    if (puffs.length < 60) puffs.push({ x, y, vx, vy, age: 0, life, kind });
  }
  function updatePuffs(dt, scroll) {
    for (let i = puffs.length - 1; i >= 0; i--) {
      const p = puffs[i];
      p.age += dt;
      if (p.age >= p.life) { puffs.splice(i, 1); continue; }
      p.x += p.vx * dt - scroll;
      p.y += p.vy * dt;
      p.vx *= Math.pow(0.96, dt * 30);
    }
  }
  function drawPuffs() {
    for (const p of puffs) {
      const f = p.age / p.life;
      if (p.kind) {                                             // Flamme: wird kleiner
        const r = 5.4 - 3.4 * f;
        circ([p.x, p.y], r, '#e8473c');
        circ([p.x, p.y], r * 0.75, '#ffb52e');
        circ([p.x, p.y], r * 0.4, '#fff3a0');
      } else {                                                  // Rauch: wird größer
        ctx.globalAlpha = 0.85 * (1 - f * f);
        circ([p.x, p.y], 2.2 + 3.6 * f, '#b4b4bc');
        circ([p.x - 0.4, p.y - 0.4], 1.4 + 2.9 * f, '#e6e6ea');
        ctx.globalAlpha = 1;
      }
    }
  }

  // ------------------------------------------------------------------
  // Das Spiel
  // ------------------------------------------------------------------
  const G = {
    state: MENU, t: 0, dist: 0, v: 0, th: 0, om: 0, b: 0, bv: 0, wmode: false, landing: false,
    inWheelie: false, arms: 0, crouch: false, kn: 0, dip: 0, ph: 0, sw: 0, wd: 0, wt: 0, tp: 0,
    burn: false, burnT: 0, boost: false, crashT: 0, shakeT: 0, bannerT: 0, dpx: 0,
    markX: -99, markLen: 0, emit: 0, big: '', sub: '', msg: '', toast: '', toastT: 0, recordT: 0,
    rotF: 0, rotR: 0, hy: -18, tuning: false, lines: [0, 1, 2, 3].map(() => ({ x: -99, y: 0 })),
    body: 0x19C2A0, fps: 0, frames: 0, fpsT: 0,
  };
  const model = () => SCOOTERS[store.scooter];
  const axleY = () => GY - model().r;

  function resetRide() {
    G.v = 0; G.th = 0; G.om = 0; G.b = 0; G.bv = 0;
    G.wmode = false; G.landing = false; G.inWheelie = false;
    G.arms = 0; G.crouch = false; G.kn = 0; G.dip = 0; G.ph = 0; G.sw = 0;
    G.wd = 0; G.wt = 0; G.tp = 0;
    G.burn = false; G.burnT = 0; G.boost = false;
    G.crashT = 0; G.shakeT = 0; G.bannerT = 0; G.dpx = 0;
    G.markX = -99; G.markLen = 0; G.emit = 0;
    G.big = ''; G.sub = ''; G.msg = ''; G.toast = ''; G.toastT = 0;
    puffs.length = 0;
    for (const l of G.lines) l.x = -99;
  }
  function gotoMenu() { G.state = MENU; G.tuning = false; resetRide(); }
  function toast(s) { G.toast = s; G.toastT = 1.8; }
  function startGame() {
    saveStore();
    applyTuning();
    G.state = PLAY;
    resetRide();
    toast('LOS!');
    play(SND_START);
  }

  function physics(h, gas, brake) {
    // Ein kleiner Zeitschritt. Gibt true zurück, wenn das Vorderrad aufsetzt.
    const VMAX = car.vmax;
    let v = G.v;
    if (G.boost) {                              // Boost: zieht richtig schnell bis zur Höchstgeschwindigkeit
      v += car.boost * h;
      if (v >= VMAX || brake || !gas) G.boost = false;
    } else if (gas && !brake) {                 // Motor: unten viel Kraft, oben weniger
      v += min(car.accel, car.power / (v + 0.5)) * h;
    }
    if (brake) v -= car.brake * h * (G.th > 0 ? 0.5 : 1.0);
    v -= (ROLL + AERO * v * v) * h;             // Roll- und Luftwiderstand
    if (v < 0.0) v = 0.0; else if (v > VMAX) v = VMAX;
    G.v = v;

    // Drehung um die Hinterachse: die Schwerkraft zieht das Vorderrad nach unten
    let th = G.th, om = G.om;
    if (th <= 0.0 && om <= 0.0 && !G.wmode) return false;       // beide Räder am Boden
    let a = -GRAVITY * cos(PHI0 + th) - DAMPING * om * (G.crouch ? 1.6 : 1.0);
    if (G.landing) {
      a -= LAND_TORQUE;
    } else if (G.wmode) {
      const f = v / VMAX;
      if (gas) a += LIFT * min(1.0, v * 0.5) * (1.0 - 0.3 * f * f);
      if (brake) a -= BRAKE_TORQUE * CTRL[G.arms];
      a += WOBBLE[G.arms] * sin(G.t * 3.1);
    }
    om += a * h;
    if (G.landing && om < -LAND_SPEED) om = -LAND_SPEED;
    th += om * h;
    if (th <= 0.0) {
      const landed = G.th > 0.0;
      if (landed) {
        G.bv += BOUNCE * (0.6 - 0.5 * om);      // Aufsetzen: das Vorderrad federt nach
        if (om < -2.4) G.v *= 0.94;             // harte Landung kostet etwas Tempo
      }
      G.th = 0.0; G.om = 0.0;
      return landed;
    }
    G.th = th; G.om = om;
    return false;
  }

  function updatePlay(dt) {
    const gas = (held & BTN_A) !== 0, brake = (held & BTN_B) !== 0, ay = axleY();
    const dual = store.tune[store.scooter][DUAL] > 0;
    if (pressed & BTN_UP) {
      if (!G.wmode) { G.wmode = true; G.landing = false; G.om += POP; }      // Vorderrad hochreißen
      else if (G.th > 0) G.landing = true;                                   // nochmal: sanft landen
      else G.wmode = false;
    }
    const arms = held & BTN_RIGHT ? 2 : (held & BTN_LEFT ? 1 : 0);
    const crouch = (held & BTN_DOWN) !== 0;
    if (arms !== G.arms || crouch !== G.crouch) {
      G.arms = arms; G.crouch = crouch;
      if (G.inWheelie && (arms || crouch)) play(SND_TRICK);
    }
    G.kn = clamp(G.kn + (crouch ? dt * 14.0 : dt * -14.0), 0.0, 2.0);        // weich in die Hocke und zurück
    if (G.dip > 0) G.dip -= dt;

    // Burnout: Gas + Bremse im Stand. Nach 1 Sekunde Bremse loslassen = Boost!
    const burn = gas && brake && G.v < 0.4 && G.th === 0 && !G.wmode;
    if (burn !== G.burn) {
      G.burn = burn;
      G.sub = '';
      if (burn) {
        G.burnT = 0.0; G.bannerT = 0.0; G.markLen = 0; G.markX = RX + 3;
        G.big = 'BURNOUT!';
      } else if (gas && G.burnT >= BURNOUT_TIME) {
        G.boost = true;
        G.big = 'BOOST!';
        play(SND_BOOST);
        buzz(60);
      } else {
        G.big = '';
      }
    }
    if (burn) {
      const t0 = G.burnT, t1 = G.burnT = t0 + dt;
      G.markLen = min(40, t1 * 30);             // Reifenspur wird länger
      if (t1 >= BURNOUT_TIME && BURNOUT_TIME > t0) play(SND_READY);
      if (t1 >= BURNOUT_TIME) G.sub = floor(G.t * 5) & 1 ? 'BREMSE LOS = BOOST!' : '';
      G.emit += dt * 16;                        // Rauch am Hinterrad
      if (G.emit >= 1) {
        G.emit -= 1;
        emitPuff(RX - 3 + randint(-2, 2), GY - 2, -25 - random() * 35, -12 - random() * 18,
          0.7 + random() * 0.5, 0);
        if (dual)                               // Dual-Motor: auch das Vorderrad dreht durch
          emitPuff(RX + model().wb - 3 + randint(-2, 2), GY - 2, -25 - random() * 35,
            -12 - random() * 18, 0.7 + random() * 0.5, 0);
      }
      G.rotR += dt * 45;
      if (dual) G.rotF += dt * 45;
    } else if (G.boost) {                       // Flammen hinten raus
      G.emit += dt * 20;
      if (G.emit >= 1) {
        G.emit -= 1;
        emitPuff(RX - 8, ay - 2 + randint(-2, 2), -60 - random() * 60, randint(-12, 12), 0.25, 3);
      }
    }

    // Physik in kleinen Schritten
    const v0 = G.v, wasBoost = G.boost;
    let landed = false;
    const n = floor(dt * 60) + 1, h = dt / n;
    for (let i = 0; i < n; i++) if (physics(h, gas, brake)) { landed = true; break; }
    let v = G.v;
    if (wasBoost && !G.boost) {
      G.big = '';
      if (v >= car.vmax - 0.5) toast(car.kmh + ' KM/H!');
    }

    // Wippen: im Boost wird das Vorderrad leicht, beim Landen federt es nach
    const sq = G.th === 0 ? clamp(((v - v0) / dt - 7.0) * 0.03, 0.0, 0.21) : 0.0;
    G.bv += ((sq - G.b) * 90.0 - G.bv * 12.0) * dt;
    G.b += G.bv * dt;
    if (G.b < 0.0) { G.b = 0.0; if (G.bv < 0.0) G.bv = 0.0; }

    // Im Wheelie steht nur ein Fuß auf dem Scooter, das andere Bein schwingt frei:
    // die Schwerkraft zieht es nach unten, Gas wirft es nach hinten, Kippen bewegt es.
    if (G.th > 0) {
      let ph = G.ph;
      let sw = G.sw + (cos(ph) * (v - v0) / dt * 0.5 + G.om * 4.0 - 16.0 * sin(ph) - 1.2 * G.sw) * dt;
      ph += sw * dt;
      let k = (model().r - G.hy) / LEG_REACH;   // Hüfte so tief, dass der Fuß den Boden trifft?
      k = k < 1.0 ? Math.acos(k) : -1.0;
      if (ph < k) {                             // Fuß schlägt auf dem Boden auf und prallt ab
        ph = k;
        if (sw < -0.8) {
          G.v = v = v * 0.985;
          emitPuff(RX + 2 - LEG_REACH * sin(k), GY - 1, -20.0, -16.0, 0.3, 0);
          play(SND_TICK);
        }
        sw = sw * -0.5 + 1.5;
      } else if (ph > 1.3) {
        ph = 1.3;
        sw *= -0.4;
      }
      G.ph = ph; G.sw = sw;
    } else {
      G.ph = G.sw = 0.0;
    }

    const d = v * dt;
    G.dpx = d * PX_PER_M;

    if (G.th > 0 && !G.inWheelie) {
      G.inWheelie = true;
      G.wd = 0.0; G.wt = 0.0; G.tp = 0.0; G.bannerT = 0.0; G.msg = '';
    }
    if (G.inWheelie) {
      G.wd += d;
      G.wt += dt;
      G.tp += d * RATE[arms + (crouch ? 3 : 0)];
    }
    if (G.th >= CRASH_RAD) { crash(); return; }
    if (landed) {
      G.wmode = false; G.landing = false; G.dip = 0.16;
      if (v > 2) emitPuff(RX + model().wb, GY - 1, -10.0, -14.0, 0.3, 0);    // Staub beim Aufsetzen
      if (G.inWheelie) endWheelie();
    }
    if (G.bannerT > 0) {
      G.bannerT -= dt;
      if (G.bannerT <= 0) { G.big = ''; G.sub = ''; G.msg = ''; }
    }
  }

  function endWheelie() {
    G.inWheelie = false;
    if (G.wd < MIN_WHEELIE) { G.big = ''; G.sub = ''; return; }
    G.bannerT = 3.0;
    G.big = G.wd.toFixed(1) + ' M';
    const tp = floor(G.tp), won = floor(G.wd * COIN_PER_M) + tp;
    store.coins += won;
    G.msg = '';
    if (tp > 0 && tp > store.tbest) { store.tbest = tp; G.msg = 'TRICK-REKORD!'; }
    toast((tp > 0 ? 'TRICKS +' + tp + '   ' : '') + '+' + won + ' MÜNZEN');
    if (G.wd > store.best) {
      store.best = G.wd;
      G.recordT = 2.5;
      G.sub = 'NEUER REKORD!';
      play(SND_RECORD);
    } else {
      const d = G.wd;
      G.sub = (d < 10 ? 'OK!' : d < 30 ? 'NICE!' : d < 80 ? 'STARK!' : d < 200 ? 'MEGA!' :
        d < 500 ? 'WAHNSINN!' : 'LEGENDE!') + '  ' + G.wt.toFixed(1) + ' S';
      play(SND_LAND);
    }
    saveStore();
  }

  function crash() {
    G.state = CRASH;
    G.inWheelie = false; G.wmode = false; G.landing = false; G.burn = false; G.boost = false;
    G.crashT = 0.0; G.shakeT = 0.4; G.bannerT = 0.0;
    G.big = 'GESTÜRZT!';
    G.sub = G.wd >= MIN_WHEELIE ? G.wd.toFixed(1) + ' M ZÄHLT NICHT' : 'AUTSCH!';
    G.msg = '';
    play(SND_CRASH);
    buzz(200);
  }

  function updateCrash(dt) {
    G.crashT += dt;
    if (G.th < 1.745) {                         // kippt weiter bis 100 Grad
      G.om += 6.0 * dt;
      G.th = min(G.th + G.om * dt, 1.745);
    }
    G.v = max(0.0, G.v - 7.0 * dt);
    G.dpx = G.v * dt * PX_PER_M;
    if (G.crashT > 1.0) {
      G.msg = floor(G.t * 2.5) & 1 ? '' : (usedTouch ? 'TIPPEN = NOCHMAL' : 'START = NOCHMAL');
      if ((pressed & (BTN_START | BTN_A)) || (taps.length && !tapped(W / 2 - 22, 58, 44, 13))) {
        G.state = PLAY;
        resetRide();
      }
    }
  }

  // ---------------- Menü ----------------
  function setColor(dir) {
    const n = COLORS.length, i = store.scooter;
    store.color[i] = (store.color[i] + dir + n) % n;
    play(SND_TICK);
  }
  function setScooter(dir) {
    store.scooter = (store.scooter + dir + SCOOTERS.length) % SCOOTERS.length;
    applyTuning();
    play(SND_TICK);
  }
  function startOrBuy() {
    const i = store.scooter;
    if (store.owned[i]) { startGame(); return; }
    if (store.coins >= SCOOTERS[i].price) {
      store.coins -= SCOOTERS[i].price;
      store.owned[i] = true;
      saveStore();
      toast('GEKAUFT!');
      play(SND_BUY);
    } else {
      toast('ZU WENIG MÜNZEN');
      play(SND_OFF);
    }
  }
  function partPrice(i, level, k) {
    return Math.round((k === DUAL ? DUAL_PRICE : PART_PRICE[level]) * SCOOTERS[i].cost / 10) * 10;
  }
  function buyPart(k) {
    const i = store.scooter, lv = store.tune[i][k];
    if (lv >= levels(k)) return;
    const p = partPrice(i, lv, k);
    if (store.coins < p) { toast('ZU WENIG MÜNZEN'); play(SND_OFF); return; }
    store.coins -= p;
    store.tune[i][k] = lv + 1;
    applyTuning();
    saveStore();
    play(SND_BUY);
  }

  function button(x, y, w, h, label, o) {
    // zeichnet einen Knopf; gibt true zurück, wenn er angetippt wurde
    o = o || {};
    const hit = !o.inert && tapped(x, y, w, h);
    ctx.fillStyle = 'rgba(0,0,0,0.35)'; rrect(x, y + 1.2, w, h, 3); ctx.fill();
    ctx.fillStyle = o.off ? '#5b6072' : (o.color || '#2f4a8f'); rrect(x, y, w, h, 3); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.16)'; rrect(x + 0.8, y + 0.8, w - 1.6, h * 0.42, 2.4); ctx.fill();
    const size = o.size || min(6.2, h * 0.5);
    if (o.price !== undefined) coins(o.price, x + w / 2, y + (h - size) / 2 - 0.2, size, 1, o.off ? '#c8ccd8' : '#ffffff');
    else if (label === '<' || label === '>') {                 // Pfeil als Dreieck
      const d = label === '<' ? -1 : 1, mx = x + w / 2, my = y + h / 2, q = size * 0.5;
      poly([[mx + d * q, my], [mx - d * q * 0.8, my - q], [mx - d * q * 0.8, my + q]], '#ffffff');
    } else if (label) text(label, x + w / 2, y + (h - size) / 2 - 0.2, size, o.off ? '#c8ccd8' : (o.tc || '#ffffff'), 1);
    return hit;
  }

  function updateMenu(dt) {
    void dt;
    const i = store.scooter;
    if (G.tuning) {
      if (pressed & BTN_START) G.tuning = false;
      return;
    }
    if (pressed & BTN_LEFT) setColor(-1);
    if (pressed & BTN_RIGHT) setColor(1);
    if (pressed & BTN_UP) setScooter(-1);
    if (pressed & BTN_DOWN) setScooter(1);
    if (pressed & BTN_START) startOrBuy();
    void i;
  }

  function drawMenu() {
    const i = store.scooter, mdl = SCOOTERS[i], owned = store.owned[i], inert = G.tuning;
    const cx = W / 2;
    // Titel und Rekorde
    text('E-SCOOTER', IL + 6, 4, 5.5, '#ffffff', 0);
    text('WHEELIE', IL + 6, 10, 13, '#ffd23f', 0, '#8c3b2e');
    text('REKORD ' + store.best.toFixed(1) + ' M', IL + 6, 27, 4.2, '#ffffff', 0);
    if (store.tbest) text('TRICK-REKORD ' + store.tbest, IL + 6, 32.5, 4.2, '#ffffff', 0);
    // Münzen und Ton
    coins(store.coins, W - IR - 21, 6, 6.5, 2);
    if (button(W - IR - 17, 3, 13, 13, store.sound ? 'TON' : 'AUS', { inert, size: 4.2, color: store.sound ? '#2f4a8f' : '#6a3340' })) {
      store.sound = !store.sound;
      saveStore();
      toast(store.sound ? 'TON AN' : 'TON AUS');
      play(SND_TICK);
    }
    // Scooter-Name
    const ny = max(4, GY - 88);
    const nw = max(64, textWidth(mdl.name, 7) + 10);
    ctx.fillStyle = 'rgba(16,24,58,0.72)'; rrect(cx - nw / 2, ny + 15, nw, 17, 3); ctx.fill();
    text(mdl.name, cx, ny + 17, 7, '#ffffff', 1);
    if (owned) text('TOP ' + topSpeed(i) + ' KM/H', cx, ny + 25.5, 4.4, '#ffe27a', 1);
    else coins(mdl.price, cx, ny + 25.5, 4.6, 1, '#ffe27a');
    // Pfeile links und rechts vom Scooter
    if (button(cx - 56, GY - 32, 14, 20, '<', { inert, size: 8 })) setScooter(-1);
    if (button(cx + 42, GY - 32, 14, 20, '>', { inert, size: 8 })) setScooter(1);
    if (G.toast && !inert) text(G.toast, cx, GY + 3.5, 5.6, '#ffffff', 1);
    else text((i + 1) + ' / ' + SCOOTERS.length, cx, GY + 5, 4, 'rgba(255,255,255,0.8)', 1);
    // unten: Farbe, Tuning, Start
    const by = H - 17, bh = 13;
    const sw = 40 + clamp((W - 160) * 0.3, 0, 24), sx = W - IR - 6 - sw, fx = IL + 6;
    if (button(fx, by, 11, bh, '<', { inert })) setColor(-1);
    ctx.fillStyle = 'rgba(16,24,58,0.72)'; rrect(fx + 12.5, by, 43, bh, 3); ctx.fill();
    text('FARBE', fx + 34, by + 1.3, 3.4, '#9fb4e8', 1, false);
    text(COLORS[store.color[i]][0], fx + 34, by + 5.6, 4.6, hex(G.body), 1);
    if (button(fx + 57, by, 11, bh, '>', { inert })) setColor(1);
    const tx = (fx + 68 + sx) / 2 - 18;
    if (button(tx, by, 36, bh, 'TUNING', { inert, off: !owned, color: '#8a4fd6', size: 5.6 })) {
      if (owned) { G.tuning = true; play(SND_TICK); } else toast('ERST KAUFEN');
    }
    if (owned) {
      if (button(sx, by, sw, bh, 'START', { inert, color: '#2e9e48', size: 7 })) startGame();
    } else if (button(sx, by, sw, bh, '', { inert, price: mdl.price, color: '#d08a1f', off: store.coins < mdl.price, size: 6 })) {
      startOrBuy();
    }
    if (!owned) text('KAUFEN', sx + sw / 2, by - 6, 4.2, '#ffe27a', 1);
    if (G.tuning) drawTuning();
  }

  function drawTuning() {
    const i = store.scooter, mdl = SCOOTERS[i];
    ctx.fillStyle = 'rgba(8,10,24,0.6)'; ctx.fillRect(0, 0, W, H);
    const pw = min(W - IL - IR - 8, 176), px = (W - pw) / 2, py = max(4, (H - 112) / 2), ph = 112;
    ctx.fillStyle = '#18244a'; rrect(px, py, pw, ph, 4); ctx.fill();
    ctx.strokeStyle = '#4c66b8'; ctx.lineWidth = 0.8; rrect(px, py, pw, ph, 4); ctx.stroke();
    text('TUNING', px + 6, py + 4, 8, '#ffd23f', 0, '#8c3b2e');
    text(mdl.name, px + 6, py + 13.5, 4, '#9fb4e8', 0, false);
    coins(store.coins, px + pw - 22, py + 6, 6, 2);
    if (button(px + pw - 17, py + 3, 13, 13, 'X', { size: 6.5, color: '#6a3340' }) || !tapped(px, py, pw, ph) && taps.length) {
      G.tuning = false;
      return;
    }
    for (let k = 0; k < PARTS.length; k++) {
      const y = py + 20 + k * 14.6, lv = store.tune[i][k], p = PARTS[k], n = levels(k);
      const stock = k === DUAL && mdl.dual;
      ctx.fillStyle = 'rgba(255,255,255,0.06)'; rrect(px + 4, y, pw - 8, 13.4, 2.5); ctx.fill();
      text(p.name, px + 8, y + 1.2, 5.2, '#ffffff', 0);
      text(stock ? 'HAT ER SCHON AB WERK' : p.info(mdl.gain), px + 8, y + 8.2, 3.4, '#9fb4e8', 0, false);
      for (let s = 0; s < n; s++) {                       // Stufen-Anzeige
        ctx.fillStyle = s < lv ? '#3ccb5a' : '#33406e';
        rrect(px + pw - 74 + (s + PART_LEVELS - n) * 8, y + 3.6, 6.4, 6.4, 1.4); ctx.fill();
      }
      if (lv >= n) {
        button(px + pw - 46, y + 1.5, 39, 10.4, stock ? 'SERIE' : k === DUAL ? 'DRIN' : 'MAX', { off: true, size: 5 });
      } else {
        const price = partPrice(i, lv, k);
        if (button(px + pw - 46, y + 1.5, 39, 10.4, '', { price, size: 5.2, color: '#2e9e48', off: store.coins < price })) buyPart(k);
      }
    }
    const y = py + 20 + PARTS.length * 14.6 + 2.5;
    text('TOP ' + topSpeed(i) + ' KM/H', px + 8, y + 2.5, 7, '#ffe27a', 0);
    if (button(px + pw - 54, y, 47, 13, 'FERTIG', { color: '#2f4a8f', size: 6 })) G.tuning = false;
    if (G.toast) text(G.toast, W / 2, py + ph - 9, 5, '#ff9d8f', 1);
  }

  // ---------------- Zeichnen ----------------
  function drawPads() {
    for (const b of pads) {
      const on = (touchHeld & b.bit) === b.bit;
      ctx.globalAlpha = on ? 0.75 : 0.34;
      circ([b.x, b.y], b.r, on ? b.c : '#10121c');
      ctx.globalAlpha = on ? 1 : 0.8;
      ctx.strokeStyle = b.c; ctx.lineWidth = b.t ? 1.1 : 0.7;
      ctx.beginPath(); ctx.arc(b.x, b.y, b.r - 0.5, 0, 2 * PI); ctx.stroke();
      if (b.t) text(b.t, b.x, b.y - (b.r > 12 ? 3.2 : b.r > 8 ? 2.0 : 1.6), b.r > 12 ? 6.2 : b.r > 8 ? 3.5 : 2.9,
        on ? '#101018' : '#ffffff', 1, false);
      ctx.globalAlpha = 1;
    }
  }

  function drawMeter(x, y) {
    // Winkelanzeige: grün = sicher, gelb = Gleichgewicht, rot = Absturzgefahr
    const w = 84, k = w / CRASH_DEG;
    ctx.fillStyle = '#101018'; rrect(x - 1, y - 1, w + 2, 7, 2); ctx.fill();
    ctx.fillStyle = '#3ccb5a'; ctx.fillRect(x, y, (BALANCE_DEG - 12) * k, 5);
    ctx.fillStyle = '#ffd23f'; ctx.fillRect(x + (BALANCE_DEG - 12) * k, y, 17 * k, 5);
    ctx.fillStyle = '#e84a3c'; ctx.fillRect(x + (BALANCE_DEG + 5) * k, y, w - (BALANCE_DEG + 5) * k, 5);
    const mx = x + min(G.th / CRASH_RAD, 1.0) * w;
    ctx.fillStyle = '#101018'; ctx.fillRect(mx - 1.6, y - 2.6, 3.2, 10.2);
    ctx.fillStyle = '#ffffff'; ctx.fillRect(mx - 0.7, y - 1.8, 1.4, 8.6);
  }

  function draw(dt) {
    const st = G.state, t = G.t, mdl = model(), menu = st === MENU;
    ctx.setTransform(SC, 0, 0, SC, 0, 0);
    let shx = 0, shy = 0;
    if (G.shakeT > 0) {                         // Wackeln beim Sturz
      G.shakeT -= dt;
      shx = randint(-2, 2); shy = randint(-1, 1);
      ctx.translate(shx * 0.5, shy * 0.5);
    }
    if (st !== PAUSE) {
      G.dist += G.dpx;
      G.rotF += G.dpx / mdl.r;
      G.rotR += G.dpx / mdl.r;
      if (G.markLen && !G.burn) { G.markX -= G.dpx; if (G.markX < -50) G.markLen = 0; }
      updatePuffs(dt, G.dpx);
    }
    drawWorld(G.dist, t);

    // Farbe (Regenbogen wechselt)
    const rgb = COLORS[store.color[store.scooter]][1];
    G.body = rgb < 0 ? rainbow(t * 0.4) : rgb;

    if (G.markLen) {                            // Reifenspur
      ctx.fillStyle = '#1e1e24';
      ctx.fillRect(G.markX - G.markLen, GY - 0.6, G.markLen, 2);
      if (store.tune[store.scooter][DUAL] > 0)    // Dual-Motor: zweite Spur vom Vorderrad
        ctx.fillRect(G.markX - G.markLen + mdl.wb, GY - 0.6, G.markLen, 2);
    }
    // Scooter und Fahrer
    let x = menu ? W / 2 - mdl.wb / 2 - 1 : RX, y = GY - mdl.r;
    if (shx || shy) { x += shx; y += shy; }
    else if (G.burn && st === PLAY) x += floor(t * 30) & 1 ? 0.7 : 0;      // Burnout: der Scooter zittert
    ctx.fillStyle = 'rgba(0,0,0,0.28)';
    ctx.beginPath();
    ctx.ellipse(x + mdl.wb / 2 * cos(min(G.th, 1.5)) + 1, GY + 0.8, mdl.wb / 2 + mdl.r + 1 - 6 * sin(min(G.th, 1.5)), 1.5, 0, 0, 2 * PI);
    ctx.fill();
    const o = { model: mdl, col: G.body, rotF: G.rotF, rotR: G.rotR, dual: store.tune[store.scooter][DUAL] > 0 };
    if (st === CRASH) {
      const k = clamp((G.th - CRASH_RAD) / (1.745 - CRASH_RAD), 0, 1);
      o.th = G.th; o.pose = 0; o.arms = 2; o.swing = null; o.lean = LEAN + (1 - LEAN) * k;
    } else {
      o.th = G.th + G.b;
      o.pose = G.dip > 0 ? max(G.kn, sin(clamp(G.dip / 0.16, 0, 1) * PI)) : G.kn;
      o.arms = G.arms; o.lean = LEAN;
      o.swing = G.th > 0 ? clamp(G.ph, -0.9, 1.3) : null;
      G.hy = body(o.th, o.pose, LEAN, mdl.dy).hip[1];
    }
    if (menu && !store.owned[store.scooter]) ctx.globalAlpha = 0.6;
    drawRider(x, y, o);
    ctx.globalAlpha = 1;
    drawPuffs();

    // Fahrtwind-Streifen bei hohem Tempo
    const n = st === PLAY ? floor((G.v - 15.0) / 3.0) : 0;
    ctx.fillStyle = 'rgba(255,255,255,0.75)';
    for (let k = 0; k < 4; k++) {
      const l = G.lines[k];
      if (k < n) {
        l.x -= 900 * dt * (st === PAUSE ? 0 : 1);
        if (l.x < -22) { l.x = W + randint(0, 50); l.y = randint(24, floor(GY) - 14); }
        ctx.fillRect(l.x, l.y, 20, 0.8);
      } else {
        l.x = -99;
      }
    }
    if (G.boost) {                              // Boost: blauer Schein am Rand
      const g = ctx.createLinearGradient(0, 0, W * 0.35, 0);
      g.addColorStop(0, 'rgba(90,150,255,0.35)'); g.addColorStop(1, 'rgba(90,150,255,0)');
      ctx.fillStyle = g; ctx.fillRect(0, 0, W * 0.35, H);
    }
    ctx.setTransform(SC, 0, 0, SC, 0, 0);

    if (G.photo) return;                        // nur das Bild, ohne Anzeigen (für das App-Icon)
    if (menu) { drawMenu(); return; }

    // Anzeigen
    const cx = W / 2;
    text('REKORD ' + store.best.toFixed(1) + ' M', IL + 4, 4, 5, '#ffffff', 0);
    coins(store.coins, IL + 4, 11, 4.6, 0);
    text(Math.round(G.v * 3.6) + ' KM/H', W - IR - 20, 3.5, 8, '#ffffff', 2);
    if (car.kmh > model().kmh) text('TUNING ' + car.kmh, W - IR - 20, 13, 3.8, '#c9a6ff', 2);
    if (st === PLAY || st === CRASH) {
      if (button(W - IR - 17, 3, 14, 14, 'II', { size: 6.5, color: 'rgba(24,36,74,0.8)', inert: st === CRASH }))
        setPause(true);
    }
    const wheelie = st === PLAY && G.inWheelie;
    if (wheelie && G.wd >= 0.3) {
      G.big = G.wd.toFixed(1) + ' M';
      const k = G.arms + (G.crouch ? 3 : 0);
      G.sub = k ? NAMES[k] + ' +' + floor(G.tp) : G.wt.toFixed(1) + ' S';
    }
    const bigc = st === CRASH ? '#ff6a5c' : G.boost ? '#7fb6ff' : G.recordT > 0 ? hex(rainbow(t * 3)) : '#ffffff';
    if (G.recordT > 0) G.recordT -= dt;
    if (G.big) text(G.big, cx, 9, 14, bigc, 1);
    if (G.sub) text(G.sub, cx, 25.5, 6.4, '#ffe27a', 1);
    if (wheelie) drawMeter(cx - 42, 36);
    else if (G.msg) text(G.msg, cx, 35, 6, '#ffffff', 1);
    if (G.toast) text(G.toast, cx, 46, 5.6, '#ffffff', 1);

    if (st === PAUSE) {
      ctx.fillStyle = 'rgba(8,10,24,0.55)'; ctx.fillRect(0, 0, W, H);
      text('PAUSE', cx, H * 0.2, 16, '#ffffff', 1);
      if (button(cx - 62, H * 0.52, 58, 17, 'WEITER', { color: '#2e9e48', size: 7 })) setPause(false);
      if (button(cx + 4, H * 0.52, 58, 17, 'MENÜ', { size: 7 })) { saveStore(); gotoMenu(); }
      return;
    }
    if (usedTouch || pointers.size) drawPads();
    else if (st === PLAY && G.v === 0 && !G.burn)
      text('TASTEN: X = GAS   C = BREMSE   PFEILE = WHEELIE / TRICKS', cx, H - 9, 4, 'rgba(255,255,255,0.85)', 1);
    if (st === CRASH && G.crashT > 1.0 && button(cx - 22, 58, 44, 13, 'MENÜ', { size: 6 })) gotoMenu();
  }

  function setPause(on) {
    if (on && G.state === PLAY) { G.state = PAUSE; taps = []; }
    else if (!on && G.state === PAUSE) { G.state = PLAY; G.bannerT = 0; }
  }

  // ---------------- Hauptschleife ----------------
  function step(dt) {
    G.frames++;
    G.fpsT += dt;
    if (G.fpsT >= 1.0) { G.fps = Math.round(G.frames / G.fpsT); G.frames = 0; G.fpsT = 0; }
    dt = clamp(dt, 0.001, 0.1);
    G.t += dt;
    if (G.t > 600.0) G.t -= 600.0;
    layoutPads();
    const playing = G.state === PLAY || G.state === CRASH;
    const th = playing ? readPads() : 0;
    pressed = keyPressed | (th & ~touchHeld);
    touchHeld = th;
    held = keys | th;
    keyPressed = 0;
    G.dpx = 0;

    const st = G.state;
    if (st === PLAY) {
      if (pressed & BTN_START) setPause(true);
      else updatePlay(dt);
    } else if (st === MENU) {
      updateMenu(dt);
    } else if (st === CRASH) {
      updateCrash(dt);
    } else if (pressed & BTN_START) {
      setPause(false);
    }
    if (G.toastT > 0) { G.toastT -= dt; if (G.toastT <= 0) G.toast = ''; }
    const play_ = G.state === PLAY;
    engineSound(G.state !== PAUSE ? G.v / car.vmax : 0.0, play_ && (held & BTN_A) !== 0,
      play_ ? (G.boost ? 2 : (G.burn ? 1 : 0)) : 0);
    draw(dt);
    taps = [];
  }

  let last = 0;
  function frame(now) {
    const dt = last ? (now - last) / 1000 : 0.016;
    last = now;
    step(dt);
    requestAnimationFrame(frame);
  }
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {                      // App im Hintergrund: Pause und Ruhe
      setPause(true);
      keys = 0; pointers.clear();
      saveStore();
      if (ac) { try { engGain.gain.value = 0; ac.suspend(); } catch (e) { /* egal */ } }
    } else {
      last = 0;
    }
  });

  applyTuning();
  gotoMenu();
  window.__game = { G, store, car, step, SCOOTERS, physics, applyTuning };     // für Tests
  requestAnimationFrame(frame);
})();
