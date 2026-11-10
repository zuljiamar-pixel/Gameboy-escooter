// E-SCOOTER WHEELIE - MakeCode-Arcade-Version für den Adafruit PyBadge (LC)
//
//   OBEN   = Wheelie-Mode an (Vorderrad hoch) / nochmal OBEN = sauber landen
//   A      = Gas (bis 100 km/h), im Wheelie: Vorderrad höher
//   B      = Bremse, im Wheelie: Vorderrad runter
//   A + B  = Burnout (B loslassen = Turbo-Start)
//   LINKS  = Einhänder   RECHTS = No-Hander   RUNTER = in die Knie
//   MENU   = Pause, Lautstärke, Helligkeit, FPS-Anzeige, Rekorde löschen
//   Startbildschirm: LINKS/RECHTS = Scooter-Farbe, B = kaufen, A = los

// ------------------------------------------------------------------
// EINSTELLUNGEN - hier kannst du das Spiel leichter/schwerer machen
// ------------------------------------------------------------------
const MAX_KMH = 100          // Höchstgeschwindigkeit mit Gas
const CRUISE_KMH = 25        // so schnell rollt der Scooter von allein
const ACCEL = 6              // Beschleunigung mit A (m/s²)
const CRUISE_ACCEL = 3       // Beschleunigung von allein
const COAST_DECEL = 1.5      // Ausrollen ohne Gas
const BRAKE_DECEL = 7        // Bremsen mit B
const POP = 1.8              // wie kräftig OBEN das Vorderrad hochreißt
const LAUNCH_BOOST = 5       // Extra-Schub nach einem Burnout
const BALANCE_DEG = 42       // Gleichgewichtspunkt des Wheelies
const CRASH_DEG = 68         // ab hier kippst du nach hinten um
const GRAVITY = 4            // wie stark das Vorderrad nach unten will
const LIFT = 6.5             // wie stark A das Vorderrad hochzieht
const BRAKE_TORQUE = 6       // wie stark B es runterdrückt
const DAMPING = 1.8          // Dämpfung (höher = gutmütiger)
const LAND_TORQUE = 5        // sanftes Landen mit nochmal OBEN
const LAND_SPEED = 1.6
const JUMP_GRAVITY = 7       // Schwerkraft beim Sprung
const MAX_JUMP = 4.4         // höchste Absprung-Geschwindigkeit nach oben
const MIN_WHEELIE = 0.5      // so viele Meter muss ein Wheelie mindestens haben
const COIN_VALUE = 10        // Punkte pro Münze
const BLITZ_KMH = 60         // ab diesem Tempo blitzt der Blitzer
const DAY_LENGTH = 110       // so viele Sekunden dauert ein ganzer Tag

// ------------------------------------------------------------------
// Feste Werte
// ------------------------------------------------------------------
const W = 160
const H = 120
const HORIZON = 86           // hier stehen die Häuser / beginnt der Gehweg
const GROUND = 108           // hier berühren die Räder die Straße
const REAR_X = 46            // Hinterachse auf dem Bildschirm
const WHEEL_R = 5
const AXLE_Y = GROUND - WHEEL_R
const WB = 26                // Radstand in Pixeln = 1 Meter
const PPM = 26
const VMAX = MAX_KMH / 3.6
const CRUISE = CRUISE_KMH / 3.6
const DEG = Math.PI / 180
const PHI0 = (90 - BALANCE_DEG) * DEG
const CRASH_RAD = CRASH_DEG * DEG
const RAMP_LEN = 40 / PPM
const RAMP_H = 12 / PPM
const RAMP_ANGLE = Math.atan2(12, 40)
const LEAN = 0.5

// Farben (siehe "palette" in pxt.json)
const WHITE = 1
const RED = 2
const SKIN = 3
const GLASS = 4      // Fenster: tagsüber Glas, nachts gelbes Licht
const YELLOW = 5
const BODY = 6       // Scooter-Farbe (wird im Shop umgefärbt)
const GREEN = 7
const NAVY = 8
const SKY1 = 9
const SKY2 = 10
const FAR = 11
const DARK = 12
const LIGHT = 13
const BROWN = 14
const BLACK = 15

const ST_TITLE = 0
const ST_PLAY = 1
const ST_CRASH = 2

const FONT = image.font8
const BIG = image.scaledFont(image.font8, 2)
const HUGE = image.scaledFont(image.font8, 3)

// ------------------------------------------------------------------
// Farbpalette: Tag, Abendrot, Nacht (je 16 Farben x RGB)
// ------------------------------------------------------------------
const PAL_DAY = hex`000000ffffffe84a3cf4c7a15d7ea6ffd23f19c2a03e9d4b2e44854f9be6a8d8f58ba6c93b3b45c9c9d28c3b2e17171c`
const PAL_DUSK = hex`000000ffffffd9473af0b48cc9a05affc24d19c2a0387f452b3a78e2674ff9c48b9a7fa035323fd0b0a8813428161419`
const PAL_NIGHT = hex`000000ffffffa5362fa98a75ffd86bffe9a019c2a0245c381d2a570b10301b24523a467024242d7c81945423190c0c10`
const pal = control.createBuffer(48)

const COLOR_NAMES = ["MINT", "BLAU", "PINK", "NEON", "FEUER-ROT", "SCHWARZ", "GOLD", "REGENBOGEN"]
const COLOR_PRICE = [0, 100, 250, 500, 750, 1000, 2000, 5000]
const COLOR_RGB = [0x19c2a0, 0x2f7de1, 0xff5fa2, 0x9dff3a, 0xe8322b, 0x4a4a58, 0xffc83d, -1]

// ------------------------------------------------------------------
// Spielstand (bleibt gespeichert)
// ------------------------------------------------------------------
let best = 0          // längster Wheelie (m)
let tbest = 0         // bester Trick-Wert
let blitzBest = 0     // schnellstes Blitzer-Foto (km/h)
let points = 0        // Konto für den Farben-Shop
let owned = 1         // gekaufte Farben (Bits)
let colorSel = 0      // gewählte Farbe
let dirty = false
let saveT = 0

function loadGame() {
    if (!settings.exists("v")) return
    best = settings.readNumber("wb") || 0
    tbest = settings.readNumber("tb") || 0
    blitzBest = settings.readNumber("bz") || 0
    points = settings.readNumber("pt") || 0
    owned = (settings.readNumber("ow") || 0) | 1
    colorSel = settings.readNumber("co") || 0
    if (colorSel < 0 || colorSel >= COLOR_NAMES.length || !(owned & (1 << colorSel))) colorSel = 0
}

function saveGame() {
    settings.writeNumber("v", 1)
    settings.writeNumber("wb", best)
    settings.writeNumber("tb", tbest)
    settings.writeNumber("bz", blitzBest)
    settings.writeNumber("pt", points)
    settings.writeNumber("ow", owned)
    settings.writeNumber("co", colorSel)
    dirty = false
    saveT = 0
}

