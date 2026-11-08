# E-SCOOTER WHEELIE - ein kleines Spiel für den Adafruit PyBadge (CircuitPython)
#
#   OBEN   = Wheelie-Mode an (Vorderrad hoch) / nochmal OBEN = sauber landen
#   A      = Gas geben (bis 100 km/h), im Wheelie: Vorderrad höher
#   B      = Bremsen, im Wheelie: Vorderrad runter
#   A + B  = Burnout! (B loslassen = Turbo-Start)
#   START  = Pause
#   SELECT = Ton an/aus
#   RUNTER = Bilder pro Sekunde anzeigen (FPS)
#
# Ziel: Fahr einen möglichst langen Wheelie! Im Wheelie-Mode musst du mit
# A und B die Balance halten. Wenn das Vorderrad wieder aufsetzt, wird die
# Strecke gezählt. Kippst du nach hinten um, zählt der Wheelie nicht. Dein Rekord bleibt auch nach dem Ausschalten
# gespeichert. Rekord löschen: im Startbildschirm START 3 Sekunden halten.
#
# Installation: Diese Datei als "code.py" auf das Laufwerk CIRCUITPY
# kopieren. Es werden keine zusätzlichen Bibliotheken gebraucht.

import binascii
import math
import random
import struct
import time

import board
import displayio
import keypad

try:
    from bitmaptools import fill_region as _fill_region
except ImportError:
    _fill_region = None

# ------------------------------------------------------------------
# EINSTELLUNGEN - hier kannst du das Spiel leichter/schwerer machen
# ------------------------------------------------------------------
MAX_SPEED_KMH = 100   # Höchstgeschwindigkeit mit Gas (A)
CRUISE_KMH = 25       # so schnell rollt der Scooter von allein
ACCEL = 6.0           # Beschleunigung mit A (m/s²), wird oben raus schwächer
CRUISE_ACCEL = 3.0    # Beschleunigung von allein bis CRUISE_KMH (m/s²)
COAST_DECEL = 1.5     # so schnell wird er ohne Gas wieder langsamer (m/s²)
BRAKE_DECEL = 7.0     # Bremsen mit B (m/s²), im Wheelie schwächer
POP = 1.8             # wie kräftig OBEN das Vorderrad hochreißt
LAUNCH_BOOST = 5.0    # Extra-Beschleunigung nach einem Burnout (m/s²)
BALANCE_DEG = 42      # Gleichgewichtspunkt des Wheelies (Grad)
CRASH_DEG = 68        # ab hier kippst du nach hinten um (Grad)
GRAVITY = 4.0         # wie stark das Vorderrad nach unten will
LIFT = 6.5            # wie stark A das Vorderrad hochzieht
BRAKE_TORQUE = 6.0    # wie stark B das Vorderrad runterdrückt
DAMPING = 1.8         # Dämpfung (höher = gutmütiger)
LAND_TORQUE = 5.0     # sanftes Landen mit nochmal OBEN
LAND_SPEED = 1.6      # so schnell senkt sich das Vorderrad beim Landen (rad/s)
BUMPS = True          # Gullydeckel, die dich durchschütteln
MIN_WHEELIE = 0.5     # so viele Meter muss ein Wheelie mindestens haben

# ------------------------------------------------------------------
# Feste Werte
# ------------------------------------------------------------------
W, H = 160, 128
FRAME = 1 / 40
PX_PER_M = 26                 # 26 Pixel = 1 Meter (Radstand)
REAR_X, AXLE_Y = 48, 112      # Hinterachse auf dem Bildschirm
WHEEL_R = 5
WHEELBASE = 26
SPR_PX, SPR_PY = 60, 60       # Drehpunkt beim Vorzeichnen der Scooter-Bilder
FRAME_STEP = 3                # ein Scooter-Bild alle 3 Grad
N_PLAY = CRASH_DEG // FRAME_STEP + 1
VMAX = MAX_SPEED_KMH / 3.6
CRUISE = CRUISE_KMH / 3.6
PHI0 = math.radians(90 - BALANCE_DEG)
CRASH_RAD = math.radians(CRASH_DEG)
LEAN = 0.5                    # Fahrer lehnt sich nur halb so weit zurück
PROP_PERIOD = 240             # Abstand, in dem sich Laternen/Bäume wiederholen

BTN_B, BTN_A, BTN_START, BTN_SELECT, BTN_DOWN, BTN_UP = 1, 2, 4, 8, 32, 64

TITLE, PLAY, PAUSE, CRASH = 0, 1, 2, 3

# ------------------------------------------------------------------
# Pixel-Schrift (5x7, mit eingebautem Schatten)
# ------------------------------------------------------------------
FONT_CHARS = " 0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZÄÖÜ.:!-/=+?()><"
FONT_HEX = (
    "000000000000000e11131519110e040c040404040e0e11010204081f1f020402"
    "01110e02060a121f02021f101e0101110e0608101e11110e1f0102040808080e"
    "11110e11110e0e11110f01020c0e11111f1111111e11111e11111e0e11101010"
    "110e1c12111111121c1f10101e10101f1f10101e1010100e11101711110f1111"
    "111f1111110e04040404040e0702020202120c11121418141211101010101010"
    "1f111b1515111111111119151311110e11111111110e1e11111e1010100e1111"
    "1115120d1e11111e1412110f10100e01011e1f0404040404041111111111110e"
    "11111111110a041111111515150a11110a040a111111110a040404041f010204"
    "08101f0a000e111f11110a000e1111110e0a00111111110e00000000000c0c00"
    "0c0c000c0c00040404040400040000000e0000000001020408100000001f001f"
    "00000004041f0404000e11010204000402040808080402080402020204080804"
    "020102040802040810080402"
)
FONT_INDEX = {c: i for i, c in enumerate(FONT_CHARS)}


def rect(bmp, x0, y0, x1, y1, c):
    """Füllt ein Rechteck (x1/y1 exklusiv), abgeschnitten am Bitmap-Rand."""
    x0 = max(0, x0)
    y0 = max(0, y0)
    x1 = min(bmp.width, x1)
    y1 = min(bmp.height, y1)
    if x1 <= x0 or y1 <= y0:
        return
    if _fill_region:
        _fill_region(bmp, x0, y0, x1, y1, c)
    else:
        for y in range(y0, y1):
            for x in range(x0, x1):
                bmp[x, y] = c


def make_palette(colors, transparent=False):
    p = displayio.Palette(len(colors))
    for i, c in enumerate(colors):
        p[i] = c
    if transparent:
        p.make_transparent(0)
    return p


