"""Desktop-Simulator für code.py (nur zum Entwickeln/Testen, nicht für den PyBadge).

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
GAME = os.path.join(HERE, "..", "code.py")

B, A, START, SELECT, DOWN, UP = 0, 1, 2, 3, 5, 6


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

    def snapshot(self):
        area = Area(0, 0, self.width, self.height)
        n = self.width * self.height
        buf = memoryview(bytearray(n * 2)).cast("I")
        mask = memoryview(bytearray(((n // 32) + 1) * 4)).cast("I")
        self._core.fill_area(area, mask, buf)
        self._root._finish_refresh()  # pylint: disable=protected-access
        px = array("H", buf.tobytes())
        rgb = bytearray(n * 3)
        for i, v in enumerate(px):
            rgb[3 * i] = (v >> 11 & 31) * 255 // 31
            rgb[3 * i + 1] = (v >> 5 & 63) * 255 // 63
            rgb[3 * i + 2] = (v & 31) * 255 // 31
        return Image.frombytes("RGB", (self.width, self.height), bytes(rgb))


class Event:
    def __init__(self, key, pressed):
        self.key_number = key
        self.pressed = pressed
        self.released = not pressed


class EventQueue:
    def __init__(self):
        self.q = []
        self.overflowed = False

    def get(self):
        return self.q.pop(0) if self.q else None

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
    for name, mod in (("board", board), ("keypad", keypad), ("microcontroller", micro)):
        sys.modules[name] = mod
    # Kein Ton / keine LEDs im Simulator: Module fehlen absichtlich
    for name in ("audioio", "synthio", "neopixel_write"):
        sys.modules[name] = None
    return display, micro


def load_game():
    display, micro = install_fakes()
    spec = importlib.util.spec_from_file_location("wheelie", GAME)
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
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

    def set_keys(self, keys):
        q = self.game.btn.keys.events.q
        for k in sorted(set(keys) - self.held):
            q.append(Event(k, True))
        for k in sorted(self.held - set(keys)):
            q.append(Event(k, False))
        self.held = set(keys)

    def run(self, seconds, keys=None, controller=None, record_every=3):
        for _ in range(int(seconds / self.dt)):
            if controller:
                keys = controller(self.game)
            if keys is not None:
                self.set_keys(keys)
            self.game.step(self.dt)
            self.n += 1
            if record_every and self.n % record_every == 0:
                self.frames.append(self.display.snapshot())

    def shot(self, name):
        img = self.display.snapshot()
        img.resize((480, 384), Image.NEAREST).save(os.path.join(self.out, name))
        return img

    def save_gif(self, name):
        big = [f.resize((320, 256), Image.NEAREST) for f in self.frames]
        big[0].save(os.path.join(self.out, name), save_all=True,
                    append_images=big[1:], duration=100, loop=0)


def balance_bot(target_deg, land_after=None):
    """Hält den Wheelie bei ca. target_deg, bremst nach land_after Sekunden."""
    state = {"t": 0.0}

    def ctl(g):
        state["t"] += 1 / 30
        th = math.degrees(g.th)
        om = math.degrees(g.om)
        if land_after is not None and state["t"] > land_after:
            return [UP] if state["t"] < land_after + 0.1 else []
        if th + om * 0.25 < target_deg:
            return [A]
        if th + om * 0.25 > target_deg + 10:
            return [B]
        return []
    return ctl


def main():
    out = sys.argv[1] if len(sys.argv) > 1 else os.path.join(HERE, "..", "sim-output")
    os.makedirs(out, exist_ok=True)
    r = Runner(out)
    g = r.game
    m = r.mod

    r.run(1.0)
    r.shot("1_titel.png")
    assert g.state == m.TITLE

    r.run(0.2, keys=[A])
    r.run(0.1, keys=[])
    assert g.state == m.PLAY, "A startet das Spiel"

    # A gibt nur Gas: kein Wheelie, aber schnell
    r.run(3.0, keys=[A])
    assert g.th == 0 and not g.in_wheelie, "A allein hebt das Vorderrad nicht"
    print("Nach 3 s Gas: %.0f km/h" % (g.v * 3.6))
    r.run(1.0, keys=[])

    # OBEN = Wheelie-Mode, mit A/B balancieren, nochmal OBEN = landen
    r.run(0.1, keys=[UP])
    r.run(3.0, controller=balance_bot(30))
    r.shot("2_wheelie.png")
    print("Wheelie: %.1f m, Winkel %.1f°, %.1f km/h" % (g.wd, math.degrees(g.th), g.v * 3.6))
    assert g.in_wheelie and g.wmode and g.state == m.PLAY
    r.run(3.0, controller=balance_bot(30, land_after=2.0))
    r.run(0.4, keys=[])
    r.shot("3_ergebnis.png")
    assert not g.in_wheelie and not g.wmode
    assert g.store.best > 5, g.store.best
    saved = m.struct.unpack("<f", bytes(r.micro.nvm[4:8]))[0]
    assert abs(saved - g.store.best) < 0.01, "Rekord im nvm gespeichert"
    print("Rekord: %.1f m (im nvm: %.1f m)" % (g.store.best, saved))

    # Ohne Gas im Wheelie-Mode fällt das Vorderrad runter und der Mode endet
    r.run(0.1, keys=[UP])
    r.run(2.5, keys=[])
    assert not g.wmode and g.th == 0 and g.state == m.PLAY

    # Wheelie-Mode + A festhalten -> Überschlag
    r.run(0.1, keys=[UP])
    r.run(4.0, keys=[A])
    r.shot("4_sturz.png")
    assert g.state == m.CRASH, "Dauer-Gas im Wheelie kippt nach hinten"
    best_before = g.store.best
    r.run(1.0, keys=[])
    r.shot("5_nochmal.png")
    assert g.store.best == best_before, "Sturz zählt nicht"
    r.run(0.1, keys=[A])
    r.run(0.1, keys=[])
    assert g.state == m.PLAY

    # Vollgas: 100 km/h
    r.run(12.0, keys=[A], record_every=6)
    print("Vollgas: %.0f km/h" % (g.v * 3.6))
    assert g.v * 3.6 > 99 and g.l_speed.text == "100 KM/H", g.l_speed.text
    r.shot("7_vollgas.png")
    r.run(0.5, keys=[])

    # Pause
    r.run(0.1, keys=[START])
    r.run(0.1, keys=[])
    assert g.state == m.PAUSE
    r.shot("6_pause.png")
    r.run(0.1, keys=[START])
    r.run(0.1, keys=[])
    assert g.state == m.PLAY

    # Ton umschalten wird gespeichert
    r.run(0.1, keys=[SELECT])
    r.run(0.1, keys=[])
    assert r.micro.nvm[2] == 0 and not g.store.sound

    # FPS-Anzeige mit RUNTER
    r.run(0.1, keys=[DOWN])
    r.run(0.7, keys=[])
    assert not g.l_fps.g.hidden and g.l_fps.text.endswith("FPS"), g.l_fps.text
    r.run(0.1, keys=[DOWN])
    r.run(0.1, keys=[])
    assert g.l_fps.g.hidden

    # Neustart des "Geräts": Rekord wird wieder geladen
    g2 = r.mod.Game(FakeDisplay())
    assert abs(g2.store.best - best_before) < 0.01 and not g2.store.sound

    # Rekord löschen: START 3 s im Titel halten
    g.goto_title()
    r.run(3.3, keys=[START], record_every=0)
    r.run(0.1, keys=[])
    assert g.store.best == 0 and g.state == m.TITLE

    r.save_gif("wheelie.gif")
    print("Alle Checks OK - Bilder in", os.path.abspath(out))


if __name__ == "__main__":
    main()