// ------------------------------------------------------------------
// Zustand der Fahrt
// ------------------------------------------------------------------
let state = ST_TITLE
let t = 0             // Zeit seit dem Einschalten (s)
let clock = 8         // Tageszeit (s)
let v = 0             // Geschwindigkeit (m/s)
let th = 0            // Wheelie-Winkel (rad)
let om = 0            // Drehgeschwindigkeit (rad/s)
let s = 0             // gefahrene Strecke (m)
let lean = LEAN
let arms = 0          // 0 normal, 1 Einhänder, 2 No-Hander
let crouch = false
let wmode = false     // Wheelie-Mode an
let landing = false   // sanft landen
let inWheelie = false
let wd = 0            // Wheelie-Strecke
let wt = 0            // Wheelie-Zeit
let tp = 0            // Trick-Punkte in diesem Wheelie
let combo = 0         // welche Tricks schon gezeigt wurden (Bits)
let trickT = 0        // wie lange der aktuelle Trick gehalten wird
let alt = 0           // Höhe über der Straße (m)
let vy = 0
let air = false
let airT = 0
let jp = 0            // Sprung-Punkte
let burn = false
let burnT = 0
let boostT = 0
let crashT = 0
let shakeT = 0
let hopT = 0
let flashT = 0        // Blitzer-Blitz
let markS = -99
let markLen = 0
let rampS = -99       // Ende der aktuellen Rampe
let blitzS = -99      // Position des Blitzers
let blitzDone = true
let flagS = -99       // Rekord-Fahne: hier wäre der Wheelie ein neuer Rekord
let flagDone = true
let nextSpawn = 25
let smokeAcc = 0
let gasHeld = false

// Anzeigen
let bigText = ""
let subText = ""
let subColor = YELLOW
let bannerT = 0       // wie lange das Ergebnis noch steht (0 = solange Wheelie läuft)
let toastText = ""
let toastT = 0
let recordT = 0       // Konfetti/Blinken bei neuem Rekord
let shopT = 0
let shopSel = 0
let lastPal = -1

// Knöpfe (Flanken selbst merken)
let pUp = false
let pA = false
let pB = false
let pLeft = false
let pRight = false

// Dinge auf der Straße
const bumpS: number[] = []
const coinS: number[] = []
const coinH: number[] = []

// Partikel (Rauch, Staub, Konfetti)
const P_MAX = 36
const pX: number[] = []
const pY: number[] = []
const pVX: number[] = []
const pVY: number[] = []
const pLife: number[] = []
const pMax: number[] = []
const pKind: number[] = []   // 0 frei, 1 Rauch, 2 Staub, 3 Konfetti, 4 Funke
for (let i = 0; i < P_MAX; i++) {
    pX.push(0); pY.push(0); pVX.push(0); pVY.push(0); pLife.push(0); pMax.push(1); pKind.push(0)
}

function emit(kind: number, x: number, y: number, vx: number, vyy: number, life: number) {
    for (let i = 0; i < P_MAX; i++) {
        if (pKind[i] == 0) {
            pKind[i] = kind; pX[i] = x; pY[i] = y; pVX[i] = vx; pVY[i] = vyy
            pLife[i] = 0; pMax[i] = life
            return
        }
    }
}

// ------------------------------------------------------------------
// Kleine Helfer
// ------------------------------------------------------------------
function hash(i: number): number {
    let h = Math.imul(i | 0, 374761393) + 668265263
    h = Math.imul(h ^ (h >>> 13), 1274126177)
    return (h ^ (h >>> 16)) & 0x7fffffff
}

function fmt1(x: number): string {
    const n = Math.round(x * 10)
    return Math.idiv(n, 10) + "." + (n % 10)
}

function txt(str: string, x: number, y: number, c: number, f: image.Font) {
    screen.print(str, x + 1, y + 1, BLACK, f)
    screen.print(str, x, y, c, f)
}

function txtC(str: string, y: number, c: number, f: image.Font) {
    txt(str, (W - str.length * f.charWidth) >> 1, y, c, f)
}

function txtR(str: string, xr: number, y: number, c: number, f: image.Font) {
    txt(str, xr - str.length * f.charWidth, y, c, f)
}

function toast(str: string) {
    toastText = str
    toastT = 1.8
}

function trickId(): number {
    return arms + (crouch ? 3 : 0)
}

function trickName(): string {
    const n = ["", "EINHÄNDER", "NO-HANDER"][arms]
    if (crouch) return n ? "KNIE-" + n : "IN DIE KNIE"
    return n
}

function trickRate(): number {
    const r = [0, 1, 3][arms] + (crouch ? 1 : 0)
    return (arms && crouch) ? r * 2 : r
}

function comboMult(): number {
    let n = 1
    for (let i = 1; i <= 5; i++) if (combo & (1 << i)) n++
    return Math.max(1, n - 1)
}

// ------------------------------------------------------------------
// Ton
// ------------------------------------------------------------------
const sndTrick = music.createSoundEffect(WaveShape.Square, 880, 1320, 120, 0, 90, SoundExpressionEffect.None, InterpolationCurve.Linear)
const sndJump = music.createSoundEffect(WaveShape.Triangle, 300, 900, 160, 0, 220, SoundExpressionEffect.None, InterpolationCurve.Curve)
const sndLand = music.createSoundEffect(WaveShape.Noise, 300, 80, 200, 0, 120, SoundExpressionEffect.None, InterpolationCurve.Linear)
const sndBump = music.createSoundEffect(WaveShape.Noise, 160, 60, 160, 0, 70, SoundExpressionEffect.None, InterpolationCurve.Linear)
const sndBlitz = music.createSoundEffect(WaveShape.Noise, 3000, 500, 220, 0, 110, SoundExpressionEffect.None, InterpolationCurve.Logarithmic)
const sndBuy = music.createSoundEffect(WaveShape.Square, 523, 1047, 140, 0, 260, SoundExpressionEffect.None, InterpolationCurve.Curve)
const sndNo = music.createSoundEffect(WaveShape.Sawtooth, 220, 140, 150, 0, 220, SoundExpressionEffect.None, InterpolationCurve.Linear)
const sndTick = music.createSoundEffect(WaveShape.Square, 660, 660, 90, 0, 40, SoundExpressionEffect.None, InterpolationCurve.Linear)
const sndCrash = music.createSoundEffect(WaveShape.Noise, 900, 60, 255, 0, 450, SoundExpressionEffect.None, InterpolationCurve.Logarithmic)

function sfx(e: music.Playable) {
    music.play(e, music.PlaybackMode.InBackground)
}

// Motor: alle 90 ms ein kurzes Stück Ton mit der passenden Tonhöhe
const engBuf = control.createBuffer(12)
let engNext = 0
let engF = 80
function engineSound() {
    const now = control.millis()
    if (now < engNext) return
    engNext = now + 90
    if (state != ST_PLAY) return
    if (burn) {
        const f = 420 + Math.randomRange(0, 120)
        music.addNote(engBuf, 0, 100, 50, 50, 2, f, music.volume(), f + 30)
        music.playInstructions(0, engBuf)
        music.addNote(engBuf, 0, 100, 34, 34, 5, 900, music.volume(), 700)
        music.playInstructions(0, engBuf)
        engF = 300
    } else if (v > 0.5) {
        const f = 70 + v * 15 + (gasHeld ? 25 : 0)
        const vol = gasHeld ? 26 : 16
        music.addNote(engBuf, 0, 100, vol, vol, 2, engF, music.volume(), f)
        music.playInstructions(0, engBuf)
        engF = f
    }
}

// ------------------------------------------------------------------
// LED unter dem Bildschirm (NeoPixel)
// ------------------------------------------------------------------
let ledKey = -1
let ledOk = true
function led(rgb: number) {
    if (rgb == ledKey || !ledOk) return
    ledKey = rgb
    try {
        const strip = light.onboardStrip()
        strip.setBrightness(40)
        strip.setAll(rgb)
    } catch (e) {
        ledOk = false       // keine LED vorhanden: dann eben ohne
    }
}

