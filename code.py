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
# Strecke gezählt. Kippst du nach hinten um, zählt der Wheelie nicht.
# Dein Rekord bleibt auch nach dem Ausschalten gespeichert.
# Rekord löschen: im Startbildschirm START 3 Sekunden halten.
#
# Installation: Diese Datei als "code.py" UND die Datei "grafik.py" auf das
# Laufwerk CIRCUITPY kopieren. Weitere Bibliotheken braucht es nicht.

import gc
import math
import random
import struct
import time

import board
import displayio
import keypad

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
FRAME = 1 / 40
PX_PER_M = 26                 # 26 Pixel = 1 Meter (Radstand)
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

# Die Grafik steckt in grafik.py (so muss der PyBadge nie alles auf einmal laden)
try:
    import grafik as gfx
    W, REAR_X, AXLE_Y = gfx.W, gfx.REAR_X, gfx.AXLE_Y
    LOAD_ERROR = None
except Exception as e:  # pylint: disable=broad-except
    LOAD_ERROR = e


def frame_specs():
    # (Winkel, Zurücklehnen) für jedes vorgezeichnete Scooter-Bild
    specs = [(i * FRAME_STEP, LEAN) for i in range(N_PLAY)]
    for k in range(1, 5):     # Bilder für den Überschlag
        specs.append((CRASH_DEG + (100 - CRASH_DEG) * k / 4, LEAN + (1 - LEAN) * k / 4))
    return specs


def show_error(e):
    # Fehler gut lesbar auf dem Bildschirm stehen lassen (statt wegzuscrollen)
    display = board.DISPLAY
    try:
        display.root_group = displayio.CIRCUITPYTHON_TERMINAL
        display.auto_refresh = True
    except Exception:  # pylint: disable=broad-except
        pass
    try:
        import traceback
        traceback.print_exception(e)
    except Exception:  # pylint: disable=broad-except
        pass
    gc.collect()
    print()
    if isinstance(e, ImportError):
        print("Fehlt grafik.py auf CIRCUITPY?")
    print("FEHLER:", repr(e))
    print("Speicher frei:", getattr(gc, "mem_free", lambda: "?")())
    print("Bitte Foto an Claude schicken")
    while True:
        time.sleep(1)


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
# Das Spiel
# ------------------------------------------------------------------
class Game:
    def __init__(self, display):
        self.store = Store()
        self.btn = Buttons()
        self.leds = Pixels()
        self.sound = Sound(self.store.sound)

        font = gfx.make_font()
        self.root = displayio.Group()
        self.world = displayio.Group()
        self.root.append(self.world)
        loading = gfx.Label(font, self.root, 8, 0xFFFFFF)
        loading.set("LÄDT...", 80, 60, 1)
        try:
            display.root_group = self.root
        except AttributeError:
            display.show(self.root)

        gc.collect()
        for tg in gfx.make_background():
            self.world.append(tg)
        self.seams = gfx.make_strip(32, 6, 0x8E8E99, 1, 98)
        self.dashes = gfx.make_strip(96, 2, 0xEDEDED, 48, 124)
        self.world.append(self.seams)
        self.world.append(self.dashes)
        self.props = []
        for maker, off, w in ((gfx.make_lamp, 0, 7), (gfx.make_tree, 85, 15), (gfx.make_lamp, 165, 7)):
            tg = maker()
            self.world.append(tg)
            self.props.append((tg, off, w))
        self.bumps = [gfx.make_bump(), gfx.make_bump()]
        for b in self.bumps:
            b.hidden = True
            self.world.append(b)
        self.mark_bmp = displayio.Bitmap(40, 2, 2)    # Reifenspur vom Burnout
        self.mark = displayio.TileGrid(self.mark_bmp, y=116,
                                       pixel_shader=gfx.make_palette((0, 0x1E1E24), True))
        self.world.append(self.mark)
        self.rider = displayio.Group()
        self.world.append(self.rider)
        self.smoke = gfx.Smoke(self.world)
        self.frames = gfx.build_frames(self.rider, frame_specs())
        gc.collect()
        self.frame = 0
        self.frames[0].hidden = False
        self.root.remove(loading.g)

        hud = displayio.Group()
        self.root.append(hud)
        self.l_best = gfx.Label(font, hud, 16, 0xFFFFFF)
        self.l_speed = gfx.Label(font, hud, 8, 0xFFFFFF)
        self.l_big = gfx.Label(font, hud, 9, 0xFFFFFF, scale=2)
        self.l_sub = gfx.Label(font, hud, 24, 0xFFE27A)
        self.l_title1 = gfx.Label(font, hud, 9, 0xFFFFFF, scale=2)
        self.l_title2 = gfx.Label(font, hud, 7, 0xFFD23F, scale=3, shadow=0x8C3B2E)
        self.l_help = gfx.Label(font, hud, 24, 0xFFFFFF)
        self.l_prompt = gfx.Label(font, hud, 22, 0xFFFFFF)
        self.l_toast = gfx.Label(font, hud, 18, 0xFFFFFF)
        self.l_fps = gfx.Label(font, hud, 7, 0xFFFFFF)
        self.l_fps.hide()
        self.fps = 0.0
        self.fps_t = -1.0

        # Winkelanzeige: grün = sicher, gelb = Gleichgewicht, rot = Absturzgefahr
        mpal = gfx.make_palette((0, 0x101018, 0x3CCB5A, 0xFFD23F, 0xE84A3C, 0xFFFFFF), True)
        mbmp = displayio.Bitmap(84, 7, 6)
        gfx.rect(mbmp, 0, 0, 84, 7, 1)
        for x in range(82):
            deg = x / 81 * CRASH_DEG
            c = 2 if deg < BALANCE_DEG - 12 else (3 if deg < BALANCE_DEG + 5 else 4)
            gfx.rect(mbmp, 1 + x, 1, 2 + x, 6, c)
        self.meter = displayio.TileGrid(mbmp, pixel_shader=mpal, x=38, y=46)
        kbmp = displayio.Bitmap(3, 11, 6)
        gfx.rect(kbmp, 0, 0, 3, 11, 1)
        gfx.rect(kbmp, 1, 1, 2, 10, 5)
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
            gfx.rect(self.mark_bmp, 40 - n, 0, 40 - self.mark_len, 2, 1)
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
    if LOAD_ERROR is not None:
        show_error(LOAD_ERROR)
    display = board.DISPLAY
    try:
        gc.collect()
        game = Game(display)
        gc.collect()
        display.auto_refresh = False
        last = time.monotonic_ns()
        while True:
            now = time.monotonic_ns()
            dt = min((now - last) / 1e9, 0.1)
            last = now
            game.step(dt)
            display.refresh()
            spent = (time.monotonic_ns() - now) / 1e9
            if spent < FRAME:
                time.sleep(FRAME - spent)
    except Exception as e:  # pylint: disable=broad-except
        show_error(e)


# Im Simulator (tools/simulator.py) wird das Spiel ferngesteuert,
# auf dem PyBadge startet es direkt hier.
if not getattr(board, "SIMULATED", False):
    main()