def make_font():
    """Alle Zeichen in eine Bitmap: Farbe 1 = Schrift, Farbe 2 = Schatten."""
    data = binascii.unhexlify(FONT_HEX)
    bmp = displayio.Bitmap(6 * len(FONT_CHARS), 8, 3)
    for value, dx in ((2, 1), (1, 0)):
        for g in range(len(FONT_CHARS)):
            for r in range(7):
                bits = data[g * 7 + r]
                for c in range(5):
                    if bits & (16 >> c):
                        bmp[g * 6 + c + dx, r + dx] = value
    return bmp


class Label:
    """Ein Text aus Kacheln der Pixel-Schrift."""

    def __init__(self, font, parent, n, color, scale=1, shadow=0x101018):
        self.n = n
        self.scale = scale
        self.g = displayio.Group(scale=scale)
        self.pal = make_palette((0, color, shadow), True)
        self.tg = displayio.TileGrid(font, pixel_shader=self.pal, width=n, height=1,
                                     tile_width=6, tile_height=8)
        self.g.append(self.tg)
        parent.append(self.g)
        self.text = ""

    def set(self, text, x, y, align=0):
        """align: 0 = links, 1 = Mitte, 2 = rechts (bezogen auf x)."""
        text = text[:self.n]
        if text != self.text:
            for i in range(self.n):
                self.tg[i] = FONT_INDEX.get(text[i], 0) if i < len(text) else 0
            self.text = text
        w = (len(text) * 6 - 1) * self.scale
        if align == 1:
            x -= w // 2
        elif align == 2:
            x -= w
        self.g.x = x
        self.g.y = y
        self.g.hidden = False

    def color(self, c):
        self.pal[1] = c

    def hide(self):
        self.g.hidden = True


class Raster:
    """Füllt Polygone und Kreise zeilenweise in eine Bitmap.
    Ohne Bitmap (bmp = None) wird nur gemessen, wie groß das Bild wird."""

    def __init__(self):
        self.bmp = None
        self.ox = self.oy = 0
        self.x0 = self.y0 = 9999
        self.x1 = self.y1 = -9999

    def span(self, xa, xb, y, c):
        if xb < xa:
            return
        if self.bmp is None:
            self.x0 = min(self.x0, xa)
            self.x1 = max(self.x1, xb)
            self.y0 = min(self.y0, y)
            self.y1 = max(self.y1, y)
        else:
            rect(self.bmp, xa - self.ox, y - self.oy, xb - self.ox + 1, y - self.oy + 1, c)

    def poly(self, p, c):
        """Konvexes Polygon füllen."""
        ymin = min(q[1] for q in p)
        ymax = max(q[1] for q in p)
        ya = int(ymin + 0.5)
        yb = max(ya, int(ymax - 0.5))
        n = len(p)
        for y in range(ya, yb + 1):
            yc = min(max(y + 0.5, ymin), ymax)
            xl, xr = 9999.0, -9999.0
            j = n - 1
            for i in range(n):
                ax, ay = p[i]
                bx, by = p[j]
                if (ay <= yc) != (by <= yc) or (ay == by == yc):
                    x = ax if ay == by else ax + (yc - ay) * (bx - ax) / (by - ay)
                    xl = min(xl, x)
                    xr = max(xr, x)
                j = i
            if xr >= xl:
                xa = int(xl + 0.5)
                xb = int(xr - 0.5)
                if xb < xa:
                    xa = xb = int((xl + xr) * 0.5)
                self.span(xa, xb, y, c)

    def seg(self, a, b, w, c):
        """Dicke Linie von a nach b."""
        dx = b[0] - a[0]
        dy = b[1] - a[1]
        d = math.sqrt(dx * dx + dy * dy) or 0.001
        nx = -dy / d * w * 0.5
        ny = dx / d * w * 0.5
        self.poly(((a[0] + nx, a[1] + ny), (b[0] + nx, b[1] + ny),
                   (b[0] - nx, b[1] - ny), (a[0] - nx, a[1] - ny)), c)

    def circle(self, p, r, c):
        cx, cy = p
        for y in range(int(cy - r + 0.5), int(cy + r - 0.5) + 1):
            d = y + 0.5 - cy
            h = r * r - d * d
            if h >= 0:
                h = math.sqrt(h)
                self.span(int(cx - h + 0.5), int(cx + h - 0.5), y, c)


# Farben für Scooter und Fahrer
C_TIRE, C_HUB, C_BODY, C_DARK, C_PANTS, C_PANTS2, C_SHIRT, C_SKIN, \
    C_HELMET, C_SHOE, C_LIGHT, C_RED, C_SHADOW = range(1, 14)
SPRITE_COLORS = (0, 0x17171C, 0xA8AEB6, 0x19C2A0, 0x0E7C68, 0x2E4485, 0x223266,
                 0xE84A3C, 0xF4C7A1, 0xFFD23F, 0x2A2A2A, 0xFFF6B0, 0xFF3030, 0x26262E)