function updateLed() {
    if (state == ST_CRASH) led((Math.floor(t * 6) & 1) ? 0xff0000 : 0)
    else if (recordT > 0) led(rainbowRgb(Math.floor(t * 12) / 12))
    else if (state == ST_TITLE) led(0x002030)
    else if (air) led(0x6000ff)
    else if (burn) led((Math.floor(t * 15) & 1) ? 0xff6000 : 0xff2000)
    else if (inWheelie) {
        const f = Math.floor(Math.min(1, th / CRASH_RAD) * 8)      // grün -> gelb -> rot
        led((Math.min(255, f * 52) << 16) | (Math.min(255, (8 - f) * 60) << 8))
    } else led(0)
}

// ------------------------------------------------------------------
// Tag und Nacht: Palette überblenden
// ------------------------------------------------------------------
// night: 0 = Tag ... 1 = Abendrot ... 2 = Nacht
function nightAmount(): number {
    const c = clock % DAY_LENGTH
    const day = DAY_LENGTH * 0.42, dusk = DAY_LENGTH * 0.08, night = DAY_LENGTH * 0.34
    if (c < day) return 0
    if (c < day + dusk * 2) return (c - day) / dusk
    if (c < day + dusk * 2 + night) return 2
    return Math.max(0, 2 - (c - day - dusk * 2 - night) / dusk)
}

function rainbowRgb(hh: number): number {
    const h6 = (hh % 1) * 6
    const i = Math.floor(h6)
    const f = Math.floor((h6 - i) * 255)
    switch (i) {
        case 0: return 0xff0000 | (f << 8)
        case 1: return ((255 - f) << 16) | 0xff00
        case 2: return 0x00ff00 | f
        case 3: return ((255 - f) << 8) | 0xff
        case 4: return (f << 16) | 0xff
        default: return 0xff0000 | (255 - f)
    }
}

function updatePalette() {
    const n = nightAmount()
    let rgb = COLOR_RGB[state == ST_TITLE ? shopSel : colorSel]
    const rainbow = rgb < 0
    const key = Math.round(n * 40) + (state == ST_TITLE ? shopSel : colorSel) * 100
    if (key == lastPal && !rainbow) return
    lastPal = key
    const a = n < 1 ? PAL_DAY : PAL_DUSK
    const b = n < 1 ? PAL_DUSK : PAL_NIGHT
    const f = Math.round((n < 1 ? n : n - 1) * 256)
    for (let i = 3; i < 48; i++) {
        const x = a[i], y = b[i]
        pal[i] = x + (((y - x) * f) >> 8)
    }
    if (rainbow) rgb = rainbowRgb(t * 0.4)
    const dim = 256 - Math.round(n * 38)          // Scooter nachts etwas dunkler
    pal[18] = (((rgb >> 16) & 255) * dim) >> 8
    pal[19] = (((rgb >> 8) & 255) * dim) >> 8
    pal[20] = ((rgb & 255) * dim) >> 8
    image.setPalette(pal)
}

// ------------------------------------------------------------------
// Fahrt zurücksetzen / Zustände
// ------------------------------------------------------------------
function resetRide() {
    v = 0; th = 0; om = 0; s = 0
    lean = LEAN; arms = 0; crouch = false
    wmode = false; landing = false; inWheelie = false
    wd = 0; wt = 0; tp = 0; combo = 0; trickT = 0
    alt = 0; vy = 0; air = false; airT = 0; jp = 0
    burn = false; burnT = 0; boostT = 0
    crashT = 0; shakeT = 0; hopT = 0; flashT = 0
    markS = -99; markLen = 0
    rampS = -99; blitzS = -99; blitzDone = true
    flagS = -99; flagDone = true
    nextSpawn = 25
    bannerT = 0; bigText = ""; subText = ""
    while (bumpS.length) bumpS.pop()
    while (coinS.length) { coinS.pop(); coinH.pop() }
    for (let i = 0; i < P_MAX; i++) pKind[i] = 0
}

function gotoTitle() {
    state = ST_TITLE
    resetRide()
    shopSel = colorSel
    shopT = 0
}

function startGame() {
    state = ST_PLAY
    resetRide()
    lastPal = -1
    music.jumpUp.play()
    toast("OBEN = WHEELIE")
    console.log("EV start")
}

function banner(big: string, sub: string, color: number, secs: number) {
    bigText = big
    subText = sub
    subColor = color
    bannerT = secs
}

// ------------------------------------------------------------------
// Physik
// ------------------------------------------------------------------
const CTRL = [1, 0.75, 0.45]       // Kontrolle mit 2 / 1 / 0 Händen
const WOBBLE = [0, 0.6, 1.5]

function physics(dt: number, gas: boolean, brake: boolean): boolean {
    let vv = v
    if (brake) vv -= BRAKE_DECEL * dt * (th > 0 ? 0.4 : 1)
    else if (gas) {
        const f = vv / VMAX
        vv += ACCEL * dt * (1 - 0.6 * f * f)
        if (boostT > 0) vv += LAUNCH_BOOST * dt
    } else if (vv < CRUISE) vv = Math.min(CRUISE, vv + CRUISE_ACCEL * dt)
    else vv = Math.max(CRUISE, vv - COAST_DECEL * dt)
    v = Math.max(0, Math.min(VMAX, vv))

    const damp = DAMPING * ((crouch && wmode) ? 1.6 : 1)
    let a = -GRAVITY * Math.cos(PHI0 + th) - damp * om
    if (landing) a -= LAND_TORQUE
    else if (wmode) {
        const c = CTRL[arms]
        if (gas) a += LIFT * c * Math.min(1, v / 2)
        if (brake && th > 0) a -= BRAKE_TORQUE * c
        a += WOBBLE[arms] * Math.sin(t * 6.3)
        // je länger der Wheelie dauert, desto unruhiger wird er (Windböen)
        a += Math.min(1.2, wt * 0.02) * Math.sin(t * 2.3 + 3 * Math.sin(t * 0.7))
    }
    om += a * dt
    if (landing && om < -LAND_SPEED) om = -LAND_SPEED
    th += om * dt
    s += v * dt
    if (th <= 0) {
        th = 0
        if (om < 0) {
            om = 0
            return true
        }
    }
    return false
}

function addPoints(n: number) {
    if (n <= 0) return
    points += n
    dirty = true
}

function endWheelie() {
    inWheelie = false
    flagS = -99
    if (wd < MIN_WHEELIE) {
        if (bannerT == 0) { bigText = ""; subText = "" }
        return
    }
    const pts = Math.floor(tp)
    console.log("EV wheelie " + fmt1(wd) + " tp " + pts)
    if (wd > best) {
        best = wd
        recordT = 2.5
        banner(fmt1(wd) + " m", "NEUER REKORD!", YELLOW, 3)
        music.powerUp.play()
        confetti()
        dirty = true
        saveT = 99
    } else {
        const word = wd < 10 ? "OK!" : wd < 30 ? "NICE!" : wd < 80 ? "STARK!" : wd < 200 ? "MEGA!" : wd < 500 ? "WAHNSINN!" : "LEGENDE!"
        banner(fmt1(wd) + " m", word + "  " + fmt1(wt) + " s", YELLOW, 3)
        music.baDing.play()
    }
    if (pts > 0) {
        addPoints(pts)
        if (pts > tbest) {
            tbest = pts
            saveT = 99
            toast("TRICK-REKORD " + pts)
        } else toast("TRICKS +" + pts)
    }
}

