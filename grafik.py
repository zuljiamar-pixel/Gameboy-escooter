# Grafik + Hardware für E-SCOOTER WHEELIE (gehört zu code.py, beide Dateien auf CIRCUITPY!)
#
# Hier wird alles gemalt (Schrift, Hintergrund, Scooter, Fahrer, Rauch, Rampe)
# und hier sind die Helfer für Knöpfe, LEDs, Ton und Speicher.

import binascii
import math
import random
import struct

import board
import displayio
import keypad
import vectorio
from bitmaptools import fill_region

W, H = 160, 128
REAR_X, AXLE_Y = 48, 112      # Hinterachse auf dem Bildschirm
WHEEL_R = 5
WHEELBASE = 26
SPR_PX, SPR_PY = 60, 60       # Drehpunkt beim Vorzeichnen der Scooter-Bilder

# Pixel-Schrift (5x7, mit eingebautem Schatten)
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
    # Rechteck füllen (x1/y1 exklusiv), am Rand abgeschnitten
    x0 = max(0, x0)
    y0 = max(0, y0)
    x1 = min(bmp.width, x1)
    y1 = min(bmp.height, y1)
    if x1 > x0 and y1 > y0:
        fill_region(bmp, x0, y0, x1, y1, c)


def make_palette(colors, transparent=False):
    p = displayio.Palette(len(colors))
    for i, c in enumerate(colors):
        p[i] = c
    if transparent:
        p.make_transparent(0)
    return p


def blob(bmp, cx, cy, r, c):
    # gefüllter Kreis (Wolken, Bäume, Rauch)
    for y in range(-int(r), int(r) + 1):
        hw = int(math.sqrt(max(0, r * r - y * y)))
        rect(bmp, int(cx) - hw, int(cy) + y, int(cx) + hw + 1, int(cy) + y + 1, c)


def make_font():
    # alle Zeichen in eine Bitmap: Farbe 1 = Schrift, Farbe 2 = Schatten
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
    # ein Text aus Kacheln der Pixel-Schrift

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
        # align: 0 = links, 1 = Mitte, 2 = rechts (bezogen auf x)
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
    # Füllt Polygone und Kreise zeilenweise in eine Bitmap.
    # Ohne Bitmap (bmp = None) wird nur gemessen, wie groß das Bild wird.

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
        # konvexes Polygon füllen
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
        # dicke Linie von a nach b
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


def draw_scooter(cv, th):
    # nur der Scooter (ohne Fahrer), Wheelie-Winkel th (rad). Drehpunkt = Hinterachse.
    ct = math.cos(th)
    st = math.sin(th)
    ox, oy = SPR_PX, SPR_PY

    def S(x, y):    # Scooter-Koordinaten (Hinterachse = 0,0) -> Bild
        return (ox + x * ct - y * st, oy - x * st - y * ct)

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


def build_frames(group, angles):
    # alle Scooter-Bilder einmal vorzeichnen (angles = Winkel in Grad)
    pal = make_palette(SPRITE_COLORS, True)
    frames = []
    for deg in angles:
        r = Raster()
        draw_scooter(r, math.radians(deg))      # 1. Größe messen
        r.bmp = displayio.Bitmap(r.x1 - r.x0 + 1, r.y1 - r.y0 + 1, len(SPRITE_COLORS))
        r.ox, r.oy = r.x0, r.y0
        draw_scooter(r, math.radians(deg))      # 2. wirklich zeichnen
        tg = displayio.TileGrid(r.bmp, pixel_shader=pal,
                                x=REAR_X - SPR_PX + r.x0, y=AXLE_Y - SPR_PY + r.y0)
        tg.hidden = True
        group.append(tg)
        frames.append(tg)
    return frames


def quad(shape, a, b, w):
    # dicke Linie von a nach b als vectorio-Polygon (Enden etwas länger,
    # damit die Gelenke geschlossen aussehen)
    dx = b[0] - a[0]
    dy = b[1] - a[1]
    d = math.sqrt(dx * dx + dy * dy) or 0.001
    nx = -dy / d * w * 0.5
    ny = dx / d * w * 0.5
    ex = dx / d * 0.6
    ey = dy / d * 0.6
    ax, ay = a[0] - ex + 0.5, a[1] - ey + 0.5
    bx, by = b[0] + ex + 0.5, b[1] + ey + 0.5
    shape.points = [(int(ax + nx), int(ay + ny)), (int(bx + nx), int(by + ny)),
                    (int(bx - nx), int(by - ny)), (int(ax - nx), int(ay - ny))]


