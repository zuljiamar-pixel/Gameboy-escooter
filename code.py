# E-SCOOTER WHEELIE für den Adafruit PyBadge (CircuitPython)
#
# Es braucht ZWEI Dateien auf dem Laufwerk CIRCUITPY: code.py und grafik.py
#
#   START  = Spiel starten / Pause
#   A      = Gas                      B      = Bremse
#   OBEN   = Wheelie an/aus           LINKS  = Einhänder
#   UNTEN  = Knie-Trick               RECHTS = No-Hander
#   A + B  = Burnout. Nach 1 Sekunde B loslassen und A halten = BOOST!
#   Im Menü: LINKS/RECHTS = Scooter-Farbe, SELECT = Ton an/aus
#            (SELECT 3 Sekunden halten = Rekorde löschen)

import gc
import math
import random
import time

import board
import displayio
import supervisor

# ------------------------------------------------------------------
# EINSTELLUNGEN - hier kannst du das Spiel verändern
# ------------------------------------------------------------------
MAX_KMH = 100         # Höchstgeschwindigkeit
ACCEL = 6.0           # Beschleunigung beim Anfahren (m/s²)
POWER = 75.0          # Motorkraft: wie gut er bei hohem Tempo noch zieht
BOOST_ACCEL = 14.0    # Beschleunigung im Boost (m/s²)
BRAKE = 8.0           # Bremse (m/s²), im Wheelie nur halb so stark
ROLL = 0.2            # Rollwiderstand (m/s²)
AERO = 0.0025         # Luftwiderstand (wächst mit Tempo mal Tempo)
BURNOUT_TIME = 1.0    # so lange muss der Burnout dauern, bis der Boost bereit ist
POP = 1.8             # wie kräftig OBEN das Vorderrad hochreißt
BALANCE_DEG = 42      # Gleichgewichtspunkt des Wheelies (Grad)
CRASH_DEG = 68        # ab hier kippst du nach hinten um (Grad)
GRAVITY = 4.0         # wie stark das Vorderrad nach unten will
LIFT = 6.5            # wie stark Gas das Vorderrad hochzieht
BRAKE_TORQUE = 6.0    # wie stark die Bremse es runterdrückt
DAMPING = 1.8         # Dämpfung (höher = gutmütiger)
LAND_TORQUE = 5.0     # sanftes Landen mit nochmal OBEN
LAND_SPEED = 1.6      # so schnell senkt sich das Vorderrad dabei (rad/s)
BOUNCE = 1.0          # wie stark das Vorderrad beim Aufsetzen nachfedert
MIN_WHEELIE = 0.5     # so viele Meter muss ein Wheelie mindestens haben
FPS = 30              # Ziel: Bilder pro Sekunde

# ------------------------------------------------------------------
# Feste Werte
# ------------------------------------------------------------------
FRAME_MS = 1000 // FPS
PX_PER_M = 26                 # 26 Pixel = 1 Meter (Radstand)
VMAX = MAX_KMH / 3.6
PHI0 = math.radians(90 - BALANCE_DEG)
CRASH_RAD = math.radians(CRASH_DEG)
CTRL = (1.0, 0.7, 0.4)        # so gut drückt die Bremse das Vorderrad mit 2 / 1 / 0 Händen runter
WOBBLE = (0.0, 0.7, 1.6)      # so stark schwankt es dabei
# Tricks: Nummer = Arme (0-2) + 3 für Knie
RATE = (0, 1, 3, 1, 4, 8)     # Trick-Punkte pro Meter
NAMES = ("", "EINHÄNDER", "NO-HANDER", "KNIE-TRICK", "KNIE-EINHÄNDER", "KNIE-NO-HANDER")
HELP = ("OBEN = WHEELIE", "LINKS = EINHÄNDER", "UNTEN = KNIE-TRICK", "RECHTS = NO-HANDER",
        "A = GAS  B = BREMSE", "A+B = BURNOUT/BOOST")
PROP_OFF = (0, 85, 165)       # Laterne, Baum, Laterne (alle 240 Pixel wieder)
ROAD = 0x3B3B45               # Farbe der Straße (Hintergrund für Schrift unten)

BTN_B, BTN_A, BTN_START, BTN_SELECT, BTN_RIGHT, BTN_DOWN, BTN_UP, BTN_LEFT = \
    1, 2, 4, 8, 16, 32, 64, 128