function crash(why: string) {
    state = ST_CRASH
    inWheelie = false; wmode = false; landing = false; air = false; burn = false
    flagS = -99
    crashT = 0
    shakeT = 0.45
    banner("GESTÜRZT!", why ? why : (wd >= MIN_WHEELIE ? fmt1(wd) + " m ZÄHLT NICHT" : "AUTSCH!"), WHITE, 99)
    sfx(sndCrash)
    music.wawawawaa.play()
    for (let i = 0; i < 8; i++)
        emit(2, REAR_X + Math.randomRange(-6, 10), GROUND - 2, Math.randomRange(-40, 40), Math.randomRange(-50, -10), 0.5)
    console.log("EV crash")
}

function confetti() {
    for (let i = 0; i < 22; i++)
        emit(3, Math.randomRange(10, 150), Math.randomRange(-20, 10), Math.randomRange(-15, 15), Math.randomRange(30, 70), 1.6)
}

function landJump() {
    air = false
    vy = 0
    hopT = 0.12
    for (let i = 0; i < 5; i++)
        emit(2, REAR_X + Math.randomRange(-4, 28), GROUND - 1, Math.randomRange(-30, 10), Math.randomRange(-25, -5), 0.4)
    if (arms == 2) {
        crash("OHNE HÄNDE GELANDET!")
        return
    }
    const pts = Math.floor(jp)
    addPoints(pts)
    sfx(sndLand)
    console.log("EV jump " + pts)
    if (inWheelie) toast("SPRUNG! +" + pts)
    else banner("+" + pts + " P", "SAUBER GELANDET!", YELLOW, 2)
}

// neue Dinge auf die Straße stellen
function spawn() {
    if (s + 10 < nextSpawn) return
    const at = nextSpawn
    const r = Math.randomRange(0, 99)
    let gap = Math.randomRange(14, 28)
    if (r < 28) {
        bumpS.push(at)                                   // Gullydeckel
    } else if (r < 50) {
        for (let i = 0; i < 5; i++) { coinS.push(at + i * 0.8); coinH.push(14) }      // Münzen am Boden
        gap += 4
    } else if (r < 66) {
        for (let i = 0; i < 4; i++) { coinS.push(at + i * 1.2); coinH.push(47) }      // Münzen für den Wheelie
        gap += 5
    } else if (r < 88) {
        rampS = at + RAMP_LEN                            // Rampe mit Münzbogen
        const hs = [34, 50, 56, 50, 34]
        for (let i = 0; i < 5; i++) { coinS.push(rampS + 1.3 + i * 1.3); coinH.push(hs[i]) }
        gap += 12
    } else {
        blitzS = at                                      // Blitzer
        blitzDone = false
    }
    nextSpawn = at + gap
}

function updateWorld(dt: number, sBefore: number) {
    // Gullydeckel
    for (let i = 0; i < bumpS.length; i++) {
        const p = bumpS[i]
        if (p > sBefore && p <= s && alt == 0) {
            hopT = 0.1
            if (th > 0) om += (Math.random() * 1.8 - 0.7) * (0.4 + 0.6 * v / VMAX)
            sfx(sndBump)
        }
    }
    while (bumpS.length && bumpS[0] < s - 3) bumpS.shift()

    // Münzen einsammeln
    const top = alt * PPM + 38 + WB * Math.sin(th) * 0.6 + 4
    const bottom = alt * PPM - 4
    for (let i = 0; i < coinS.length; i++) {
        const p = coinS[i]
        if (coinH[i] > 0 && p > s - 0.3 && p < s + 1.25 && coinH[i] <= top && coinH[i] >= bottom) {
            emit(4, REAR_X + (p - s) * PPM, GROUND - coinH[i], 0, -30, 0.35)
            coinH[i] = 0
            addPoints(COIN_VALUE)
            music.baDing.play()
            console.log("EV coin")
        }
    }
    while (coinS.length && coinS[0] < s - 3) { coinS.shift(); coinH.shift() }

    // Rekord-Fahne
    if (inWheelie && !flagDone && flagS > 0 && s >= flagS) {
        flagDone = true
        toast("REKORD GEKNACKT!")
        sfx(sndBuy)
        recordT = 1.2
        for (let i = 0; i < 10; i++)
            emit(3, REAR_X + Math.randomRange(-10, 40), Math.randomRange(40, 70), Math.randomRange(-30, 30), Math.randomRange(-40, 20), 1)
        console.log("EV flag")
    }

    // Blitzer
    if (!blitzDone && blitzS <= s) {
        blitzDone = true
        const kmh = Math.round(v * 3.6)
        if (kmh >= BLITZ_KMH) {
            flashT = 0.12
            sfx(sndBlitz)
            addPoints(kmh)
            if (kmh > blitzBest) { blitzBest = kmh; saveT = 99 }
            toast("GEBLITZT! " + kmh + " km/h +" + kmh)
            console.log("EV blitz " + kmh)
        }
    }

    // Rampe und Sprung
    const start = rampS - RAMP_LEN
    if (air) {
        vy -= JUMP_GRAVITY * dt
        alt += vy * dt
        airT += dt
        jp += dt * 20 * (1 + trickRate()) * comboMult()
        if (alt <= 0) {
            alt = 0
            landJump()
        }
    } else if (sBefore < rampS && rampS <= s) {
        air = true
        airT = 0
        jp = 5
        vy = Math.min(v * Math.sin(RAMP_ANGLE) + 0.5, MAX_JUMP)
        alt = RAMP_H
        sfx(sndJump)
    } else if (start <= s && s < rampS) alt = (s - start) / RAMP_LEN * RAMP_H
    else alt = 0
}

