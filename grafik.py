# Grafik + Hardware für E-SCOOTER WHEELIE (gehört zu code.py - BEIDE Dateien
# müssen auf dem Laufwerk CIRCUITPY liegen!)
#
# Die Bilder (Scooter, Fahrer, Stadt, Schrift ...) stehen fertig gezeichnet ganz
# unten in dieser Datei, als Kommentar-Zeilen. Kommentare kosten auf dem PyBadge
# keinen Arbeitsspeicher. Beim Start liest die Datei einfach ihre eigenen letzten
# Zeilen. Während der Fahrt werden nur noch fertige Bildchen verschoben: das ist
# schnell und erzeugt keinen Speicher-Müll, deshalb ruckelt es nicht.
# (Gezeichnet werden die Bilder auf dem Computer mit tools/bilder.py.)

import binascii
import gc
import random
import struct

import board
import displayio
import keypad
from bitmaptools import fill_region

VERSION = 5                   # code.py prüft, ob beide Dateien zusammenpassen
REAR_X, AXLE_Y = 48, 112      # Hinterachse auf dem Bildschirm
STEP = 3                      # ein Scooter-Bild alle 3 Grad
NF = 24                       # so viele Scooter-Bilder gibt es (0 bis 69 Grad)
NP = 3                        # Posen: 0 stehen, 1 halb in der Hocke, 2 Hocke
NL, NT, NU = 48, 17, 12       # Anzahl Bilder: Beine / Oberkörper / Arme hoch
NS = 12                       # Anzahl Bilder vom freien Bein, das im Wheelie schwingt

COLORS = (("MINT", 0x19C2A0), ("BLAU", 0x2F7DE1), ("PINK", 0xFF5FA2), ("FEUER-ROT", 0xE8322B),
          ("SCHWARZ", 0x3A3A46), ("GOLD", 0xFFC83D), ("REGENBOGEN", -1), ("NEON-GRÜN", 0x9DFF3A),
          ("LILA", 0x9B5DE5), ("ORANGE", 0xFF8A1F), ("WEISS", 0xF2F2F6), ("EIS-BLAU", 0x8FE8FF))

# Pixel-Schrift: diese Zeichen gibt es (in dieser Reihenfolge)
FONT_CHARS = " 0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZÄÖÜ.:!-/=+?()><"
FONT_INDEX = {c: i for i, c in enumerate(FONT_CHARS)}


class Bilder:
    # liest die vorgezeichneten Bilder vom Ende dieser Datei (immer der Reihe nach)

    def __init__(self):
        try:
            f = open(__file__, "rb")
        except (NameError, OSError):
            f = open("/grafik.py", "rb")
        self.f = f
        line = b"-"
        while line and not line.startswith(b"# ==BILDER=="):
            line = f.readline()

    def _head(self, name, least):
        p = str(self.f.readline(), "utf-8").split()
        if len(p) < least or p[1] != name:
            raise RuntimeError("grafik.py ist kaputt - bitte neu kopieren")
        return p

    def get(self, name, transparent=True):
        # nächstes Bild -> (Bitmap, Palette). Jede Zeile der Datei ist eine Bildzeile,
        # jedes Byte darin ein Farb-Lauf: (Länge - 1) << bits | Farbe
        p = self._head(name, 6)
        w = int(p[2])
        h = int(p[3])
        n = len(p) - 4
        gc.collect()                        # aufräumen, damit das Bild sicher Platz findet
        bmp = displayio.Bitmap(w, h, n)
        pal = displayio.Palette(n)
        for i in range(n):
            pal[i] = int(p[4 + i], 16)
        if transparent:
            pal.make_transparent(0)
        s = 2 if n <= 4 else 4
        m = (1 << s) - 1
        read = self.f.readline
        for y in range(h):
            x = 0
            for b in binascii.unhexlify(read()[1:].strip()):
                k = x + (b >> s) + 1
                if b & m:
                    fill_region(bmp, x, y, k, y + 1, b & m)
                x = k
        return bmp, pal

    def grid(self, name, count=1, transparent=True, x=0, y=0):
        # nächstes Bild als TileGrid; count = so viele Kacheln liegen nebeneinander
        bmp, pal = self.get(name, transparent)
        return displayio.TileGrid(bmp, pixel_shader=pal, width=1, height=1,
                                  tile_width=bmp.width // count, tile_height=bmp.height,
                                  x=x, y=y)

    def data(self, name):
        return binascii.unhexlify(self._head(name, 3)[2])

    def close(self):
        self.f.close()


def rect(bmp, x0, y0, x1, y1, c):
    # Rechteck füllen (x1/y1 exklusiv), am Rand abgeschnitten
    x0 = max(0, x0)
    y0 = max(0, y0)
    x1 = min(bmp.width, x1)
    y1 = min(bmp.height, y1)
    if x1 > x0 and y1 > y0:
        fill_region(bmp, x0, y0, x1, y1, c)


def make_palette(colors, transparent=True):
    p = displayio.Palette(len(colors))
    for i, c in enumerate(colors):
        p[i] = c
    if transparent:
        p.make_transparent(0)
    return p


def rainbow(h):
    # Regenbogenfarbe für h zwischen 0 und 1 (ohne Speicher zu verbrauchen)
    x = int(h * 1530) % 1530
    i = x // 255
    f = x % 255
    if i == 0:
        return 0xFF0000 | (f << 8)
    if i == 1:
        return ((255 - f) << 16) | 0xFF00
    if i == 2:
        return 0x00FF00 | f
    if i == 3:
        return ((255 - f) << 8) | 0xFF
    if i == 4:
        return (f << 16) | 0xFF
    return 0xFF0000 | (255 - f)


class Label:
    # ein Text aus Kacheln der Pixel-Schrift

    def __init__(self, font, parent, n, color, scale=1, shadow=0x101018, bg=None):
        # bg = Farbe hinter der Schrift (None = durchsichtig)
        self.n = n
        self.scale = scale
        self.g = displayio.Group(scale=scale)
        self.pal = make_palette((bg or 0, color, shadow), bg is None)
        self.tg = displayio.TileGrid(font, pixel_shader=self.pal, width=n, height=1,
                                     tile_width=6, tile_height=8)
        self.g.append(self.tg)
        self.g.hidden = True
        parent.append(self.g)
        self.text = ""

    def set(self, text, x, y, align=0):
        # align: 0 = links, 1 = Mitte, 2 = rechts (bezogen auf x)
        old = self.text
        if text != old:                   # nur die Zeichen neu setzen, die sich ändern
            for i in range(self.n):
                c = text[i] if i < len(text) else " "
                if c != (old[i] if i < len(old) else " "):
                    self.tg[i] = FONT_INDEX.get(c, 0)
            self.text = text
        w = (len(text) * 6 - 1) * self.scale
        if align == 1:
            x -= w // 2
        elif align == 2:
            x -= w
        self.g.x = x
        self.g.y = y
        self.g.hidden = False

    def hide(self):
        self.g.hidden = True