def draw_rider(cv, th, lean):
    """Scooter + Fahrer, Wheelie-Winkel th (rad). Drehpunkt = Hinterachse."""
    ct = math.cos(th)
    st = math.sin(th)
    ox, oy = SPR_PX, SPR_PY

    def S(x, y):    # Scooter-Koordinaten (Hinterachse = 0,0) -> Bild
        return (ox + x * ct - y * st, oy - x * st - y * ct)

    # Schatten auf der Straße
    fx = WHEELBASE * ct
    cv.span(int(ox + min(0, fx)) - 5, int(ox + max(0, fx)) + 4, oy + 5, C_SHADOW)

    # Scooter
    cv.circle(S(0, 0), WHEEL_R, C_TIRE)
    cv.circle(S(0, 0), 1.8, C_HUB)
    cv.poly((S(-3, 0.6), S(21, 0.6), S(21, -2.6), S(-3, -2.6)), C_BODY)
    cv.seg(S(-3.5, -0.2), S(-3.5, -1.8), 2.0, C_RED)
    cv.seg(S(17, -1), S(24.5, 2.5), 3.0, C_BODY)
    cv.seg(S(25, 0), S(21.5, 22), 2.6, C_DARK)
    cv.seg(S(18.5, 22.5), S(24, 22.5), 2.2, C_TIRE)
    cv.seg(S(23.4, 13), S(23.7, 15.5), 2.6, C_LIGHT)
    cv.circle(S(WHEELBASE, 0), WHEEL_R, C_TIRE)
    cv.circle(S(WHEELBASE, 0), 1.8, C_HUB)

    # Fahrer (lehnt sich nur teilweise mit zurück)
    phi = th * lean
    cp = math.cos(phi)
    sp = math.sin(phi)
    mx = 9.5 * ct - 0.6 * st
    my = 9.5 * st + 0.6 * ct

    def R(x, y):    # Fahrer-Koordinaten (Füße = 0,0) -> Bild
        return (ox + mx + x * cp - y * sp, oy - my - x * sp - y * cp)

    hip = R(-0.5, 17.5)
    shoulder = R(1.5, 27.5)
    for ax, color in ((5.5, C_PANTS2), (14.5, C_PANTS)):
        knee = R(((ax - 9.5) * 0.5) + 1.8, 9.0)
        cv.seg(S(ax, 2.0), knee, 3.2, color)
        cv.circle(knee, 1.6, color)
        cv.seg(knee, hip, 3.6, color)
        cv.seg(S(ax - 2, 1.4), S(ax + 2.2, 1.4), 2.2, C_SHOE)
    cv.seg(hip, shoulder, 5.5, C_SHIRT)
    cv.circle(R(2.6, 33.2), 3.8, C_SKIN)
    cv.poly([R(2.6 + 4.4 * math.cos(a), 33.6 + 4.4 * math.sin(a))
             for a in (0.0, 0.6, 1.2, 1.9, 2.5, 3.14)], C_HELMET)
    grip = S(20, 22.5)
    cv.seg(shoulder, grip, 2.4, C_SHIRT)
    cv.circle(grip, 1.4, C_SKIN)


def frame_specs():
    """(Winkel, Zurücklehnen) für jedes vorgezeichnete Scooter-Bild."""
    specs = [(i * FRAME_STEP, LEAN) for i in range(N_PLAY)]
    for k in range(1, 5):     # Bilder für den Überschlag
        specs.append((CRASH_DEG + (100 - CRASH_DEG) * k / 4, LEAN + (1 - LEAN) * k / 4))
    return specs


def build_frames(group):
    """Zeichnet alle Scooter-Bilder einmal vor (beim Start)."""
    pal = make_palette(SPRITE_COLORS, True)
    frames = []
    for deg, lean in frame_specs():
        r = Raster()
        draw_rider(r, math.radians(deg), lean)      # 1. Größe messen
        r.bmp = displayio.Bitmap(r.x1 - r.x0 + 1, r.y1 - r.y0 + 1, len(SPRITE_COLORS))
        r.ox, r.oy = r.x0, r.y0
        draw_rider(r, math.radians(deg), lean)      # 2. wirklich zeichnen
        tg = displayio.TileGrid(r.bmp, pixel_shader=pal,
                                x=REAR_X - SPR_PX + r.x0, y=AXLE_Y - SPR_PY + r.y0)
        tg.hidden = True
        group.append(tg)
        frames.append(tg)
    return frames


# ------------------------------------------------------------------
# Hardware-Helfer: Knöpfe, LEDs, Ton, Speicher
# ------------------------------------------------------------------
class Buttons:
    def __init__(self):
        # Reihenfolge am Schieberegister: B, A, START, SELECT, rechts, runter, hoch, links
        self.keys = keypad.ShiftRegisterKeys(
            clock=board.BUTTON_CLOCK, data=board.BUTTON_OUT,
            latch=board.BUTTON_LATCH, key_count=8, value_when_pressed=True)
        self.held = 0
        self.pressed = 0
        self.released = 0

    def poll(self):
        self.pressed = 0
        self.released = 0
        ev = self.keys.events.get()
        while ev:
            bit = 1 << ev.key_number
            if ev.pressed:
                self.held |= bit
                self.pressed |= bit
            else:
                self.held &= ~bit
                self.released |= bit
            ev = self.keys.events.get()
        if self.keys.events.overflowed:
            self.keys.events.clear()
            self.keys.reset()
            self.held = 0


class Pixels:
    """Die NeoPixel-LED(s) unter dem Bildschirm (ohne Zusatz-Bibliothek)."""

    def __init__(self):
        self.pin = None
        self.last = None
        self.buf = bytearray(15)
        try:
            import digitalio
            import neopixel_write
            self.pin = digitalio.DigitalInOut(board.NEOPIXEL)
            self.pin.switch_to_output()
            self.write = neopixel_write.neopixel_write
        except Exception:  # pylint: disable=broad-except
            self.pin = None

    def set(self, r, g, b):
        if self.pin is None:
            return
        c = (int(g) & 255, int(r) & 255, int(b) & 255)
        if c == self.last:
            return
        self.last = c
        for i in range(5):
            self.buf[3 * i:3 * i + 3] = bytes(c)
        try:
            self.write(self.pin, self.buf)
        except Exception:  # pylint: disable=broad-except
            self.pin = None