function updatePlay(dt: number) {
    const gas = controller.A.isPressed()
    const brake = controller.B.isPressed()
    const up = controller.up.isPressed()
    gasHeld = gas
    if (up && !pUp) {
        if (!wmode) {
            wmode = true
            landing = false
            om += POP
        } else if (th > 0) landing = true
        else wmode = false
    }
    pUp = up

    // Tricks
    const na = controller.right.isPressed() ? 2 : (controller.left.isPressed() ? 1 : 0)
    const nc = controller.down.isPressed()
    if (na != arms || nc != crouch) {
        arms = na
        crouch = nc
        trickT = 0
        if ((inWheelie || air) && trickId() > 0) sfx(sndTrick)
    }
    if ((inWheelie || air) && trickId() > 0) {
        trickT += dt
        if (trickT > 0.6 && !(combo & (1 << trickId()))) {
            combo |= 1 << trickId()
            if (comboMult() > 1) toast("COMBO x" + comboMult())
        }
    }

    // Burnout
    const nb = gas && brake && !wmode && th == 0 && alt == 0
    if (nb && !burn) {
        burnT = 0
        markLen = 0
        banner("BURNOUT!", "", YELLOW, 0)
    } else if (burn && !nb) {
        if (bannerT == 0) { bigText = ""; subText = "" }
        if (gas && burnT >= 1) {
            boostT = 1.5
            toast("LAUNCH!")
            music.jumpUp.play()
            console.log("EV launch")
        }
    }
    burn = nb
    if (burn) {
        burnT += dt
        markS = s
        markLen = Math.min(40, burnT * 30)
        subText = fmt1(burnT) + " s"
        smokeAcc += dt * 18
        while (smokeAcc >= 1) {
            smokeAcc -= 1
            emit(1, REAR_X - 3 + Math.randomRange(-2, 2), GROUND - 2, -25 - Math.random() * 35, -12 - Math.random() * 18, 0.7 + Math.random() * 0.5)
        }
    }
    if (boostT > 0) boostT -= dt

    // Physik in kleinen Schritten
    const sBefore = s
    let landed = false
    const steps = Math.floor(dt / 0.01) + 1
    for (let i = 0; i < steps; i++)
        if (physics(dt / steps, gas, brake)) landed = true

    if (th > 0 && !inWheelie) {
        inWheelie = true
        wd = 0; wt = 0; tp = 0
        if (!air) combo = 0
        bannerT = 0
        flagS = best >= 3 ? s + best : -99      // Rekord-Fahne aufstellen
        flagDone = false
    }
    if (inWheelie) {
        wd += v * dt
        wt += dt
        tp += v * dt * trickRate() * comboMult()
        bigText = fmt1(wd) + " m"
        const name = trickName()
        subText = name ? name + "! +" + Math.floor(tp) : fmt1(wt) + " s"
        subColor = YELLOW
    }
    if (th >= CRASH_RAD) {
        crash("")
        return
    }
    if (landed) {
        if (inWheelie && !air) {
            for (let i = 0; i < 4; i++)
                emit(2, REAR_X + WB + Math.randomRange(-3, 3), GROUND - 1, Math.randomRange(-10, 30), Math.randomRange(-25, -5), 0.35)
        }
        wmode = false
        landing = false
        if (inWheelie) endWheelie()
    }
    spawn()
    updateWorld(dt, sBefore)
    if (state != ST_PLAY) return
    if (!inWheelie && !air && trickId() == 0) combo = 0
    if (air && !inWheelie) {
        const name = trickName()
        bigText = "SPRUNG!"
        subText = name ? "AIR " + name + "! +" + Math.floor(jp) : "+" + Math.floor(jp)
        bannerT = 0.3
    }
    if (bannerT > 0) {
        bannerT -= dt
        if (bannerT <= 0) { bannerT = 0; bigText = ""; subText = "" }
    }
}

function updateCrash(dt: number) {
    crashT += dt
    arms = 2
    crouch = false
    lean = Math.min(1, lean + dt * 2)
    const limit = 100 * DEG
    if (th < limit) {
        om += 6 * dt
        th = Math.min(th + om * dt, limit)
    }
    v = Math.max(0, v - 7 * dt)
    s += v * dt
    if (alt > 0) {
        vy -= JUMP_GRAVITY * dt
        alt = Math.max(0, alt + vy * dt)
    }
    const a = controller.A.isPressed()
    if (crashT > 1 && a && !pA) {
        state = ST_PLAY
        resetRide()
    }
    pA = a
}

function updateTitle(dt: number) {
    const a = controller.A.isPressed()
    const b = controller.B.isPressed()
    const l = controller.left.isPressed()
    const r = controller.right.isPressed()
    if ((l && !pLeft) || (r && !pRight)) {
        shopSel = (shopSel + (r ? 1 : COLOR_NAMES.length - 1)) % COLOR_NAMES.length
        shopT = 6
        if (owned & (1 << shopSel)) {
            colorSel = shopSel
            dirty = true
        }
        sfx(sndTick)
    }
    if (shopT > 0) {
        shopT -= dt
        if (b && !pB && !(owned & (1 << shopSel))) {
            shopT = 6
            if (points >= COLOR_PRICE[shopSel]) {
                points -= COLOR_PRICE[shopSel]
                owned |= 1 << shopSel
                colorSel = shopSel
                saveGame()
                toast("GEKAUFT!")
                recordT = 2
                confetti()
                sfx(sndBuy)
                console.log("EV buy " + shopSel)
            } else {
                toast("ZU WENIG PUNKTE")
                sfx(sndNo)
            }
        }
        if (shopT <= 0) shopSel = colorSel
    }
    if (a && !pA) startGame()
    pA = a; pB = b; pLeft = l; pRight = r
}

game.onUpdate(function () {
    let dt = game.eventContext().deltaTime
    if (dt > 0.1) dt = 0.1
    t += dt
    clock += dt
    if (state == ST_TITLE) updateTitle(dt)
    else if (state == ST_PLAY) updatePlay(dt)
    else updateCrash(dt)

    // Partikel
    for (let i = 0; i < P_MAX; i++) {
        const k = pKind[i]
        if (k == 0) continue
        pLife[i] += dt
        if (pLife[i] >= pMax[i]) { pKind[i] = 0; continue }
        pX[i] += pVX[i] * dt - (k == 3 ? 0 : v * PPM * dt)
        pY[i] += pVY[i] * dt
        if (k == 2 || k == 4) pVY[i] += 120 * dt
        if (k == 1) pVX[i] *= 0.96
    }
    if (toastT > 0) toastT -= dt
    if (recordT > 0) recordT -= dt
    if (shakeT > 0) shakeT -= dt
    if (hopT > 0) hopT -= dt
    if (flashT > 0) flashT -= dt
    saveT += dt
    if (dirty && (saveT > 15 || state != ST_PLAY)) saveGame()
    engineSound()
    updatePalette()
    updateLed()
})

// ------------------------------------------------------------------
// Zeichnen
// ------------------------------------------------------------------
let camX = 0      // Wackeln
let camY = 0

function seg(ax: number, ay: number, bx: number, by: number, w: number, c: number) {
    const dx = bx - ax, dy = by - ay
    const d = Math.sqrt(dx * dx + dy * dy)
    if (d < 0.01) return
    const nx = -dy / d * w * 0.5, ny = dx / d * w * 0.5
    screen.fillPolygon4(Math.round(ax + nx), Math.round(ay + ny), Math.round(bx + nx), Math.round(by + ny),
        Math.round(bx - nx), Math.round(by - ny), Math.round(ax - nx), Math.round(ay - ny), c)
}

// weicher Übergang zwischen den zwei Himmelsfarben (einmal vorgemalt)
const skyBand = image.create(W, 4)
skyBand.fillRect(0, 0, W, 2, SKY1)
skyBand.fillRect(0, 2, W, 2, SKY2)
for (let x = 0; x < W; x += 2) {
    skyBand.setPixel(x, 0, SKY2)
    skyBand.setPixel(x + 1, 1, SKY2)
    skyBand.setPixel(x + 1, 2, SKY1)
    skyBand.setPixel(x, 3, SKY1)
}

function drawSky(n: number) {
    screen.fill(SKY1)
    screen.fillRect(0, 42, W, HORIZON - 42, SKY2)
    screen.drawImage(skyBand, 0, 38)
    if (n > 1.3) {                           // Sterne
        for (let i = 0; i < 16; i++) {
            const h = hash(i + 900)
            if (((h >> 10) + Math.floor(t * 2)) % 7 != 0) screen.setPixel(h % W, (h >> 8) % 50, WHITE)
        }
    }
    // Sonne geht unter, Mond geht auf
    const sunY = 18 + n * 46
    if (sunY < HORIZON + 10) {
        screen.fillCircle(128, sunY, 9, YELLOW)
        if (n < 0.5) screen.drawCircle(128, sunY, 11, WHITE)
    }
    if (n > 1) {
        const moonY = 20 + (2 - n) * 70
        screen.fillCircle(100, moonY, 7, WHITE)
        screen.fillCircle(103, moonY - 2, 6, SKY1)
    }
    // Wolken
    const drift = Math.floor(s * PPM * 0.06 + t * 3)
    for (let i = 0; i < 4; i++) {
        const x = (i * 57 + 200 - drift % 228 + 228) % 228 - 34
        const y = 22 + ((i * 13) % 20)
        screen.fillCircle(x + 6, y + 4, 4, LIGHT)
        screen.fillCircle(x + 13, y + 2, 6, LIGHT)
        screen.fillCircle(x + 21, y + 4, 5, LIGHT)
        screen.fillRect(x + 4, y + 5, 20, 4, LIGHT)
    }
}