class Rider:
    # Scooter + Fahrer aus vorgezeichneten Bildchen. Während der Fahrt werden nur
    # Kachel-Nummern und Positionen aus einer Tabelle gesetzt (kein Rechnen).

    def __init__(self, L):
        self.g = g = displayio.Group()      # Nullpunkt = Hinterachse
        self.key = -99
        self.hy = -30                       # Höhe der Hüfte über der Hinterachse (Pixel, minus = oben)
        self.sc = L.grid("sc", NF)
        self.bleg = L.grid("bleg", NL)      # hinteres Bein auf dem Trittbrett ...
        self.swing = L.grid("swing", NS)    # ... oder frei in der Luft (im Wheelie)
        self.legs = L.grid("legs", NL)
        self.torso = L.grid("torso", NT)
        self.bar = L.grid("bar", NP * NF)
        self.up = L.grid("up", 2 * NU)
        for tg in (self.sc, self.bleg, self.swing, self.legs, self.torso, self.bar, self.up):
            g.append(tg)
        self.tab = t = L.data("tab")
        # diese Paletten-Plätze bekommen die gewählte Farbe: Scooter und Helm
        self.tint = [(self.sc.pixel_shader, 2), (self.torso.pixel_shader, 5)]
        self.cr = []                        # zwei Bilder für den Sturz
        k = NP * NF * 17
        for name in ("cr0", "cr1"):
            tg = L.grid(name, 1, True, t[k] - 128, t[k + 1] - 128)
            k += 2
            tg.hidden = True
            g.append(tg)
            self.cr.append(tg)
            self.tint.append((tg.pixel_shader, 2))
            self.tint.append((tg.pixel_shader, 11))
        self.ox = t[k] - 128
        self.oy = t[k + 1] - 128
        self.show(0, 0, 0)

    def color(self, rgb):
        for pal, i in self.tint:
            pal[i] = rgb

    def _normal(self, on):
        self.sc.hidden = not on
        self.legs.hidden = not on
        self.torso.hidden = not on
        if not on:
            self.bar.hidden = True
            self.up.hidden = True
            self.bleg.hidden = True
            self.swing.hidden = True

    def show(self, i, pose, arms, s=-1):
        # i = Bild-Nummer (Winkel / 3 Grad); pose: 0 stehen, 1 halb, 2 Hocke;
        # arms: 0 normal, 1 Einhänder, 2 No-Hander; s: Bild vom freien Bein (-1 = steht)
        key = i + arms * 32 + pose * 128 + (s + 1) * 512
        if key == self.key:
            return
        if self.key < 0:
            if self.key > -9:
                self.cr[-1 - self.key].hidden = True
            self._normal(True)
        self.key = key
        f = i + NF * pose
        k = f * 17                          # 17 Bytes pro Bild: Kachel-Nummern und Positionen
        t = self.tab
        g = self.sc
        g[0] = i
        g.x = t[k] - 128
        g.y = t[k + 1] - 128
        g = self.legs
        g[0] = t[k + 2]
        g.x = t[k + 3] - 128
        g.y = t[k + 4] - 128
        g = self.torso
        g[0] = t[k + 5]
        g.x = t[k + 6] - 128
        g.y = t[k + 7] - 128
        g = self.bar
        g.hidden = arms == 2
        g[0] = f
        g.x = t[k + 8] - 128
        g.y = t[k + 9] - 128
        g = self.up
        g.hidden = arms == 0
        g[0] = t[k + 10] + (NU if arms == 2 else 0)
        g.x = t[k + 11] - 128
        g.y = t[k + 12] - 128
        g = self.bleg
        g.hidden = s >= 0
        g[0] = t[k + 2]
        g.x = t[k + 13] - 128
        g.y = t[k + 14] - 128
        self.hy = t[k + 16] - 128
        g = self.swing
        g.hidden = s < 0
        g[0] = s if s > 0 else 0
        g.x = t[k + 15] - 128 + self.ox
        g.y = self.hy + self.oy

    def crash(self, k):
        # Sturz-Bild k (0 oder 1)
        if self.key == -1 - k:
            return
        if self.key >= 0 or self.key < -9:
            self._normal(False)
        else:
            self.cr[-1 - self.key].hidden = True
        self.cr[k].hidden = False
        self.key = -1 - k


def make_strip(w, h, color, w_on, y, count):
    # count Kacheln nebeneinander: z. B. der Mittelstreifen, der vorbeizieht
    bmp = displayio.Bitmap(w, h, 2)
    rect(bmp, 0, 0, w_on, h, 1)
    return displayio.TileGrid(bmp, pixel_shader=make_palette((0, color)),
                              width=count, height=1, tile_width=w, tile_height=h, y=y)


class Puffs:
    # Rauch, Staub und Boost-Flammen: ein paar Bildchen, die immer wieder benutzt werden

    def __init__(self, parent, sheet, pal, n=12):
        self.n = n
        self.tg = []
        for _ in range(n):
            tg = displayio.TileGrid(sheet, pixel_shader=pal, width=1, height=1,
                                    tile_width=12, tile_height=12)
            tg.hidden = True
            parent.append(tg)
            self.tg.append(tg)
        self.x = [0.0] * n
        self.y = [0.0] * n
        self.vx = [0.0] * n
        self.vy = [0.0] * n
        self.age = [0.0] * n
        self.life = [0.0] * n
        self.kind = [0] * n

    def emit(self, x, y, vx, vy, life, kind):
        # kind: 0 = Rauch (wird größer), 3 = Flamme (wird kleiner)
        life_ = self.life
        for i in range(self.n):
            if life_[i] <= 0:
                self.x[i] = x
                self.y[i] = y
                self.vx[i] = vx
                self.vy[i] = vy
                self.age[i] = 0.0
                life_[i] = life
                self.kind[i] = kind
                return

    def update(self, dt, scroll):
        life = self.life
        age = self.age
        for i in range(self.n):
            if life[i] <= 0:
                continue
            age[i] += dt
            tg = self.tg[i]
            if age[i] >= life[i]:
                life[i] = 0.0
                tg.hidden = True
                continue
            self.x[i] += self.vx[i] * dt - scroll
            self.y[i] += self.vy[i] * dt
            self.vx[i] *= 0.96
            f = min(2, int(age[i] / life[i] * 3))
            k = self.kind[i]
            tg[0] = k + 2 - f if k else f
            tg.x = int(self.x[i]) - 6
            tg.y = int(self.y[i]) - 6
            tg.hidden = False

    def clear(self):
        for i in range(self.n):
            self.life[i] = 0.0
            self.tg[i].hidden = True


# ------------------------------------------------------------------
# Hardware-Helfer: Knöpfe, LED, Ton, Speicher
# ------------------------------------------------------------------
class Buttons:
    def __init__(self):
        # Reihenfolge am Schieberegister: B, A, START, SELECT, rechts, runter, hoch, links
        self.keys = keypad.ShiftRegisterKeys(
            clock=board.BUTTON_CLOCK, data=board.BUTTON_OUT,
            latch=board.BUTTON_LATCH, key_count=8, value_when_pressed=True)
        self.ev = keypad.Event()
        self.held = 0
        self.pressed = 0
        self.released = 0

    def poll(self):
        self.pressed = 0
        self.released = 0
        ev = self.ev
        q = self.keys.events
        while q.get_into(ev):
            bit = 1 << ev.key_number
            if ev.pressed:
                self.held |= bit
                self.pressed |= bit
            else:
                self.held &= ~bit
                self.released |= bit
        if q.overflowed:
            q.clear()
            self.keys.reset()
            self.held = 0


class Pixels:
    # die NeoPixel-LED unter dem Bildschirm (ohne Zusatz-Bibliothek)

    def __init__(self):
        self.last = -1
        self.buf = bytearray(15)
        try:
            import digitalio
            import neopixel_write
            self.pin = digitalio.DigitalInOut(board.NEOPIXEL)
            self.pin.switch_to_output()
            self.write = neopixel_write.neopixel_write
        except Exception:  # pylint: disable=broad-except
            self.pin = None

    def set(self, rgb):
        if rgb == self.last or self.pin is None:
            return
        self.last = rgb
        buf = self.buf
        for i in range(0, 15, 3):
            buf[i] = (rgb >> 8) & 255
            buf[i + 1] = rgb >> 16
            buf[i + 2] = rgb & 255
        try:
            self.write(self.pin, buf)
        except Exception:  # pylint: disable=broad-except
            self.pin = None