class Rider:
    # Der Fahrer aus einfachen Formen (vectorio). So kann er Tricks machen,
    # ohne dass für jede Pose eigene Bilder im Speicher liegen müssen.
    # arms: 0 = beide Hände am Lenker, 1 = Einhänder, 2 = No-Hander
    # crouch: True = in die Knie

    def __init__(self, parent):
        pals = {}
        self.g = displayio.Group()
        parent.append(self.g)

        def shape(c, r=0):
            if c not in pals:
                pals[c] = make_palette((c,))
            if r:
                s = vectorio.Circle(pixel_shader=pals[c], radius=r, x=0, y=0)
            else:
                s = vectorio.Polygon(pixel_shader=pals[c], points=[(0, 0), (1, 0), (0, 1)])
            self.g.append(s)
            return s

        # Reihenfolge = von hinten nach vorne
        self.arm_b = (shape(0xB8372D), shape(0xB8372D))     # hinterer Arm
        self.hand_b = shape(0xF4C7A1, 1)
        self.leg_b = (shape(0x223266), shape(0x223266))     # hinteres Bein
        self.shoe_b = shape(0x2A2A2A)
        self.leg_f = (shape(0x2E4485), shape(0x2E4485))     # vorderes Bein
        self.shoe_f = shape(0x2A2A2A)
        self.torso = shape(0xE84A3C)
        self.head = shape(0xF4C7A1, 4)
        self.helmet = shape(0xFFD23F)
        self.arm_f = (shape(0xE84A3C), shape(0xE84A3C))     # vorderer Arm
        self.hand_f = shape(0xF4C7A1, 1)
        self.key = None

    def update(self, th, lean, arms, crouch):
        key = (int(th * 150), int(lean * 20), arms, crouch)
        if key == self.key:
            return                # nichts geändert, nichts neu zeichnen
        self.key = key
        ct = math.cos(th)
        st = math.sin(th)
        phi = th * lean           # Fahrer lehnt sich nur teilweise mit zurück
        cp = math.cos(phi)
        sp = math.sin(phi)
        ox, oy = REAR_X, AXLE_Y
        mx = 9.5 * ct - 0.6 * st
        my = 9.5 * st + 0.6 * ct

        def S(x, y):    # Scooter-Koordinaten (Hinterachse = 0,0) -> Bildschirm
            return (ox + x * ct - y * st, oy - x * st - y * ct)

        def R(x, y):    # Fahrer-Koordinaten (Füße = 0,0) -> Bildschirm
            return (ox + mx + x * cp - y * sp, oy - my - x * sp - y * cp)

        if crouch:      # in die Knie: alles tiefer, Knie weiter vorne
            hip, sh, hd, kx, ky = (-4.0, 9.0), (0.5, 18.5), (2.4, 24.0), 6.5, 8.0
        else:
            hip, sh, hd, kx, ky = (-0.5, 17.5), (1.5, 27.5), (2.6, 33.2), 1.8, 9.0
        hip = R(*hip)
        shoulder = R(*sh)
        for (shin, thigh), shoe, ax in ((self.leg_b, self.shoe_b, 5.5),
                                        (self.leg_f, self.shoe_f, 14.5)):
            knee = R((ax - 9.5) * 0.5 + kx, ky)
            quad(shin, S(ax, 2.0), knee, 3.2)
            quad(thigh, knee, hip, 3.6)
            quad(shoe, S(ax - 2, 1.4), S(ax + 2.2, 1.4), 2.2)
        quad(self.torso, hip, shoulder, 5.5)
        x, y = R(*hd)
        self.head.x = int(x + 0.5)
        self.head.y = int(y + 0.5)
        self.helmet.points = [(int(px + 0.5), int(py + 0.5)) for px, py in
                              (R(hd[0] + 4.6 * math.cos(a), hd[1] + 0.4 + 4.6 * math.sin(a))
                               for a in (0.0, 0.6, 1.2, 1.9, 2.5, 3.14))]
        grip = S(20, 22.5)
        for arm, hand, up, out in ((self.arm_b, self.hand_b, arms >= 1, -1),
                                   (self.arm_f, self.hand_f, arms == 2, 1)):
            if up:      # Hand in die Luft
                elbow = R(sh[0] + 4.0 * out, sh[1] + 5.0)
                h = R(sh[0] + 7.0 * out, sh[1] + 11.0)
            else:       # Hand am Lenker
                h = grip
                elbow = ((shoulder[0] + grip[0]) * 0.5, (shoulder[1] + grip[1]) * 0.5 + 1.5)
            quad(arm[0], shoulder, elbow, 2.4)
            quad(arm[1], elbow, h, 2.2)
            hand.x = int(h[0] + 0.5)
            hand.y = int(h[1] + 0.5)