function drawFar(off: number) {
    const SLOT = 20
    let i = Math.idiv(off, SLOT)
    let x = -(off % SLOT)
    while (x < W) {
        const h = hash(i + 5000)
        const bw = 13 + h % 7
        const bh = 8 + (h >> 3) % 26
        const top = HORIZON - bh
        screen.fillRect(x, top, bw, bh, FAR)
        if ((h >> 9) % 3 == 0) screen.fillRect(x + 3, top - 3, 2, 3, FAR)          // Antenne
        let bits = hash(i + 9000)
        for (let wy = top + 3; wy < HORIZON - 4; wy += 5)
            for (let wx = x + 2; wx < x + bw - 2; wx += 4) {
                if ((bits & 3) == 0) screen.fillRect(wx, wy, 2, 2, GLASS)
                bits = (bits >> 2) | ((bits & 3) << 28)
            }
        i++
        x += SLOT
    }
}

function drawTree(x: number, h: number) {
    const tx = x + 14 + h % 12
    screen.fillRect(tx - 1, HORIZON - 12, 3, 12, BROWN)
    screen.fillCircle(tx, HORIZON - 18, 8, GREEN)
    screen.fillCircle(tx - 5, HORIZON - 13, 5, GREEN)
    screen.fillCircle(tx + 5, HORIZON - 14, 5, GREEN)
    screen.setPixel(tx - 3, HORIZON - 21, YELLOW)
    screen.setPixel(tx + 2, HORIZON - 17, YELLOW)
}

const WALLS = [SKIN, LIGHT, FAR, SKY2]
function drawHouse(i: number, x: number, h: number) {
    const w = 28 + (h >> 4) % 14
    const ht = 20 + (h >> 8) % 17
    const top = HORIZON - ht
    const x0 = x + ((46 - w) >> 1)
    const wall = WALLS[(h >> 12) % 4]
    screen.fillRect(x0, top, w, ht, wall)
    const roof = (h >> 14) % 3
    if (roof < 2) {
        const rh = 8 + (h >> 16) % 6
        screen.fillTriangle(x0 - 2, top, x0 + w + 1, top, x0 + (w >> 1), top - rh, roof ? RED : BROWN)
        if ((h >> 19) & 1) screen.fillRect(x0 + w - 8, top - rh + 2, 3, rh - 3, DARK)   // Schornstein
    } else {
        screen.fillRect(x0 - 1, top - 3, w + 2, 3, BROWN)                               // Flachdach
    }
    // Fenster: manche leuchten nachts (GLASS), manche bleiben dunkel (NAVY)
    let k = 0
    for (let wy = top + 4; wy + 6 <= HORIZON - 9; wy += 9) {
        for (let wx = x0 + 4; wx + 5 <= x0 + w - 3; wx += 8) {
            screen.fillRect(wx, wy, 5, 6, ((h >> (20 + (k % 8))) & 1) ? GLASS : NAVY)
            k++
        }
    }
    const dx = x0 + (w >> 1) - 2 + ((h >> 6) % 7) - 3
    screen.fillRect(dx, HORIZON - 9, 5, 9, BROWN)
    screen.setPixel(dx + 3, HORIZON - 5, YELLOW)
}

function drawNear(off: number) {
    const SLOT = 46
    let i = Math.idiv(off, SLOT)
    let x = -(off % SLOT)
    while (x < W) {
        const h = hash(i)
        if (h % 10 < 3) drawTree(x, h >> 5)
        else drawHouse(i, x, h)
        i++
        x += SLOT
    }
}

function drawRoad(px: number, n: number) {
    screen.fillRect(0, HORIZON, W, 7, LIGHT)             // Gehweg
    screen.fillRect(0, HORIZON + 7, W, 2, FAR)           // Bordstein
    screen.fillRect(0, HORIZON + 9, W, H - HORIZON - 9, DARK)
    if (v < 16)
        for (let x = -(px % 20); x < W; x += 20) screen.drawLine(x, HORIZON, x, HORIZON + 6, FAR)
    for (let x = -(px % 72); x < W; x += 72) screen.fillRect(x, 115, 34, 2, WHITE)
    // Laternen
    for (let x = 70 - (px % 150); x < W + 10; x += 150) {
        screen.fillRect(x, 58, 2, HORIZON - 55, DARK)
        screen.fillRect(x - 2, 54, 6, 5, DARK)
        screen.fillRect(x - 1, 55, 4, 3, n > 0.8 ? YELLOW : LIGHT)
        if (n > 1.2) {                                   // Lichtschein in der Nacht
            screen.drawLine(x - 4, 60, x - 8, 68, YELLOW)
            screen.drawLine(x + 5, 60, x + 9, 68, YELLOW)
        }
    }
}

function drawThings(px: number) {
    // Reifenspur
    if (markLen > 0) {
        const x = REAR_X + 3 + Math.round((markS - s) * PPM)
        if (x > -2 && x - markLen < W) screen.fillRect(x - Math.round(markLen), GROUND, Math.round(markLen), 2, BLACK)
    }
    // Gullydeckel
    for (let i = 0; i < bumpS.length; i++) {
        const x = REAR_X + Math.round((bumpS[i] - s) * PPM)
        if (x > -8 && x < W + 8) {
            screen.fillRect(x - 5, GROUND, 11, 2, BLACK)
            screen.fillRect(x - 4, GROUND - 1, 9, 1, FAR)
            screen.fillRect(x - 4, GROUND + 2, 9, 1, FAR)
        }
    }
    // Rampe
    const rx = REAR_X + Math.round((rampS - RAMP_LEN - s) * PPM)
    if (rx > -42 && rx < W) {
        screen.fillTriangle(rx, GROUND + 1, rx + 40, GROUND + 1, rx + 40, GROUND - 11, BROWN)
        screen.drawLine(rx, GROUND, rx + 40, GROUND - 12, YELLOW)
        screen.fillRect(rx + 38, GROUND - 11, 3, 13, BLACK)
        for (let k = 12; k < 38; k += 8) screen.drawLine(rx + k, GROUND, rx + k + 3, GROUND - Math.idiv((k + 3) * 12, 40) + 2, YELLOW)
    }
    // Blitzer
    const bx = REAR_X + Math.round((blitzS - s) * PPM) + 20
    if (bx > -10 && bx < W + 10) {
        screen.fillRect(bx, HORIZON - 14, 2, 20, DARK)
        screen.fillRect(bx - 4, HORIZON - 24, 10, 11, BLACK)
        screen.fillRect(bx - 3, HORIZON - 23, 8, 9, LIGHT)
        screen.fillCircle(bx, HORIZON - 19, 2, flashT > 0 ? WHITE : RED)
    }
    // Rekord-Fahne
    if (flagS > 0) {
        const fx = REAR_X + Math.round((flagS - s) * PPM)
        if (fx > -14 && fx < W + 2) {
            screen.fillRect(fx, HORIZON - 20, 2, 24, WHITE)
            screen.fillTriangle(fx + 2, HORIZON - 20, fx + 2, HORIZON - 11, fx + 13, HORIZON - 15, flagDone ? YELLOW : RED)
            screen.fillRect(fx - 2, HORIZON + 3, 6, 2, BLACK)
        }
    }
    // Münzen (drehen sich)
    const ph = Math.floor(t * 8) % 4
    const hw = ph == 0 ? 3 : (ph == 2 ? 1 : 2)
    for (let i = 0; i < coinS.length; i++) {
        if (coinH[i] <= 0) continue
        const x = REAR_X + Math.round((coinS[i] - s) * PPM)
        if (x < -4 || x > W + 4) continue
        const y = GROUND - coinH[i]
        screen.fillRect(x - hw, y - 3, hw * 2 + 1, 7, YELLOW)
        screen.fillRect(x - hw, y - 2, 1, 5, WHITE)
        if (hw > 1) screen.fillRect(x + hw, y - 2, 1, 5, BROWN)
    }
}

