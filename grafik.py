# Grafik für E-SCOOTER WHEELIE (gehört zu code.py, beide Dateien auf CIRCUITPY!)
#
# Hier wird alles gemalt: Schrift, Hintergrund, Scooter, Rauch.
# Das meiste davon läuft nur einmal beim Start.

import binascii
import math
import random

import displayio
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


def draw_rider(cv, th, lean):
    # Scooter + Fahrer, Wheelie-Winkel th (rad). Drehpunkt = Hinterachse.
    ct = math.cos(th)
    st = math.sin(th)
    ox, oy = SPR_PX, SPR_PY

    def S(x, y):    # Scooter-Koordinaten (Hinterachse = 0,0) -> Bild
        return (ox + x * ct - y * st, oy - x * st - y * ct)

    fx = WHEELBASE * ct      # Schatten auf der Straße
    cv.span(int(ox + min(0, fx)) - 5, int(ox + max(0, fx)) + 4, oy + 5, C_SHADOW)

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

    phi = th * lean          # Fahrer lehnt sich nur teilweise mit zurück
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


def build_frames(group, specs):
    # alle Scooter-Bilder einmal vorzeichnen; specs = [(Winkel in Grad, Zurücklehnen), ...]
    pal = make_palette(SPRITE_COLORS, True)
    frames = []
    for deg, lean in specs:
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
