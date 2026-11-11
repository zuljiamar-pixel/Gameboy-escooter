"""Desktop-Simulator für code.py + grafik.py (nur zum Entwickeln/Testen, nicht für den PyBadge).

Rendert das Spiel mit Adafruits Blinka-displayio (reines Python) in Bilder,
steuert die Knöpfe per Skript und prüft dabei die Spiellogik.

    python -m venv venv
    venv/bin/pip install adafruit-blinka-displayio pillow
    venv/bin/python tools/simulator.py [ausgabe-ordner]

Erzeugt Screenshots (PNG) und eine Animation (GIF) im Ausgabe-Ordner.
"""

import importlib.util
import math
import os
import random
import struct
import sys
import types
from array import array

import displayio  # Blinka-Implementierung
import bitmaptools  # noqa: F401  (muss vor den Fake-Modulen geladen sein)
import busdisplay  # noqa: F401  (vermeidet zirkulären Import in Blinka)
from displayio._area import Area
from displayio._displaycore import _DisplayCore
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
GAME = os.path.join(HERE, "..", "code.py")

B, A, START, SELECT, RIGHT, DOWN, UP, LEFT = 0, 1, 2, 3, 4, 5, 6, 7


# ------------------------------------------------------------------
# Fake-Hardware
# ------------------------------------------------------------------
class FakeDisplay:
    width = 160
    height = 128

    def __init__(self):
        self._core = _DisplayCore(
            None, 160, 128, 0x100, 0x100, 0, 0, 0, 16, False, True, 1,
            False, False, 0x2A, 0x2B, 0x2A, 0x2B, False, False, False, False)
        self.auto_refresh = True
        self._root = None

    @property
    def root_group(self):
        return self._root

    @root_group.setter
    def root_group(self, group):
        self._root = group
        self._core.set_root_group(group)

    def refresh(self):
        pass

    def dirty_pixels(self):
        """Wie viele Pixel müsste der PyBadge jetzt neu zeichnen? (und merkt sich den Stand)"""
        areas = []
        self._root._get_refresh_areas(areas)  # pylint: disable=protected-access
        px = 0
        for a in areas:
            w = min(160, a.x2) - max(0, a.x1)
            h = min(128, a.y2) - max(0, a.y1)
            if w > 0 and h > 0:
                px += w * h
        self._root._finish_refresh()  # pylint: disable=protected-access
        return px, len(areas)

    def snapshot(self):
        area = Area(0, 0, self.width, self.height)
        n = self.width * self.height
        buf = memoryview(bytearray(n * 2)).cast("I")
        mask = memoryview(bytearray(((n // 32) + 1) * 4)).cast("I")
        self._core.fill_area(area, mask, buf)
        px = array("H", buf.tobytes())
        rgb = bytearray(n * 3)
        for i, v in enumerate(px):
            rgb[3 * i] = (v >> 11 & 31) * 255 // 31
            rgb[3 * i + 1] = (v >> 5 & 63) * 255 // 63
            rgb[3 * i + 2] = (v & 31) * 255 // 31
        return Image.frombytes("RGB", (self.width, self.height), bytes(rgb))


class Event:
    def __init__(self, key_number=0, pressed=True):
        self.key_number = key_number
        self.pressed = pressed
        self.released = not pressed


class EventQueue:
    def __init__(self):
        self.q = []
        self.overflowed = False

    def get_into(self, ev):
        if not self.q:
            return False
        ev.key_number, ev.pressed = self.q.pop(0)
        ev.released = not ev.pressed
        return True

    def clear(self):
        self.q.clear()


class ShiftRegisterKeys:
    def __init__(self, **kwargs):
        assert kwargs["key_count"] == 8 and kwargs["value_when_pressed"] is True
        self.key_count = 8
        self.events = EventQueue()

    def reset(self):
        pass


def install_fakes():
    display = FakeDisplay()
    board = types.ModuleType("board")
    board.SIMULATED = True
    board.DISPLAY = display
    for name in ("BUTTON_CLOCK", "BUTTON_OUT", "BUTTON_LATCH", "NEOPIXEL",
                 "SPEAKER", "SPEAKER_ENABLE"):
        setattr(board, name, name)
    keypad = types.ModuleType("keypad")
    keypad.ShiftRegisterKeys = ShiftRegisterKeys
    keypad.Event = Event
    micro = types.ModuleType("microcontroller")
    micro.nvm = bytearray(256)
    supervisor = types.ModuleType("supervisor")
    supervisor.ticks_ms = lambda: 0
    for name, mod in (("board", board), ("keypad", keypad), ("microcontroller", micro),
                      ("supervisor", supervisor)):
        sys.modules[name] = mod
    # Kein Ton / keine LEDs im Simulator: Module fehlen absichtlich
    for name in ("audioio", "synthio", "neopixel_write"):
        sys.modules[name] = None
    return display, micro


def load_game():
    display, micro = install_fakes()
    root = os.path.dirname(os.path.abspath(GAME))
    if root not in sys.path:
        sys.path.insert(0, root)     # damit "import grafik" klappt
    sys.modules.pop("grafik", None)
    spec = importlib.util.spec_from_file_location("wheelie", GAME)
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    if mod.LOAD_ERROR is not None:
        raise mod.LOAD_ERROR
    return mod, display, micro


# ------------------------------------------------------------------
# Szenarien
# ------------------------------------------------------------------
class Runner:
    def __init__(self, out):
        self.mod, self.display, self.micro = load_game()
        self.game = self.mod.Game(self.display)
        self.out = out
        self.held = set()
        self.frames = []
        self.n = 0
        self.dt = 1 / 30
        self.px_sum = self.px_max = self.px_n = 0

    def load(self, text):
        """Wie viele Pixel musste der Bildschirm pro Bild neu malen (seit dem letzten Aufruf)?"""
        print("      %-34s im Schnitt %5d Pixel pro Bild, höchstens %5d"
              % (text, self.px_sum / max(1, self.px_n), self.px_max))
        self.px_sum = self.px_max = self.px_n = 0

    def set_keys(self, keys):
        q = self.game.btn.keys.events.q
        for k in sorted(set(keys) - self.held):
            q.append((k, True))
        for k in sorted(self.held - set(keys)):
            q.append((k, False))
        self.held = set(keys)

    def run(self, seconds, keys=None, controller=None, record_every=3):
        for _ in range(max(1, int(seconds / self.dt + 0.5))):
            if controller:
                keys = controller(self.game)
            if keys is not None:
                self.set_keys(keys)
            self.game.step(self.dt)
            px = self.display.dirty_pixels()[0]
            self.px_sum += px
            self.px_max = max(self.px_max, px)
            self.px_n += 1
            self.n += 1
            if record_every and self.n % record_every == 0:
                self.frames.append(self.display.snapshot())

    def tap(self, key, hold=0.1):
        self.run(hold, keys=[key])
        self.run(0.1, keys=[])

    def shot(self, name):
        img = self.display.snapshot()
        img.resize((480, 384), Image.NEAREST).save(os.path.join(self.out, name))
        return img


def balance_bot(target_deg, extra=(), land_after=None):
    """Hält den Wheelie bei ca. target_deg (A antippen, B wenn zu hoch)."""
    state = {"t": 0.0}

    def ctl(g):
        state["t"] += 1 / 30
        if land_after is not None and state["t"] > land_after:
            return [UP] if state["t"] < land_after + 0.1 else []
        p = math.degrees(g.th) + math.degrees(g.om) * 0.25
        keys = list(extra)
        if p < target_deg:
            keys.append(A)
        elif p > target_deg + 10:
            keys.append(B)
        return keys
    return ctl


def check(cond, text):
    if not cond:
        raise AssertionError(text)
    print("  ok  " + text)


def main():
    out = sys.argv[1] if len(sys.argv) > 1 else os.path.join(HERE, "..", "sim-output")
    os.makedirs(out, exist_ok=True)
    random.seed(1)                    # immer der gleiche "Zufall": gleiche Bilder bei jedem Lauf
    r = Runner(out)
    g = r.game
    m = r.mod
    gfx = m.gfx
    nvm = r.micro.nvm
    kmh = lambda: g.v * 3.6

    import bilder
    with open(os.path.join(HERE, "..", "grafik.py"), encoding="utf-8") as f:
        stored = f.read().split("\n" + bilder.MARK)[1].split("\n")[1:-1]
    check(stored == bilder.build()[0], "Bilder in grafik.py sind aktuell (tools/bilder.py)")

    # --- Menü: Steuerung, Farbwahl, START ---
    r.run(1.0)
    r.load("Start")
    r.run(2.0)
    r.load("Menü")
    while g.l_start.g.hidden:         # "START = LOS!" blinkt: fürs Bild warten, bis es da ist
        r.run(1 / 30)
    r.shot("01_menue.png")
    check(g.state == m.MENU and not g.menu.hidden, "Menü beim Start")
    r.tap(A)
    check(g.state == m.MENU, "A startet das Spiel NICHT (nur START)")
    first = g.rider.tint[0][0][2]
    r.tap(RIGHT)
    check(g.store.color == 1 and g.rider.tint[0][0][2] != first and "BLAU" in g.l_col.text,
          "RECHTS = nächste Farbe (%s)" % g.l_col.text)
    r.tap(LEFT)
    r.tap(LEFT)
    check(g.store.color == len(gfx.COLORS) - 1, "LINKS geht rückwärts durch die Farben")
    for _ in range(7):
        r.tap(RIGHT)
    check(gfx.COLORS[g.store.color][0] == "REGENBOGEN" and g.rainbow, "Regenbogen wählbar")
    c1 = g.rider.tint[0][0][2]
    r.run(0.5)
    check(g.rider.tint[0][0][2] != c1, "Regenbogen wechselt die Farbe")
    r.load("Menü mit Regenbogen")
    r.shot("02_regenbogen.png")
    r.tap(RIGHT)
    r.tap(RIGHT)
    name = gfx.COLORS[g.store.color][0]
    r.shot("03_farbe.png")
    r.tap(START)
    check(g.state == m.PLAY and g.menu.hidden, "START startet das Spiel")
    check(nvm[17] == g.store.color, "gewählte Farbe gespeichert (%s)" % name)
    check(g.l_fps.text.endswith("FPS") and not g.l_fps.g.hidden, "FPS-Anzeige unten links: " + g.l_fps.text)

    # --- Gas, Ausrollen, Bremse ---
    check(g.v == 0, "ohne Gas bleibt der Scooter stehen")
    t50 = t99 = None
    for i in range(30 * 20):
        r.run(1 / 30, keys=[A], record_every=0)
        if t50 is None and kmh() >= 50:
            t50 = i / 30
        if kmh() >= 99.5:
            t99 = i / 30
            break
    r.load("Vollgas bis 100 km/h")
    check(t99 is not None and g.th == 0, "Gas: 50 km/h nach %.1f s, 100 km/h nach %.1f s" % (t50, t99 or -1))
    check(max(tg.hidden for tg in g.lines) is False, "Fahrtwind-Streifen bei hohem Tempo")
    r.shot("04_vollgas.png")
    r.run(3.0, keys=[])
    v_coast = kmh()
    check(50 < v_coast < 95, "ohne Gas rollt er aus (nach 3 s: %.0f km/h)" % v_coast)
    r.run(1.0, keys=[B])
    check(kmh() < v_coast - 20, "B bremst (nach 1 s: %.0f km/h)" % kmh())
    r.run(1.0, keys=[A])
    r.load("Ausrollen und Bremsen")

    # --- Wheelie: OBEN, balancieren, Tricks, sauber landen ---
    r.tap(UP, 0.07)
    r.run(2.0, controller=balance_bot(30))
    check(g.in_wheelie and g.wmode and not g.meter.hidden, "OBEN = Wheelie, mit A/B gehalten (%.0f Grad)" % math.degrees(g.th))
    r.load("Wheelie")
    r.shot("05_wheelie.png")
    for extra, arms, crouch, word, shot in (([LEFT], 1, False, "EINHÄNDER", "06_einhaender.png"),
                                            ([DOWN], 0, True, "KNIE-TRICK", "07_knie.png"),
                                            ([RIGHT], 2, False, "NO-HANDER", "08_nohander.png"),
                                            ([DOWN, RIGHT], 2, True, "KNIE-NO-HANDER", "09_knie_nohander.png")):
        r.run(1.3, controller=balance_bot(30, extra))
        check(g.arms == arms and g.crouch == crouch and g.l_sub.text.startswith(word) and g.in_wheelie,
              "Trick: " + g.l_sub.text)
        check(g.kn == (2.0 if crouch else 0.0), "   Knie %s" % ("ganz unten" if crouch else "gestreckt"))
        r.shot(shot)
    r.load("Wheelie mit Tricks")
    tp = g.tp
    r.run(2.5, controller=balance_bot(30, land_after=0.0))
    check(not g.in_wheelie and not g.wmode and g.state == m.PLAY, "nochmal OBEN = sauber gelandet")
    check(g.store.best > 30 and g.store.tbest == int(tp), "Rekord %.1f m, Trick-Rekord %d" % (g.store.best, g.store.tbest))
    best, tbest = struct.unpack("<ff", bytes(nvm[4:12]))
    check(abs(best - g.store.best) < 0.01 and int(tbest) == g.store.tbest, "Rekorde im nvm gespeichert")
    r.shot("10_ergebnis.png")

    # --- ohne Gas fällt das Vorderrad von selbst und federt nach ---
    r.run(1.5, keys=[])
    r.tap(UP, 0.07)
    peak = bounce = 0
    dipped = False
    for _ in range(90):
        r.run(1 / 30, keys=[], record_every=1)
        peak = max(peak, g.th)
        if g.th == 0:
            bounce = max(bounce, g.b)
            dipped = dipped or g.dip > 0
    check(15 < math.degrees(peak) < 35 and not g.wmode and g.th == 0,
          "ohne Gas geht das Vorderrad von selbst runter (höchster Punkt %.0f Grad)" % math.degrees(peak))
    check(bounce > 0.03 and dipped and g.b < 0.01,
          "beim Aufsetzen federt es nach (%.1f Grad) und der Fahrer geht kurz in die Knie"
          % math.degrees(bounce))

    # --- Dauer-Gas im Wheelie = Sturz, START = nochmal ---
    best = g.store.best
    r.tap(UP, 0.07)
    r.run(3.0, keys=[A])
    check(g.state == m.CRASH, "Dauer-Gas im Wheelie kippt nach hinten")
    r.run(0.4, keys=[])
    r.shot("11_sturz.png")
    r.run(1.0, keys=[])
    check(g.store.best == best, "Sturz zählt nicht")
    r.tap(START)
    check(g.state == m.PLAY and g.v == 0 and g.th == 0, "START = nochmal")

    # --- Burnout und Boost ---
    r.run(0.5, keys=[A, B])
    check(g.burn and g.v == 0, "A + B im Stand = Burnout")
    r.run(0.2, keys=[A])
    check(not g.boost, "Burnout kürzer als 1 Sekunde: kein Boost")
    r.run(1.0, keys=[B])
    r.run(1.6, keys=[A, B])
    check(g.burn and g.burn_t >= 1.0 and not g.mark.hidden, "Burnout mit Rauch und Reifenspur (%.1f s)" % g.burn_t)
    check(any(l > 0 for l in g.puffs.life), "Rauch")
    r.load("Burnout")
    r.shot("12_burnout.png")
    t = 0
    for i in range(30 * 6):
        r.run(1 / 30, keys=[A], record_every=2)
        if i == 2:
            check(g.boost and g.l_big.text == "BOOST!", "B loslassen, A halten = BOOST")
        if i == 18:
            r.shot("13_boost.png")
        if kmh() >= 99.5:
            t = i / 30
            break
    r.load("Boost")
    check(0 < t < 3.0 and not g.boost, "Boost: in %.1f s auf 100 km/h" % t)
    r.shot("14_nach_boost.png")
    r.run(1.0, keys=[])

    # --- Pause und zurück ins Menü ---
    r.tap(START)
    check(g.state == m.PAUSE, "START = Pause")
    v = g.v
    r.run(0.5)
    check(g.v == v, "in der Pause steht alles")
    r.shot("15_pause.png")
    r.tap(START)
    check(g.state == m.PLAY, "START = weiter")
    r.tap(START)
    r.tap(SELECT)
    check(g.state == m.MENU and not g.menu.hidden, "Pause + SELECT = Menü")

    # --- SELECT im Menü: Ton an/aus, lange halten = Rekorde löschen ---
    r.tap(SELECT)
    check(not g.store.sound and nvm[2] == 0, "SELECT = Ton aus (gespeichert)")
    r.tap(SELECT)
    check(g.store.sound and nvm[2] == 1, "SELECT = Ton an")
    r.shot("16_menue_rekord.png")

    # --- "Neustart" des Geräts: alles wird wieder geladen ---
    s2 = gfx.Store()
    check(abs(s2.best - g.store.best) < 0.01 and s2.tbest == g.store.tbest
          and s2.color == g.store.color and s2.best > 30,
          "nach dem Aus- und Einschalten ist alles noch da")

    r.run(3.2, keys=[SELECT], record_every=0)
    r.run(0.2, keys=[])
    check(g.store.best == 0 and g.store.tbest == 0 and g.store.sound, "SELECT 3 s halten = Rekorde gelöscht")

    # --- alter Spielstand (frühere Version) wird übernommen ---
    nvm[0:18] = b"EW" + bytes((1, 2)) + struct.pack("<ffIBB", 2356.7, 149.0, 4711, 0x7F, 3)
    s3 = gfx.Store()
    check(abs(s3.best - 2356.7) < 0.01 and s3.tbest == 149 and s3.color == 3,
          "alter Rekord aus der früheren Version bleibt erhalten")
    s3.save()
    check(struct.unpack("<I", bytes(nvm[12:16]))[0] == 4711, "alte Punkte werden nicht überschrieben")

    print("\nAlle Checks OK - Bilder in", os.path.abspath(out))
    if len(sys.argv) > 2:             # zweites Argument: Ordner für die Bilder der Anleitung
        make_docs(out, sys.argv[2])


def make_docs(out, docs):
    """Bilder und eine kurze Animation für die README."""
    os.makedirs(docs, exist_ok=True)
    for src, dst in (("01_menue.png", "menue.png"), ("05_wheelie.png", "wheelie.png"),
                     ("08_nohander.png", "nohander.png"), ("07_knie.png", "knie.png"),
                     ("12_burnout.png", "burnout.png"), ("13_boost.png", "boost.png"),
                     ("11_sturz.png", "sturz.png"), ("10_ergebnis.png", "rekord.png")):
        Image.open(os.path.join(out, src)).resize((320, 256), Image.NEAREST).save(
            os.path.join(docs, dst), optimize=True)
    random.seed(2)
    r = Runner(docs)                  # eine kurze Runde für die Animation
    r.run(1.0)
    r.tap(RIGHT)
    r.run(0.5)
    r.tap(RIGHT)
    r.run(0.6)
    r.tap(START)
    r.run(1.2, keys=[A, B])           # Burnout ...
    r.run(1.9, keys=[A])              # ... und Boost
    r.run(0.4, keys=[])
    r.tap(UP, 0.07)
    r.run(1.6, controller=balance_bot(30))
    r.run(1.2, controller=balance_bot(30, [LEFT]))
    r.run(1.2, controller=balance_bot(30, [RIGHT]))
    r.run(1.2, controller=balance_bot(30, [DOWN]))
    r.run(2.6, controller=balance_bot(30, land_after=0.0))
    r.frames = r.frames[::2]          # 5 Bilder pro Sekunde reichen für die Vorschau
    big = [f.resize((320, 256), Image.NEAREST).quantize(colors=64) for f in r.frames]
    big[0].save(os.path.join(docs, "spiel.gif"), save_all=True, append_images=big[1:],
                duration=200, loop=0, optimize=True)
    print("Bilder für die Anleitung in", os.path.abspath(docs))


if __name__ == "__main__":
    main()