// Scooter + Fahrer. pitch = Wheelie-Winkel + Schräglage der Rampe
function drawRider(pitch: number) {
    const ct = Math.cos(pitch), st = Math.sin(pitch)
    const ox = REAR_X + camX + (burn ? (Math.floor(t * 30) & 1) : 0)
    const oy = AXLE_Y + camY - Math.round(alt * PPM) - (hopT > 0 ? 1 : 0)

    // Schatten (wird in der Luft und im Wheelie kürzer)
    const sl = Math.max(4, Math.round((WB * ct + 9) * Math.max(0.3, 1 - alt / 2.5)))
    screen.fillRect(REAR_X - 5 + camX, GROUND + camY, sl, 1, BLACK)

    // Scooter-Koordinaten (Hinterachse = 0,0) -> Bildschirm
    const SX = (x: number, y: number) => ox + x * ct - y * st
    const SY = (x: number, y: number) => oy - x * st - y * ct

    const spin = s * PPM / WHEEL_R
    for (let k = 0; k < 2; k++) {
        const wx = SX(k * WB, 0), wy = SY(k * WB, 0)
        screen.fillCircle(Math.round(wx), Math.round(wy), WHEEL_R, BLACK)
        screen.fillCircle(Math.round(wx), Math.round(wy), 2, LIGHT)
        if (v < 9) {                                   // Speichen
            const cs = Math.cos(spin) * 4, sn = Math.sin(spin) * 4
            screen.drawLine(Math.round(wx - cs), Math.round(wy - sn), Math.round(wx + cs), Math.round(wy + sn), LIGHT)
        }
    }
    seg(SX(-3, -1), SY(-3, -1), SX(21, -1), SY(21, -1), 3.4, BODY)          // Trittbrett
    seg(SX(-4.5, -0.2), SY(-4.5, -0.2), SX(-4.5, -1.9), SY(-4.5, -1.9), 2.2, RED)   // Rücklicht
    seg(SX(17, -1), SY(17, -1), SX(24.5, 2.5), SY(24.5, 2.5), 3, BODY)
    seg(SX(25, 0), SY(25, 0), SX(21.5, 22), SY(21.5, 22), 2.4, DARK)        // Lenkstange
    seg(SX(18.5, 22.5), SY(18.5, 22.5), SX(24, 22.5), SY(24, 22.5), 2.2, BLACK)
    seg(SX(23.4, 13), SY(23.4, 13), SX(23.7, 15.5), SY(23.7, 15.5), 2.6, YELLOW)   // Licht

    // Fahrer lehnt sich nur teilweise mit zurück
    const phi = pitch * lean
    const cp = Math.cos(phi), sp = Math.sin(phi)
    const mx = 9.5 * ct - 0.6 * st, my = 9.5 * st + 0.6 * ct
    const RX = (x: number, y: number) => ox + mx + x * cp - y * sp
    const RY = (x: number, y: number) => oy - my - x * sp - y * cp

    let hipX = -0.5, hipY = 17.5, shX = 1.5, shY = 27.5, hdX = 2.6, hdY = 33.2, kx = 1.8, ky = 9
    if (crouch) { hipX = -4; hipY = 9; shX = 0.5; shY = 18.5; hdX = 2.4; hdY = 24; kx = 6.5; ky = 8 }
    const hx = RX(hipX, hipY), hy = RY(hipX, hipY)
    const sx = RX(shX, shY), sy = RY(shX, shY)
    const gx = SX(20, 22.5), gy = SY(20, 22.5)

    // hinterer Arm (dunkler)
    drawArm(sx, sy, gx, gy, arms >= 1, -1, shX, shY, RX, RY, BROWN)
    for (let k = 0; k < 2; k++) {
        const ax = k ? 14.5 : 5.5
        const knx = RX((ax - 9.5) * 0.5 + kx, ky), kny = RY((ax - 9.5) * 0.5 + kx, ky)
        const c = k ? NAVY : BLACK
        seg(SX(ax, 2), SY(ax, 2), knx, kny, 3.2, c)
        seg(knx, kny, hx, hy, 3.6, c)
        seg(SX(ax - 2, 1.4), SY(ax - 2, 1.4), SX(ax + 2.4, 1.4), SY(ax + 2.4, 1.4), 2.4, DARK)   // Schuh
    }
    seg(hx, hy, sx, sy, 5.6, RED)                                              // Oberkörper
    const hcx = Math.round(RX(hdX, hdY)), hcy = Math.round(RY(hdX, hdY))
    screen.fillCircle(hcx, hcy, 4, SKIN)
    // Helm: obere Hälfte vom Kopf
    const ux = -sp, uy = -cp           // "oben" für den Fahrer
    seg(hcx - cp * 4.4 + ux * 1.2, hcy + sp * 4.4 + uy * 1.2, hcx + cp * 4.4 + ux * 1.2, hcy - sp * 4.4 + uy * 1.2, 2.6, YELLOW)
    screen.fillCircle(Math.round(hcx + ux * 2.4), Math.round(hcy + uy * 2.4), 3, YELLOW)
    // vorderer Arm
    drawArm(sx, sy, gx, gy, arms == 2, 1, shX, shY, RX, RY, RED)
}

function drawArm(sx: number, sy: number, gx: number, gy: number, upp: boolean, out: number, shX: number, shY: number,
    RX: (x: number, y: number) => number, RY: (x: number, y: number) => number, c: number) {
    let ex: number, ey: number, hx: number, hy: number
    if (upp) {           // Hand in die Luft
        ex = RX(shX + 4 * out, shY + 5); ey = RY(shX + 4 * out, shY + 5)
        hx = RX(shX + 7 * out, shY + 11); hy = RY(shX + 7 * out, shY + 11)
    } else {             // Hand am Lenker
        hx = gx; hy = gy
        ex = (sx + gx) * 0.5; ey = (sy + gy) * 0.5 + 1.5
    }
    seg(sx, sy, ex, ey, 2.6, c)
    seg(ex, ey, hx, hy, 2.4, c)
    screen.fillCircle(Math.round(hx), Math.round(hy), 1, SKIN)
}

