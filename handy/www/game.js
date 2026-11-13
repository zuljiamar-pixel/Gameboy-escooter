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

  // STOPPIE: das Heck geht hoch, der Scooter rollt nur noch auf dem Vorderrad.
  // Eigene Physik (Drehung um die Vorderachse), der Wheelie oben bleibt unverändert.
  const S_POP = 1.5;          // wie kräftig der Stoppie-Knopf das Heck hochreißt
  const S_BALANCE_DEG = 32;   // Gleichgewichtspunkt vom Stoppie (Grad)
  const S_CRASH_DEG = 58;     // ab hier fliegst du über den Lenker (Grad)
  const S_GRAVITY = 4.0;      // wie stark das Heck nach unten will
  const S_LIFT = 7.0;         // wie stark die Vorderbremse das Heck hochzieht
  const S_DOWN = 6.0;         // wie stark das Heck runterkommt, wenn man die Bremse loslässt
  const S_BRAKE = 7.0;        // so stark bremst der Scooter im Stoppie (m/s²)
  const S_MIN_KMH = 12;       // so schnell muss man mindestens sein
  const COIN_PER_M_STOPPIE = 3;   // Münzen pro Meter Stoppie (Stoppies sind kürzer)

  // ------------------------------------------------------------------
  // SCOOTER und TUNING
  // ------------------------------------------------------------------
  // name = so heißt der Scooter im Spiel, kmh = Höchstgeschwindigkeit ohne Tuning,
  // accel = Beschleunigung beim Anfahren (m/s², das Original hat 6.0),
  // dual = hat schon ab Werk zwei Motoren, price = Preis in Münzen,
  // label = Schriftzug auf dem Scooter, tail / lamp = dort sitzen Rücklicht und Scheinwerfer,
  // bot = Unterkante vom Trittbrett (dort leuchtet die LED),
  // gain = km/h pro Motor-Stufe, cost = Tuning-Teile sind so viel mal teurer,
  // id = feste Kennung (damit Käufe und Tuning auch nach dem Umsortieren richtig bleiben)
  const SCOOTERS = [
    { id: 'g3', name: 'NINEBOT MAX G3', kmh: 80, accel: 6.0, dual: false, price: 0, gain: 5, cost: 1, r: 5.0, wb: 26, dy: 0, color: 4,
      label: 'MAX G3', bot: -2.6, tail: [-5.9, 2.9], lamp: [22.9, 21.2] },
    { id: 'g4', name: 'KUKIRIN G4', kmh: 105, accel: 7.5, dual: false, price: 300, gain: 8, cost: 1.5, r: 5.6, wb: 27, dy: 0.6, color: 12,
      label: 'KUKIRIN G4', bot: -2.0, tail: [-3.8, 7.2], lamp: [24.9, 23.8] },
    { id: 'gt2', name: 'SEGWAY GT2', kmh: 112, accel: 9.0, dual: true, price: 650, gain: 10, cost: 2, r: 5.4, wb: 28, dy: 0.7, color: 13,
      label: 'GT2', bot: -2.9, tail: [-5.6, 3.4], lamp: [22.6, 20.6] },
    { id: 'ww', name: 'KAABO WOLF WARRIOR 11', kmh: 118, accel: 9.5, dual: true, price: 950, gain: 11, cost: 2.2, r: 6.0, wb: 29, dy: 1.2, color: 4,
      label: 'KAABO', bot: -3.2, tail: [-6.3, 4.6], lamp: [27.0, 12.4] },
    { id: 'dx', name: 'DUALTRON X LIMITED', kmh: 125, accel: 10.5, dual: true, price: 1200, gain: 12, cost: 2.5, r: 6.6, wb: 30, dy: 1.5, color: 11,
      label: 'DUALTRON', bot: -4.0, tail: [-2.9, 7.9], lamp: [26.9, 13.7] },
    { id: 'nami', name: 'NAMI BURN-E 2 MAX', kmh: 140, accel: 11.5, dual: true, price: 2000, gain: 13, cost: 3, r: 6.0, wb: 29, dy: 1.8, color: 4,
      label: 'NAMI BURN-E 2', bot: -3.6, tail: [-5.0, 5.0], lamp: [25.9, 12.4] },
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
    ['LILA', 0x9B5DE5], ['ORANGE', 0xFF8A1F], ['WEISS', 0xF2F2F6], ['EIS-BLAU', 0x8FE8FF],
    ['GRAU', 0x7C838F], ['TITAN', 0xA39A88]];

  // ------------------------------------------------------------------
  // CUSTOM: Fahrer und Scooter selbst gestalten (alles gratis)
  // ------------------------------------------------------------------
  // Farbwerte: -1 = Regenbogen, -2 = Sonderfall (Serie, aus, wie Scooter), -3 = keine Farbe (nur Name)
  const CLOTH = [['ROT', 0xE84A3C], ['JEANS', 0x33509A], ['SCHWARZ', 0x2B2C34], ['WEISS', 0xF2F2F6],
    ['GRAU', 0x7C838F], ['BLAU', 0x2F7DE1], ['GRÜN', 0x3CCB5A], ['GELB', 0xFFD23F], ['ORANGE', 0xFF8A1F],
    ['PINK', 0xFF5FA2], ['LILA', 0x9B5DE5], ['TÜRKIS', 0x19C2A0], ['BEIGE', 0xD8C3A0], ['BRAUN', 0x7A4E36],
    ['OLIV', 0x6B7A3A]];
  const SKINS = [['HELL', 0xF4C7A1], ['SEHR HELL', 0xFBE0C8], ['MITTEL', 0xD9A77A], ['BRAUN', 0xA8724A],
    ['DUNKEL', 0x6E4A32]];
  const HELMETS = [['OFFEN', -3], ['INTEGRAL', -3], ['MOTOCROSS', -3]];
  const HCOLS = [['WIE SCOOTER', -2]].concat(COLORS);
  const VISORS = [['DUNKEL', 0x20232C], ['GOLD', 0xE8B53A], ['BLAU', 0x3A7BD5], ['ROT', 0xD8262C], ['KLAR', 0x9FC0E4]];
  const PATTERNS = [['STREIFEN', -3], ['UNI', -3], ['DOPPEL', -3], ['RENNSTREIFEN', -3]];
  const RIMS = [['SILBER', 0xAEB4BD], ['SCHWARZ', 0x3A3B44], ['GOLD', 0xE8B53A], ['ROT', 0xD8262C],
    ['BLAU', 0x2F7DE1], ['WIE SCOOTER', -2]];
  const CALIPERS = [['SERIE', -2], ['ROT', 0xD8262C], ['GOLD', 0xE8B53A], ['BLAU', 0x2F7DE1], ['GRÜN', 0x3CCB5A],
    ['SCHWARZ', 0x2B2C34]];
  const LEDS = [['AUS', -2], ['BLAU', 0x3F8CFF], ['ROT', 0xFF3040], ['GRÜN', 0x3CFF6A], ['LILA', 0xB060FF],
    ['PINK', 0xFF5FC8], ['WEISS', 0xF0F4FF], ['REGENBOGEN', -1]];
  const SMOKES = [['WEISS', -2], ['SCHWARZ', 0x3A3A44], ['ROT', 0xFF4040], ['BLAU', 0x4A90FF], ['GRÜN', 0x4ADC6A],
    ['LILA', 0xB070FF], ['PINK', 0xFF70C0], ['GELB', 0xFFD83F], ['REGENBOGEN', -1]];
  // Zeilen im CUSTOM-Fenster: [Name, Liste, Schlüssel]. Fahrer gilt für alle Scooter,
  // Scooter-Teile hat jeder Scooter einzeln (Schlüssel = Platz in store.mods, -1 = Farbe).
  const LOOK_ROWS = [['HELM', HELMETS, 'helmet'], ['HELM-FARBE', HCOLS, 'hcol'], ['VISIER', VISORS, 'visor'],
    ['JACKE', CLOTH, 'shirt'], ['MUSTER', PATTERNS, 'pattern'], ['HOSE', CLOTH, 'pants'], ['SCHUHE', CLOTH, 'shoes'],
    ['HAUT', SKINS, 'skin']];
  const MOD_ROWS = [['FARBE', COLORS, -1], ['FELGEN', RIMS, 0], ['BREMSSÄTTEL', CALIPERS, 1], ['LED UNTEN', LEDS, 2],
    ['RAUCH', SMOKES, 3]];

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
  const BTN_STOP = 256;                   // Stoppie
  const S_PHI0 = rad(90 - S_BALANCE_DEG);
  const S_CRASH_RAD = rad(S_CRASH_DEG);
  const S_LEAN = 0.12;                    // im Stoppie bleibt der Fahrer fast aufrecht
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
    best: 0, tbest: 0, sbest: 0, sound: true, coins: 0, scooter: 0,
    ids: SCOOTERS.map(s => s.id),
    owned: SCOOTERS.map(s => s.price === 0),
    color: SCOOTERS.map(s => s.color),
    tune: SCOOTERS.map(() => PARTS.map(() => 0)),
    look: { helmet: 0, hcol: 0, visor: 0, shirt: 0, pattern: 0, pants: 1, shoes: 3, skin: 0 },
    mods: SCOOTERS.map(() => MOD_ROWS.filter(r => r[2] >= 0).map(() => 0)),   // Felgen, Bremssättel, LED, Rauch
  };
  const okIndex = (v, list) => Number.isInteger(v) && v >= 0 && v < list.length;
  try {
    const d = JSON.parse(localStorage.getItem(KEY) || '{}');
    if (d.best >= 0) store.best = +d.best;
    if (d.tbest >= 0) store.tbest = floor(d.tbest);
    if (d.sbest >= 0) store.sbest = +d.sbest;
    if (d.coins >= 0) store.coins = floor(d.coins);
    if (typeof d.sound === 'boolean') store.sound = d.sound;
    // Gespeichert wird nach Kennung. Alte Spielstände hatten nur 3 Scooter ohne Kennung.
    const ids = Array.isArray(d.ids) ? d.ids : ['g3', 'g4', 'dx'];
    ids.forEach((id, j) => {
      const i = SCOOTERS.findIndex(s => s.id === id);
      if (i < 0) return;
      if (d.scooter === j) store.scooter = i;
      if (d.owned && d.owned[j]) store.owned[i] = true;
      if (d.color && d.color[j] >= 0 && d.color[j] < COLORS.length) store.color[i] = floor(d.color[j]);
      PARTS.forEach((p, k) => {
        const v = d.tune && d.tune[j] && d.tune[j][k];
        if (v >= 0 && v <= levels(k)) store.tune[i][k] = floor(v);
      });
      MOD_ROWS.forEach(([, list, k]) => {
        const v = k >= 0 && d.mods && d.mods[j] && d.mods[j][k];
        if (okIndex(v, list)) store.mods[i][k] = v;
      });
    });
    if (d.look) for (const [, list, key] of LOOK_ROWS) if (okIndex(d.look[key], list)) store.look[key] = d.look[key];
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
  let W = 160, H = 120, SC = 1, GY = 92, RX = 60, IL = 0, IR = 0, skyGrad = null;
  const lightCanvas = document.createElement('canvas'), roadCanvas = document.createElement('canvas');

  const ROAD_W = 96;                      // Breite der Asphalt-Kachel (Einheiten)
  const asphalt = (() => {
    // Asphalt: Körnung, feine Risse und geflickte Stellen (einmal gemalt, dann nur noch verschoben)
    const c = document.createElement('canvas'), k = 6;
    c.width = ROAD_W * k; c.height = 36 * k;
    const x = c.getContext('2d');
    let seed = 12345;
    const rnd = () => (seed = (Math.imul(seed, 1103515245) + 12345) & 0x7fffffff) / 0x7fffffff;
    for (let i = 0; i < 2600; i++) {
      const light = rnd() < 0.5, y = rnd() * c.height;
      x.fillStyle = light ? 'rgba(255,255,255,' + (0.03 + rnd() * 0.07) + ')' : 'rgba(0,0,0,' + (0.05 + rnd() * 0.12) + ')';
      x.fillRect(rnd() * c.width, y, 1 + rnd() * (1.5 + y / 60), 1 + rnd() * 1.5);
    }
    x.fillStyle = 'rgba(0,0,0,0.10)';                           // geflickte Stelle
    x.fillRect(38 * k, 9 * k, 22 * k, 7 * k);
    x.strokeStyle = 'rgba(0,0,0,0.22)'; x.lineWidth = 1;
    x.strokeRect(38 * k, 9 * k, 22 * k, 7 * k);
    x.strokeStyle = 'rgba(0,0,0,0.3)'; x.lineWidth = 1.2; x.lineJoin = 'round';
    for (const [x0, y0] of [[8, 4], [70, 20], [22, 26]]) {      // Risse
      x.beginPath(); x.moveTo(x0 * k, y0 * k);
      let px = x0 * k, py = y0 * k;
      for (let j = 0; j < 9; j++) { px += (4 + rnd() * 9); py += (rnd() - 0.5) * 12; x.lineTo(px, py); }
      x.stroke();
    }
    return c;
  })();
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
    // Sonnenlicht von rechts oben + dunklere Ränder: einmal vormalen, später nur noch darüberlegen
    const lw = canvas.width, lh = canvas.height, lx = lightCanvas.getContext('2d');
    lightCanvas.width = lw; lightCanvas.height = lh;
    let g = lx.createLinearGradient(lw, 0, lw * 0.3, lh * 0.9);
    g.addColorStop(0, 'rgba(255,214,140,0.22)');
    g.addColorStop(0.6, 'rgba(255,214,140,0.04)');
    g.addColorStop(1, 'rgba(40,50,90,0.10)');
    lx.fillStyle = g; lx.fillRect(0, 0, lw, lh);
    g = lx.createRadialGradient(lw / 2, lh * 0.48, lh * 0.45, lw / 2, lh * 0.48, Math.hypot(lw, lh) * 0.56);
    g.addColorStop(0, 'rgba(6,8,20,0)');
    g.addColorStop(1, 'rgba(6,8,20,0.34)');
    lx.fillStyle = g; lx.fillRect(0, 0, lw, lh);
    // Asphalt in der passenden Größe vormalen (dann muss beim Zeichnen nichts mehr skaliert werden)
    roadCanvas.width = Math.ceil(ROAD_W * SC); roadCanvas.height = Math.ceil(37 * SC);
    const rx = roadCanvas.getContext('2d', { alpha: false });
    g = rx.createLinearGradient(0, 0, 0, roadCanvas.height);
    g.addColorStop(0, '#43434e');
    g.addColorStop(1, '#2b2b34');
    rx.fillStyle = g; rx.fillRect(0, 0, roadCanvas.width, roadCanvas.height);
    rx.drawImage(asphalt, 0, 0, roadCanvas.width, roadCanvas.height);
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
    KeyX: BTN_A, Space: BTN_A, KeyC: BTN_B, KeyB: BTN_B, KeyS: BTN_STOP, KeyV: BTN_STOP,
    Enter: BTN_START, KeyP: BTN_START, Escape: BTN_START };
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
      { bit: BTN_STOP, x: bx - 8, y: by - 25, r: 9.5, t: 'STOPPIE', c: '#5fd0ff' },
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
  let ac = null, beeps = [], snd = null;
  function audioInit() {
    try {
      if (ac) { if (ac.state === 'suspended') ac.resume(); return; }
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      ac = new AC();
      const gain = (v, to) => { const g = ac.createGain(); g.gain.value = v; g.connect(to); return g; };
      const osc = (type, to) => { const o = ac.createOscillator(); o.type = type; o.connect(to); o.start(); return o; };
      const filter = (type, f, q, to) => {
        const b = ac.createBiquadFilter(); b.type = type; b.frequency.value = f; b.Q.value = q; b.connect(to); return b;
      };
      const out = gain(0.9, ac.destination);
      // E-Motor: tiefes Summen + das typische hohe Sirren, das mit dem Tempo steigt
      const motor = gain(0, out), mlp = filter('lowpass', 900, 0.7, motor);
      const hum = osc('triangle', mlp), hum2 = osc('sawtooth', gain(0.35, mlp));
      const whine = gain(0, out), wh = osc('sine', whine), wh2 = osc('triangle', gain(0.3, whine));
      // Rauschen für Fahrtwind, quietschende Reifen und Schleifen
      const n = ac.sampleRate * 2, buf = ac.createBuffer(1, n, ac.sampleRate), d = buf.getChannelData(0);
      for (let i = 0; i < n; i++) d[i] = random() * 2 - 1;
      const noise = ac.createBufferSource();
      noise.buffer = buf; noise.loop = true;
      const wind = gain(0, out), wlp = filter('lowpass', 400, 0.5, wind);
      const tyre = gain(0, out), tbp = filter('bandpass', 1300, 9, tyre), tbp2 = filter('bandpass', 2100, 6, gain(0.5, tyre));
      const scrape = gain(0, out), sbp = filter('bandpass', 3400, 1.2, scrape);
      noise.connect(wlp); noise.connect(tbp); noise.connect(tbp2); noise.connect(sbp);
      noise.start();
      snd = { motor, mlp, hum, hum2, whine, wh, wh2, wind, wlp, tyre, tbp, tbp2, scrape };
    } catch (e) { ac = null; snd = null; }
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
  function engineSound(v, gas, wild, skid, scrape, dual) {
    // v = Tempo (m/s); wild = 1 Burnout, 2 Boost; skid = Reifen rutschen (0..1); scrape = es schleift
    if (!ac || !snd) return;
    try {
      const t = ac.currentTime, on = store.sound ? 1 : 0;
      const set = (param, value, tc) => param.setTargetAtTime(value, t, tc || 0.04);
      const rev = wild === 1 ? 26 + random() * 2 : v;         // im Burnout dreht der Motor hoch
      const load = wild ? 1 : gas ? 0.75 : 0.25;
      const f = 55 + rev * 9 + (wild === 2 ? 40 : 0);
      set(snd.hum.frequency, f); set(snd.hum2.frequency, f * 2.01);
      set(snd.wh.frequency, f * (dual ? 6.2 : 5.3)); set(snd.wh2.frequency, f * 8.07);
      set(snd.mlp.frequency, 500 + rev * 40);
      const run = rev > 0.3 || gas ? 1 : 0;
      set(snd.motor.gain, on * run * (0.035 + 0.075 * load));
      set(snd.whine.gain, on * run * min(1, rev / 12) * (0.008 + 0.03 * load) * (dual ? 1.4 : 1));
      set(snd.wind.gain, on * min(0.16, v * v * 0.00009), 0.15);
      set(snd.wlp.frequency, 250 + v * 28, 0.15);
      const sq = wild === 1 ? (dual ? 1 : 0.8) : skid * 0.6;
      set(snd.tyre.gain, on * sq * 0.5, 0.03);
      set(snd.tbp.frequency, 1150 + 250 * sin(G.t * 23) + (wild === 1 ? 150 : v * 10), 0.02);
      set(snd.tbp2.frequency, 1900 + 300 * sin(G.t * 17), 0.02);
      set(snd.scrape.gain, on * (scrape ? 0.16 : 0), 0.02);
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
  function glowSprite(r, g, b, hard) {
    // runder weicher Fleck (für Rauch, Lichter und Schatten)
    const c = document.createElement('canvas');
    c.width = c.height = 64;
    const x = c.getContext('2d'), gr = x.createRadialGradient(32, 32, 0, 32, 32, 32);
    const col = a => 'rgba(' + r + ',' + g + ',' + b + ',' + a + ')';
    gr.addColorStop(0, col(1)); gr.addColorStop(hard || 0.35, col(0.7)); gr.addColorStop(0.75, col(0.18)); gr.addColorStop(1, col(0));
    x.fillStyle = gr; x.fillRect(0, 0, 64, 64);
    return c;
  }
  const SPR = { smoke: glowSprite(236, 236, 240, 0.5), grey: glowSprite(170, 170, 180, 0.5), dust: glowSprite(196, 180, 150),
    dark: glowSprite(0, 0, 0, 0.45), red: glowSprite(255, 40, 30), warm: glowSprite(255, 240, 180), fire: glowSprite(255, 140, 40) };
  const tinted = new Map();
  function tintSprite(rgb, hard) {
    // weicher Fleck in einer beliebigen Farbe (für LED und farbigen Rauch), wird gemerkt
    const key = rgb + '/' + (hard || 0);
    if (!tinted.has(key)) tinted.set(key, glowSprite((rgb >> 16) & 255, (rgb >> 8) & 255, rgb & 255, hard));
    return tinted.get(key);
  }
  function smokeSprite() {
    // Rauchfarbe vom Scooter (null = normaler weißer Rauch)
    const c = SMOKES[store.mods[store.scooter][3]][1];
    if (c === -2) return null;
    return tintSprite(c === -1 ? rainbow(floor(random() * 24) / 24) : c, 0.5);
  }
  function glow(spr, x, y, rx, ry, alpha) {
    ctx.globalAlpha = alpha;
    ctx.drawImage(spr, x - rx, y - (ry || rx), rx * 2, (ry || rx) * 2);
    ctx.globalAlpha = 1;
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

  function wheel(p, r, rot, kind, col, motor, th, spin, cal) {
    // kind: 0 normal, 1 Stollen (Gelände), 2 extra breit; spin = wie schnell es dreht (rad/s)
    circ(p, r, '#15151a');
    ctx.lineCap = 'butt';
    ctx.strokeStyle = '#26262d'; ctx.lineWidth = 0.45;         // Flanke vom Reifen
    ctx.beginPath(); ctx.arc(p[0], p[1], r - (kind === 2 ? 1.6 : 1.1), 0, 2 * PI); ctx.stroke();
    if (kind === 1) {
      ctx.strokeStyle = '#2c2c34'; ctx.lineWidth = 1.1;
      ctx.setLineDash([1.1, 1.3]); ctx.lineDashOffset = -rot * r;
      ctx.beginPath(); ctx.arc(p[0], p[1], r - 0.45, 0, 2 * PI); ctx.stroke();
      ctx.setLineDash([]);
    }
    const ri = r * (kind === 2 ? 0.46 : 0.56), fast = clamp((Math.abs(spin || 0) - 18) / 30, 0, 1);
    if (kind === 2) circ(p, ri + 0.7, col);
    circ(p, ri, RIM_C === null ? '#8d939d' : shade(RIM_C, -0.25));
    circ(p, ri - 0.5, RIM_C === null ? '#aeb4bd' : hex(RIM_C));
    ctx.strokeStyle = RIM_C === null ? '#555b66' : shade(RIM_C, -0.55);
    ctx.lineWidth = 0.75;                                      // Speichen (verwischen bei hohem Tempo)
    ctx.globalAlpha = 1 - 0.75 * fast;
    ctx.beginPath();
    for (let k = 0; k < 3; k++) {
      const a = rot + k * PI / 3;
      ctx.moveTo(p[0] - cos(a) * ri, p[1] - sin(a) * ri);
      ctx.lineTo(p[0] + cos(a) * ri, p[1] + sin(a) * ri);
    }
    ctx.stroke();
    ctx.globalAlpha = 1;
    if (fast > 0) {
      ctx.strokeStyle = 'rgba(85,91,102,' + (0.35 * fast) + ')'; ctx.lineWidth = ri * 0.5;
      ctx.beginPath(); ctx.arc(p[0], p[1], ri * 0.62, 0, 2 * PI); ctx.stroke();
    }
    const rd = r * 0.4;                                        // Bremsscheibe mit Löchern
    ctx.strokeStyle = '#d6dae0'; ctx.lineWidth = r * 0.11;
    ctx.beginPath(); ctx.arc(p[0], p[1], rd, 0, 2 * PI); ctx.stroke();
    if (fast < 1) {
      ctx.strokeStyle = 'rgba(70,74,84,' + (0.8 - 0.8 * fast) + ')'; ctx.lineWidth = r * 0.05;
      ctx.setLineDash([0.35, rd * PI / 4 - 0.35]); ctx.lineDashOffset = -rot * rd;
      ctx.beginPath(); ctx.arc(p[0], p[1], rd, 0, 2 * PI); ctx.stroke();
      ctx.setLineDash([]);
    }
    if (motor) { circ(p, r * 0.33, '#3a3b44'); circ(p, r * 0.25, '#17171c'); circ(p, r * 0.1, '#a8aeb6'); }
    else circ(p, r * 0.2, '#17171c');
    const a = rad(135) + (th || 0);                            // Bremssattel (dreht sich nicht mit)
    const q = [p[0] + cos(a) * rd, p[1] - sin(a) * rd];
    seg([q[0] - sin(a) * 0.7, q[1] - cos(a) * 0.7], [q[0] + sin(a) * 0.7, q[1] + cos(a) * 0.7], r * 0.26, CAL_C || cal || '#c4282a');
    ctx.strokeStyle = 'rgba(255,255,255,0.16)'; ctx.lineWidth = 0.6; ctx.lineCap = 'butt';     // Glanz auf dem Reifen
    ctx.beginPath(); ctx.arc(p[0], p[1], r - 0.8, -2.4, -1.2); ctx.stroke();
  }

  function fender(S, th, x, r, a0, a1, c) {
    // Schutzblech: Bogen um das Rad, Winkel in Grad (0 = nach vorn, 90 = oben)
    const p = S(x, 0);
    ctx.strokeStyle = c; ctx.lineWidth = 1.5; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.arc(p[0], p[1], r + 1.5, -(rad(a1) + th), -(rad(a0) + th)); ctx.stroke();
  }

  function shock(a, b, w, col) {
    // Federbein: Dämpfer in der Mitte, Feder im Zickzack außen herum
    const dx = b[0] - a[0], dy = b[1] - a[1], L = Math.hypot(dx, dy) || 1;
    const nx = -dy / L * w / 2, ny = dx / L * w / 2, n = max(6, Math.round(L / 0.5));
    seg(a, b, w * 0.42, '#23242c');
    ctx.strokeStyle = col; ctx.lineWidth = 0.42; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.beginPath();
    for (let i = 0; i <= n; i++) {
      const t = 0.1 + 0.8 * i / n, sg = i & 1 ? 1 : -1;
      const x = a[0] + dx * t + nx * sg, y = a[1] + dy * t + ny * sg;
      if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y);
    }
    ctx.stroke();
    circ(a, w * 0.36, '#6a6f7a'); circ(b, w * 0.36, '#6a6f7a');
  }

  function lettering(S, th, x, y, str, size, col, along) {
    // Schrift auf dem Scooter; along = Richtung in Grad (0 = nach vorn, 90 = nach oben)
    const q = S(x, y);
    ctx.save();
    ctx.translate(q[0], q[1]);
    ctx.rotate(-(th + rad(along || 0)));
    ctx.font = 'italic 900 ' + size + 'px' + FONT;
    ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
    ctx.fillStyle = col;
    ctx.fillText(str, 0, 0);
    ctx.restore();
  }

  function checker(S, x, y, col) {
    // kleines Karo-Muster (Aufkleber)
    const q = 0.62;
    for (const [i, k] of [[0, 0], [1, 1], [2, 0], [3, 1]])
      poly([S(x + i * q, y + k * q), S(x + i * q + q, y + k * q), S(x + i * q + q, y + k * q - q), S(x + i * q, y + k * q - q)], col);
  }

  function cable(S, a, c, b) {
    // Bremskabel: dünner Bogen vom Lenker nach unten
    const p0 = S(a[0], a[1]), p1 = S(c[0], c[1]), p2 = S(b[0], b[1]);
    ctx.strokeStyle = '#101014'; ctx.lineWidth = 0.38; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(p0[0], p0[1]); ctx.quadraticCurveTo(p1[0], p1[1], p2[0], p2[1]); ctx.stroke();
  }

  function drawScooter(model, S, th, col, rotF, rotR, dual, spinF, spinR) {
    // Alle Scooter sind nach Fotos der echten Modelle gezeichnet (Seitenansicht).
    // Koordinaten: Hinterachse = 0,0; x nach vorn, y nach oben. Griff bei 20.3 / 22.8.
    const c = hex(col), cd = shade(col, -0.3), cl = shade(col, 0.4);
    const D = '#17171c', D2 = '#2a2b33', ST = '#8d939d', RED = '#e0282a', CY = '#2bd4ff';
    const r = model.r, wb = model.wb;
    const hi = 'rgba(255,255,255,0.2)';
    if (model.id === 'g3') {
      // --- Ninebot Max G3: schlank, schwarzes Fahrwerk, rote Federn und Bremssättel ---
      wheel(S(0, 0), r, rotR, 0, c, true, th, spinR, RED);
      wheel(S(wb, 0), r, rotF, 0, c, dual, th, spinF, RED);
      fender(S, th, 0, r, 22, 158, D);                          // langes Schutzblech hinten
      seg(S(-5.7, 3.4), S(-6.1, 2.2), 1.1, D2);
      circ(S(-5.9, 2.9), 0.75, '#ff3b30');                      // Rücklicht
      fender(S, th, wb, r, 42, 152, D);
      seg(S(0, 0), S(5.6, -0.9), 2.0, D2);                      // Schwinge hinten
      circ(S(0, 0), 0.8, ST);
      shock(S(1.3, 2.5), S(5.0, 0.5), 1.6, RED);                // Federbein hinten
      seg(S(wb, 0), S(24.8, 4.4), 2.1, D);                      // Gabel
      circ(S(wb, 0), 0.8, ST);
      shock(S(25.0, 3.4), S(23.8, 7.2), 1.6, RED);              // Hydraulik-Federung vorn
      seg(S(10.6, -2.2), S(9.2, -4.7), 0.55, '#6a6f7a');        // Ständer
      poly([S(4.4, 0.9), S(18.4, 0.9), S(20.4, -0.5), S(19.6, -2.3), S(5.0, -2.3), S(3.8, -0.9)], c);    // Trittbrett
      poly([S(4.3, -1.35), S(20.1, -1.35), S(19.6, -2.3), S(5.0, -2.3)], cd);
      seg(S(5.2, 0.95), S(18.0, 0.95), 0.8, D2);                // Gummi-Matte
      seg(S(4.9, -0.2), S(6.1, -0.2), 0.7, '#ff8a1f');          // Reflektoren
      seg(S(17.6, -0.2), S(18.8, -0.2), 0.7, '#ff8a1f');
      lettering(S, th, 8.2, -0.2, model.label, 1.45, cl, 0);
      seg(S(18.6, -0.7), S(23.0, 6.2), 3.0, c);                 // Hals
      seg(S(19.6, 0.0), S(23.3, 5.7), 0.45, hi);
      cable(S, [22.4, 22.6], [27.6, 15], [24.7, 6.4]);
      seg(S(23.2, 8.0), S(20.9, 22.2), 2.1, c);                 // Lenkstange
      seg(S(23.7, 8.8), S(21.5, 21.8), 0.42, hi);
      circ(S(23.3, 7.0), 1.75, D2);                             // Klapp-Gelenk
      circ(S(23.3, 7.0), 0.6, RED);
      seg(S(22.4, 20.3), S(22.7, 21.9), 1.6, '#fff3b8');        // Licht
      seg(S(19.8, 23.7), S(22.8, 24.0), 1.6, D);                // Display im Lenker
      seg(S(20.3, 24.5), S(22.3, 24.7), 0.5, CY);
      seg(S(20.9, 22.3), S(23.3, 21.3), 0.45, ST);              // Bremshebel
      circ(S(20.3, 22.8), 1.3, D);
    } else if (model.id === 'g4') {
      // --- Kukirin G4: kantiger Rahmen, breite Reifen, schwarze Lenkstange, orange Details ---
      const O = '#ff7a1a', K = '#1c1d24';
      wheel(S(0, 0), r, rotR, 1, c, true, th, spinR, O);
      wheel(S(wb, 0), r, rotF, 1, c, dual, th, spinF, O);
      fender(S, th, 0, r, 38, 142, D);
      fender(S, th, wb, r, 52, 128, D);
      seg(S(0, 0), S(5.8, 0.2), 2.9, c);                        // Schwinge hinten
      seg(S(0.6, 0.6), S(5.4, 0.8), 0.4, cl);
      circ(S(0, 0), 0.95, ST);
      shock(S(0.9, 3.0), S(5.0, 1.2), 1.7, '#9aa0aa');
      seg(S(2.6, 1.6), S(0.6, 5.2), 1.2, D2);                   // Fußstütze hinten
      poly([S(-3.7, 7.2), S(-3.1, 8.1), S(4.5, 4.2), S(3.9, 3.3)], D);
      seg(S(-3.5, 7.6), S(-3.95, 6.8), 0.9, '#ff3b30');
      seg(S(24.9, 8.6), S(25.5, 3.0), 2.5, K);                  // Lenksäule nach unten
      seg(S(24.2, 2.7), S(wb, 0), 2.9, c);                      // Schwinge vorn
      seg(S(24.4, 3.3), S(26.6, 0.7), 0.4, cl);
      circ(S(wb, 0), 0.95, ST);
      shock(S(26.1, 7.6), S(26.9, 1.5), 1.9, '#9aa0aa');        // Federbein vorn
      seg(S(11.6, -1.7), S(13.0, -5.3), 0.6, '#6a6f7a');        // Ständer
      poly([S(3.6, 1.5), S(20.2, 1.5), S(21.6, 0.2), S(20.6, -1.7), S(4.4, -1.7), S(3.2, -0.2)], c);    // Trittbrett
      poly([S(3.8, -0.9), S(21.0, -0.9), S(20.6, -1.7), S(4.4, -1.7)], cd);
      seg(S(4.6, 1.55), S(19.4, 1.55), 0.8, D2);
      checker(S, 4.6, 0.55, O);
      checker(S, 17.0, 0.55, O);
      poly([S(8.0, 0.7), S(10.2, 0.7), S(10.2, -0.2), S(8.0, -0.2)], '#ffd23f');     // Aufkleber
      seg(S(19.4, -0.2), S(23.8, 7.6), 3.5, c);                 // schräger Träger zum Lenkkopf
      seg(S(20.5, 0.6), S(24.2, 7.1), 0.45, cl);
      checker(S, 20.9, 3.6, O);
      seg(S(23.3, 8.2), S(25.3, 9.7), 2.7, D2);                 // Klapp-Gelenk
      circ(S(24.3, 8.95), 0.6, O);
      cable(S, [22.6, 23], [28.4, 16], [26.4, 6.6]);
      seg(S(24.3, 9.9), S(21.3, 22.0), 3.0, K);                 // breite schwarze Lenkstange
      seg(S(25.2, 10.4), S(22.3, 21.8), 0.4, hi);
      lettering(S, th, 23.75, 11.6, model.label, 1.5, O, 103.8);
      poly([S(19.5, 23.2), S(24.5, 23.0), S(25.1, 24.4), S(21.4, 25.7), S(19.7, 24.9)], D);     // Cockpit mit LED-Licht
      seg(S(20.3, 24.6), S(22.4, 25.0), 0.6, CY);
      seg(S(24.5, 23.4), S(24.8, 24.1), 0.9, '#fff3b8');
      seg(S(20.9, 22.3), S(23.4, 21.4), 0.45, ST);
      circ(S(20.3, 22.8), 1.3, D);
    } else if (model.id === 'gt2') {
      // --- Segway GT2: langes flaches Trittbrett, große Titan-Gussform vorn, Schwinge vorn ---
      const O = '#ff8a2a', K = '#25262e', SV = '#d6dae0';
      wheel(S(0, 0), r, rotR, 0, c, true, th, spinR, '#9aa0aa');
      wheel(S(wb, 0), r, rotF, 0, c, dual, th, spinF, '#9aa0aa');
      fender(S, th, 0, r, 28, 140, D);
      seg(S(-5.2, 3.6), S(-6.0, 2.6), 1.3, D2);
      seg(S(0, 0), S(6.2, 0.4), 2.6, K);                        // Schwinge hinten
      circ(S(0, 0), 0.85, ST);
      shock(S(1.4, 2.6), S(5.6, 0.5), 1.6, SV);
      seg(S(12.0, -2.4), S(10.6, -5.2), 0.55, '#6a6f7a');       // Ständer
      poly([S(3.0, 1.6), S(20.8, 1.6), S(21.8, -0.4), S(20.4, -2.6), S(4.4, -2.6), S(2.6, -0.8)], K);    // Trittbrett
      poly([S(3.6, 1.6), S(20.6, 1.6), S(20.9, 0.5), S(3.4, 0.5)], c);                                   // Seitenblende
      seg(S(4.4, -0.7), S(19.4, -0.7), 0.42, O);                // orange Linie
      seg(S(4.2, 1.65), S(19.6, 1.65), 0.7, D2);
      lettering(S, th, 6.0, -1.65, model.label, 1.5, cl, 0);
      poly([S(16.4, 1.6), S(21.2, 1.6), S(26.0, 11.2), S(23.0, 12.6), S(20.4, 7.2)], c);    // große Gussform vorn
      poly([S(18.2, 1.6), S(20.4, 1.6), S(24.2, 9.4), S(22.6, 10.0)], cd);
      seg(S(21.6, 3.2), S(24.8, 9.8), 0.45, cl);
      seg(S(19.3, 0.9), S(20.4, 3.0), 0.8, O);                  // Blinker
      seg(S(25.4, 9.6), S(wb, 0), 2.6, c);                      // Schwinge vorn
      seg(S(25.9, 9.1), S(wb + 0.4, 0.6), 0.45, cl);
      shock(S(26.6, 10.4), S(28.4, 3.4), 1.7, SV);              // Federbein vorn
      circ(S(wb, 0), 0.9, ST);
      cable(S, [22.4, 22.8], [27.2, 16.6], [25.0, 11.8]);
      circ(S(24.4, 12.4), 1.6, K);                              // Klapp-Gelenk
      circ(S(24.4, 12.4), 0.55, O);
      seg(S(24.2, 13.2), S(21.0, 22.2), 2.1, K);                // Lenkstange
      seg(S(24.7, 13.5), S(21.6, 21.8), 0.4, hi);
      seg(S(22.3, 19.8), S(22.6, 21.2), 1.5, '#fff3b8');        // Licht
      seg(S(19.2, 23.5), S(23.4, 23.8), 2.2, D);                // Lenker mit Display
      seg(S(19.9, 24.4), S(22.7, 24.6), 0.6, CY);
      seg(S(20.9, 22.3), S(23.4, 21.4), 0.45, ST);
      circ(S(20.3, 22.8), 1.3, D);
    } else if (model.id === 'ww') {
      // --- Kaabo Wolf Warrior 11: Motorrad-Gabel bis zum Lenker, Doppel-Scheinwerfer, Gepäckträger ---
      const R = '#d8262c', K = '#1c1d24', SV = '#d0d4da', BL = '#3f8cff';
      wheel(S(0, 0), r, rotR, 1, c, true, th, spinR, R);
      wheel(S(wb, 0), r, rotF, 1, c, dual, th, spinF, R);
      seg(S(0, 0), S(6.6, 0.8), 3.0, K);                        // Schwinge hinten
      circ(S(0, 0), 0.95, ST);
      shock(S(1.0, 3.6), S(5.8, 1.4), 1.8, R);
      seg(S(2.4, 2.1), S(-0.4, 6.4), 0.9, K);                   // Gepäckträger / Griff hinten
      seg(S(-0.4, 6.4), S(-5.6, 6.0), 0.9, K);
      seg(S(-5.6, 6.0), S(-6.4, 4.4), 0.9, K);
      fender(S, th, 0, r, 40, 138, D);
      seg(S(12.4, -2.6), S(11.0, -5.6), 0.6, '#6a6f7a');        // Ständer
      poly([S(3.2, 2.1), S(20.4, 2.1), S(21.6, 0.4), S(20.8, -2.6), S(4.4, -2.6), S(2.6, -0.6)], c);     // Trittbrett
      poly([S(3.6, -1.2), S(21.2, -1.2), S(20.8, -2.6), S(4.4, -2.6)], cd);
      seg(S(4.4, 2.15), S(19.8, 2.15), 0.8, D2);                // Gummi-Matte
      seg(S(5.0, -2.95), S(19.8, -2.95), 0.5, BL);              // blaue LED unten
      lettering(S, th, 9.0, -0.5, model.label.toLowerCase(), 2.2, R, 0);
      poly([S(19.4, 2.1), S(22.0, 2.1), S(25.0, 8.2), S(22.8, 9.2)], K);       // Hals
      shock(S(21.2, 2.8), S(23.6, 8.0), 2.0, R);                // rote Feder im Hals
      seg(S(wb - 1.4, 0.4), S(22.8, 12.0), 1.5, K);             // Gabel: hinteres Rohr ...
      seg(S(wb, 0), S(24.4, 12.0), 2.1, K);                     // ... vorderes Rohr (schwarz) ...
      seg(S(wb - 0.2, 1.0), S(26.9, 5.6), 1.2, SV);             // ... mit silbernem Standrohr unten
      seg(S(24.4, 12.0), S(22.2, 22.6), 2.2, K);                // die Rohre gehen bis zum Lenker
      seg(S(22.8, 12.0), S(20.6, 22.6), 1.8, K);
      seg(S(24.9, 12.6), S(22.8, 22.2), 0.4, hi);
      seg(S(25.2, 12.4), S(22.0, 12.4), 1.0, D);                // Gabelbrücken
      seg(S(23.2, 21.4), S(20.2, 21.4), 1.0, D);
      circ(S(wb, 0), 0.95, ST);
      fender(S, th, wb, r, 60, 120, D);
      cable(S, [21.8, 23.0], [28.6, 17.4], [24.6, 8.2]);
      circ(S(26.0, 13.6), 1.7, K);                              // zwei runde Scheinwerfer
      circ(S(26.4, 13.6), 1.1, '#fff3b8');
      circ(S(26.6, 11.6), 1.7, K);
      circ(S(27.0, 11.6), 1.1, '#fff3b8');
      seg(S(18.8, 23.4), S(24.0, 23.9), 2.3, D);                // breiter Lenker mit roten Griffen
      seg(S(20.0, 24.9), S(22.4, 25.1), 0.6, CY);
      seg(S(20.9, 22.3), S(23.4, 21.4), 0.45, ST);
      circ(S(20.3, 22.8), 1.35, R);
    } else if (model.id === 'nami') {
      // --- NAMI Burn-E 2 Max: Gitterrohr-Rahmen, sehr hoch, lange Gabel, Federbein unter dem Trittbrett ---
      const K = '#1b1c22', SV = '#cfd4da', OR = '#ff6a1a';
      wheel(S(0, 0), r, rotR, 0, c, true, th, spinR, OR);
      wheel(S(wb, 0), r, rotF, 0, c, dual, th, spinF, OR);
      fender(S, th, 0, r, 42, 132, D);
      seg(S(-4.4, 5.4), S(-5.2, 4.4), 1.2, D2);
      seg(S(0, 0), S(7.0, 0.2), 3.0, K);                        // Schwinge hinten
      circ(S(0, 0), 0.95, ST);
      shock(S(3.2, -2.4), S(7.6, 0.9), 2.0, SV);                // Federbein liegt unter dem Trittbrett
      seg(S(12.6, -3.0), S(11.2, -6.0), 0.6, '#6a6f7a');        // Ständer
      poly([S(4.0, 2.0), S(20.0, 2.0), S(19.4, -2.0), S(4.8, -2.0)], '#22232a');     // Akku im Rahmen
      seg(S(2.6, 2.7), S(21.6, 2.7), 1.5, c);                   // Gitterrohr-Rahmen: oben ...
      seg(S(4.2, -2.8), S(20.0, -2.8), 1.5, c);                 // ... unten ...
      for (let k = 0; k < 5; k++)                               // ... und schräge Streben
        seg(S(4.4 + k * 3.2, -2.8), S(6.0 + k * 3.2, 2.7), 0.9, c);
      seg(S(3.0, 3.2), S(21.0, 3.2), 0.9, D);                   // Griptape oben
      seg(S(2.6, 2.7), S(4.2, -2.8), 1.5, c);
      seg(S(21.0, 2.7), S(25.0, 10.2), 1.7, c);                 // Rahmen läuft zum Lenkkopf hoch
      seg(S(20.0, -2.8), S(25.6, 8.0), 1.7, c);
      seg(S(21.6, 2.4), S(25.2, 9.4), 0.4, cl);
      seg(S(25.2, 9.6), S(26.8, 4.6), 2.6, D2);                 // lange Gabel: oben dunkel ...
      seg(S(26.8, 4.6), S(wb, 0), 1.7, SV);                     // ... unten silbern
      circ(S(wb, 0), 0.95, ST);
      fender(S, th, wb, r, 58, 122, D);
      cable(S, [22.0, 23.0], [28.4, 17.2], [26.0, 9.4]);
      seg(S(24.9, 9.8), S(21.2, 22.2), 2.4, K);                 // Lenkstange
      seg(S(25.6, 10.4), S(22.1, 21.8), 0.42, hi);
      lettering(S, th, 23.2, 13.2, model.label, 1.4, OR, 106.4);
      circ(S(25.3, 12.4), 1.5, K);                              // Scheinwerfer
      circ(S(25.7, 12.4), 1.0, '#fff3b8');
      seg(S(19.2, 23.5), S(23.6, 23.8), 2.4, D);                // Lenker mit Display
      seg(S(20.0, 24.6), S(22.8, 24.8), 0.6, CY);
      seg(S(20.9, 22.3), S(23.4, 21.4), 0.45, ST);
      circ(S(20.3, 22.8), 1.3, D);
    } else {
      // --- Dualtron X Limited: riesiger Akku-Kasten, eine dicke Lenksäule, fette 13-Zoll-Reifen ---
      const K = '#1c1d24', K2 = '#30323c', SV = '#c9ced6';
      wheel(S(0, 0), r, rotR, 2, c, true, th, spinR, RED);
      wheel(S(wb, 0), r, rotF, 2, c, dual, th, spinF, RED);
      fender(S, th, 0, r, 32, 122, D);
      seg(S(0, 0), S(6.6, 0.6), 3.7, K2);                       // Schwingen
      seg(S(0.8, 1.2), S(6.2, 1.7), 0.45, c);
      circ(S(0, 0), 1.05, ST);
      seg(S(wb, 0), S(23.8, 1.0), 3.7, K2);
      seg(S(24.4, 1.9), S(29.2, 1.1), 0.45, c);
      circ(S(wb, 0), 1.05, ST);
      seg(S(8.2, -3.6), S(6.6, -6.3), 0.7, '#6a6f7a');          // Ständer
      poly([S(-2.7, 8.5), S(-1.9, 9.4), S(5.2, 4.5), S(4.8, 2.4), S(2.6, 2.4)], K);     // Fußstütze hinten
      seg(S(-2.6, 8.4), S(-2.9, 7.3), 1.0, '#ff3b30');
      shock(S(-0.5, 6.5), S(4.0, 3.4), 2.1, SV);                // Federbein hinten
      circ(S(-0.7, 6.7), 0.65, RED);
      poly([S(3.6, 2.4), S(22.6, 2.4), S(23.9, 0.6), S(22.7, -3.7), S(4.8, -3.7), S(3.2, -1.0)], K);    // Akku-Kasten
      poly([S(4.6, 1.3), S(22.6, 1.3), S(22.3, -2.7), S(5.2, -2.7), S(4.2, -0.9)], K2);
      seg(S(4.4, 2.4), S(21.8, 2.4), 0.9, '#3a3b44');           // Griptape
      seg(S(5.4, -0.7), S(7.6, -0.7), 1.5, '#ff3b30');          // Rücklicht in der Seite
      seg(S(5.4, -0.7), S(7.6, -0.7), 0.4, '#ffb0a8');
      lettering(S, th, 8.7, -0.75, model.label, 1.9, cl, 0);
      circ(S(21.1, -0.7), 1.2, '#ffd23f');                      // gelber Ring
      circ(S(21.1, -0.7), 0.72, K);
      seg(S(5.6, -3.25), S(22.0, -3.25), 0.5, c);               // LED-Leiste unten
      poly([S(20.6, 2.4), S(24.4, 0.3), S(26.4, 9.0), S(22.6, 10.2)], K);      // Hals-Block
      seg(S(25.6, 8.3), S(34.2, 7.7), 0.95, K);                 // Schutzblech vorn (gerade Platte)
      shock(S(24.5, 7.3), S(28.6, 2.6), 2.1, SV);               // Federbein vorn
      circ(S(24.3, 7.5), 0.65, RED);
      poly([S(22.1, 9.6), S(26.5, 8.7), S(26.8, 12.3), S(22.7, 13.2)], K2);    // Klapp-Block
      circ(S(23.6, 11.6), 0.5, ST); circ(S(25.5, 10.2), 0.5, ST);
      cable(S, [22.6, 23.4], [29.4, 17], [27.0, 9.4]);
      seg(S(24.5, 12.8), S(21.5, 22.2), 3.7, K);                // dicke Lenksäule
      seg(S(25.8, 13.4), S(22.9, 22.0), 0.42, hi);
      lettering(S, th, 23.55, 15.4, model.label, 1.55, cl, 107.4);
      circ(S(26.2, 13.7), 1.75, K2);                            // runder Scheinwerfer
      circ(S(26.6, 13.7), 1.15, '#fff3b8');
      seg(S(19.6, 23.5), S(23.4, 23.7), 2.5, K);                // Lenker-Klemme und Display
      seg(S(20.3, 25.2), S(22.9, 25.4), 1.3, D);
      seg(S(20.7, 25.6), S(22.5, 25.7), 0.45, CY);
      seg(S(20.9, 22.3), S(23.6, 21.5), 0.5, ST);
      circ(S(20.3, 22.8), 1.4, D);
    }
  }

  // Farben vom Fahrer: kommen aus CUSTOM (applyLook), gezeichnet wird immer nur ein Fahrer
  let SKIN = '#f4c7a1', SKIN_D = '#d79f7a', SHIRT = '#e84a3c', SHIRT_D = '#b8372d';
  let LEG_F = '#33509a', LEG_B = '#25356e', SHOE = '#ededf2', STRIPE = '#ffffff';
  let HELMET_T = 0, HELMET_C = 0x19C2A0, VISOR = '#20232c', PATTERN = 0;
  let RIM_C = null, CAL_C = null;           // Felgen und Bremssättel (null = Serie)
  function pick(list, i, t) {
    // Farbe aus einer CUSTOM-Liste: Regenbogen läuft, "wie Scooter" nimmt die Scooter-Farbe
    const c = list[i][1];
    return c === -1 ? rainbow(t * 0.4) : c === -2 ? G.body : c;
  }
  function applyLook(t) {
    const L = store.look, sk = SKINS[L.skin][1], sh = CLOTH[L.shirt][1], pa = CLOTH[L.pants][1];
    SKIN = hex(sk); SKIN_D = shade(sk, -0.13);
    SHIRT = hex(sh); SHIRT_D = shade(sh, -0.22);
    STRIPE = L.shirt === 3 ? '#2b2c34' : '#ffffff';
    LEG_F = hex(pa); LEG_B = shade(pa, -0.28);
    SHOE = hex(CLOTH[L.shoes][1]);
    HELMET_T = L.helmet; PATTERN = L.pattern;
    HELMET_C = pick(HCOLS, L.hcol, t);
    VISOR = hex(VISORS[L.visor][1]);
    const md = store.mods[store.scooter];
    RIM_C = md[0] === 0 ? null : pick(RIMS, md[0], t);
    CAL_C = md[1] === 0 ? null : hex(CALIPERS[md[1]][1]);
  }

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
    if (PATTERN === 0) seg(P(3.2, 0.9), P(TORSO - 2.6, 0.9), 0.9, STRIPE);       // Muster: ein Streifen
    else if (PATTERN === 2) {                                                     // zwei Streifen
      seg(P(3.2, 1.5), P(TORSO - 2.6, 1.5), 0.6, STRIPE);
      seg(P(3.2, 0.2), P(TORSO - 2.6, 0.2), 0.6, STRIPE);
    } else if (PATTERN === 3) seg(P(5.6, -2.3), P(5.6, 2.3), 1.7, hex(col));    // Rennstreifen in Helm-Farbe
    seg(P(TORSO + 0.2, 0.3), P(TORSO + 2.4, 0.5), 2.4, SKIN_D);  // Hals
    const head = P(16.1, 0.5), hc = hex(col), hd = shade(col, -0.3);
    circ(head, 3.7, SKIN);
    if (HELMET_T === 0) {                                       // offener Helm: von der Stirn bis in den Nacken
      ctx.fillStyle = hc;
      ctx.beginPath();
      for (let k = -1; k < 12; k++) {
        const w = rad(8 + k * 17) - a;
        const x = head[0] + 4.5 * cos(w), y = head[1] - 4.5 * sin(w) - 0.2;
        if (k < 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.closePath(); ctx.fill();
      seg(P(17.6, 2.0), P(19.3, 0.4), 1.0, 'rgba(255,255,255,0.75)');     // Glanzlicht
      seg(P(16.7, 2.6), P(16.3, 5.9), 1.3, '#20202a');          // Schirm
      circ(P(15.0, 3.0), 0.55, '#20202a');                      // Auge
      seg(P(13.4, -2.6), P(13.0, 0.4), 0.6, '#20202a');         // Kinnriemen
    } else {                                                    // Integral- oder Motocross-Helm: ganzer Kopf
      circ(head, 4.7, hc);
      poly([P(14.0, 0.8), P(12.4, 2.4), P(12.0, 4.4), P(13.6, 5.0), P(15.2, 4.4)], hc);   // Kinnteil
      seg(P(12.5, 1.6), P(12.2, 4.0), 0.5, hd);
      if (HELMET_T === 1) {
        seg(P(16.9, 3.3), P(15.0, 3.7), 2.3, VISOR);           // Visier
        seg(P(17.4, 4.0), P(16.9, 4.6), 0.5, 'rgba(255,255,255,0.55)');
      } else {
        poly([P(12.4, 2.6), P(10.9, 6.4), P(12.2, 6.8), P(14.0, 4.8)], hc);           // Kinnbügel nach vorn
        seg(P(16.6, -4.2), P(16.6, 2.6), 0.9, '#20202a');      // Brillenband
        seg(P(16.9, 2.8), P(15.6, 4.9), 2.0, VISOR);           // Brille
        seg(P(17.1, 3.8), P(16.6, 4.6), 0.45, 'rgba(255,255,255,0.6)');
        poly([P(19.4, 0.4), P(19.6, 7.0), P(18.6, 7.2), P(18.2, 2.4)], hd);           // Schirm oben
      }
      seg(P(18.4, -1.6), P(20.2, 0.2), 0.9, 'rgba(255,255,255,0.6)');      // Glanzlicht
    }
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
    // o: model, col, th, pose, arms, swing (Winkel oder null), lean, rotF, rotR, spinF, spinR,
    //    dual, tilt (Oberkörper neigt sich beim Gasgeben und Bremsen, Grad), brake, light
    const model = o.model, g = body(o.th, o.pose, o.lean, model.dy);
    ctx.save();
    ctx.translate(x, y);
    const lamp = g.S(model.lamp[0], model.lamp[1]), tail = g.S(model.tail[0], model.tail[1]);
    if (o.light) {                                              // Lichtkegel vom Scheinwerfer
      ctx.save();
      ctx.translate(lamp[0], lamp[1]);
      ctx.rotate(0.16 - o.th);
      const gr = ctx.createLinearGradient(0, 0, 62, 0);
      gr.addColorStop(0, 'rgba(255,244,190,0.20)'); gr.addColorStop(1, 'rgba(255,244,190,0)');
      ctx.fillStyle = gr;
      ctx.beginPath(); ctx.moveTo(0, -1); ctx.lineTo(62, -9); ctx.lineTo(62, 13); ctx.lineTo(0, 1); ctx.closePath(); ctx.fill();
      ctx.restore();
    }
    drawScooter(model, g.S, o.th, o.col, o.rotF, o.rotR, o.dual, o.spinF, o.spinR);
    if (o.led !== null && o.led !== undefined) {                 // LED unter dem Trittbrett
      const la = g.S(4.5, model.bot), lb = g.S(19.5, model.bot);
      ctx.globalCompositeOperation = 'lighter';
      glow(tintSprite(o.led), (la[0] + lb[0]) / 2, (la[1] + lb[1]) / 2, 10, 2.4, 0.7);
      ctx.globalCompositeOperation = 'source-over';
      seg(la, lb, 0.6, hex(o.led));
    }
    if (o.light) {
      glow(SPR.warm, lamp[0], lamp[1], 4.2, 0, 0.75);
      glow(SPR.red, tail[0], tail[1], o.brake ? 6.5 : 2.6, 0, o.brake ? 0.95 : 0.5);    // Bremslicht
      if (o.brake) circ(tail, 0.9, '#ffd0c8');
    }
    drawLeg(g, model, false);
    if (o.swing !== null) drawSwing(g.hip, o.swing); else drawLeg(g, model, true);
    const psi = g.psi + (o.tilt || 0);
    const sh = drawTorso(g.hip, psi, HELMET_C);
    circ(g.hip, 2.2, LEG_F);
    const phi = o.th * 180 / PI * o.lean;
    if (o.arms === 2) drawUpArm(sh, phi, 1);
    else drawBarArm(sh, g.S(20.3, 22.8), psi);
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
    cells(dist, 20, (n, x) => {
      ctx.fillStyle = 'rgba(0,0,0,' + (hash(n, 21) * 0.07) + ')';
      ctx.fillRect(x + 0.7, base + 0.7, 19.3, 6.3);
    });
    ctx.fillStyle = 'rgba(0,0,0,0.16)'; ctx.fillRect(0, base + 0.7, W, 1.3);      // Schatten der Häuser
    ctx.fillStyle = '#d0d0d8'; ctx.fillRect(0, base, W, 0.7);
    ctx.fillStyle = '#7a7a86'; ctx.fillRect(0, base + 7, W, 2.6);    // Bordstein
    ctx.setTransform(1, 0, 0, 1, 0, 0);                         // Asphalt: Pixel für Pixel kopieren
    const rw = roadCanvas.width, ry = Math.floor((base + 9.5) * SC);
    for (let x = -Math.round((((dist % ROAD_W) + ROAD_W) % ROAD_W) * SC); x < canvas.width; x += rw)
      ctx.drawImage(roadCanvas, x, ry);
    ctx.setTransform(SC, 0, 0, SC, 0, 0);
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
      glow(SPR.dark, x + (((n % 3) + 3) % 3 === 1 ? 11 : 7), by + 0.2, ((n % 3) + 3) % 3 === 1 ? 10 : 5, 1.5, 0.45);
      if (((n % 3) + 3) % 3 === 1) {
        ctx.fillStyle = '#6b4a2b'; ctx.fillRect(x + 6.5, by - 16, 3, 16);
        ctx.fillStyle = '#4d351f'; ctx.fillRect(x + 8.5, by - 16, 1, 16);
        circ([x + 9, by - 17.5], 6.5, '#2f7a3d');
        circ([x + 8, by - 21], 8.5, '#3d8f4b');
        circ([x + 6, by - 24], 5.4, '#55b462');
        circ([x + 12, by - 19], 3.4, '#55b462');
        circ([x + 4.5, by - 25.5], 2.4, '#6cc777');
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
  // kind: 0 Rauch, 1 Staub, 2 Bremsrauch, 3 Flamme, 4 Funke
  const puffs = [];
  function emitPuff(x, y, vx, vy, life, kind) {
    if (puffs.length < 220)
      puffs.push({ x, y, vx, vy, age: 0, life, kind, s: 0.8 + random() * 0.5, spr: kind === 0 ? smokeSprite() : null });
  }
  function sparks(x, y, n, speed) {
    for (let i = 0; i < n; i++)
      emitPuff(x, y, -speed * (0.3 + random()), -20 - random() * 70, 0.18 + random() * 0.3, 4);
  }
  function updatePuffs(dt, scroll) {
    const k = Math.pow(0.96, dt * 30);
    for (let i = puffs.length - 1; i >= 0; i--) {
      const p = puffs[i];
      p.age += dt;
      if (p.age >= p.life) { puffs.splice(i, 1); continue; }
      p.x += p.vx * dt - scroll;
      p.y += p.vy * dt;
      if (p.kind === 4) {                       // Funken fallen und springen einmal auf
        p.vy += 330 * dt;
        if (p.y > GY && p.vy > 0) { p.y = GY; p.vy *= -0.35; p.vx *= 0.6; }
      } else {
        p.vx *= k;
        if (p.kind < 3) { p.vy = p.vy * k - 5 * dt; }           // Rauch steigt langsam weiter auf
      }
    }
  }
  function drawPuffs() {
    for (const p of puffs) {
      const f = p.age / p.life, kind = p.kind;
      if (kind === 3) {                                         // Flamme: wird kleiner
        const r = 5.4 - 3.4 * f;
        ctx.globalCompositeOperation = 'lighter';
        glow(SPR.fire, p.x, p.y, r * 2.4, 0, 0.5 * (1 - f));
        ctx.globalCompositeOperation = 'source-over';
        circ([p.x, p.y], r, '#e8473c');
        circ([p.x, p.y], r * 0.75, '#ffb52e');
        circ([p.x, p.y], r * 0.4, '#fff3a0');
      } else if (kind === 4) {                                  // Funke: kurzer heller Strich
        ctx.strokeStyle = f < 0.4 ? '#fff6c8' : f < 0.75 ? '#ffc04a' : '#ff7a2a';
        ctx.lineWidth = 0.55; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x - p.vx * 0.018, p.y - p.vy * 0.018); ctx.stroke();
      } else {                                                  // Rauch und Staub: weich, wird größer und dünner
        const r = (kind === 0 ? 3.4 + 8.5 * f : 2.2 + 5.5 * f) * p.s;
        const a = (kind === 0 ? 0.8 : kind === 1 ? 0.5 : 0.34) * (1 - f) * min(1, p.age * 12);
        glow(kind === 1 ? SPR.dust : p.spr || (f > 0.5 || kind === 2 ? SPR.grey : SPR.smoke), p.x, p.y, r, 0, a);
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
    custom: false, ctab: 0, crow: 0, cfx: 0,          // CUSTOM-Fenster: offen, Reiter, Zeile, Rauch-Vorschau
    marks: [], skid: 0, accS: 0, scrape: false,       // Bremsspuren, rutschende Reifen, Beschleunigung (geglättet)
    ps: 0, po: 0, smode: false, slanding: false,      // Stoppie: Winkel (rad), Drehgeschwindigkeit, an, sanft landen
    inStoppie: false, sd: 0, st: 0, crashFwd: false,  // ... Strecke (m), Zeit (s), Sturz nach vorn
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
    G.marks.length = 0; G.skid = 0; G.accS = 0; G.scrape = false;
    G.ps = 0; G.po = 0; G.smode = false; G.slanding = false;
    G.inStoppie = false; G.sd = 0; G.st = 0; G.crashFwd = false;
    for (const l of G.lines) l.x = -99;
  }
  function gotoMenu() { G.state = MENU; G.tuning = false; G.custom = false; resetRide(); }
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

  function physicsStoppie(h, gas, brake) {
    // Ein kleiner Zeitschritt im Stoppie. Gibt true zurück, wenn das Hinterrad aufsetzt.
    // Das Hinterrad ist in der Luft: der Motor treibt nicht, Gas macht nichts. Nur die Bremse steuert.
    let v = G.v;
    if (brake) v -= S_BRAKE * h;
    v -= (ROLL + AERO * v * v) * h;
    if (v < 0.0) v = 0.0;
    G.v = v;

    // Drehung um die Vorderachse: die Schwerkraft zieht das Heck nach unten,
    // die Vorderbremse zieht es hoch (nur solange der Scooter noch rollt)
    let ps = G.ps, po = G.po;
    if (ps <= 0.0 && po <= 0.0 && !G.smode) return false;
    let a = -S_GRAVITY * cos(S_PHI0 + ps) - DAMPING * po * (G.crouch ? 1.6 : 1.0);
    if (G.slanding) {
      a -= LAND_TORQUE;
    } else if (G.smode) {
      if (brake) a += S_LIFT * CTRL[G.arms] * min(1.0, v * 0.35);
      else a -= S_DOWN;                         // Bremse los = Heck kommt runter (Gas braucht es nicht)
      a += WOBBLE[G.arms] * sin(G.t * 2.7);
    }
    po += a * h;
    if (G.slanding && po < -LAND_SPEED) po = -LAND_SPEED;
    ps += po * h;
    if (ps <= 0.0) {
      const landed = G.ps > 0.0;
      if (landed && po < -2.4) G.v *= 0.96;     // hartes Aufsetzen kostet etwas Tempo
      G.ps = 0.0; G.po = 0.0;
      return landed;
    }
    G.ps = ps; G.po = po;
    return false;
  }

  function updatePlay(dt) {
    const gas = (held & BTN_A) !== 0, brake = (held & BTN_B) !== 0, ay = axleY();
    const dual = store.tune[store.scooter][DUAL] > 0;
    if (pressed & BTN_STOP) {
      if (G.smode) {
        if (G.ps > 0) G.slanding = true;                                     // nochmal: sanft landen
        else G.smode = false;
      } else if (G.wmode || G.th > 0) {
        // im Wheelie geht kein Stoppie
      } else if (G.v * 3.6 < S_MIN_KMH) {
        toast('SCHNELLER FÜR STOPPIE!');
      } else {
        G.smode = true; G.slanding = false; G.po += S_POP; G.boost = false;  // Heck hochreißen
      }
    }
    const inS = G.smode || G.ps > 0;            // im Stoppie
    if ((pressed & BTN_UP) && !inS) {
      if (!G.wmode) { G.wmode = true; G.landing = false; G.om += POP; }      // Vorderrad hochreißen
      else if (G.th > 0) G.landing = true;                                   // nochmal: sanft landen
      else G.wmode = false;
    }
    const arms = held & BTN_RIGHT ? 2 : (held & BTN_LEFT ? 1 : 0);
    const crouch = (held & BTN_DOWN) !== 0;
    if (arms !== G.arms || crouch !== G.crouch) {
      G.arms = arms; G.crouch = crouch;
      if ((G.inWheelie || G.inStoppie) && (arms || crouch)) play(SND_TRICK);
    }
    G.kn = clamp(G.kn + (crouch ? dt * 14.0 : dt * -14.0), 0.0, 2.0);        // weich in die Hocke und zurück
    if (G.dip > 0) G.dip -= dt;

    // Burnout: Gas + Bremse im Stand. Nach 1 Sekunde Bremse loslassen = Boost!
    const burn = gas && brake && G.v < 0.4 && G.th === 0 && !G.wmode && !inS;
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
      G.emit += dt * 22;                        // Rauch am Hinterrad
      while (G.emit >= 1) {
        G.emit -= 1;
        emitPuff(RX - 2 + randint(-2, 2), GY - 1.5, -18 - random() * 40, -6 - random() * 16,
          0.9 + random() * 0.9, 0);
        if (dual)                               // Dual-Motor: auch das Vorderrad dreht durch
          emitPuff(RX + model().wb - 2 + randint(-2, 2), GY - 1.5, -18 - random() * 40,
            -6 - random() * 16, 0.9 + random() * 0.9, 0);
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
    const step_ = inS ? physicsStoppie : physics;
    for (let i = 0; i < n; i++) if (step_(h, gas, brake)) { landed = true; break; }
    let v = G.v;
    if (wasBoost && !G.boost) {
      G.big = '';
      if (v >= car.vmax - 0.5) toast(car.kmh + ' KM/H!');
    }

    // Wippen: im Boost wird das Vorderrad leicht, beim Landen federt es nach
    const sq = G.th === 0 && !inS ? clamp(((v - v0) / dt - 7.0) * 0.03, 0.0, 0.21) : 0.0;
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
          emitPuff(RX + 2 - LEG_REACH * sin(k), GY - 1, -20.0, -16.0, 0.45, 1);
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

    // Nur fürs Auge und Ohr (ändert die Fahr-Physik nicht):
    G.accS += ((v - v0) / dt - G.accS) * min(1, dt * 7);          // Beschleunigung, geglättet
    const skid = brake && G.th === 0 && v > 7 && !G.burn && !inS; // Vollbremsung: Reifen rutschen
    if (skid) {
      if (!G.skid) G.marks.push({ x: RX, len: 0 });
      const mk = G.marks[G.marks.length - 1];
      mk.x = RX + G.dpx; mk.len += G.dpx;
      G.emit += dt * 14;
      if (G.emit >= 1) { G.emit -= 1; emitPuff(RX - 1, GY - 1, -8 - random() * 14, -5 - random() * 8, 0.5 + random() * 0.3, 2); }
    }
    G.skid = skid ? min(1, v / 20) : 0;
    if (inS && brake && v > 3) G.skid = 0.25;                     // im Stoppie quietscht der Vorderreifen leise
    G.scrape = G.th > 1.08 && v > 1;                              // kurz vor dem Umkippen schleift das Heck
    if (G.scrape) sparks(RX - model().r * 0.9, GY - 0.5, random() < dt * 70 ? 2 : 0, 30 + v * 3);

    if (G.th > 0 && !G.inWheelie) {
      G.inWheelie = true;
      G.wd = 0.0; G.wt = 0.0; G.tp = 0.0; G.bannerT = 0.0; G.msg = '';
    }
    if (G.inWheelie) {
      G.wd += d;
      G.wt += dt;
      G.tp += d * RATE[arms + (crouch ? 3 : 0)];
    }
    if (G.ps > 0 && !G.inStoppie) {
      G.inStoppie = true;
      G.sd = 0.0; G.st = 0.0; G.tp = 0.0; G.bannerT = 0.0; G.msg = '';
    }
    if (G.inStoppie) {
      G.sd += d;
      G.st += dt;
      G.tp += d * RATE[arms + (crouch ? 3 : 0)];
    }
    if (G.th >= CRASH_RAD || G.ps >= S_CRASH_RAD) { crash(); return; }
    if (landed && inS) {
      G.smode = false; G.slanding = false; G.dip = 0.16;
      if (v > 2) for (let i = 0; i < 3; i++)      // Staub, wenn das Hinterrad aufsetzt
        emitPuff(RX + randint(-2, 2), GY - 1, -10.0 - random() * 20, -8.0 - random() * 12, 0.5, 1);
      if (G.inStoppie) endStoppie();
    } else if (landed) {
      G.wmode = false; G.landing = false; G.dip = 0.16;
      if (v > 2) for (let i = 0; i < 3; i++)      // Staub beim Aufsetzen
        emitPuff(RX + model().wb + randint(-2, 2), GY - 1, -10.0 - random() * 20, -8.0 - random() * 12, 0.5, 1);
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

  function endStoppie() {
    G.inStoppie = false;
    if (G.sd < MIN_WHEELIE) { G.big = ''; G.sub = ''; return; }
    G.bannerT = 3.0;
    G.big = G.sd.toFixed(1) + ' M';
    const tp = floor(G.tp), won = floor(G.sd * COIN_PER_M_STOPPIE) + tp;
    store.coins += won;
    G.msg = '';
    if (tp > 0 && tp > store.tbest) { store.tbest = tp; G.msg = 'TRICK-REKORD!'; }
    toast((tp > 0 ? 'TRICKS +' + tp + '   ' : '') + '+' + won + ' MÜNZEN');
    if (G.sd > store.sbest) {
      store.sbest = G.sd;
      G.recordT = 2.5;
      G.sub = 'NEUER STOPPIE-REKORD!';
      play(SND_RECORD);
    } else {
      const d = G.sd;
      G.sub = 'STOPPIE ' + (d < 3 ? 'OK!' : d < 10 ? 'NICE!' : d < 25 ? 'STARK!' : d < 60 ? 'MEGA!' : 'LEGENDE!') +
        '  ' + G.st.toFixed(1) + ' S';
      play(SND_LAND);
    }
    saveStore();
  }

  function crash() {
    G.state = CRASH;
    G.crashFwd = G.ps > 0;                      // aus dem Stoppie: über den Lenker
    const dist = G.crashFwd ? G.sd : G.wd;
    G.inWheelie = false; G.wmode = false; G.landing = false; G.burn = false; G.boost = false;
    G.inStoppie = false; G.smode = false; G.slanding = false;
    G.crashT = 0.0; G.shakeT = 0.4; G.bannerT = 0.0; G.skid = 0;
    sparks(G.crashFwd ? RX + model().wb + 3 : RX - 4, GY - 1, 14, 60 + G.v * 3);
    G.big = 'GESTÜRZT!';
    G.sub = dist >= MIN_WHEELIE ? dist.toFixed(1) + ' M ZÄHLT NICHT' : G.crashFwd ? 'ÜBER DEN LENKER!' : 'AUTSCH!';
    G.msg = '';
    play(SND_CRASH);
    buzz(200);
  }

  function updateCrash(dt) {
    G.crashT += dt;
    if (G.crashFwd) {                           // überschlägt sich nach vorn bis 100 Grad
      if (G.ps < 1.745) {
        G.po += 6.0 * dt;
        G.ps = min(G.ps + G.po * dt, 1.745);
      }
    } else if (G.th < 1.745) {                  // kippt weiter bis 100 Grad
      G.om += 6.0 * dt;
      G.th = min(G.th + G.om * dt, 1.745);
    }
    G.v = max(0.0, G.v - 7.0 * dt);
    G.dpx = G.v * dt * PX_PER_M;
    G.scrape = max(G.th, G.ps) >= 1.6 && G.v > 1.5;     // der Scooter rutscht auf dem Lenker: Funken
    if (G.scrape && random() < dt * 60)
      sparks(G.crashFwd ? RX + model().wb + 4 + random() * 10 : RX - 6 - random() * 16, GY - 0.5, 2, 20 + G.v * 3);
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

  function customLayout() {
    // links das Fenster mit den Einstellungen, rechts die Vorschau
    const px = IL + 4, pw = clamp(W - IL - IR - 112, 100, 136), area = W - IR - (px + pw);
    const zoom = area >= 110 ? 1.45 : area >= 80 ? 1.2 : 1.0;   // Vorschau so groß, wie Platz ist
    return { px, py: 3, pw, ph: H - 6, pcx: (px + pw + W - IR) / 2, area, zoom };
  }
  function changeCustom(row, dir) {
    const [, list, key] = row;
    if (G.ctab === 0) store.look[key] = (store.look[key] + dir + list.length) % list.length;
    else if (key < 0) { setColor(dir); return; }
    else {
      const m = store.mods[store.scooter];
      m[key] = (m[key] + dir + list.length) % list.length;
      if (key === 3) G.cfx = 1.3;               // neue Rauchfarbe gleich zeigen
    }
    play(SND_TICK);
  }
  function randomCustom() {
    // ZUFALL: alles auf der offenen Seite neu würfeln
    if (G.ctab === 0) for (const [, list, key] of LOOK_ROWS) store.look[key] = floor(random() * list.length);
    else {
      store.color[store.scooter] = floor(random() * COLORS.length);
      const m = store.mods[store.scooter];
      for (const [, list, key] of MOD_ROWS) if (key >= 0) m[key] = floor(random() * list.length);
      G.cfx = 1.3;
    }
    play(SND_BUY);
  }
  function closeCustom() {
    G.custom = false;
    saveStore();
    play(SND_TICK);
  }

  function updateMenu(dt) {
    void dt;
    const i = store.scooter;
    if (G.custom) {
      const rows = G.ctab ? MOD_ROWS : LOOK_ROWS;
      if (pressed & BTN_UP) G.crow = (G.crow + rows.length - 1) % rows.length;
      if (pressed & BTN_DOWN) G.crow = (G.crow + 1) % rows.length;
      if (pressed & BTN_LEFT) changeCustom(rows[G.crow], -1);
      if (pressed & BTN_RIGHT) changeCustom(rows[G.crow], 1);
      if (pressed & BTN_B) { G.ctab ^= 1; G.crow = 0; play(SND_TICK); }
      if (pressed & BTN_START) closeCustom();
      if (G.cfx > 0) {                          // Vorschau vom Rauch: kurzer Burnout
        G.cfx -= dt;
        G.rotR += dt * 45;
        G.emit += dt * 22;
        const L = customLayout(), m = model();
        while (G.emit >= 1) {
          G.emit -= 1;
          emitPuff(L.pcx - m.wb * L.zoom / 2 + randint(-2, 2), GY - 2, -18 - random() * 40, -6 - random() * 16,
            0.9 + random() * 0.9, 0);
        }
      }
      return;
    }
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

  function drawCustom() {
    const { px, py, pw, ph, pcx, area } = customLayout(), i = store.scooter, mdl = SCOOTERS[i];
    ctx.fillStyle = 'rgba(20,30,64,0.93)'; rrect(px, py, pw, ph, 4); ctx.fill();
    ctx.strokeStyle = '#4c66b8'; ctx.lineWidth = 0.8; rrect(px, py, pw, ph, 4); ctx.stroke();
    text('CUSTOM', px + 5, py + 4, 7, '#ffd23f', 0, '#8c3b2e');
    const tw = (pw - 46) / 2;                   // zwei Reiter: Fahrer und Scooter
    for (const [k, name] of [[0, 'FAHRER'], [1, 'SCOOTER']]) {
      if (button(px + 42 + k * (tw + 1.5), py + 3, tw, 10, name, { size: 4.2, color: G.ctab === k ? '#8a4fd6' : '#33406e' })) {
        if (G.ctab !== k) { G.ctab = k; G.crow = 0; play(SND_TICK); }
      }
    }
    const rows = G.ctab ? MOD_ROWS : LOOK_ROWS, rh = min(12, (ph - 17) / rows.length);
    const bL = px + 41, vx = bL + 10, vw = pw - 4 - 10 - 51, bR = px + pw - 4 - 9;
    rows.forEach((row, r) => {
      const [name, list, key] = row, y = py + 16 + r * rh, bh = rh - 2.4;
      const idx = G.ctab === 0 ? store.look[key] : key < 0 ? store.color[i] : store.mods[i][key];
      if (!usedTouch && r === G.crow) {         // mit Tastatur: ausgewählte Zeile
        ctx.fillStyle = 'rgba(255,255,255,0.08)'; rrect(px + 2, y - 0.6, pw - 4, rh - 1, 2); ctx.fill();
      }
      text(name, px + 5, y + (bh - 3.8) / 2, 3.8, '#9fb4e8', 0, false);
      if (button(bL, y, 9, bh, '<', { size: 5 })) changeCustom(row, -1);
      if (button(bR, y, 9, bh, '>', { size: 5 })) changeCustom(row, 1);
      ctx.fillStyle = 'rgba(0,0,0,0.25)'; rrect(vx, y, vw, bh, 2); ctx.fill();
      if (tapped(vx, y, vw, bh)) changeCustom(row, 1);
      const c = list[idx][1], sw = c !== -3 && vw >= 44;
      if (sw) {                                 // kleines Farbmuster
        const col = c === -1 ? rainbow(G.t * 0.4) : c === -2 ? (key === 'hcol' || key === 0 ? G.body : key === 3 ? 0xE6E6EA : -2) : c;
        if (col === -2) { ctx.strokeStyle = '#9fb4e8'; ctx.lineWidth = 0.5; ctx.beginPath(); ctx.arc(vx + 4, y + bh / 2, 2, 0, 2 * PI); ctx.stroke(); }
        else {
          circ([vx + 4, y + bh / 2], 2.1, hex(col));
          ctx.strokeStyle = 'rgba(255,255,255,0.45)'; ctx.lineWidth = 0.4;     // heller Rand: auch Schwarz sieht man
          ctx.beginPath(); ctx.arc(vx + 4, y + bh / 2, 2.1, 0, 2 * PI); ctx.stroke();
        }
      }
      text(list[idx][0], vx + (sw ? 7.5 : 0) + (vw - (sw ? 7.5 : 0)) / 2, y + (bh - 4.2) / 2, 4.2, '#ffffff', 1, false);
    });
    // rechts über der Vorschau: Name; unten: ZUFALL und FERTIG
    const title = G.ctab ? mdl.name : 'DEIN FAHRER', fit = (str, size) => min(size, size * (area - 6) / textWidth(str, size));
    text(title, pcx, 6, fit(title, 5.4), '#ffffff', 1);
    if (G.ctab === 0) text('GILT FÜR ALLE SCOOTER', pcx, 13, fit('GILT FÜR ALLE SCOOTER', 3.6), 'rgba(255,255,255,0.85)', 1);
    if (area >= 84) {                           // nebeneinander ...
      if (button(pcx - 39, H - 17, 37, 13, 'ZUFALL', { size: 5.6, color: '#d08a1f' })) randomCustom();
      if (button(pcx + 2, H - 17, 37, 13, 'FERTIG', { size: 5.6, color: '#2e9e48' })) closeCustom();
    } else {                                    // ... oder übereinander, wenn wenig Platz ist
      const bw = area - 6, bx = pcx - bw / 2;
      if (button(bx, H - 30, bw, 12, 'ZUFALL', { size: 5, color: '#d08a1f' })) randomCustom();
      if (button(bx, H - 16, bw, 12, 'FERTIG', { size: 5, color: '#2e9e48' })) closeCustom();
    }
  }

  function drawMenu() {
    if (G.custom) { drawCustom(); return; }
    const i = store.scooter, mdl = SCOOTERS[i], owned = store.owned[i], inert = G.tuning;
    const cx = W / 2;
    // Titel und Rekorde
    text('E-SCOOTER', IL + 6, 4, 5.5, '#ffffff', 0);
    text('WHEELIE', IL + 6, 10, 13, '#ffd23f', 0, '#8c3b2e');
    const recs = ['REKORD ' + store.best.toFixed(1) + ' M', 'STOPPIE-REKORD ' + store.sbest.toFixed(1) + ' M'];
    if (store.tbest) recs.push('TRICK-REKORD ' + store.tbest);
    let recRight = IL + 6;
    recs.forEach((r, k) => {
      text(r, IL + 6, 27 + k * 5.5, 4.2, '#ffffff', 0);
      recRight = max(recRight, IL + 6 + textWidth(r, 4.2));
    });
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
    let ns = 7, nw = max(64, textWidth(mdl.name, ns) + 10);
    let nx = cx - nw / 2;                       // auf schmalen Bildschirmen neben die Rekorde schieben ...
    if (nx < recRight + 3) {
      const room = W - IR - 4 - (recRight + 3);
      if (nw > room) { ns = 7 * (room - 10) / (nw - 10); nw = room; }      // ... und wenn nötig kleiner schreiben
      nx = min(recRight + 3, W - IR - 4 - nw);
    }
    const ncx = nx + nw / 2;
    ctx.fillStyle = 'rgba(16,24,58,0.72)'; rrect(nx, ny + 15, nw, 17, 3); ctx.fill();
    text(mdl.name, ncx, ny + 17 + (7 - ns) / 2, ns, '#ffffff', 1);
    if (owned) text('TOP ' + topSpeed(i) + ' KM/H', ncx, ny + 25.5, 4.4, '#ffe27a', 1);
    else coins(mdl.price, ncx, ny + 25.5, 4.6, 1, '#ffe27a');
    // Pfeile links und rechts vom Scooter
    if (button(cx - 56, GY - 32, 14, 20, '<', { inert, size: 8 })) setScooter(-1);
    if (button(cx + 42, GY - 32, 14, 20, '>', { inert, size: 8 })) setScooter(1);
    if (G.toast && !inert) text(G.toast, cx, GY + 3.5, 5.6, '#ffffff', 1);
    else text((i + 1) + ' / ' + SCOOTERS.length, cx, GY + 5, 4, 'rgba(255,255,255,0.8)', 1);
    // unten: Farbe, Tuning, Start
    const by = H - 17, bh = 13;
    const sw = 40 + clamp((W - 160) * 0.3, 0, 24), sx = W - IR - 6 - sw, fx = IL + 6;
    const farbe = fx + 71 + 74 <= sx;           // schnelle Farbwahl, wenn Platz ist (sonst in CUSTOM)
    if (farbe) {
      if (button(fx, by, 11, bh, '<', { inert })) setColor(-1);
      ctx.fillStyle = 'rgba(16,24,58,0.72)'; rrect(fx + 12.5, by, 43, bh, 3); ctx.fill();
      text('FARBE', fx + 34, by + 1.3, 3.4, '#9fb4e8', 1, false);
      text(COLORS[store.color[i]][0], fx + 34, by + 5.6, 4.6, hex(G.body), 1);
      if (button(fx + 57, by, 11, bh, '>', { inert })) setColor(1);
    }
    const bx0 = farbe ? fx + 71 : fx, cxb = (bx0 + sx - 3) / 2;
    if (button(cxb - 35.5, by, 34, bh, 'CUSTOM', { inert, color: '#1f9e9a', size: 5.6 })) {
      G.custom = true; G.ctab = 0; G.crow = 0; play(SND_TICK);
    }
    const tx = cxb + 1.5;
    if (button(tx, by, 34, bh, 'TUNING', { inert, off: !owned, color: '#8a4fd6', size: 5.6 })) {
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

  function drawMeter(x, y, ang, bal, crashDeg) {
    // Winkelanzeige: grün = sicher, gelb = Gleichgewicht, rot = Absturzgefahr
    const w = 84, k = w / crashDeg;
    ctx.fillStyle = '#101018'; rrect(x - 1, y - 1, w + 2, 7, 2); ctx.fill();
    ctx.fillStyle = '#3ccb5a'; ctx.fillRect(x, y, (bal - 12) * k, 5);
    ctx.fillStyle = '#ffd23f'; ctx.fillRect(x + (bal - 12) * k, y, 17 * k, 5);
    ctx.fillStyle = '#e84a3c'; ctx.fillRect(x + (bal + 5) * k, y, w - (bal + 5) * k, 5);
    const mx = x + min(ang / rad(crashDeg), 1.0) * w;
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
      for (let i = G.marks.length - 1; i >= 0; i--) {
        G.marks[i].x -= G.dpx;
        if (G.marks[i].x < -5) G.marks.splice(i, 1);
      }
      updatePuffs(dt, G.dpx);
    }
    drawWorld(G.dist, t);

    // Farbe (Regenbogen wechselt)
    const rgb = COLORS[store.color[store.scooter]][1];
    G.body = rgb < 0 ? rainbow(t * 0.4) : rgb;

    ctx.fillStyle = 'rgba(20,20,26,0.5)';         // Bremsspuren
    for (const mk of G.marks) {
      ctx.fillRect(mk.x - mk.len, GY - 0.3, mk.len, 1.3);
      ctx.fillRect(mk.x - mk.len + mdl.wb, GY - 0.3, mk.len, 1.3);
    }
    if (G.markLen) {                            // Reifenspur
      ctx.fillStyle = '#1e1e24';
      ctx.fillRect(G.markX - G.markLen, GY - 0.6, G.markLen, 2);
      if (store.tune[store.scooter][DUAL] > 0)    // Dual-Motor: zweite Spur vom Vorderrad
        ctx.fillRect(G.markX - G.markLen + mdl.wb, GY - 0.6, G.markLen, 2);
    }
    // Scooter und Fahrer
    const cl = menu && G.custom ? customLayout() : null, custom = cl !== null;
    const pcx = custom ? cl.pcx : 0, zoom = custom ? cl.zoom : 1;
    let x = custom ? pcx - mdl.wb / 2 : menu ? W / 2 - mdl.wb / 2 - 1 : RX, y = GY - mdl.r;
    if (zoom !== 1) {                           // CUSTOM: der Scooter steht größer in der Vorschau
      ctx.save();
      ctx.translate(pcx, GY); ctx.scale(zoom, zoom); ctx.translate(-pcx, -GY);
    }
    applyLook(t);
    if (G.ps > 0) {                             // Stoppie: die Vorderachse bleibt am Boden, das Heck geht hoch
      x += mdl.wb * (1 - cos(G.ps));
      y -= mdl.wb * sin(G.ps);
    }
    if (shx || shy) { x += shx; y += shy; }
    else if (G.burn && st === PLAY) x += floor(t * 30) & 1 ? 0.7 : 0;      // Burnout: der Scooter zittert
    const ang = min(max(G.th, G.ps), 1.5), lift = sin(ang);    // weicher Schatten, wird im Wheelie kürzer
    glow(SPR.dark, x + mdl.wb / 2 * cos(ang) + 1, GY + 1, mdl.wb / 2 + mdl.r + 3 - 7 * lift, 2.6, 0.55);
    glow(SPR.dark, G.ps > 0 ? x + mdl.wb * cos(ang) : x, GY + 0.6, mdl.r + 1.5, 1.6, 0.5);
    const ledI = store.mods[store.scooter][2], led = ledI ? pick(LEDS, ledI, t * 1.5) : null;
    if (led !== null && lift < 0.9) {           // LED leuchtet auf die Straße
      ctx.globalCompositeOperation = 'lighter';
      glow(tintSprite(led), x + mdl.wb / 2 * cos(ang) + 1, GY + 0.8, mdl.wb / 2 + 8 - 8 * lift, 3.6, 0.8 * (1 - lift));
      ctx.globalCompositeOperation = 'source-over';
    }
    const dualOn = store.tune[store.scooter][DUAL] > 0, wspin = G.v * PX_PER_M / mdl.r;
    const o = { model: mdl, col: G.body, rotF: G.rotF, rotR: G.rotR, dual: dualOn, light: true, led,
      spinR: G.burn ? 45 : wspin, spinF: G.burn && dualOn ? 45 : wspin,
      brake: (st === PLAY && (held & BTN_B) !== 0) || st === CRASH };
    if (st === CRASH && G.crashFwd) {          // Sturz nach vorn: über den Lenker
      const k = clamp((G.ps - S_CRASH_RAD) / (1.745 - S_CRASH_RAD), 0, 1);
      o.th = -G.ps; o.pose = 0; o.arms = 2; o.swing = null; o.lean = S_LEAN + (1 - S_LEAN) * k;
    } else if (st === CRASH) {
      const k = clamp((G.th - CRASH_RAD) / (1.745 - CRASH_RAD), 0, 1);
      o.th = G.th; o.pose = 0; o.arms = 2; o.swing = null; o.lean = LEAN + (1 - LEAN) * k;
    } else if (G.ps > 0) {                      // Stoppie: der Fahrer bleibt fast aufrecht und lehnt sich zurück
      o.th = -G.ps;
      o.pose = max(G.kn, 1.2);
      o.arms = G.arms; o.lean = S_LEAN; o.swing = null;
      o.tilt = clamp(-G.accS * 0.85, -9, 8) * 0.6 + 14;
    } else {
      o.th = G.th + G.b;
      o.pose = G.dip > 0 ? max(G.kn, sin(clamp(G.dip / 0.16, 0, 1) * PI)) : G.kn;
      o.arms = G.arms; o.lean = LEAN;
      o.swing = G.th > 0 ? clamp(G.ph, -0.9, 1.3) : null;
      G.hy = body(o.th, o.pose, LEAN, mdl.dy).hip[1];
      // Der Fahrer geht mit: beim Gasgeben nach vorn, beim Bremsen nach hinten und leicht in die Knie
      o.tilt = clamp(-G.accS * 0.85, -9, 8) * (G.th > 0 ? 0.35 : 1);
      if (G.th === 0 && G.b < 0.01) o.pose = max(o.pose, clamp(-G.accS * 0.07, 0, 0.55));
    }
    if (menu && !custom && !store.owned[store.scooter]) ctx.globalAlpha = 0.6;
    drawRider(x, y, o);
    ctx.globalAlpha = 1;
    if (zoom !== 1) ctx.restore();
    drawPuffs();

    // Fahrtwind-Streifen bei hohem Tempo
    const n = st === PLAY ? floor((G.v - 15.0) / 3.0) : 0;
    ctx.fillStyle = 'rgba(255,255,255,0.4)';
    for (let k = 0; k < 4; k++) {
      const l = G.lines[k];
      if (k < n) {
        l.x -= 900 * dt * (st === PAUSE ? 0 : 1);
        if (l.x < -22) { l.x = W + randint(0, 50); l.y = randint(24, floor(GY) - 14); }
        ctx.fillRect(l.x, l.y, 26, 0.45);
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
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.drawImage(lightCanvas, 0, 0);                           // Sonnenlicht und dunklere Ränder
    ctx.setTransform(SC, 0, 0, SC, 0, 0);

    if (G.photo) return;                        // nur das Bild, ohne Anzeigen (für das App-Icon)
    if (menu) { drawMenu(); return; }

    // Anzeigen
    const cx = W / 2;
    if (G.inStoppie || G.smode) text('STOPPIE-REKORD ' + store.sbest.toFixed(1) + ' M', IL + 4, 4, 5, '#ffffff', 0);
    else text('REKORD ' + store.best.toFixed(1) + ' M', IL + 4, 4, 5, '#ffffff', 0);
    coins(store.coins, IL + 4, 11, 4.6, 0);
    text(Math.round(G.v * 3.6) + ' KM/H', W - IR - 20, 3.5, 8, '#ffffff', 2);
    if (car.kmh > model().kmh) text('TUNING ' + car.kmh, W - IR - 20, 13, 3.8, '#c9a6ff', 2);
    if (st === PLAY || st === CRASH) {
      if (button(W - IR - 17, 3, 14, 14, 'II', { size: 6.5, color: 'rgba(24,36,74,0.8)', inert: st === CRASH }))
        setPause(true);
    }
    const wheelie = st === PLAY && G.inWheelie, stoppie = st === PLAY && G.inStoppie;
    if (wheelie && G.wd >= 0.3) {
      G.big = G.wd.toFixed(1) + ' M';
      const k = G.arms + (G.crouch ? 3 : 0);
      G.sub = k ? NAMES[k] + ' +' + floor(G.tp) : G.wt.toFixed(1) + ' S';
    }
    if (stoppie && G.sd >= 0.3) {
      G.big = G.sd.toFixed(1) + ' M';
      const k = G.arms + (G.crouch ? 3 : 0);
      G.sub = k ? 'STOPPIE ' + NAMES[k] + ' +' + floor(G.tp) : 'STOPPIE ' + G.st.toFixed(1) + ' S';
    }
    const bigc = st === CRASH ? '#ff6a5c' : G.boost ? '#7fb6ff' : G.recordT > 0 ? hex(rainbow(t * 3)) : '#ffffff';
    if (G.recordT > 0) G.recordT -= dt;
    if (G.big) text(G.big, cx, 9, 14, bigc, 1);
    if (G.sub) text(G.sub, cx, 25.5, 6.4, '#ffe27a', 1);
    if (wheelie) drawMeter(cx - 42, 36, G.th, BALANCE_DEG, CRASH_DEG);
    else if (stoppie) drawMeter(cx - 42, 36, G.ps, S_BALANCE_DEG, S_CRASH_DEG);
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
      text('TASTEN: X = GAS   C = BREMSE   S = STOPPIE   PFEILE = WHEELIE / TRICKS', cx, H - 9, 4, 'rgba(255,255,255,0.85)', 1);
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
    engineSound(G.state !== PAUSE ? G.v : 0.0, play_ && (held & BTN_A) !== 0,
      play_ ? (G.boost ? 2 : (G.burn ? 1 : 0)) : 0, play_ ? G.skid : 0,
      G.scrape && G.state !== PAUSE && G.state !== MENU, store.tune[store.scooter][DUAL] > 0);
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
      if (ac) { try { ac.suspend(); } catch (e) { /* egal */ } }
    } else {
      last = 0;
    }
  });

  applyTuning();
  gotoMenu();
  window.__game = { G, store, car, step, SCOOTERS, physics, physicsStoppie, applyTuning };     // für Tests
  requestAnimationFrame(frame);
})();