MENU, PLAY, PAUSE, CRASH = 0, 1, 2, 3

# Töne: (Frequenz, Dauer)
SND_START = ((523, 0.07), (784, 0.1))
SND_TICK = ((660, 0.04),)
SND_TRICK = ((1047, 0.05), (1568, 0.08))
SND_LAND = ((880, 0.06), (1175, 0.1))
SND_RECORD = ((523, 0.09), (659, 0.09), (784, 0.09), (1047, 0.25))
SND_CRASH = ((220, 0.08), (165, 0.08), (110, 0.12), (70, 0.2))
SND_READY = ((988, 0.05), (1319, 0.1))
SND_BOOST = ((392, 0.05), (587, 0.05), (784, 0.05), (1175, 0.15))
SND_OFF = ((300, 0.1), (200, 0.15))

# Die Grafik steckt in grafik.py (so muss der PyBadge nie alles auf einmal laden)
try:
    import grafik as gfx
    if getattr(gfx, "VERSION", 0) != 5:
        raise ImportError("grafik.py ist von einer anderen Version")
    REAR_X, AXLE_Y, STEP = gfx.REAR_X, gfx.AXLE_Y, gfx.STEP
    LOAD_ERROR = None
except Exception as e:  # pylint: disable=broad-except
    LOAD_ERROR = e


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
    print("FEHLER:", repr(e))
    print("Speicher frei:", getattr(gc, "mem_free", lambda: "?")())
    print("Tipp: code.py UND grafik.py")
    print("neu kopieren. Sonst Foto")
    print("an Claude schicken.")
    while True:
        time.sleep(1)