function drawParticles() {
    for (let i = 0; i < P_MAX; i++) {
        const k = pKind[i]
        if (k == 0) continue
        const x = Math.round(pX[i]), y = Math.round(pY[i])
        const f = pLife[i] / pMax[i]
        if (k == 1) screen.fillCircle(x, y, 1 + Math.floor(f * 4.5), f > 0.6 ? FAR : LIGHT)
        else if (k == 2) screen.fillRect(x, y, 2, 2, LIGHT)
        else if (k == 3) screen.fillRect(x, y, 2, 2, [RED, YELLOW, GREEN, SKY1, WHITE][i % 5])
        else screen.fillRect(x - 1, y - 1, 3, 3, WHITE)
    }
}

function drawHud() {
    const playing = state != ST_TITLE
    if (playing) {
        txt("REKORD " + fmt1(best) + "m", 2, 1, WHITE, FONT)
        txtR(Math.round(v * 3.6) + " km/h", 158, 1, WHITE, FONT)
        // Konto
        screen.fillCircle(5, 14, 3, YELLOW)
        screen.fillRect(4, 12, 1, 5, WHITE)
        txt("" + points, 11, 11, YELLOW, FONT)
        const m = comboMult()
        if (m > 1 && (inWheelie || air)) txtR("COMBO x" + m, 158, 11, RED, FONT)
    }
    if (bigText) {
        txtC(bigText, 22, WHITE, BIG)
        let c = subColor
        if (recordT > 0 && (Math.floor(t * 8) & 1)) c = RED
        if (subText) txtC(subText, 40, c, FONT)
    }
    if (state == ST_PLAY && inWheelie) {
        // Winkelanzeige: grün = sicher, gelb = Balance, rot = Gefahr
        const x0 = 38, y0 = 51
        screen.fillRect(x0 - 1, y0 - 1, 86, 7, BLACK)
        const g = Math.round((BALANCE_DEG - 12) / CRASH_DEG * 84)
        const y = Math.round((BALANCE_DEG + 5) / CRASH_DEG * 84)
        screen.fillRect(x0, y0, g, 5, GREEN)
        screen.fillRect(x0 + g, y0, y - g, 5, YELLOW)
        screen.fillRect(x0 + y, y0, 84 - y, 5, RED)
        const mx = x0 + Math.round(Math.min(1, th / CRASH_RAD) * 83)
        screen.fillRect(mx - 1, y0 - 3, 3, 11, BLACK)
        screen.fillRect(mx, y0 - 2, 1, 9, WHITE)
    }
    if (state == ST_CRASH && crashT > 1 && (Math.floor(t * 2.5) & 1) == 0) txtC("A = NOCHMAL", 62, WHITE, FONT)
    if (toastT > 0 && toastText) txtC(toastText, 110, WHITE, FONT)
}

const HINTS = ["OBEN = Wheelie an/aus", "A = Gas   B = Bremse", "A + B = Burnout", "Steuerkreuz = Tricks",
    "< > = Scooter-Farben", "MENU = Pause & mehr"]

function drawTitle() {
    txtC("E-SCOOTER", 3, WHITE, BIG)
    screen.print("WHEELIE", 18, 20, BROWN, HUGE)
    screen.print("WHEELIE", 17, 19, YELLOW, HUGE)
    if (shopT > 0) {
        const own = (owned & (1 << shopSel)) != 0
        txtC(own ? "< " + COLOR_NAMES[shopSel] + " >" : "< " + COLOR_NAMES[shopSel] + "  " + COLOR_PRICE[shopSel] + " P >", 46, WHITE, FONT)
        txtC(own ? "Konto: " + points + " P" : "B = kaufen   Konto: " + points + " P", 56, YELLOW, FONT)
    } else {
        txtC(HINTS[Math.floor(t / 2.2) % HINTS.length], 46, WHITE, FONT)
        const k = Math.floor(t / 3) % 4
        let line = "Rekord: " + fmt1(best) + " m"
        if (k == 1 && tbest > 0) line = "Trick-Rekord: " + tbest
        else if (k == 2 && points > 0) line = "Konto: " + points + " P"
        else if (k == 3 && blitzBest > 0) line = "Blitzer-Rekord: " + blitzBest + " km/h"
        txtC(line, 56, YELLOW, FONT)
    }
    if (shopT > 0 || (Math.floor(t * 2.5) & 1) == 0) txtC("A = LOS!", 110, WHITE, FONT)
}

game.onPaint(function () {
    const n = nightAmount()
    camX = 0; camY = 0
    if (shakeT > 0) { camX = Math.randomRange(-2, 2); camY = Math.randomRange(-2, 2) }
    const px = Math.floor(s * PPM)
    drawSky(n)
    drawFar(Math.floor(px * 0.15))
    drawNear(Math.floor(px * 0.5))
    drawRoad(px, n)
    drawThings(px)

    // Schräglage auf der Rampe
    let pitch = 0
    const start = rampS - RAMP_LEN
    if (air) pitch = RAMP_ANGLE * Math.max(0, 1 - airT / 0.5)
    else if (start <= s && s < rampS) pitch = RAMP_ANGLE
    else if (start - 1 <= s && s < start) pitch = Math.atan2((s + 1 - start) / RAMP_LEN * RAMP_H, 1)
    drawRider(th + pitch)
    drawParticles()

    // Fahrtwind-Streifen bei hohem Tempo
    if (state == ST_PLAY && v > 17) {
        const cnt = Math.floor((v - 17) / 2.5) + 1
        for (let i = 0; i < cnt; i++) {
            const h = hash(i + Math.floor(t * 20) * 7)
            const y = 30 + h % 70
            const x = (h >> 8) % W
            screen.drawLine(x, y, x + 10 + (h >> 16) % 14, y, WHITE)
        }
    }
    if (flashT > 0) screen.fill(WHITE)
    if (state == ST_TITLE) drawTitle()
    drawHud()
})

// ------------------------------------------------------------------
// Start
// ------------------------------------------------------------------
loadGame()
shopSel = colorSel
updatePalette()

scene.systemMenu.addEntry(function () { return "REKORDE LÖSCHEN" }, function () {
    scene.systemMenu.closeMenu()
    if (game.ask("Wirklich alles", "löschen?")) {
        best = 0; tbest = 0; blitzBest = 0; points = 0; owned = 1; colorSel = 0
        saveGame()
        gotoTitle()
        toast("ALLES GELÖSCHT")
    }
}, img`
    . . . . . . . . . . . . . . . .
    . . . . . 2 2 2 2 2 2 . . . . .
    . . . 2 2 2 2 2 2 2 2 2 2 . . .
    . . . . . . . . . . . . . . . .
    . . . 2 2 2 2 2 2 2 2 2 2 . . .
    . . . 2 2 1 2 2 1 2 2 1 2 . . .
    . . . 2 2 1 2 2 1 2 2 1 2 . . .
    . . . 2 2 1 2 2 1 2 2 1 2 . . .
    . . . 2 2 1 2 2 1 2 2 1 2 . . .
    . . . 2 2 1 2 2 1 2 2 1 2 . . .
    . . . 2 2 1 2 2 1 2 2 1 2 . . .
    . . . 2 2 2 2 2 2 2 2 2 2 . . .
    . . . . 2 2 2 2 2 2 2 2 . . . .
    . . . . . . . . . . . . . . . .
    . . . . . . . . . . . . . . . .
    . . . . . . . . . . . . . . . .
`)