class Sound:
    # einfache Töne über den eingebauten Lautsprecher (synthio)

    def __init__(self, on):
        self.ok = False
        self.on = on
        self.seq = ()
        self.pos = 0
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
                self.seq = ()
                self._next()

    def play(self, notes):
        # notes: ((Frequenz, Dauer), ...)
        if self.ok and self.on:
            self.seq = notes
            self.pos = 0
            self._next()

    def _next(self):
        try:
            if self.cur is not None:
                self.synth.release(self.cur)
                self.cur = None
            if self.pos < len(self.seq):
                f, self.t = self.seq[self.pos]
                self.pos += 1
                self.cur = self.synthio.Note(frequency=f, waveform=self.sq,
                                             envelope=self.env, amplitude=0.3)
                self.synth.press(self.cur)
        except Exception:  # pylint: disable=broad-except
            self.ok = False

    def update(self, dt, speed, gas, wild):
        # speed 0..1; wild = Burnout oder Boost (Motor heult, Reifen quietscht)
        if not self.ok:
            return
        if self.cur is not None:
            self.t -= dt
            if self.t <= 0:
                self._next()
        try:
            amp = 0.0
            freq = 150 + 600 * speed + (50 if gas else 0)
            if wild == 1:
                amp = 0.12
                freq = 650 + random.randint(-80, 80)
            elif wild:
                amp = 0.14
                freq += 300
            elif speed > 0.02:
                amp = 0.04 + (0.05 if gas else 0.0)
            self.engine.amplitude = amp if self.on else 0.0
            self.engine.frequency = freq
        except Exception:  # pylint: disable=broad-except
            self.ok = False


class Store:
    # Rekorde, Farbe und Ton im nvm-Speicher (bleibt nach dem Ausschalten erhalten)

    def __init__(self):
        self.best = 0.0         # längster Wheelie (m)
        self.tbest = 0          # bester Trick-Wert
        self.sound = True
        self.color = 0
        self.nvm = None
        try:
            import microcontroller
            nvm = microcontroller.nvm
            self.nvm = nvm
            if nvm is not None and len(nvm) >= 18 and bytes(nvm[0:2]) == b"EW":
                self.sound = nvm[2] != 0
                best, tb = struct.unpack("<ff", bytes(nvm[4:12]))
                if best == best and 0 <= best < 1e6:   # NaN-Schutz
                    self.best = best
                if tb == tb and 0 <= tb < 1e9:
                    self.tbest = int(tb)
                if nvm[3] >= 2 and nvm[17] < len(COLORS):
                    self.color = nvm[17]
        except Exception:  # pylint: disable=broad-except
            self.nvm = None

    def save(self):
        if self.nvm is None:
            return
        try:
            self.nvm[0:12] = (b"EW" + bytes((1 if self.sound else 0, 3)) +
                              struct.pack("<ff", self.best, self.tbest))
            self.nvm[17:18] = bytes((self.color,))
        except Exception:  # pylint: disable=broad-except
            pass