class Sound:
    """Einfache Töne über den eingebauten Lautsprecher (synthio)."""

    def __init__(self, on):
        self.ok = False
        self.on = on
        self.seq = []
        self.cur = None
        self.t = 0.0
        try:
            import array
            import audioio
            import digitalio
            import synthio
            self.synthio = synthio
            self.enable = digitalio.DigitalInOut(board.SPEAKER_ENABLE)
            self.enable.switch_to_output(value=on)
            self.audio = audioio.AudioOut(board.SPEAKER)
            self.synth = synthio.Synthesizer(sample_rate=16000)
            self.audio.play(self.synth)
            n = 32
            self.saw = array.array("h", [int(-28000 + 56000 * i / n) for i in range(n)])
            self.sq = array.array("h", [20000] * (n // 2) + [-20000] * (n // 2))
            self.env = synthio.Envelope(attack_time=0.003, decay_time=0.0,
                                        release_time=0.03, attack_level=1.0,
                                        sustain_level=1.0)
            self.engine = synthio.Note(frequency=120, waveform=self.saw,
                                       envelope=self.env, amplitude=0.0)
            self.synth.press(self.engine)
            noise = array.array("h", [random.randint(-20000, 20000) for _ in range(64)])
            self.screech = synthio.Note(frequency=180, waveform=noise,
                                        envelope=self.env, amplitude=0.0)
            self.synth.press(self.screech)
            self.ok = True
        except Exception as e:  # pylint: disable=broad-except
            print("Kein Ton:", e)

    def set_on(self, on):
        self.on = on
        if self.ok:
            try:
                self.enable.value = on
            except Exception:  # pylint: disable=broad-except
                pass
            if not on:
                self.seq = []
                self._next()

    def play(self, notes):
        """notes: Liste von (Frequenz, Dauer). Frequenz 0 = Pause."""
        if not (self.ok and self.on):
            return
        self.seq = list(notes)
        self._next()

    def _next(self):
        try:
            if self.cur is not None:
                self.synth.release(self.cur)
                self.cur = None
            if self.seq:
                f, self.t = self.seq.pop(0)
                if f > 0:
                    self.cur = self.synthio.Note(frequency=f, waveform=self.sq,
                                                 envelope=self.env, amplitude=0.3)
                    self.synth.press(self.cur)
        except Exception:  # pylint: disable=broad-except
            self.ok = False

    def update(self, dt, speed, gas, burn=False):
        if not self.ok:
            return
        if self.cur is not None or self.seq:
            self.t -= dt
            if self.t <= 0:
                self._next()
        try:
            amp = 0.0
            freq = 150 + 600 * speed + (50 if gas else 0)
            if burn:                          # Motor heult, Reifen quietscht
                amp = 0.12
                freq = 650 + random.randint(-80, 80)
            elif speed > 0.02:
                amp = 0.04 + (0.05 if gas else 0.0)
            self.engine.amplitude = amp if self.on else 0.0
            self.engine.frequency = freq
            self.screech.amplitude = 0.12 if (burn and self.on) else 0.0
        except Exception:  # pylint: disable=broad-except
            self.ok = False


class Store:
    """Rekord + Toneinstellung im nichtflüchtigen Speicher (nvm)."""

    def __init__(self):
        self.best = 0.0
        self.sound = True
        self.nvm = None
        try:
            import microcontroller
            self.nvm = microcontroller.nvm
            if self.nvm is not None and len(self.nvm) >= 8 and bytes(self.nvm[0:2]) == b"EW":
                self.sound = self.nvm[2] != 0
                best = struct.unpack("<f", bytes(self.nvm[4:8]))[0]
                if best == best and 0 <= best < 1e6:   # NaN-Schutz
                    self.best = best
        except Exception:  # pylint: disable=broad-except
            self.nvm = None

    def save(self):
        if self.nvm is None:
            return
        try:
            self.nvm[0:8] = b"EW" + bytes((1 if self.sound else 0, 1)) + struct.pack("<f", self.best)
        except Exception:  # pylint: disable=broad-except
            pass


# ------------------------------------------------------------------
# Hintergrund: wird beim Start EINMAL gemalt und bewegt sich nicht.
# Nur schmale Streifen und kleine Sprites bewegen sich, das ist schnell.
# ------------------------------------------------------------------
(SKY0, SKY1, SKY2, SUN, GLOW, CLOUD, FAR1, FAR2, WALL_A, WALL_B, WALL_C, ROOF,
 TREE, TREE_D, TRUNK, GLASS, DOOR, WALK, CURB, ROAD, ROADLINE) = range(21)
BG_COLORS = (0x3E8EDE, 0x6FB4EE, 0xA8D8F5, 0xFFE27A, 0xFFF3B8, 0xFFFFFF, 0x8BA6C9,
             0xA9C0DD, 0xE9A15B, 0xDDD5C4, 0x9FC3A8, 0x8C3B2E, 0x3E9D4B, 0x2E7A3A,
             0x6B4A2B, 0x5D7EA6, 0x5A3A26, 0xB3B3BD, 0x7A7A86, 0x3B3B45, 0x8E8E99)


def blob(bmp, cx, cy, r, c):
    """Gefüllter Kreis (für Wolken, Bäume, Sonne)."""
    for y in range(-int(r), int(r) + 1):
        hw = int(math.sqrt(max(0, r * r - y * y)))
        rect(bmp, int(cx) - hw, int(cy) + y, int(cx) + hw + 1, int(cy) + y + 1, c)


def make_background():
    bmp = displayio.Bitmap(W, H, len(BG_COLORS))
    rect(bmp, 0, 0, W, 30, SKY0)
    rect(bmp, 0, 30, W, 58, SKY1)
    rect(bmp, 0, 58, W, 100, SKY2)
    for y, c in ((28, SKY1), (29, SKY0), (56, SKY2), (57, SKY1)):   # weiche Übergänge
        for x in range(y % 2, W, 2):
            bmp[x, y] = c
    for y in range(9, 32):            # Sonne mit Schein
        for x in range(117, 143):
            d = (x - 129.5) ** 2 + (y - 20.5) ** 2
            if d < 81:
                bmp[x, y] = SUN
            elif d < 121 and (x + y) % 2 == 0:
                bmp[x, y] = GLOW
    for cx, cy, s in ((20, 40, 1.0), (75, 35, 0.7), (128, 43, 0.85)):     # Wolken
        for dx, dy, r in ((0, 4, 5), (6, 1, 6), (13, 3, 5), (19, 5, 4), (7, 6, 5)):
            blob(bmp, cx + dx * s, cy + dy * s, r * s, CLOUD)

    random.seed(7)                    # Hochhäuser in der Ferne
    x = 0
    while x < W:
        w = random.randint(9, 20)
        top = 98 - random.randint(10, 30)
        rect(bmp, x, top, x + w, 98, FAR1)
        for wy in range(top + 3, 95, 5):
            for wx in range(x + 2, x + w - 2, 4):
                if random.random() < 0.5:
                    rect(bmp, wx, wy, wx + 2, wy + 2, FAR2)
        x += w + random.randint(0, 6)

    random.seed(3)                    # Häuser und Bäume an der Straße
    x = 0
    while x < W:
        if random.random() < 0.35:
            tx = x + 7
            rect(bmp, tx - 1, 86, tx + 2, 98, TRUNK)
            blob(bmp, tx, 80, 8, TREE_D)
            blob(bmp, tx - 3, 77, 5, TREE)
            blob(bmp, tx + 3, 83, 5, TREE)
            x += 16
        else:
            w = random.randint(20, 30)
            top = 98 - random.randint(18, 28)
            rect(bmp, x, top, x + w, 98, random.choice((WALL_A, WALL_B, WALL_C)))
            for i in range(w // 2 + 2):    # Dach
                rect(bmp, x - 1 + i, top - 1 - i, x + w + 1 - i, top - i, ROOF)
            for wy in range(top + 3, 89, 8):
                for wx in range(x + 3, x + w - 5, 7):
                    rect(bmp, wx, wy, wx + 4, wy + 5, GLASS)
            dx = x + w // 2 - 2
            rect(bmp, dx, 90, dx + 5, 98, DOOR)
            x += w + random.randint(2, 6)

    rect(bmp, 0, 98, W, 104, WALK)    # Gehweg
    rect(bmp, 0, 104, W, 107, CURB)   # Bordstein
    rect(bmp, 0, 107, W, H, ROAD)     # Straße
    rect(bmp, 0, 108, W, 109, ROADLINE)
    return displayio.TileGrid(bmp, pixel_shader=make_palette(BG_COLORS))


def make_strip(period, h, color, w_on, y):
    """Schmaler, endlos scrollender Streifen (Gehwegfugen, Mittelstreifen)."""
    bmp = displayio.Bitmap(period, h, 2)
    rect(bmp, 0, 0, w_on, h, 1)
    return displayio.TileGrid(bmp, pixel_shader=make_palette((0, color), True),
                              width=W // period + 2, height=1, tile_width=period,
                              tile_height=h, y=y)


def make_lamp():
    pal = make_palette((0, 0x4A4F5A, 0xFFF3B8, 0x2E323A), True)
    bmp = displayio.Bitmap(7, 38, 4)
    rect(bmp, 3, 6, 5, 38, 1)         # Mast
    rect(bmp, 2, 35, 6, 38, 3)        # Fuß
    rect(bmp, 1, 1, 6, 7, 3)          # Lampe
    rect(bmp, 2, 2, 5, 6, 2)
    rect(bmp, 2, 0, 5, 1, 3)
    return displayio.TileGrid(bmp, pixel_shader=pal, y=101 - 38)


def make_tree():
    pal = make_palette((0, 0x3E9D4B, 0x2E7A3A, 0x6B4A2B), True)
    bmp = displayio.Bitmap(15, 28, 4)
    rect(bmp, 6, 12, 9, 28, 3)
    blob(bmp, 7, 8, 7, 2)
    blob(bmp, 5, 6, 4, 1)
    blob(bmp, 10, 10, 3, 1)
    return displayio.TileGrid(bmp, pixel_shader=pal, y=101 - 28)


class Smoke:
    """Rauchwolken beim Burnout: ein paar kleine Sprites, die wiederverwendet werden."""

    def __init__(self, parent, n=14):
        sheet = displayio.Bitmap(36, 12, 3)
        for i, r in enumerate((2.2, 3.8, 5.4)):     # klein, mittel, groß
            blob(sheet, i * 12 + 6, 6, r, 2)
            blob(sheet, i * 12 + 6, 6, r - 1.2, 1)
        pal = make_palette((0, 0xE6E6EA, 0xB4B4BC), True)
        self.parts = []
        for _ in range(n):
            tg = displayio.TileGrid(sheet, pixel_shader=pal, width=1, height=1,
                                    tile_width=12, tile_height=12)
            tg.hidden = True
            parent.append(tg)
            self.parts.append([tg, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0])  # x, y, vx, vy, Alter, Lebensdauer

    def emit(self, x, y):
        for p in self.parts:
            if p[6] <= 0:
                p[1:] = [x, y, -25 - random.random() * 35, -12 - random.random() * 18,
                         0.0, 0.7 + random.random() * 0.5]
                return

    def update(self, dt, scroll):
        for p in self.parts:
            if p[6] <= 0:
                continue
            p[5] += dt
            tg = p[0]
            if p[5] >= p[6]:
                p[6] = 0.0
                tg.hidden = True
                continue
            p[1] += p[3] * dt - scroll
            p[2] += p[4] * dt
            p[3] *= 0.96
            tg[0] = min(2, int(p[5] / p[6] * 3))
            tg.x = int(p[1]) - 6
            tg.y = int(p[2]) - 6
            tg.hidden = False

    def clear(self):
        for p in self.parts:
            p[6] = 0.0
            p[0].hidden = True


def make_bump():
    pal = make_palette((0, 0x23232A, 0x7D7D88), True)
    bmp = displayio.Bitmap(12, 4, 3)
    rect(bmp, 2, 0, 10, 4, 2)
    rect(bmp, 0, 1, 12, 3, 2)
    rect(bmp, 3, 1, 9, 3, 1)
    rect(bmp, 1, 2, 11, 3, 1)
    return displayio.TileGrid(bmp, pixel_shader=pal, y=115)


# ------------------------------------------------------------------
# Das Spiel
# ------------------------------------------------------------------
class Game:
    def __init__(self, display):
        self.store = Store()
        self.btn = Buttons()
        self.leds = Pixels()
        self.sound = Sound(self.store.sound)

        font = make_font()
        self.root = displayio.Group()
        self.world = displayio.Group()
        self.root.append(self.world)
        loading = Label(font, self.root, 8, 0xFFFFFF)
        loading.set("LÄDT...", 80, 60, 1)
        try:
            display.root_group = self.root
        except AttributeError:
            display.show(self.root)

        self.world.append(make_background())
        self.seams = make_strip(32, 6, 0x8E8E99, 1, 98)
        self.dashes = make_strip(96, 2, 0xEDEDED, 48, 124)
        self.world.append(self.seams)
        self.world.append(self.dashes)
        self.props = []
        for maker, off, w in ((make_lamp, 0, 7), (make_tree, 85, 15), (make_lamp, 165, 7)):
            tg = maker()
            self.world.append(tg)
            self.props.append((tg, off, w))
        self.bumps = [make_bump(), make_bump()]
        for b in self.bumps:
            b.hidden = True
            self.world.append(b)
        self.mark_bmp = displayio.Bitmap(40, 2, 2)    # Reifenspur vom Burnout
        self.mark = displayio.TileGrid(self.mark_bmp, y=116,
                                       pixel_shader=make_palette((0, 0x1E1E24), True))
        self.world.append(self.mark)
        self.rider = displayio.Group()
        self.world.append(self.rider)
        self.smoke = Smoke(self.world)
        self.frames = build_frames(self.rider)
        self.frame = 0
        self.frames[0].hidden = False
        self.root.remove(loading.g)

        hud = displayio.Group()
        self.root.append(hud)
        self.l_best = Label(font, hud, 16, 0xFFFFFF)
        self.l_speed = Label(font, hud, 8, 0xFFFFFF)
        self.l_big = Label(font, hud, 9, 0xFFFFFF, scale=2)
        self.l_sub = Label(font, hud, 24, 0xFFE27A)
        self.l_title1 = Label(font, hud, 9, 0xFFFFFF, scale=2)
        self.l_title2 = Label(font, hud, 7, 0xFFD23F, scale=3, shadow=0x8C3B2E)
        self.l_help = Label(font, hud, 24, 0xFFFFFF)
        self.l_prompt = Label(font, hud, 22, 0xFFFFFF)
        self.l_toast = Label(font, hud, 18, 0xFFFFFF)
        self.l_fps = Label(font, hud, 7, 0xFFFFFF)
        self.l_fps.hide()
        self.fps = 0.0
        self.fps_t = -1.0

        # Winkelanzeige: grün = sicher, gelb = Gleichgewicht, rot = Absturzgefahr
        mpal = make_palette((0, 0x101018, 0x3CCB5A, 0xFFD23F, 0xE84A3C, 0xFFFFFF), True)
        mbmp = displayio.Bitmap(84, 7, 6)
        rect(mbmp, 0, 0, 84, 7, 1)
        for x in range(82):
            deg = x / 81 * CRASH_DEG
            c = 2 if deg < BALANCE_DEG - 12 else (3 if deg < BALANCE_DEG + 5 else 4)
            rect(mbmp, 1 + x, 1, 2 + x, 6, c)
        self.meter = displayio.TileGrid(mbmp, pixel_shader=mpal, x=38, y=46)
        kbmp = displayio.Bitmap(3, 11, 6)
        rect(kbmp, 0, 0, 3, 11, 1)
        rect(kbmp, 1, 1, 2, 10, 5)
        self.marker = displayio.TileGrid(kbmp, pixel_shader=mpal, x=38, y=44)
        hud.append(self.meter)
        hud.append(self.marker)

        self.t = 0.0
        self.toast_t = 0.0
        self.best_key = None
        self.kmh = -1
        self.reset_ride()
        self.goto_title()

    # ---------------- Zustände ----------------
    def reset_ride(self):
        self.v = 0.0            # Geschwindigkeit (m/s)
        self.th = 0.0           # Wheelie-Winkel (rad)
        self.om = 0.0           # Drehgeschwindigkeit (rad/s)
        self.s = 0.0            # gefahrene Strecke (m)
        self.in_wheelie = False
        self.wmode = False      # Wheelie-Mode an (mit OBEN)
        self.landing = False    # nochmal OBEN gedrückt: sanft landen
        self.wd = 0.0           # Wheelie-Strecke (m)
        self.wt = 0.0           # Wheelie-Zeit (s)
        self.hud_t = 1.0
        self.result_t = 0.0
        self.record_t = 0.0
        self.shake_t = 0.0
        self.hop_t = 0.0
        self.crash_t = 0.0
        self.next_bump = 30.0
        self.burn = False       # Burnout läuft (A + B)
        self.burn_t = 0.0
        self.boost_t = 0.0      # Turbo-Start nach dem Burnout
        self.smoke_acc = 0.0
        self.mark_s = -999.0    # wo die Reifenspur liegt (m)
        self.mark_len = 0
        self.last_px = 0
        self.bump_pos = [-100.0, -100.0]

    def goto_title(self):
        self.state = TITLE
        self.start_hold = -1.0
        self.reset_ride()
        for l in (self.l_big, self.l_sub, self.l_speed, self.l_prompt):
            l.hide()
        self.l_title1.set("E-SCOOTER", 80, 3, 1)
        self.l_title2.set("WHEELIE", 80, 20, 1)

    def start_game(self):
        self.state = PLAY
        for l in (self.l_title1, self.l_title2, self.l_help, self.l_prompt):
            l.hide()
        self.reset_ride()
        random.seed(time.monotonic_ns() % 1000003)   # Gullydeckel jedes Mal anders
        self.sound.play(((523, 0.07), (784, 0.1)))
        self.toast("OBEN = WHEELIE")

    def toast(self, text):
        self.l_toast.set(text, 157, 118, 2)
        self.toast_t = 1.6

    # ---------------- Hauptschritt ----------------
    def step(self, dt):
        b = self.btn
        b.poll()
        self.t += dt
        if b.pressed & BTN_SELECT:
            self.store.sound = not self.store.sound
            self.sound.set_on(self.store.sound)
            self.store.save()
            self.toast("TON AN" if self.store.sound else "TON AUS")
        if b.pressed & BTN_DOWN:
            self.fps_t = -1.0 if self.fps_t >= 0 else 0.0
            self.l_fps.hide()
        if dt > 0:
            self.fps += (1 / dt - self.fps) * 0.1
        if self.fps_t >= 0:
            self.fps_t += dt
            if self.fps_t > 0.5:
                self.fps_t = 0.0
                self.l_fps.set("%d FPS" % int(self.fps + 0.5), 2, 118)

        if self.state == TITLE:
            self.update_title(dt)
        elif self.state == PLAY:
            if b.pressed & BTN_START:
                self.state = PAUSE
                self.l_prompt.set("PAUSE - START = WEITER", 80, 60, 1)
            else:
                self.update_play(dt, b.held & BTN_A, b.held & BTN_B)
        elif self.state == PAUSE:
            if b.pressed & (BTN_START | BTN_A):
                self.state = PLAY
                self.l_prompt.hide()
        elif self.state == CRASH:
            self.update_crash(dt)

        if self.toast_t > 0:
            self.toast_t -= dt
            if self.toast_t <= 0:
                self.l_toast.hide()

        gas = self.state == PLAY and b.held & BTN_A
        self.sound.update(dt, self.v / VMAX if self.state != PAUSE else 0, gas,
                          self.state == PLAY and self.burn)
        self.draw(dt)

    def update_title(self, dt):
        b = self.btn
        self.l_help.set(("A = GAS   B = BREMSE", "OBEN = WHEELIE AN/AUS",
                         "A + B = BURNOUT")[int(self.t / 2) % 3], 80, 48, 1)
        if b.held & BTN_START:
            # START gedrückt halten = Rekord löschen
            if self.start_hold < 0:
                self.start_hold = 0.0
            self.start_hold += dt
            if 0.8 < self.start_hold < 3.0:
                self.l_prompt.set("REKORD LÖSCHEN... %d" % (3 - int(self.start_hold)), 80, 66, 1)
            elif self.start_hold >= 3.0 > self.start_hold - dt:
                self.store.best = 0.0
                self.store.save()
                self.l_prompt.hide()
                self.toast("REKORD GELÖSCHT")
                self.sound.play(((300, 0.1), (200, 0.15)))
        else:
            if b.released & BTN_START and 0 <= self.start_hold < 0.8:
                self.start_game()
                return
            self.start_hold = -1.0
            if int(self.t * 2.5) % 2 == 0:
                self.l_prompt.set("DRÜCK A ZUM STARTEN", 80, 66, 1)
            else:
                self.l_prompt.hide()
        if b.pressed & BTN_A:
            self.start_game()

    def physics(self, dt, gas, brake):
        """Ein kleiner Physik-Schritt. Gibt True zurück, wenn das Vorderrad aufsetzt."""
        v = self.v
        if brake:
            v -= BRAKE_DECEL * dt * (0.4 if self.th > 0 else 1.0)
        elif gas:
            f = v / VMAX
            v += ACCEL * dt * (1 - 0.6 * f * f)        # oben raus zieht er weniger
            if self.boost_t > 0:
                v += LAUNCH_BOOST * dt
        elif v < CRUISE:
            v = min(CRUISE, v + CRUISE_ACCEL * dt)     # rollt von allein
        else:
            v = max(CRUISE, v - COAST_DECEL * dt)
        self.v = min(max(v, 0.0), VMAX)
        a = -GRAVITY * math.cos(PHI0 + self.th) - DAMPING * self.om
        if self.landing:
            a -= LAND_TORQUE
        elif self.wmode:
            if gas:
                a += LIFT * min(1.0, self.v / 2.0)
            if brake and self.th > 0:
                a -= BRAKE_TORQUE
        self.om += a * dt
        if self.landing and self.om < -LAND_SPEED:
            self.om = -LAND_SPEED
        self.th += self.om * dt
        self.s += self.v * dt
        if self.th <= 0:
            self.th = 0.0
            if self.om < 0:
                self.om = 0.0
                return True
        return False

    def update_play(self, dt, gas, brake):
        if self.btn.pressed & BTN_UP:
            if not self.wmode:
                self.wmode = True          # Wheelie-Mode an: Vorderrad hochreißen
                self.landing = False
                self.om += POP
            elif self.th > 0:
                self.landing = True        # nochmal OBEN: sanft landen
            else:
                self.wmode = False
        burn = bool(gas and brake) and not self.wmode and self.th == 0
        if burn and not self.burn:
            self.start_burnout()
        elif self.burn and not burn:
            self.end_burnout(gas)
        self.burn = burn
        if burn:
            self.update_burnout(dt)
        if self.boost_t > 0:
            self.boost_t -= dt
        landed = False
        s_before = self.s
        steps = int(dt / 0.01) + 1
        for _ in range(steps):
            if self.physics(dt / steps, gas, brake):
                landed = True
        if self.th > 0 and not self.in_wheelie:
            self.in_wheelie = True
            self.wd = 0.0
            self.wt = 0.0
            self.hud_t = 1.0
            self.result_t = 0.0
        if self.in_wheelie:
            self.wd += self.v * dt
            self.wt += dt
        if self.th >= CRASH_RAD:
            self.crash()
            return
        if landed:
            self.wmode = False
            self.landing = False
            if self.in_wheelie:
                self.end_wheelie()
        self.update_bumps(s_before)
        if self.result_t > 0:
            self.result_t -= dt
            if self.result_t <= 0:
                self.l_big.hide()
                self.l_sub.hide()

    def update_bumps(self, s_before):
        """Gullydeckel: bump_pos > 0 = kommt noch, < 0 = schon überfahren."""
        if not BUMPS:
            return
        if self.s + 8 > self.next_bump:
            i = 0 if abs(self.bump_pos[0]) < abs(self.bump_pos[1]) else 1
            self.bump_pos[i] = self.next_bump
            self.next_bump += random.uniform(25, 55)
        for i in range(2):
            p = self.bump_pos[i]
            if p > 0 and s_before < p <= self.s:
                self.bump_pos[i] = -p
                self.hop_t = 0.1
                if self.th > 0:
                    k = 0.4 + 0.6 * self.v / VMAX
                    self.om += random.uniform(-0.7, 1.1) * k
                self.sound.play(((90, 0.05),))

    def start_burnout(self):
        self.burn_t = 0.0
        self.hud_t = 1.0
        self.result_t = 0.0
        self.mark_bmp.fill(0)
        self.mark_s = self.s
        self.mark_len = 0
        self.l_big.set("BURNOUT!", 80, 14, 1)
        self.l_sub.hide()

    def update_burnout(self, dt):
        self.burn_t += dt
        self.mark_s = self.s                      # Spur bleibt unterm Hinterrad
        n = min(40, int(self.burn_t * 30))        # Reifenspur wird länger
        if n > self.mark_len:
            rect(self.mark_bmp, 40 - n, 0, 40 - self.mark_len, 2, 1)
            self.mark_len = n
        self.smoke_acc += dt * 16                 # ca. 16 Rauchwolken pro Sekunde
        while self.smoke_acc >= 1:
            self.smoke_acc -= 1
            self.smoke.emit(REAR_X - 3 + random.randint(-2, 2), AXLE_Y + 3)
        self.hud_t += dt
        if self.hud_t >= 0.1:
            self.hud_t = 0.0
            self.l_sub.set("%.1f S" % self.burn_t, 80, 33, 1)

    def end_burnout(self, gas):
        if self.result_t <= 0:
            self.l_big.hide()
            self.l_sub.hide()
        if gas and self.burn_t >= 1.0:            # B losgelassen, A noch drin: Turbo-Start
            self.boost_t = 1.5
            self.toast("LAUNCH!")
            self.sound.play(((392, 0.06), (587, 0.06), (880, 0.12)))

    def end_wheelie(self):
        self.in_wheelie = False
        if self.wd < MIN_WHEELIE:
            self.l_big.hide()
            self.l_sub.hide()
            return
        self.result_t = 3.0
        self.l_big.set("%.1f M" % self.wd, 80, 14, 1)
        if self.wd > self.store.best:
            self.store.best = self.wd
            self.store.save()
            self.record_t = 2.5
            self.l_sub.set("NEUER REKORD!", 80, 33, 1)
            self.sound.play(((523, 0.09), (659, 0.09), (784, 0.09), (1047, 0.25)))
        else:
            d = self.wd
            word = ("OK!" if d < 10 else "NICE!" if d < 30 else "STARK!" if d < 80 else
                    "MEGA!" if d < 200 else "WAHNSINN!" if d < 500 else "LEGENDE!")
            self.l_sub.set("%s  %.1f S" % (word, self.wt), 80, 33, 1)
            self.sound.play(((880, 0.06), (1175, 0.1)))

    def crash(self):
        self.state = CRASH
        self.in_wheelie = False
        self.wmode = False
        self.landing = False
        self.crash_t = 0.0
        self.shake_t = 0.4
        self.result_t = 0.0
        self.l_big.set("GESTÜRZT!", 80, 14, 1)
        if self.wd >= MIN_WHEELIE:
            self.l_sub.set("%.1f M ZÄHLT NICHT" % self.wd, 80, 33, 1)
        else:
            self.l_sub.set("AUTSCH!", 80, 33, 1)
        self.sound.play(((220, 0.08), (165, 0.08), (110, 0.12), (70, 0.2)))

    def update_crash(self, dt):
        self.crash_t += dt
        limit = math.radians(100)
        if self.th < limit:
            self.om += 6.0 * dt
            self.th = min(self.th + self.om * dt, limit)
        self.v = max(0.0, self.v - 7.0 * dt)
        self.s += self.v * dt
        if self.crash_t > 1.0:
            if int(self.t * 2.5) % 2 == 0:
                self.l_prompt.set("A = NOCHMAL", 80, 62, 1)
            else:
                self.l_prompt.hide()
            if self.btn.pressed & (BTN_A | BTN_START):
                self.l_prompt.hide()
                self.l_big.hide()
                self.l_sub.hide()
                self.state = PLAY
                self.reset_ride()

    # ---------------- Zeichnen ----------------
    def frame_index(self):
        deg = math.degrees(self.th)
        if deg <= CRASH_DEG:
            return min(int(deg / FRAME_STEP + 0.5), N_PLAY - 1)
        k = int((deg - CRASH_DEG) / ((100 - CRASH_DEG) / 4) + 0.5)
        return N_PLAY - 1 + min(k, 4)

    def draw(self, dt):
        playing = self.state != TITLE
        # Nur schmale Streifen und kleine Sprites bewegen sich
        px = int(self.s * PX_PER_M)
        self.seams.x = -(px % 32)
        self.seams.hidden = self.v > 14      # bei hohem Tempo würden sie flackern
        self.dashes.x = -(px % 96)
        fx = int(self.s * PX_PER_M * 0.9)
        for tg, off, w in self.props:
            x = (off - fx) % PROP_PERIOD - 30
            if -w < x < W:
                tg.x = x
                tg.hidden = False
            else:
                tg.hidden = True
        for i in range(2):
            x = REAR_X + int((abs(self.bump_pos[i]) - self.s) * PX_PER_M) - 6
            if -12 < x < W:
                self.bumps[i].x = x
                self.bumps[i].hidden = False
            else:
                self.bumps[i].hidden = True

        # Wackeln beim Sturz
        if self.shake_t > 0:
            self.shake_t -= dt
            self.world.x = random.randint(-2, 2) if self.shake_t > 0 else 0
            self.world.y = random.randint(-2, 2) if self.shake_t > 0 else 0

        # Scooter-Bild passend zum Winkel zeigen
        i = self.frame_index()
        if i != self.frame:
            self.frames[i].hidden = False
            self.frames[self.frame].hidden = True
            self.frame = i
        if self.hop_t > 0:
            self.hop_t -= dt
        self.rider.y = -1 if self.hop_t > 0 else 0
        self.rider.x = int(self.t * 30) % 2 if self.burn and self.state == PLAY else 0

        # Burnout: Rauch und Reifenspur
        dpx = px - self.last_px
        self.last_px = px
        self.smoke.update(dt if self.state != PAUSE else 0, dpx if 0 <= dpx < 100 else 0)
        x = REAR_X + 3 - 40 + int((self.mark_s - self.s) * PX_PER_M)
        if self.mark_len and -40 < x < W:
            self.mark.x = x
            self.mark.hidden = False
        else:
            self.mark.hidden = True

        # Anzeigen (nur neu schreiben, wenn sich etwas ändert)
        key = (int(self.store.best * 10), playing)
        if key != self.best_key:
            self.best_key = key
            if playing:
                self.l_best.set("REKORD %.1f M" % self.store.best, 2, 2)
            else:
                self.l_best.set("REKORD %.1f M" % self.store.best, 80, 57, 1)
        kmh = int(self.v * 3.6 + 0.5)
        if playing and kmh != self.kmh:
            self.kmh = kmh
            self.l_speed.set("%d KM/H" % kmh, 158, 2, 2)
        if self.state == TITLE:
            self.kmh = -1
        show_meter = self.state == PLAY and self.in_wheelie
        if show_meter:
            self.hud_t += dt
            if self.hud_t >= 0.1 and self.wd >= 0.3:
                self.hud_t = 0.0
                self.l_big.set("%.1f M" % self.wd, 80, 14, 1)
                self.l_sub.set("%.1f S" % self.wt, 80, 33, 1)
            self.marker.x = 38 + int(min(self.th / CRASH_RAD, 1.0) * 81)
        self.meter.hidden = not show_meter
        self.marker.hidden = not show_meter

        # Rekord blinkt
        if self.record_t > 0:
            self.record_t -= dt
            self.l_sub.color(0xFFE27A if int(self.t * 8) % 2 or self.record_t <= 0 else 0xFF6A3C)

        self.update_leds()

    def update_leds(self):
        L = self.leds
        if self.state == CRASH:
            L.set(40 if int(self.t * 6) % 2 else 0, 0, 0)
        elif self.record_t > 0:
            h = (self.t * 3) % 3
            L.set(*((30 * (1 - h), 30 * h, 0) if h < 1 else
                    (0, 30 * (2 - h), 30 * (h - 1)) if h < 2 else
                    (30 * (h - 2), 0, 30 * (3 - h))))
        elif self.state == PLAY and self.burn:
            L.set(40, 8 + 12 * (int(self.t * 15) % 2), 0)
        elif self.state == PLAY and self.in_wheelie:
            f = min(self.th / CRASH_RAD, 1.0)
            L.set(int(40 * min(1, f * 1.6)), int(30 * min(1, (1 - f) * 2.2)), 0)
        elif self.state == TITLE:
            L.set(0, 6, 8)
        else:
            L.set(0, 0, 0)


def main():
    display = board.DISPLAY
    game = Game(display)
    display.auto_refresh = False
    last = time.monotonic_ns()
    try:
        while True:
            now = time.monotonic_ns()
            dt = min((now - last) / 1e9, 0.1)
            last = now
            game.step(dt)
            display.refresh()
            spent = (time.monotonic_ns() - now) / 1e9
            if spent < FRAME:
                time.sleep(FRAME - spent)
    finally:
        display.auto_refresh = True


# Im Simulator (tools/simulator.py) wird das Spiel ferngesteuert,
# auf dem PyBadge startet es direkt hier.
if not getattr(board, "SIMULATED", False):
    main()