class Game:
    def __init__(self, display):
        self.store = gfx.Store()
        self.btn = gfx.Buttons()
        self.leds = gfx.Pixels()
        self.sound = gfx.Sound(self.store.sound)
        L = gfx.Bilder()                # die Bilder stehen fertig gezeichnet in grafik.py
        font = L.get("font")[0]
        root = displayio.Group()
        self.world = world = displayio.Group()
        root.append(world)
        load = gfx.Label(font, root, 7, 0xFFFFFF)
        load.set("LÄDT...", 80, 60, 1)
        display.root_group = root

        world.append(L.grid("sky", 1, False))                         # Himmel, Stadt, Straße
        world.append(L.grid("town", 1, False, 0, 53))
        world.append(L.grid("road", 1, False, 0, 98))
        self.dashes = gfx.make_strip(96, 2, 0xEDEDED, 48, 124, 3)      # Mittelstreifen
        world.append(self.dashes)
        lamp = L.grid("lamp", 1, True, 0, 62)                         # ziehen am Gehweg vorbei
        self.props = (lamp, L.grid("tree", 1, True, 0, 72),
                      displayio.TileGrid(lamp.bitmap, pixel_shader=lamp.pixel_shader, y=62))
        for tg in self.props:
            tg.hidden = True
            world.append(tg)
        self.mark_bmp = displayio.Bitmap(40, 2, 2)                     # Reifenspur
        self.mark = displayio.TileGrid(self.mark_bmp, y=116,
                                       pixel_shader=gfx.make_palette((0, 0x1E1E24)))
        world.append(self.mark)
        self.shadow = gfx.make_shadow()
        world.append(self.shadow)
        self.rider = rd = gfx.Rider(L)                                 # Scooter und Fahrer
        self.nf = gfx.NF - 1
        rd.g.x = REAR_X + 72
        rd.g.y = AXLE_Y
        world.append(rd.g)
        self.puffs = gfx.Puffs(world, *L.get("puff"))
        L.close()
        self.lines = []                                                # Fahrtwind-Streifen
        for _ in range(4):
            tg = gfx.make_strip(18, 1, 0xFFFFFF, 18, 0, 1)
            tg.hidden = True
            world.append(tg)
            self.lines.append(tg)

        hud = displayio.Group()
        hud.hidden = True               # erst zeigen, wenn alles fertig ist
        root.append(hud)
        L = gfx.Label
        self.l_rec = L(font, hud, 16, 0xFFFFFF)
        self.l_speed = L(font, hud, 8, 0xFFFFFF)
        self.l_big = L(font, hud, 9, 0xFFFFFF, 2)
        self.l_sub = L(font, hud, 20, 0xFFE27A)
        self.l_msg = L(font, hud, 16, 0xFFFFFF)
        self.l_toast = L(font, hud, 16, 0xFFFFFF)
        self.l_fps = L(font, hud, 9, 0xFFFFFF, 1, 0x101018, ROAD)     # unten links: Bilder pro Sekunde
        self.l_fps.set(" -- FPS", -3, 119)

        # Winkelanzeige: grün = sicher, gelb = Gleichgewicht, rot = Absturzgefahr
        mpal = gfx.make_palette((0, 0x101018, 0x3CCB5A, 0xFFD23F, 0xE84A3C, 0xFFFFFF))
        bmp = displayio.Bitmap(84, 7, 6)
        gfx.rect(bmp, 0, 0, 84, 7, 1)
        for x in range(82):
            deg = x / 81 * CRASH_DEG
            gfx.rect(bmp, 1 + x, 1, 2 + x, 6,
                     2 if deg < BALANCE_DEG - 12 else (3 if deg < BALANCE_DEG + 5 else 4))
        self.meter = displayio.TileGrid(bmp, pixel_shader=mpal, x=38, y=46)
        bmp = displayio.Bitmap(3, 11, 6)
        gfx.rect(bmp, 0, 0, 3, 11, 1)
        gfx.rect(bmp, 1, 1, 2, 10, 5)
        self.marker = displayio.TileGrid(bmp, pixel_shader=mpal, x=38, y=44)
        hud.append(self.meter)
        hud.append(self.marker)

        # Menü: Titel, Farbwahl und die Steuerung auf einer dunklen Tafel
        self.menu = m = displayio.Group()
        root.append(m)
        m.append(displayio.TileGrid(displayio.Bitmap(8, 8, 2), width=15, height=7, tile_width=8,
                                    tile_height=8, y=37,
                                    pixel_shader=gfx.make_palette((0x18244A, 0), False)))
        tg = displayio.TileGrid(font, pixel_shader=gfx.make_palette((0, 0xFFFFFF, 0x0A1024)),
                                width=19, height=6, tile_width=6, tile_height=8, x=3, y=41)
        for row in range(6):
            for i, ch in enumerate(HELP[row]):
                tg[i, row] = gfx.FONT_INDEX.get(ch, 0)
        m.append(tg)
        L(font, m, 9, 0xFFFFFF).set("E-SCOOTER", 80, 1, 1)
        L(font, m, 7, 0xFFD23F, 2, 0x8C3B2E).set("WHEELIE", 80, 10, 1)
        self.l_col = L(font, m, 20, 0xFFFFFF)
        self.l_start = L(font, m, 12, 0xFFD23F)
        self.l_mrec = L(font, m, 16, 0xFFFFFF, 1, 0x101018, ROAD)

        root.remove(load.g)
        hud.hidden = False
        gc.collect()
        self.t = 0.0
        self.sx = 0.0           # Straße: wie weit der Mittelstreifen verschoben ist
        self.pp = 0.0           # Laternen und Baum
        self.last_pp = -1
        self.shadow_n = 10
        self.frames = 0
        self.fps_t = 0.0
        self.toast_t = 0.0
        self.record_t = 0.0
        self.sel_t = -1.0
        self.kmh = -1
        self.rec_key = -1
        self.rainbow = False
        self.body = 0
        self.meter_on = True
        self.saved_color = self.store.color
        self.goto_menu()

    # ---------------- Zustände ----------------
    def reset_ride(self):
        self.v = 0.0            # Geschwindigkeit (m/s)
        self.th = 0.0           # Wheelie-Winkel (rad)
        self.om = 0.0           # Drehgeschwindigkeit (rad/s)
        self.b = 0.0            # Wippen: Nachfedern beim Gasgeben und Landen (rad)
        self.bv = 0.0
        self.wmode = False      # Wheelie-Mode an (mit OBEN)
        self.landing = False    # nochmal OBEN gedrückt: sanft landen
        self.in_wheelie = False
        self.arms = 0           # 0 = normal, 1 = Einhänder, 2 = No-Hander
        self.crouch = False     # Knie-Trick (UNTEN gedrückt)
        self.kn = 0.0           # so weit ist er in den Knien: 0 = steht, 2 = ganz unten
        self.dip = 0.0          # federt nach dem Landen kurz in die Knie
        self.wd = 0.0           # Wheelie-Strecke (m)
        self.wt = 0.0           # Wheelie-Zeit (s)
        self.tp = 0.0           # Trick-Punkte in diesem Wheelie
        self.burn = False
        self.burn_t = 0.0
        self.boost = False
        self.crash_t = 0.0
        self.shake_t = 0.0
        self.banner_t = 0.0     # so lange bleibt das Ergebnis noch stehen
        self.hud_t = 1.0
        self.dpx = 0.0          # so viele Pixel hat sich die Straße in diesem Bild bewegt
        self.mark_x = -99.0
        self.mark_len = 0
        self.emit = 0.0
        self.mark.hidden = True
        self.puffs.clear()
        self.l_big.hide()
        self.l_sub.hide()
        self.l_msg.hide()
        self.l_toast.hide()
        gc.collect()

    def goto_menu(self):
        self.state = MENU
        self.reset_ride()
        self.menu.hidden = False
        self.sel_t = -1.0
        self.l_speed.hide()
        self.rec_key = -1
        self.show_color()

    def show_color(self):
        name, rgb = gfx.COLORS[self.store.color]
        self.rainbow = rgb < 0
        if rgb >= 0:
            self.body = rgb
            self.rider.color(rgb)
        self.l_col.set("FARBE < " + name + " >", 80, 28, 1)

    def start_game(self):
        if self.store.color != self.saved_color:
            self.saved_color = self.store.color
            self.store.save()
        self.state = PLAY
        self.menu.hidden = True
        self.reset_ride()
        self.kmh = -1
        self.rec_key = -1
        self.toast("OBEN=WHEELIE")
        self.sound.play(SND_START)

    def toast(self, text):
        if self.state == MENU:
            self.l_toast.set(text, 3, 108)
        else:
            self.l_toast.set(text, 158, 109, 2)
        self.toast_t = 1.8

    # ---------------- Hauptschritt ----------------
    def step(self, dt):
        b = self.btn
        b.poll()
        self.frames += 1
        self.fps_t += dt
        if self.fps_t >= 1.0:           # Bilder pro Sekunde, einmal pro Sekunde neu
            self.l_fps.set(" %d FPS" % int(self.frames / self.fps_t + 0.5), -3, 119)
            self.frames = 0
            self.fps_t = 0.0
        if dt > 0.1:
            dt = 0.1
        elif dt < 0.001:
            dt = 0.001
        self.t += dt
        if self.t > 600.0:
            self.t -= 600.0
        st = self.state
        if st == PLAY:
            if b.pressed & BTN_START:
                self.state = PAUSE
                self.l_big.set("PAUSE", 80, 14, 1)
                self.l_sub.set("START = WEITER", 80, 33, 1)
                self.l_msg.set("SELECT = MENÜ", 80, 46, 1)
                gc.collect()
            else:
                self.update_play(dt)
        elif st == MENU:
            self.update_menu(dt)
        elif st == CRASH:
            self.update_crash(dt)
        elif b.pressed & BTN_SELECT:
            self.goto_menu()
        elif b.pressed & BTN_START:
            self.state = PLAY
            self.l_big.hide()
            self.l_sub.hide()
            self.l_msg.hide()
            self.banner_t = 0.0
            self.hud_t = 1.0

        if self.toast_t > 0:
            self.toast_t -= dt
            if self.toast_t <= 0:
                self.l_toast.hide()
        st = self.state
        play = st == PLAY
        self.sound.update(dt, self.v / VMAX if st != PAUSE else 0.0,
                          play and b.held & BTN_A,
                          (2 if self.boost else (1 if self.burn else 0)) if play else 0)
        self.draw(dt)

    def update_menu(self, dt):
        b = self.btn
        p = b.pressed
        st = self.store
        if p & (BTN_LEFT | BTN_RIGHT):          # Scooter-Farbe wählen
            n = len(gfx.COLORS)
            st.color = (st.color + (1 if p & BTN_RIGHT else n - 1)) % n
            self.show_color()
            self.sound.play(SND_TICK)
        if p & BTN_SELECT:
            self.sel_t = 0.0
        elif self.sel_t >= 0.0:
            if b.held & BTN_SELECT:             # lange halten = Rekorde löschen
                self.sel_t += dt
                if self.sel_t >= 3.0 > self.sel_t - dt:
                    st.best = 0.0
                    st.tbest = 0
                    st.save()
                    self.rec_key = -1
                    self.toast("REKORDE GELÖSCHT")
                    self.sound.play(SND_OFF)
            else:
                if self.sel_t < 1.0:            # kurz gedrückt = Ton an/aus
                    st.sound = not st.sound
                    self.sound.set_on(st.sound)
                    st.save()
                    self.toast("TON AN" if st.sound else "TON AUS")
                    self.sound.play(SND_TICK)
                self.sel_t = -1.0
        if int(self.t * 2.5) & 1:
            self.l_start.hide()
        else:
            self.l_start.set("START = LOS!", 3, 97)
        if p & BTN_START:
            self.start_game()

    def physics(self, h, gas, brake):
        # Ein kleiner Zeitschritt. Gibt True zurück, wenn das Vorderrad aufsetzt.
        v = self.v
        if self.boost:                          # Boost: zieht richtig schnell bis 100 km/h
            v += BOOST_ACCEL * h
            if v >= VMAX or brake or not gas:
                self.boost = False
        elif gas and not brake:                 # Motor: unten viel Kraft, oben weniger
            v += min(ACCEL, POWER / (v + 0.5)) * h
        if brake:
            v -= BRAKE * h * (0.5 if self.th > 0 else 1.0)
        v -= (ROLL + AERO * v * v) * h          # Roll- und Luftwiderstand
        if v < 0.0:
            v = 0.0
        elif v > VMAX:
            v = VMAX
        self.v = v

        # Drehung um die Hinterachse: die Schwerkraft zieht das Vorderrad nach unten
        th = self.th
        om = self.om
        if th <= 0.0 and om <= 0.0 and not self.wmode:
            return False                        # beide Räder am Boden
        a = -GRAVITY * math.cos(PHI0 + th) - DAMPING * om * (1.6 if self.crouch else 1.0)
        if self.landing:
            a -= LAND_TORQUE
        elif self.wmode:
            f = v / VMAX
            if gas:
                a += LIFT * min(1.0, v * 0.5) * (1.0 - 0.3 * f * f)
            if brake:
                a -= BRAKE_TORQUE * CTRL[self.arms]
            a += WOBBLE[self.arms] * math.sin(self.t * 3.1)
        om += a * h
        if self.landing and om < -LAND_SPEED:
            om = -LAND_SPEED
        th += om * h
        if th <= 0.0:
            landed = self.th > 0.0
            if landed:
                self.bv += BOUNCE * (0.6 - 0.5 * om)        # Aufsetzen: das Vorderrad federt nach
                if om < -2.4:
                    self.v *= 0.94              # harte Landung kostet etwas Tempo
            self.th = 0.0
            self.om = 0.0
            return landed
        self.th = th
        self.om = om
        return False

    def update_play(self, dt):
        b = self.btn
        held = b.held
        gas = (held & BTN_A) != 0
        brake = (held & BTN_B) != 0
        if b.pressed & BTN_UP:
            if not self.wmode:
                self.wmode = True               # Wheelie-Mode an: Vorderrad hochreißen
                self.landing = False
                self.om += POP
            elif self.th > 0:
                self.landing = True             # nochmal OBEN: sanft landen
            else:
                self.wmode = False
        arms = 2 if held & BTN_RIGHT else (1 if held & BTN_LEFT else 0)
        crouch = (held & BTN_DOWN) != 0
        if arms != self.arms or crouch != self.crouch:
            self.arms = arms
            self.crouch = crouch
            if self.in_wheelie and (arms or crouch):
                self.sound.play(SND_TRICK)
                self.hud_t = 1.0

        k = self.kn + (dt * 14.0 if crouch else dt * -14.0)       # weich in die Hocke und zurück
        self.kn = 0.0 if k < 0.0 else (2.0 if k > 2.0 else k)
        if self.dip > 0:
            self.dip -= dt

        # Burnout: Gas + Bremse im Stand. Nach 1 Sekunde B loslassen = Boost!
        burn = gas and brake and self.v < 0.4 and self.th == 0 and not self.wmode
        if burn != self.burn:
            self.burn = burn
            self.l_sub.hide()
            if burn:
                self.burn_t = 0.0
                self.banner_t = 0.0
                self.mark_bmp.fill(0)
                self.mark_len = 0
                self.mark_x = REAR_X - 37.0
                self.mark.x = REAR_X - 37
                self.l_big.set("BURNOUT!", 80, 14, 1)
            elif gas and self.burn_t >= BURNOUT_TIME:
                self.boost = True
                self.l_big.set("BOOST!", 80, 14, 1)
                self.sound.play(SND_BOOST)
            else:
                self.l_big.hide()
        if burn:
            t0 = self.burn_t
            self.burn_t = t1 = t0 + dt
            n = min(40, int(t1 * 30))           # Reifenspur wird länger
            if n > self.mark_len:
                gfx.rect(self.mark_bmp, 40 - n, 0, 40 - self.mark_len, 2, 1)
                self.mark_len = n
                self.mark.hidden = False
            if t1 >= BURNOUT_TIME > t0:
                self.sound.play(SND_READY)
            if t1 >= BURNOUT_TIME:
                if int(self.t * 5) & 1:
                    self.l_sub.set("B LOS = BOOST!", 80, 33, 1)
                else:
                    self.l_sub.hide()
            self.emit += dt * 16                # Rauch am Hinterrad
            if self.emit >= 1:
                self.emit -= 1
                self.puffs.emit(REAR_X - 3 + random.randint(-2, 2), AXLE_Y + 3,
                                -25 - random.random() * 35, -12 - random.random() * 18,
                                0.7 + random.random() * 0.5, 0)
        elif self.boost:                        # Flammen hinten raus
            self.emit += dt * 20
            if self.emit >= 1:
                self.emit -= 1
                self.puffs.emit(REAR_X - 8, AXLE_Y - 2 + random.randint(-2, 2),
                                -60 - random.random() * 60, random.randint(-12, 12), 0.25, 3)

        # Physik in kleinen Schritten
        v0 = self.v
        was_boost = self.boost
        landed = False
        n = int(dt * 60) + 1
        h = dt / n
        for _ in range(n):
            if self.physics(h, gas, brake):
                landed = True
                break
        v = self.v
        if was_boost and not self.boost:
            self.l_big.hide()
            if v >= VMAX - 0.5:
                self.toast("%d KM/H!" % MAX_KMH)

        # Wippen: im Boost wird das Vorderrad leicht, beim Landen federt es nach
        sq = ((v - v0) / dt - 7.0) * 0.03 if self.th == 0 else 0.0
        if sq < 0.0:
            sq = 0.0
        elif sq > 0.21:
            sq = 0.21
        self.bv += ((sq - self.b) * 90.0 - self.bv * 12.0) * dt
        self.b += self.bv * dt
        if self.b < 0.0:
            self.b = 0.0
            if self.bv < 0.0:
                self.bv = 0.0

        d = v * dt
        self.dpx = d * PX_PER_M
        self.sx = (self.sx + self.dpx) % 96.0
        self.pp = (self.pp + self.dpx * 0.9) % 240.0

        if self.th > 0 and not self.in_wheelie:
            self.in_wheelie = True
            self.wd = 0.0
            self.wt = 0.0
            self.tp = 0.0
            self.hud_t = 1.0
            self.banner_t = 0.0
            self.l_msg.hide()
        if self.in_wheelie:
            self.wd += d
            self.wt += dt
            self.tp += d * RATE[arms + (3 if crouch else 0)]
        if self.th >= CRASH_RAD:
            self.crash()
            return
        if landed:
            self.wmode = False
            self.landing = False
            self.dip = 0.16
            if v > 2:                           # Staub beim Aufsetzen
                self.puffs.emit(REAR_X + 26, AXLE_Y + 4, -10.0, -14.0, 0.3, 0)
            if self.in_wheelie:
                self.end_wheelie()
        if self.banner_t > 0:
            self.banner_t -= dt
            if self.banner_t <= 0:
                self.l_big.hide()
                self.l_sub.hide()
                self.l_msg.hide()

    def end_wheelie(self):
        self.in_wheelie = False
        if self.wd < MIN_WHEELIE:
            self.l_big.hide()
            self.l_sub.hide()
            return
        st = self.store
        self.banner_t = 3.0
        self.l_big.set("%.1f M" % self.wd, 80, 14, 1)
        tp = int(self.tp)
        new = False
        if tp > 0:
            self.toast("TRICKS +%d" % tp)
            if tp > st.tbest:
                st.tbest = tp
                new = True
                self.l_msg.set("TRICK-REKORD!", 80, 46, 1)
        if self.wd > st.best:
            st.best = self.wd
            new = True
            self.rec_key = -1
            self.record_t = 2.5
            self.l_sub.set("NEUER REKORD!", 80, 33, 1)
            self.sound.play(SND_RECORD)
        else:
            d = self.wd
            self.l_sub.set(("OK!" if d < 10 else "NICE!" if d < 30 else "STARK!" if d < 80 else
                            "MEGA!" if d < 200 else "WAHNSINN!" if d < 500 else "LEGENDE!")
                           + "  %.1f S" % self.wt, 80, 33, 1)
            self.sound.play(SND_LAND)
        if new:
            st.save()                           # Rekorde bleiben gespeichert
        gc.collect()                            # aufräumen, solange gerade nichts passiert

    def crash(self):
        self.state = CRASH
        self.in_wheelie = False
        self.wmode = False
        self.landing = False
        self.burn = False
        self.boost = False
        self.crash_t = 0.0
        self.shake_t = 0.4
        self.banner_t = 0.0
        self.l_big.set("GESTÜRZT!", 80, 14, 1)
        if self.wd >= MIN_WHEELIE:
            self.l_sub.set("%.1f M ZÄHLT NICHT" % self.wd, 80, 33, 1)
        else:
            self.l_sub.set("AUTSCH!", 80, 33, 1)
        self.l_msg.hide()
        self.sound.play(SND_CRASH)
        gc.collect()

    def update_crash(self, dt):
        self.crash_t += dt
        if self.th < 1.745:                     # kippt weiter bis 100 Grad
            self.om += 6.0 * dt
            self.th = min(self.th + self.om * dt, 1.745)
        self.v = v = max(0.0, self.v - 7.0 * dt)
        self.dpx = v * dt * PX_PER_M
        self.sx = (self.sx + self.dpx) % 96.0
        self.pp = (self.pp + self.dpx * 0.9) % 240.0
        if self.crash_t > 1.0:
            if int(self.t * 2.5) & 1:
                self.l_msg.hide()
            else:
                self.l_msg.set("START = NOCHMAL", 80, 46, 1)
            if self.btn.pressed & (BTN_START | BTN_A):
                self.state = PLAY
                self.reset_ride()

    # ---------------- Zeichnen ----------------
    def draw(self, dt):
        st = self.state
        t = self.t
        rd = self.rider

        # Straße, Laternen und Baum ziehen vorbei
        self.dashes.x = -int(self.sx)
        pp = int(self.pp)
        if pp != self.last_pp:
            self.last_pp = pp
            for k in range(3):
                tg = self.props[k]
                x = (PROP_OFF[k] - pp) % 240 - 30
                if x < 160:
                    tg.x = x
                    tg.hidden = False
                else:
                    tg.hidden = True
        if not self.burn and self.mark_len:     # Reifenspur bleibt auf der Straße liegen
            self.mark_x -= self.dpx
            if self.mark_x < -40:
                self.mark_len = 0
                self.mark.hidden = True
            else:
                self.mark.x = int(self.mark_x)
        if st != PAUSE:
            self.puffs.update(dt, self.dpx)

        # Scooter und Fahrer: passendes Bild zum Winkel
        if st == CRASH:
            k = int((self.th - CRASH_RAD) / (1.746 - CRASH_RAD) * 3)
            rd.crash(2 if k > 2 else k)
            i = self.nf
        else:
            i = int((self.th + self.b) * 57.3 / STEP + 0.5)
            if i > self.nf:
                i = self.nf
            k = int(self.kn + 0.5)
            rd.show(i, 1 if self.dip > 0 and k == 0 else k, self.arms)
        x = REAR_X + (72 if st == MENU else 0)
        y = AXLE_Y
        if self.shake_t > 0:                    # Wackeln beim Sturz
            self.shake_t -= dt
            x += random.randint(-2, 2)
            y += random.randint(-1, 1)
        elif self.burn and st == PLAY:          # Burnout: der Scooter zittert
            x += int(t * 30) & 1
        rd.g.x = x
        rd.g.y = y
        self.shadow.x = x - 5
        n = 10 - i // 3                         # Schatten wird im Wheelie kürzer
        if n != self.shadow_n:
            self.shadow_n = n
            for k in range(10):
                self.shadow[k] = 1 if k < n else 0
        if self.rainbow and self.frames & 1:
            self.body = gfx.rainbow(t * 0.4)
            rd.color(self.body)

        # Fahrtwind-Streifen bei hohem Tempo
        n = int((self.v - 15.0) / 3.0) if st == PLAY else 0
        for k in range(4):
            tg = self.lines[k]
            if k < n:
                x = tg.x - 30
                if x < -18 or tg.hidden:
                    x = 160 + random.randint(0, 50)
                    tg.y = random.randint(24, 100)
                    tg.hidden = False
                tg.x = x
            elif not tg.hidden:
                tg.hidden = True

        # Anzeigen (werden nur neu geschrieben, wenn sich etwas ändert)
        store = self.store
        if st == MENU:
            k = int(t / 3) & 1 if store.tbest else 0
            if k != self.rec_key:
                self.rec_key = k
                self.l_rec.hide()
                if k:
                    self.l_mrec.set("TRICK-REKORD %d" % store.tbest, 158, 119, 2)
                else:
                    self.l_mrec.set("REKORD %.1f M" % store.best, 158, 119, 2)
        else:
            if self.rec_key != 9:
                self.rec_key = 9
                self.l_rec.set("REKORD %.1f M" % store.best, 2, 2)
            k = int(self.v * 3.6 + 0.5)
            if k != self.kmh:
                self.kmh = k
                self.l_speed.set("%d KM/H" % k, 158, 2, 2)
        wheelie = st == PLAY and self.in_wheelie
        if wheelie:
            self.hud_t += dt
            if self.hud_t >= 0.1 and self.wd >= 0.3:
                self.hud_t = 0.0
                self.l_big.set("%.1f M" % self.wd, 80, 14, 1)
                k = self.arms + (3 if self.crouch else 0)
                if k:
                    self.l_sub.set("%s +%d" % (NAMES[k], int(self.tp)), 80, 33, 1)
                else:
                    self.l_sub.set("%.1f S" % self.wt, 80, 33, 1)
            self.marker.x = 38 + int(min(self.th / CRASH_RAD, 1.0) * 81)
        if wheelie != self.meter_on:
            self.meter_on = wheelie
            self.meter.hidden = not wheelie
            self.marker.hidden = not wheelie

        # LED unter dem Bildschirm
        if self.record_t > 0:
            self.record_t -= dt
            k = (gfx.rainbow(t * 3) >> 3) & 0x1F1F1F
        elif st == CRASH:
            k = 0x280000 if int(t * 6) & 1 else 0
        elif st == MENU:
            k = (self.body >> 3) & 0x1F1F1F     # zeigt die gewählte Scooter-Farbe
        elif st == PAUSE:
            k = 0
        elif self.boost:
            k = 0x181838 if int(t * 15) & 1 else 0x303040
        elif self.burn:
            if self.burn_t >= BURNOUT_TIME:
                k = 0x003000 if int(t * 8) & 1 else 0x283000
            else:
                k = 0x281400 if int(t * 15) & 1 else 0x280800
        elif self.in_wheelie:
            k = int(min(self.th / CRASH_RAD, 1.0) * 8)             # grün -> gelb -> rot
            k = (min(40, k * 7) << 16) | (min(30, (8 - k) * 8) << 8)
        else:
            k = 0
        self.leds.set(k)


def main():
    if LOAD_ERROR is not None:
        show_error(LOAD_ERROR)
    display = board.DISPLAY
    try:
        game = Game(display)
        display.auto_refresh = False
        ticks = supervisor.ticks_ms
        last = ticks()
        while True:
            now = ticks()
            game.step(((now - last) & 0x1FFFFFFF) * 0.001)
            last = now
            display.refresh()
            wait = FRAME_MS - ((ticks() - now) & 0x1FFFFFFF)
            if wait > 0:
                time.sleep(wait * 0.001)
    except Exception as e:  # pylint: disable=broad-except
        show_error(e)


# Im Simulator (tools/simulator.py) wird das Spiel ferngesteuert,
# auf dem PyBadge startet es direkt hier.
if not getattr(board, "SIMULATED", False):
    main()