class Band:
    # ein waagrechter Streifen vom Hintergrund (spart Speicher: drei kleine
    # Bitmaps statt einer großen); Koordinaten sind Bildschirm-Koordinaten
    def __init__(self, y0, h, colors):
        self.y0 = y0
        self.bmp = displayio.Bitmap(W, h, len(colors))
        self.tg = displayio.TileGrid(self.bmp, pixel_shader=make_palette(colors), y=y0)

    def rect(self, x0, y0, x1, y1, c):
        rect(self.bmp, x0, y0 - self.y0, x1, y1 - self.y0, c)

    def blob(self, cx, cy, r, c):
        blob(self.bmp, cx, cy - self.y0, r, c)

    def dither(self, y, c):
        for x in range(y % 2, W, 2):
            self.bmp[x, y - self.y0] = c


def make_background():
    # Himmel, Häuser und Straße: einmal gemalt, bewegt sich nicht
    sky = Band(0, 53, (0x3E8EDE, 0x6FB4EE, 0xFFE27A, 0xFFF3B8, 0xFFFFFF))
    sky.rect(0, 0, W, 30, 0)
    sky.rect(0, 30, W, 53, 1)
    sky.dither(28, 1)
    sky.dither(29, 0)
    for y in range(9, 32):            # Sonne mit Schein
        for x in range(117, 143):
            d = (x - 129.5) ** 2 + (y - 20.5) ** 2
            if d < 81:
                sky.bmp[x, y] = 2
            elif d < 121 and (x + y) % 2 == 0:
                sky.bmp[x, y] = 3
    for cx, cy, s in ((20, 40, 1.0), (75, 35, 0.7), (128, 43, 0.85)):     # Wolken
        for dx, dy, r in ((0, 4, 5), (6, 1, 6), (13, 3, 5), (19, 5, 4), (7, 6, 5)):
            sky.blob(cx + dx * s, cy + dy * s, r * s, 4)

    # 0 Himmel unten, 1 Himmel Mitte, 2/3 Hochhäuser, 4-6 Wände, 7 Dach,
    # 8/9 Baum, 10 Stamm, 11 Fenster, 12 Tür
    town = Band(53, 45, (0xA8D8F5, 0x6FB4EE, 0x8BA6C9, 0xA9C0DD, 0xE9A15B, 0xDDD5C4,
                         0x9FC3A8, 0x8C3B2E, 0x3E9D4B, 0x2E7A3A, 0x6B4A2B, 0x5D7EA6,
                         0x5A3A26))
    town.rect(0, 53, W, 58, 1)
    town.rect(0, 58, W, 98, 0)
    town.dither(56, 0)
    town.dither(57, 1)
    random.seed(7)                    # Hochhäuser in der Ferne
    x = 0
    while x < W:
        w = random.randint(9, 20)
        top = 98 - random.randint(10, 30)
        town.rect(x, top, x + w, 98, 2)
        for wy in range(top + 3, 95, 5):
            for wx in range(x + 2, x + w - 2, 4):
                if random.random() < 0.5:
                    town.rect(wx, wy, wx + 2, wy + 2, 3)
        x += w + random.randint(0, 6)
    random.seed(3)                    # Häuser und Bäume an der Straße
    x = 0
    while x < W:
        if random.random() < 0.35:
            tx = x + 7
            town.rect(tx - 1, 86, tx + 2, 98, 10)
            town.blob(tx, 80, 8, 9)
            town.blob(tx - 3, 77, 5, 8)
            town.blob(tx + 3, 83, 5, 8)
            x += 16
        else:
            w = random.randint(20, 30)
            top = 98 - random.randint(18, 28)
            town.rect(x, top, x + w, 98, random.choice((4, 5, 6)))
            for i in range(w // 2 + 2):    # Dach
                town.rect(x - 1 + i, top - 1 - i, x + w + 1 - i, top - i, 7)
            for wy in range(top + 3, 89, 8):
                for wx in range(x + 3, x + w - 5, 7):
                    town.rect(wx, wy, wx + 4, wy + 5, 11)
            dx = x + w // 2 - 2
            town.rect(dx, 90, dx + 5, 98, 12)
            x += w + random.randint(2, 6)

    road = Band(98, 30, (0xB3B3BD, 0x7A7A86, 0x3B3B45, 0x8E8E99))
    road.rect(0, 98, W, 104, 0)       # Gehweg
    road.rect(0, 104, W, 107, 1)      # Bordstein
    road.rect(0, 107, W, H, 2)        # Straße
    road.rect(0, 108, W, 109, 3)
    return (sky.tg, town.tg, road.tg)


def make_strip(period, h, color, w_on, y):
    # schmaler, endlos scrollender Streifen (Gehwegfugen, Mittelstreifen)
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


def make_shadow():
    # Schatten unter dem Scooter: 10 Kacheln à 4 Pixel, so kann er kürzer werden
    bmp = displayio.Bitmap(8, 1, 2)
    rect(bmp, 4, 0, 8, 1, 1)
    tg = displayio.TileGrid(bmp, pixel_shader=make_palette((0, 0x26262E), True),
                            width=10, height=1, tile_width=4, tile_height=1,
                            x=REAR_X - 5, y=AXLE_Y + 5)
    for i in range(10):
        tg[i] = 1
    return tg


def make_ramp():
    # Holzrampe, 40 x 12 Pixel, links flach, rechts hoch
    pal = make_palette((0, 0x8A6A3E, 0xD9B77A, 0x5A4326, 0xFFD23F), True)
    bmp = displayio.Bitmap(40, 12, 5)
    for x in range(40):
        h = (x + 1) * 12 // 40
        rect(bmp, x, 12 - h, x + 1, 12, 1)
        rect(bmp, x, 12 - h, x + 1, 13 - h, 2)
        if x % 8 < 4 and h > 3:                 # gelbe Warnstreifen
            rect(bmp, x, 12 - h + 2, x + 1, 13 - h + 2, 4)
    rect(bmp, 37, 0, 40, 12, 3)
    return displayio.TileGrid(bmp, pixel_shader=pal, y=AXLE_Y + 5 - 12)


def rainbow(h):
    # Regenbogenfarbe für h zwischen 0 und 1
    i = int(h * 6) % 6
    f = int((h * 6 - int(h * 6)) * 255)
    r, g, b = ((255, f, 0), (255 - f, 255, 0), (0, 255, f),
               (0, 255 - f, 255), (f, 0, 255), (255, 0, 255 - f))[i]
    return (r << 16) | (g << 8) | b


def make_bump():
    pal = make_palette((0, 0x23232A, 0x7D7D88), True)
    bmp = displayio.Bitmap(12, 4, 3)
    rect(bmp, 2, 0, 10, 4, 2)
    rect(bmp, 0, 1, 12, 3, 2)
    rect(bmp, 3, 1, 9, 3, 1)
    rect(bmp, 1, 2, 11, 3, 1)
    return displayio.TileGrid(bmp, pixel_shader=pal, y=115)


class Smoke:
    # Rauchwolken beim Burnout: ein paar kleine Sprites, die wiederverwendet werden

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
                p[1] = x
                p[2] = y
                p[3] = -25 - random.random() * 35
                p[4] = -12 - random.random() * 18
                p[5] = 0.0
                p[6] = 0.7 + random.random() * 0.5
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
    # Die NeoPixel-LED(s) unter dem Bildschirm (ohne Zusatz-Bibliothek).

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
    # Einfache Töne über den eingebauten Lautsprecher (synthio).

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
        # notes: Liste von (Frequenz, Dauer). Frequenz 0 = Pause.
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


SCOOTER_COLORS = (    # Name, Preis in Trick-Punkten, Farbe, dunkle Farbe (-1 = Regenbogen)
    ("MINT", 0, 0x19C2A0, 0x0E7C68),
    ("BLAU", 100, 0x2F7DE1, 0x1B4E95),
    ("PINK", 250, 0xFF5FA2, 0xB03A6E),
    ("FEUER-ROT", 500, 0xE8322B, 0x8E1A14),
    ("SCHWARZ", 1000, 0x3A3A46, 0x18181E),
    ("GOLD", 2000, 0xFFC83D, 0xB07D12),
    ("REGENBOGEN", 5000, -1, 0x34343E),
)


class Store:
    # Rekorde, Trick-Punkte-Konto, gekaufte Farben und Ton im nvm-Speicher
    # (bleibt auch nach dem Ausschalten erhalten)

    def __init__(self):
        self.best = 0.0         # Wheelie-Rekord (m)
        self.tbest = 0          # Trick-Rekord (Punkte)
        self.sound = True
        self.points = 0         # Trick-Punkte zum Ausgeben
        self.owned = 1          # gekaufte Farben (Bit 0 = Mint, ist immer da)
        self.color = 0          # gewählte Farbe
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
                if nvm[3] >= 2:                          # ab Version 2: Konto + Farben
                    pts, owned, color = struct.unpack("<IBB", bytes(nvm[12:18]))
                    if pts < 100000000:
                        self.points = pts
                    self.owned = owned | 1
                    if color < len(SCOOTER_COLORS) and self.owns(color):
                        self.color = color
        except Exception:  # pylint: disable=broad-except
            self.nvm = None

    def owns(self, i):
        return bool(self.owned & (1 << i))

    def save(self):
        if self.nvm is None:
            return
        try:
            self.nvm[0:18] = (b"EW" + bytes((1 if self.sound else 0, 2)) +
                              struct.pack("<ffIBB", self.best, self.tbest, self.points,
                                          self.owned, self.color))
        except Exception:  # pylint: disable=broad-except
            pass