# ==BILDER== (automatisch erzeugt von tools/bilder.py - nicht ändern)
#@ font 312 8 000000 ffffff 101018
#18090c010c0904110c01041108050411040908090809040d080904090811001104090401080104090c0900010801000110010801000108010409040d0809040d080d0011000108010001080100010801000108010001080100110401000108010001080100013c016c091001080110011801
#140100060104050204010006010406010604050200011200010006040a0102010006010001000601000100060100010a010001000601000106010401120112010006010001020401020401060c010601020001000201020c0500050201020401020100060100010a01000100060100010a010001000e0002010a01020401020102040102010204010201020401020102040102000a01020402000208020002080200021c051001022c0120010801000601080100020801100110010002
#1401020005020401020802040102040100020401000102000d0401000214010002010204010201020401020102040102010204010201020802010204010001020c01020c0102080201020401020401021001020001020100020001020c0102010001020504010201020401020102040102010204010201020401020102140102040102040102010204010201020401020001000100020001000100020801000200090809040108011c05020c010228010002110801020802040102000100021001100108010002
#14010201000102040102100100020801040100020102040a01000d0c01000204090002000d0211020d000201020c01020401020d040d04010209001102040102100102000500020401020c01020102010201020100010201020401020d000201020401020d000200090c01020401020401020102040102010201000102040100020801000208010002000100060100010006010001020401021c060c010208090c0100020412110c010002000102140102100100010002
#1405000201020401020c01000210010011100102010a0104010002040100060108060102010a0102010a010001020c0102040102010e00010e00010200020102010a0102040102100102000102010801020c01020002010201020005020102040102010e00010201000102010201060806010801020401020401020102040102010201020102000100010c0102080100020411020102040102010204010218051001020c0a0401000204110402010a040100020401021401020c0100020001
#140106000102040102080100020401080102000601060108010201020401020001020801020401020801000201020401020102040102010204010001020001000201020c01020c01020401020102040102040102040104010200010200010401020c01020401020102040102010204010201020c0102000100020102000114010204010204010204010200010001000201020102010201000200010801020401000208010a01020102040102010204010200050c050210021c0100020c1204010210020c0110010002080100020801
#18090002000904110409000208010204090002000900020001020c090002000500020001020401020d0002000900020900020011000102100d020102040102000908050002000102040100110001020401020102040102000900020102100500010001020401000d000204010208090002040100020401000100020102040102040102041100010204010200090002000900020005020c060c01240230020c01140108010002080100021001
#1c0a080a0412040a1002080a080a0802100a080608020802000e080a040a08120002140e00020802040a08060802080200120002080200020802040a04021406000200020802000e0c020c0a0c020c020002040208020802081200020802040a080a0806280270021402080210021802
#@ sky 160 53 3e8ede 6fb4ee ffe27a ffffff
#
#
#
#
#
#
#
#
#
#
#fcf402000200020002
#fcf00200020002000200020002
#fcec02001a00020002
#fce802002a0002
#fce40200320002
#fce002003a0002
#fcdc020042
#fcd80200420002
#fcdc4a0002
#fcd802004a
#fcdc4a0002
#fcd802004a
#fcdc4a0002
#fcd802004a
#fcdc0200420002
#fce0420002
#fcdc02003a0002
#0401080108010801080108010801080108010801080108010801080108010801080108010801080108010801080108010801080108010801080108010402013200020108010801080108010801
#000100010001000100010001000100010001000100010001000100010001000100010001000100010001000100010001000100010001000100010001000100010001000100010001000100010001000100010001000100010001000100010001000100010001000100010001000100010001000100010001000102012a01020100010001000100010001000100010001000100010001
#0009000900090009000900090009000900090009000900090009000900090009000900090009000900090009000900090009000900090009000900090005020002011a0102000900090009000900090009
#fded020102010201020102010261
#fd350bb50201020102010265
#fd3113fd35
#fd2d1bfd31
#fd252ffd25
#6503b537fd21
#591ba547fd15
#5523a14bfd11
#512b0103954ba10b61
#4d438d47991b59
#41538d2f010b992355
#3d5701039113b92f49
#3d678d0bb53f41
#3d6bfd454741
#396ffd455335
#3d6ffd3d5b31
#3d6bfd415f2d
#3d6bfd415f2d
#413b01030913fd495b2d
#4d0305231903fd513f011331
#5d1bfd7d27150b35
#6903fd951b59
#fdfd0d0b61
#@ town 160 45 a8d8f5 6fb4ee 9db9da b9d0ea f0e7d3 f3c9a2 c3e0cc cbd8ea b04e3e 5c6781 6c8db8 ffffff 7a4e36 55b462 3d8f4b 6b4a2b
#f1f1f1f1f1f1f1f1f1f1
#f1f1f1f1f1f1f1f1f1f1
#f1f1f1f1f1f1f1f1f1f1
#110021002100210021002100210021002100210021002100210021002100210021002100210021002100210021002100210021002100210021002100210021002100210021002100210021002100210001
#00010001000100010001000100010001000100010001000100010001000100010001000100010001000100010001000100010001000100010001000100010001000100010001000100010001000100010001000100010001000100010001000100010001000100010001000100010001000100010001000100010001000100010001000100010001000100010001000100010001000100010001000100010001
#01200120181001200120012001200120012001200120012001200120012001200120012001200120012001200120012001200120012001200120012001200120012001200120012001200120012001
#6038f0d0f9f9d9
#5058f0c0f9f9d9
#4078f0c0f4f4b4
#3098f0b0f4f4b4
#20b8f0a0f4f4b4c018f090f9f909
#10d8f090446b146b146b146b44b038f080f9f909
#00f8f080440b4a0b140b4a0b140b4a0b140b4a0b44a058f080f7f7
#f818f070440b4a0b140b4a0b140b4a0b140b4a0b449078f070f7f7
#f82852f000446b146b146b146b448098f060f7f7
#f83842f000440b4a0b140b4a0b140b4a0b140b4a0b4470b8f050176b176b176b172b
#f84832f000440b4a0b140b4a0b140b4a0b140b4a0b4460d872c0170b4a0b170b4a0b170b4a0b170b1a
#f8580312f000440b4a0b140b4a0b140b4a0b140b4a0b4450f862c0170b4a0b170b4a0b170b4a0b170b1a
#f86812500d000e70446b146b146b146b4440f81852200d000e60176b176b176b172b
#f87802206d1e40f4f4b430f838426d1e30170b4a0b170b4a0b170b4a0b170b1a
#f888108d2e20f4f4b420f858228d2e10170b4a0b170b4a0b170b4a0b170b1a
#f57502108d3e10f4f4b410f878128d3e00170b4a0b170b4a0b170b4a0b170b1a
#f57502108d3e10f4f4b400f898028d3e00176b176b176b172b
#f5750200ad3e00f4f4b410f67602ad3ef7f7
#2b156b156b2502000e8d4e00f4f4b410f676020e8d4ef7f7
#1a0b150b4a0b150b4a0b2502000e8d0e0d2e00f4f4b410f676020e8d0e0d2ef7f7
#1a0b150b4a0b150b4a0b25021ecd1ef4f4b410366b166b361ecd0ef7f7
#2b156b156b2502001ebd0e02f4f4b410360b4a0b160b4a0b36021ebd0ef7f7
#1a0b150b4a0b150b4a0b2502004e0d1e6d02f4f4b410360b4a0b160b4a0b36024e0d1e6df7f7
#1a0b150b4a0b150b4a0b2502008e4d0e02f4f4b410366b166b36028e4d0ef7f7
#1a0b150b4a0b150b4a0b2502107e4d12f4f4b410360b4a0b160b4a0b36127e4d00f7f7
#2b156b156b2502109e0d1e12f4f4b410360b4a0b160b4a0b36129e0d1e00f7f7
#f575021002ae22f4f4b410360b4a0b160b4a0b3622ae0200f7f7
#f5750210226e42f4f4b410366b166b3622106e2200f7f7
#f5750210420f0e0f62f4f4b410f6762210120f0e0f02131200f7f7
#f57502101213022f62f4f4b410f6762210122f02131200f7f7
#555cb502101213022f62f4f4b410865c862210122f4200f7f7
#555cb50210422f62f4f4b410865c862210122f4200f7f7
#555cb50210422f62f4f4b410865c862210122f4200f7f7
#555cb50210422f62f4f4b410865c862210122f4200f7f7
#553c0b0cb50210422f62f4f4b410863c0b0c862210122f4200f7f7
#555cb50210422f62f4f4b410865c862210122f4200f7f7
#555cb50210422f62f7f7b710865c862210122f4200f4f4
#555cb50210422f62f7f7b710865c862210122f4200f4f4
#555cb50210422f62f7f7b710865c862210122f4200f4f4
#@ road 160 30 3b3b45 b9b9c3 7a7a86 8e8e99
#fdfd7d
#190349034903490349034903490349032d
#190349034903490349034903490349032d
#190349034903490349034903490349032d
#190349034903490349034903490349032d
#190349034903490349034903490349032d
#fefe7e
#fefe7e
#fefe7e
#
#ffff7f
#
#
#
#
#
#
#
#
#
#
#
#
#
#
#
#
#
#
#
#@ lamp 9 40 000000 4a4f5a fff3b8 2e323a
#0413
#0413
#001b
#00031203
#00031203
#00031203
#00031203
#001b
#080f
#0c05
#0c05
#0c05
#0c05
#0c05
#0c05
#0c05
#0c05
#0c05
#0c05
#0c05
#0c05
#0c05
#0c05
#0c05
#0c05
#0c05
#0c05
#0c05
#0c05
#0c05
#0c05
#0c05
#0c05
#0c05
#0c05
#0c05
#080f
#080f
#080f
#080f
#@ tree 17 30 000000 55b462 3d8f4b 6b4a2b
#
#14010002
#081906
#04210a
#04210e
#04210e
#00290e
#00022112
#00022102010a
#063106
#00062d02
#0012010619
#00221102
#041e11
#04260106
#082a
#101a
#18030203
#180b
#180b
#180b
#180b
#180b
#180b
#180b
#180b
#180b
#180b
#180b
#180b
#@ sc 864 39 000000 17171c 19c2a0 a8aeb6
#5c11701570117411740d7c09800580058001800580018001800580018001800184018401840584058401880580018c01
#5c11701570117411701570117415740d7809780d7c05780d780d78057c097c057c0580097c0984097c09840508037009040378050803
#600a7c0a740100067805067805067409027c0d74117015700d7811700d740d02780d740d780978098009780906000770090204076c0904077009060b6c0508077009060b3411
#600a7c0a7c0a7c0680067c0a7801000674050a74090274050a700d02740906040368050a00036809060403640d020403680906000764090600076c0906000768090a0b6c050a0b68090a0b6c050e030268090a07380928050e030a241d
#6406800603780a0774060b740607780607780a07740600076801000a0003740a076801000a00036801040a07680104060b64050a0b6405000a0b64050e0764050e0b64090e076805040a030268090e030664090e03026809001e241120090e030a24191c09002e10090b09
#64060778060778060778020b74060b7406077c060774060b74060778060774060b7406077806036801040a076801040a036801080603026801040a03026801040a0302801264010c166001081a64010c1e141d18050c2210211c05142a091305
#64020b78060778060778020b78020380020380060778060774060b7406037c06037c0a7c0a74060302780e780e780e7812801278161c0d401a1815482200090b093c260d0f05501e0d0705
#640a7c0a7c0a7c0a7c0a7c0a800a780a7c0a7c0a780e7c0a7c0a780a7c0a781274127812801214114c1a0c19441a081d541a090b09481601020d0709600a0d0705
#640a7c0a8006800680068006800a7c0a7c0a7c0a780a7c0e7c0a780a7c0e780e780e7c12801208195416001d5016090f095c0e110309580e110309600e0f09
#640a80068006800a7c0a7c0a800a7c067c0a800a780a7c0e7c0a780a7c0e780e78127c0e10115c1209070d580e0102010f0954120d0b05640a0d0309600a1305680a15
#68068006800a7c0a7c0a7c0a800a7c0a7c0a7c0a7c0a7c0e7c0a780e780e7c0e780e0c1158120419600e050f05600e0d0705600a0d0705640a010f09600a010b096c0a11
#6806800a7c0a80068006800a800a7c0a7c0a7c0a7c0a7c0e7c0a780e7c0a7c0e08115c0e00195c0e090b09600a0d0705640a0d0705600a07010b05640e01030d640e11700e05
#6806800a8006800a7c0a7c0a800a7c0a7c0a800a7c0a7c0a800a780e7c0e00155c0e1d5c0e050b09600a090b05600a0d0705640a011305600e0f09680a116c0a0d780e
#680a80068006800a80068006840a7c0a7c0a800a780e7c0a800a195c0e0015600a1d600a050b095c0a090b05600a0d0705600e1305680a010b09640a156c0e09700e840a
#680a8006800a8006800a7c0a84068006800a7c0a7c0a800a1568061d60061d600a050b095c0a0d07055c0a0d0705600a0103050705640a01070d680a15680a11740e7c0a800e
#680a800a8006800a7c0a8006840a7c0a7c0a800a000d680a1568061d600a050b095c0a050b095c0a0d07055c0a0d07055c0a0103050705640a0f09640a156c0a116c0e800e7c0e800e
#6c06800a8006800a8006800a8406800a7c0a040570021d640619640a050709600a0907095c0a090b055c0a0d07055c0a0103050705600a0f09640a19640a0d780a7c0e800e7c0e800a
#6c06800a800a7c0a800a800600097406116c06156c0219680a15640a010b09600a0907095c0a030907055c0a0d07055c0a0103050705600a0f09600a19640a15680e800e7c0e7c0e7c0e800e
#00026406800a800609740a0d700a0d6c0e0d700a11680a15640a19600a090709600a090705600a030903095c0a070507055c0a01030507055c0a010f09600a15640a15680a00096c127c0e7c0e800e7c0e800a
#00060d4c0a09740a0d6c0e0d6c0a11680e11680a15680a050709640a050709600a090705600a0d0705600a090705600a070503095c0a010f095c0a010f095c0a19640a15640a0009700e780e800e7c0e7c0e800a800e
#000a11400e1104060d480e11680a15640e050309640a090309600e050709640a0907095c0e090705600a0907095c0a070507055c0a0103050705600a010f095c0a19600a19600a15640e00056c0e7c0e780e800e7c0e800e7c0e800e
#00010a03093c0e050309040a113c0e0507050402000d440a090709600a03050705600e03050705600a0d0705600e030903095c0a0103050705600a030903095c0a0113055c0a0113055c0a09030d5c0e15640a15640e00056812740e7c0e780e800e800a800e800a840a
#090e09340e0d030900010a0309380e0d03090e11380e030903090002000d400a01030903095c0a01030507055c0e07050705600a01030903095c0a01070107055c0a0113095c0a050b095c0a050b095c0a195c12040568120005641274127412780e7c0e800e7c0e800e7c0e800e
#0507015a070507110e09142a010705070500010a0309281a01070507050a152c16010705030902040d38120107010705580e0513055c0e050f055c0a050f095c0a050b09580e1d5c0e195816000d5c1278127012741274127812780e800e7c0e800e800a840a
#05070156010705070d0701560107010b110e09003a051309000e0309142a051305000a151c22090b090002040d281e090b0950160d070950161d58121d501a0011581600115416701674167012741274127c0e780e800e800e800e7c0e840a
#090b4e090f11070152090f11070152090b0900090e05420d0709040e0309083621000a15142a1d140d2026194c1e00194c1e00154c1a701a6c16701278127412741274127c0e780e840e7c0e800e800e800e
#000907094409070900090b3e101d00050705420c1d0005074a0c19040512013e081904120309043208150c06190c2a0c0d180d182210094c1e681a701a6c167016781274127412780e7c0e7c0e800e800e800a800e78090a
#001d441d04090709481504090b1e3415040507052a2c0d0805073a24051005463c16030900263c021d0822440d141e440d101a741670167016781274127412780e7c0e7c0e800e800e74090e74090e700d0e
#080d540d0c1d50051009070968090b12600507051e5405072e50053a441207092244021d041e441d001a540d0c1a500d0816580d0812781674127412780e7c12680d0e740d0e700d0a70110a70110a7409030e
#980d741d6c09070968090b0a0164050705166005072654013a4812070522441207051a541d1a501d16541916600d0412600d0412600d0012640d000e6c0d126411126c110e6c110e7009030e7009030e70091205
#fc280d741d6c09070968090b0a0168050705126005072258365036540e01070516500a05070116540200090701165c19125c190e60151260150e68150e6809070e7009070a7009030e70091205680912056c011a05
#fcb80d741d6c0907096c090f0205640507050e6405071e5c05071a5c325832582e640907011260090712640907126409070e6c09070e68051a016c091601680916016c011a0568011a056c0e050705
#fcfc480d741d7009070968090f0205640507050e640507050a016405031e60051e602a602e5c2a602a642668051a01642205682205681e05680e030507056412050705680a010f09
#fcfcd80d781d6c09070968090f020564090f0205640507050a016405070503060164050705030205602601602601602601602601642205640a0705030205680e03050705640e030507056806050f09640a010f09680200090709
#fcfcfc6c0d741d6c0907096c09070968090f020564090f0964090f096405070503020564050705030205640507050302056006010705030205640a070503020568090f096802090f096406050f0970090709680200090709741d
#fcfcfcfc0d741d6c1d6c0907096c0907096c09070968090f0964090f0964090f0964090f0968090f096c0907097409070970090709741d701d7c0d
#fcfcfcfc8c0d7c0d741d6c1d6c1d6c0907096c0907096c0907096c09070970090709701d741d701d7c0d800d
#fcfcfcfcfcac0d7c0d7c0d741d6c1d6c1d6c1d701d780d840d800d
#fcfcfcfcfcfcfc5c0d7c0d7c0d7c0d800d
#@ bleg 672 21 000000 25356e 33509a ededf2
#0c0d200d240d2c01200d30013001200d2c0130013001280d240d2c0130013001300130013001300130013001300130013c012c012c0128052c053001300130012c01300130012c05380130012c012c012c052c052c0928052c0928250c252c01
#0c0d200d240d200d200d28092809200d240928092809280d240d240928092809280928092809280d2409280d240d240d300d200d200d240928092809280928092809280d240d2011280928092409280d201120151c1d1419182110250c250c25
#1009200d2809200d240d240d240d200d200d240d240d2809280d200d240d240d240d240d240d2411200d240d240d24112c0d20111c111c112011240d240d2411201120151c151821181120111c112015181d142110250c250c250c250c250c25
#100d2009280d200d200d240d240d200d200d240d240d280d240d200d240d240d240d240d240d280d201120112011240d2c11200d200d20151c111c151c19181d141d14211021102510191819141d14250c250c250c250c250c250c250c250c25
#100d200d240d200d200d240d240d200d200d2411240d240d240d200d24112011200d240d280d2411200d240d241120112c111c111c1120151c111c1918191c1d141d141d141d141d141d1819141d1421101d141d181918192011240d240d0c150009
#100d200d240d200d200d280d240d2009240d240d2411200d240d240d240d240d240d240d240d28111c11240d240d24112c111c111c1120151c1120151c151c191c151c1918191c111c19181914191c191c11200d240d28092809280928092c09
#100d200d240d240d2009280d240d200d200d2411240d200d280d200d240d240d240d240d241128111c0d2411201124112c0d20111c112011201120151c152011240d2809280d2409241120111c11240d200d240d240d240d2809280928092c09
#100d200d240d240d200d240d240d200d200d280d24112009280d240d240d240d200d280d240d2c0d200d240d2411240d2c11200d200d240d240d2411240d280928092809280d240920151c151815200d200d240d240d2809280d240d28092c09
#1409200d2809240d200d280d240d1c0d240d240d280d2009280d240d240d240d240d240d2411280d200d2411240d241128111c11200d200d28092c092809280d28092809280928091c111c151c11240d200d240d2809280d28092805032805072c010301
#100d200d240d280920092c0d240d1c0d240d2809280d200d2809240d240d240d240d240d280d2c0d200d240d2411280d20111c11200d240d240d280d240d2809280d28092809280918111c151c112411200d2405030124050301280103012c050328010b24010b28050b
#0c0d24092809280d20092c092809200928092c092809240d28092809280928092809280d280930092409280d240d280d1c111c11200d240d240d2c0928092c0928092c0928092805031411200b0120050305280d2005030128010728010b24050728050b240b2c0b280507
#080d240d240d240d200d280d240d20092809280d28092809280d24092809280d240d2809280d2c09240d2809280d280d10112011200d240d280d280d28092c0928092c09280928050b04132013200f300b240f2413200f2c0b2c0b280b280b300b
#080d2409240d280924092c0928092409280928092c092809280d2409280d2809240d2809280d2c0d240d240d280d280d03080d201120112409280d2c09280d280503012805032c05032805072405070813201320132413200f280b280b2c0b2c0b300330033407
#040d240d240d240d200d280d240d200d240d28092c0928092c092409280d28092809280d28093009240d280d240d0328091b280b24050301280b2805032c09032805032c050724050b28010b24010b280b08036807340b24073003340330073403ac03
#000d2809240d280924092c0d2409240928092c09280d28092c0924092c092809280d2809280d2c090324090724090720090b20051f2013200f2413280f28050728010b2c0b280b2c0b2c0b2807bc03
#13240d240903240d24092c09240d24090324092c09280d280d0324090320092c090324090328090324090724090328050b24050724050b24050728010f30132013240b280f2c13200f2c0b280b300b280b3003
#1320132013240f201324090324050724010b2405032809032805072c010b24050b1c090328050724090724050b24050b20050b24010b28010b28010728010b2c07700730033007340b280b3007300338033003
#132013201320132013201320132013240f280f2413280f24131c010f24010f24010b24010b28010b28010b28072c0b2c0b2c0b3003fc24033403
#a40f24073013200b28072813240f280b300b2c07240f280b2c0b280f280b2c0b3003340330033403
#fc18033003640b2c07300734033403280b2c073007300730033403
#fcfce403
#@ swing 372 21 000000 25356e 33509a ededf2
#fcfcfcfcfc14017801
#440574017401fcdc017401740174056c09680d
#4409680d6809680d680d680d680d6809680d6809680d5c19
#4011640d680d640d680d680d680d640d641160155c195025
#44116011640d680d640d680d640d680d640d6015581d300b35
#48116011640d640d640d680d640d640d64115c15541d380b29
#4c116011600d640d640d6809680d640d60115c154825400b21
#5011600d6011600d6809640d640d640d60115819400725440b
#540d6011600d640d6409640d640d640d5c11541d440b115807
#580d600d600d640d6409640d640d600d5c154c0319500701
#5c0964096409640d6409640d600d601158114c0b0d5c07
#5c0d600d600d640964096409640d5c0d58155407056403
#600d6009600d64096409600d600d5c115407095c0b
#600d0758096409600d600d600d5c0d5c11540b056407
#64010f580d6009600d60096409600d5807095c0b
#680b6005075c09600d6009600d5c0309580f016407
#6807641358090003580d60096009600701600f6403
#d80f5c13580701600103055c0b015c0f640b
#d8036813581358135813600b6403
#fcb813581360076803
#fcfc38036403
#@ legs 912 20 000000 25356e 33509a ededf2
#0e380e380e380e380e380e380e380e380e380e380e380e380e380e380e380e380e38123412342a1c2e182e182e3016180e380e380e38123412342a380e440238123c06380e3c0a1c1a4c0a341630163412340e380e380e3c06380a3c0a3c0a
#0e380e380e380e380e380e38123412341234123416301234123416301a2c1e2822242a1c2a1c2e182e182e182e182e18123416301a2c2a1c2a1c2e182e2c1a281e30162c1a30121c2e182e182e182e281e2c1a30123412380e340e34123412
#1234123412341234123416301630163016301a2c1e281a2c1e2822242a1c2a1c2e182e183214321432143214321432141e28222426202e182e182e182e182e182e24222422281e182e182e182e182e182e2422281e281e2c1630162c1a2c1a
#1234123416301a2c16301a2c1e281a2c1e2822242620222426202a1c2e182e182e182e1832143214361036103610361026202a1c2a1c2e182e1832143214321432143214321c2a142e182e182e18321432142e20262026281e281a281e2822
#001234123812341630123416301a2c1a2c1e2c1e281e281e281e2822281e281e2c1e281e2c1a3c0e380e3c0a3c0e0c12140e181e2822281e30163412400a14160c0a1422000a141a080a1422000a141e040a141e040a380a1816080a18120c0e1412100a141a080a141e000e141e000e141e000e1c2a20222012000e20120012
#0412340e3c12341630123416341a2c16301a3016301a2c16301a301634123812380e3c0a3c0e3c0e380e380e380e38121c1a301634123c0e380e3c0a3c0a140e140e100e140e10160c0e10160c0e101a080e340e380a3c0e3c0a140e140a1412100a14160c0a1416080e141e000e1c12040e1c12040e1c12041203
#0812340e38163416301238123812301634123812380e301634123c0a3c0e3c0a3c0a3c0e3c0a3c0e3c0a3c0e03340e03340e071c0e3c0e3c0a3c0e3c0a3c0e380e3c0a3c0a100e180a100e180a1012140e032c0e380a400a3c0e380e100e140e1012100e1012100a14160c0e10160c0e030c160c0a070c160c0a0b
#0c0e3412381238123412380e3c0e3412380e3c0e3c0a380e3c0a3c0e3c0a3c0e380e3c0a3c0e3c0e03340e03380a07340a07340a0b1c0a400a3c0a400a3c0a400a3c0a3c0a3c0e03340e03340a07080e1c060b280e380e3c0a400a3c0a3c0a100e140e030c0e140e030c12140a00030812100e070812100a070c1214060b
#0c12340e3c0e3c0e380e3c0e3c0a380e3c0e3c0a3c0e380a3c0e3c0a3c0e380e3c0a3c0e3c0a40060b34060b34060b38020b380607200a400a3c0a400a3c0a400a3c0a03380e0338060b340a0734060738060b2c0a380e3c0a400a3c0a03380a0734060b34060b080e180a0b040e18060b080e18020b0c0e1c0207
#100e340e400a400a380e400a3c0a3c0a3c0e3c0a400a380e3c0a3c0a3c0e3c0a3c0e03380a03380a0738020b3c02073c02073c020b38020b200a3c0e3c0a400a3c0a400a0734060b38060b34020b38060b34020b3c0207300a380e3c0a033c060738020f34020f34020f34020f38020b080e1c0b0c0e1c07100e1c0b
#140a380a400a400a3c0a400a3c0a3c0a400a3c0e3c0a3c0a3c0e380e3c0a03380e0338060b34060b38020b3c0b3c0b3c0b40074007240a3c0e3c0a400a3c0a03400f34020f38020f340b3c020b3c07400b300a38020f34133c133413340f380f380b400b3c074403
#140a380e3c0e3c0a3c0a400a3c0a3c0e3c0a400a3c0a3c0e3c0a3c0a03380a0738060b34020f38020b38020b3c07440344034803700a3c0e3c0a40060738020f380f380f3c0b4003440744037c1334133813380b400740034403440348034403
#140a3c0a3c0e3c0a3c0e3c0a3c0a3c0e3c0a400a3c0e03380a03380a0734060b38020b38020b3c0b3c0b3c0bfca40a3c0e3c0a033c1334133c03440348039403c813340f3c034803
#140a3c0a3c0e3c0a3c0e3c0e380e3c0a3c0e033806073c020b38060b38020f30020b380f3c0b400744034403fca80a3c020f34133c0b4007
#140a3c0a3c0e3c0a400a3c0e380a07380a033c020b38020f34133813340f380b400744034403fcfc4013381338133803
#140a3c0a3c0e3c0e3c0a40020b341338020b3813380f3c07400b40074003fcfcfc2813380f3c03
#140a3c0e3c0a033813380f381334133813380b3c0744034803
#10133c0f341338133813380b380744074403
#1013381334133803480b
#10133813
#@ torso 255 21 000000 e84a3c b8372d f4c7a1 d79f7a 19c2a0 f4f4f6 20202a
#702590459025a0458045a005b025b025b025b015b0558045a025a045a03590459025
#605560450605705570350615603506157045705580250615802506158055802516256025062570250625701516250760150635076015161517604517
#5045061550450615503516156035161540451615503506155035161560351615603506256025162570350605275025160527502516151740350605276015160527503506051705501516051705
#40550615405506055055061550550615404506071540451615404506255045062550450607056035060527506527406517504506276055070550550715600345070550450715
#405506035055030750650760650750652730650705405537405537405527505527600345070560034507056055070560135560133507056023455013350705
#40451307503523273045131750352327302523070300073055032730550703000740550705605507056003450705706305604325602345604325603335603335502345
#50152307031740053307030007401523070317400543070370535005430703606370637053805390538053706305705305605315704305604325
#50054310075004338043904380042390438043904380538053a033a0339043a02314804304902314704305
#50241360010024b01413a024a024b023a01304b01304b01304b01304c024b024c024b02400019024c024017003002401
#3002012480020124800110249001002480010024a024b014c024b024b024d0140001a02401a02401a02411a02401a01421802411
#201211049002210480120114a0021104900221040170010024a024c024b02401a02401a0010431a00421a01411a041a00421a041900431
#200241701231800241801231800241701231800231900241800102319041a012318001023190010231801241800241801241700251
#101231800241800241801231800231801231800231901231801231900231a01231900241801231900241801241801241601241
#100241701231801231900241701231801231800231901231801231900241a00231901231801241801241800241900241701241
#001231800241800241900231801231800241701231901231900231901231a00241801231900241900241801241801241701241
#000241701241800241801231800241800231801231901231900231901231a01231900241801231901231901231901241700251
#1231801231801231901231800241800231801231901231900231901231a01231901231900241900241801241900241701241
#0241800241800241900241800231900231801231901231900241900231a01231901231901231901231901231901221901221
#0031a031900231901231801231801231801231901231900241900231b00241900231901231a00221a01221b00201c00201
#2011c011a031a0418051801231801231901231901231900241a00231a00231a00221b00201d00201d001d001
#f0f00011e001d001805180519051901231901231a001e001e011
#@ bar 936 9 000000 e84a3c f4c7a1 b8372d
#000130012c012c012c0128012c0130012c012c012c01240910020c090c060c05080a10050806180504061409040628061409000a24061805000a180900061809000a24061c012c012c012c01140a24062c06200a240628022c06200a28022806240a2006280628062406200a2806240a2806240a3806380a2406200a280a20062806200a280624022c0618110a28022806280a2001062001062c062406240a2806240a2806200a2406
#092409240924092409240924092409240910020c09100608090c0a0c09080a0c0904010a0809040a1009000a1409040a1009000a1409040a1009000a1405000a1805000a18090a1809000a140900061805280914060409100a0409100a0801140a0c01100a0c010c0a200a240a240a200a240a240a200a1c0a280a200a240a1c0a240a240a240a01200a24110634010a20010a1c0a280a200a200a200a240a200a240a14150a10110a10110a10110a100d0a10110a1c050a20010a18050a240a20010a240a1c010a2406
#0928092405280924092009140604090c0a0809100608090c0a0c09080a0c0904010a0c0904010a0c090005060c0900010a1011061409000106140d0a1805000106141102180d06180d021c0d06181102180d061809140a000d08050a000d08010a080904090208090c0106080d08010a040d04050210010c0106240a10010c01061001080102280a2406240a2006280601200a2406011c010205240601200102052406051c01020520110618050c090204011405062001062405022406240a200102280106200a280614090c0210150a0c150614110a0c150610110614110a140d061411022009061c0902240506180902240106
#00092809200928090c0a04091006080908010a080504050a0c0904010a0c0900050a0c090405060c09000902140500091419101518151c1118151c1118111c111c0d20111c111c11200908050a040d0009060809040906081d10090409100d000d0c09040510090409140108091009040910090405180504091405040518010409180100091c0100091c010009180100091c111c111c11201118111c1518110409080d040d0801100910011005240924052405280920092805140928052409240d200d2009280d1c111c09280d1c0d240d20092409
#0409240d1c0908010a0c0900090a080900090a08150a0819021019060c191815181518111c11180d1c11200d1c112011180d20111c0d200d200d2011241d020c19141914151815181914151409000910090409140900091415140d0005140d00051409000914151815181518111c1518151c1118191415501d0c210c0d04051011000910010c05240924052809200928051409280924052809240d1c0d20111c09240d200d201518111c151c11
#04190a0c190608150a1019020c19060c1910151c1514151c111c111c0d200d1c0d1c0d240d1c0d240d1c092809200924092409240d2c111c0d200d200d200d20111c0d1c1118151c111c1118151815141518151c111c111815200d1c11240920111c0d58111815101d101d1011000510090409100d000514090405280514010c0518052809240928092409200d2015140d20151c111819181514151815
#08150a0c0100110a041906100100052011180100052009240d20092809200d28012c0128012801280100012405280928012809240128092c012409300100012c01240100015c09240100012409200d1c11200d200920111c111c0d200d20111c111811280128092801300128016401000120091c112011101d10191419141914191419180928052805280d240524052c091c11200d1c151c11181514151819
#24022c061001fc012801fccc016001c401fca0010001200d240100012401280d200d2009240528092805200d5c01fc64052c01240d141914151c151419141d4c0528052c0528012c013401240928012c09b009
#fcfcfcfcfcfc8c0194012c012c012c012c0130012801fcfc3801280160051c112409fc9401
#@ up 360 15 000000 e84a3c f4c7a1 b8372d
#0a3002fcfc880a1c0a0402200a300230062c0a2c0a2c0a280a30062c06280a3006
#0a2c0afcfc840a1c0a000a1c0a2c0a280a2c0a2c0a2c0a280a2c0a280a280a2c0a
#0a2c0a3006fcfc480a1c0a000a1c010208061c0a2801062c0106300630062c063006280a2c092c0601
#0007300b280a2c063006fcd8071c05080b1805040a1c0900061c0904061c09300530052c05300928092c053009
#000b2c0b2c06032806032c0a2c0afc980b1409080b180508060318050406031809040a1809040a1c0530052c092c092c052c092c09
#040730072c0b2806032c0a2c0a3006fc6007140510071409080b18050406031809040a1809040a1c0508061c09280930052c092c053009
#0407300b2c0b280b2c0b280a03280a03280a3002ec071405100b1005100b1405080b14050c0b1409040a031805040a031809000a1c050802200928092c093009
#040b30072c0b2c07300b2c0b280607240a03280a30023006740b0c0914070c0d0c0b10090c071405100b10090c0b14050806071405040a031805040a1c090402200504061c093009
#080b2c0b2c0b280b2c0b300b280f24020b240a07240a2c06033006380b0409180b0809140b0c090c0b1005100b1009100b10050c0f100904020b1405040a071409000a1c090006031c0508061c09
#080b300b280f280b2c0f280f280f240f280f200a0724060b240a03340b04091c0b0009180f0805140b0809140f0809100f0809100f0c09080f10050c0f1009000a07140900060b1409000a031c05
#0c0b2c0f280f280b2c0f280f2813240f2413200f2817180a0f2c0b09200f091c0f0009180b0409180f0405180f040914130409100f080510130809080f100908170809000a0f1009
#100b2c0b2c0f280b2c0f28132413241324131c17241f1427180309280709240f091c0b09200f091c13091813000914130005181304050c170409101b090c2309
#100b300b2c0b2c0b2c0f2c0f28132017201b181f181f18231403092c0309280709240709240b09240b09200f051c13051c1705141709141b05141b09
#10033c03340b2c07300b300b300b280f28132017280f241714030401300300012c03092803092807052c07052c0705240b05240f051c1305240f2417
#94033403380334073407300734072c0bfc140300012c03380334073407300734072c0b
#= tab 7b6800876c04865a8a63008457836e896e7b6701866b0585588862008256836d886d7b6602866b0585588862018156836d886d7b6503856b0684588662018056836c876d7b6404846a0683578561027e54836c866c7b6305836a0781578461027c54826b856c7a6206836a0781578461037c54826b856c7a61078269087f568260037a53826b846b7a60088169087e568160047853826a836b7a60098069097c567f60047653816a826b7a5f0a7f69097b567e60057453806a816b7a5f0b7e680a78567c600573527e6a806a7a5f0c7d680a77567b600671527d6a7f6a7a5e0d7d680b76567b600670527e697f6a7a5e0e7c680b75567a60076f527d697e6a7a5e0f7b680c73567860076d527c697d6a7a5e107a680c72567760076c527b697c6a795e1179680d70577560086a537a697b6a785f1278680d6f57746108695379697a6a765f1377690e6d587361096754786a796b755f1476690e6c587262096654776a786b73601575690f6a5970620a6455766a776b72601674691069596e630a6356756a766b706117736910685a6d630b6157746b756c7b6818856f02855d8a6600835a837087717b6718856f03845d896600835a837087717b6619846e03835c8865018159836f86707b6519846e04835c8765018059836f86707b641a836d04825c8664027e58836e85707b631a836d05815a8463027c57836e846f7a621b816d05815a8463037c57826e846f7a611b816d06805a8362037b57826e836f7a601c806c067f5a8261047957816d826f7a601c806c077d598061047756816d816e7a5f1d7e6c077d5980610576567f6c816e7a5f1d7e6c087b597e600574567f6c806e7a5f1e7d6b087a597d600672567e6c7f6e7a5e1e7d6b0978597c600670567e6c7e6e7a5e1f7b6a0978597c600770567c6c7e6e7a5e1f7b6a0a755a7a60076f567c6c7d6e7a5e207a6a0a745a7960076e567b6c7c6e795e207a6a0b725a7860086b567b6c7b6e785f2178690b725a7861086b56796c7b6e765f2178690c705a7661096956796c7a6e755f2277690c6f5a7562096856786c796e73602277690d6d5c73620a6759786c786f72602375690e6b5c72630a6559776d776f70612375690e6b5c6c630b6459776d776f7b682483720084618a6800845e837286747b67248372018361896700825e837285747b66258371018361896601815e837285747b6525837102825f8765017f5c837284737b6426827002825f8764027e5b837184737b6326827003805f8663027d5b837183737a6227806f03805f8663037d5b817083737a6127806f047f5e8462037b5a817082727a60287f6e047f5e8461047a5a817082727a60287f6e057e5d826104785a817081727a5f297e6d057d5d7f6105765a807080727a5f297e6d067d5d7d6005765a807080727a5f2a7d6c067c5d7c6006745a7f707f727a5e2a7d6c077b5d7a6006735a7f707f727a5e2b7c6b077a5c79600772597e6f7e717a5e2b7c6b08785c78600770597e6f7d717a5e2c7a6a08785c76600770597c6f7d71795e2c7a6a09765d7560086d5a7c6f7c72785f2d796a09755d7461086c5a7b707b72765f2d796a0a735e7261096c5a7b707b72755f2e786a0a725e7162096b5a7a707a7273602e786a0b705e6f620a695b7a70797272602f766a0c6f5e6f630a685b786f797270612f766a0c6e5e6e630b665b786f7872576155616e7e
#@ cr0 46 36 000000 17171c 19c2a0 a8aeb6 25356e 33509a ededf2 e84a3c b8372d f4c7a1 d79f7a 19c2a0 f4f4f6 20202a
#f0f06031
#f0f05061
#f0f040211321
#f0f030213321
#f0f0301103211311
#f0f02002511311
#f050135072112321
#1019c0211013e2011321
#002917001b0d6021b2304231
#1019371d0b502152a04201
#40471b4021f01052
#401c370b4021f03032
#30290b370bf0a032
#30291b370017b0555032
#40291b877095002612
#40291b08170a7720c52612
#600958976500552612
#20880018874560152612
#293800083048473534602612
#292890382725646022
#f0202825845022
#f0400730943022
#f0f0442022
#f0f000442612
#f0f010342612
#f0f030142612
#f0f040042612
#f0f04001261211
#f0f040212211
#f0f030213221
#f0f030110312011311
#f0f0301112111311
#f0f03001222321
#f0f03022011321
#f0f0301261
#f0f030021031
#@ cr1 48 36 000000 17171c 19c2a0 a8aeb6 25356e 33509a ededf2 e84a3c b8372d f4c7a1 d79f7a 19c2a0 f4f4f6 20202a
#f0f04021
#f0f02061
#f0f01081
#f0f010212321
#f0f0101103111311
#f0f000511311
#f0f010411311
#f0f032012321
#f0c08231
#f09062005201
#f0301300624062
#f000011013429042
#e02162d022
#f01132f00022
#f01102f0201622
#f011f0202622
#f011c0651622
#f0b0951622
#f0a0a51622
#600df010656022
#2907200d2bd045246032
#29572bb045544032
#19870b109745743022
#30091cf70735a41622
#30090c092bd7253420441622
#30293b08070897151470242612
#40192bc80715a0142622
#50091b38008807e001162211
#7038f0a0212211
#5048f0a0213221
#3048f0c0110312011311
#102918f0e01122011311
#1029f0f00011122321
#2009f0f02012011321
#f0f0601251
#f0f050120031
#@ puff 72 12 000000 e6e6ea b4b4bc fff3a0 ffb52e e8473c
#
#f0b042f0e045
#f0a0122112f0c0152415
#f04240124112f00045400524032405
#50027012211220126112500570152415201504430415
#40020102600241022002810240050405600514031405200514431405
#300221025002410220028102300504030405500504230405200504630405
#40020102600241022002810240050405600514031405200514431405
#50027012211220126112500570152415201504430415
#f04240124112f00045400524032405
#f0a0122112f0c0152415
#f0b042f0e045
