#!/usr/bin/env python3
"""Zeichnet alle Bilder für E-SCOOTER WHEELIE und hängt sie an grafik.py an.

Der PyBadge hat sehr wenig Arbeitsspeicher. Deshalb wird hier - auf dem
Computer - alles vorgezeichnet: Scooter und Fahrer in jedem Winkel, die Stadt,
die Schrift ... Das Ergebnis steht als Kommentar-Zeilen ganz unten in
grafik.py. Kommentare kosten auf dem PyBadge keinen Speicher; grafik.py liest
beim Start einfach seine eigenen letzten Zeilen.

    python tools/bilder.py                  # grafik.py neu füllen
    python tools/bilder.py vorschau [png]   # zusätzlich eine Vorschau malen (braucht Pillow)

Format einer Bild-Gruppe:
    #@ name breite höhe farbe0 farbe1 ...     (Farben als rrggbb)
    #<eine Zeile pro Bildzeile, hex>          jedes Byte = (Länge-1) << bits | Farbe
bits = 2 bei höchstens 4 Farben, sonst 4. Farbe 0 am Zeilenende wird weggelassen.
Dazu kommt die Tabelle "#= tab <hex>": für jedes Bild 17 Bytes, wo welches
Körperteil hingehört (siehe Rider.show in grafik.py).
"""

import ast
import math
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
GRAFIK = os.path.join(HERE, "..", "grafik.py")
MARK = "# ==BILDER=="
B = 100                       # Zeichen-Nullpunkt (Hinterachse) auf der Arbeitsfläche

LEAN = 0.7                    # der Fahrer lehnt sich weniger weit zurück als der Scooter
TORSO_MIN = -27.0             # Oberkörper-Bild 0: so weit nach vorn gebeugt (Grad)
TORSO_STEP = 4.0              # Grad zwischen zwei Oberkörper-Bildern
ARM_STEP = 4.5                # Grad zwischen zwei Arm-hoch-Bildern
# Posen: (Hüfte x, Hüfte y, Neigung Oberkörper)   0 = stehen, 1 = halb, 2 = Hocke
POSES = ((-0.5, 17.5, -11.0), (-2.2, 14.3, -19.0), (-3.8, 11.0, -27.0))
LEG = 8.7                     # Länge von Unter- und Oberschenkel
ARM = 6.2                     # Länge von Ober- und Unterarm
TORSO = 10.3                  # Hüfte bis Schulter

# Pixel-Schrift 5x7 (Reihenfolge der Zeichen: FONT_CHARS in grafik.py)
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


def constants(path=GRAFIK):
    """Liest die einfachen Konstanten (STEP, NF, FONT_CHARS ...) aus grafik.py."""
    with open(path, encoding="utf-8") as f:
        tree = ast.parse(f.read())
    out = {}
    for node in tree.body:
        if not isinstance(node, ast.Assign):
            continue
        try:
            value = ast.literal_eval(node.value)
        except (ValueError, SyntaxError):
            continue
        for t in node.targets:
            if isinstance(t, ast.Name):
                out[t.id] = value
            elif isinstance(t, ast.Tuple) and isinstance(value, tuple):
                for name, v in zip(t.elts, value):
                    out[name.id] = v
    return out


# ------------------------------------------------------------------
# Zeichenfläche
# ------------------------------------------------------------------
class Canvas:
    def __init__(self, w=2 * B, h=2 * B):
        self.w, self.h = w, h
        self.px = [[0] * w for _ in range(h)]
        self.co = 0               # wird auf jede Farbnummer addiert
        self.remap = None         # oder: Tabelle Farbnummer -> Farbnummer

    def span(self, xa, xb, y, c):
        if 0 <= y < self.h:
            c = self.remap[c] if self.remap else c + self.co
            row = self.px[y]
            for x in range(max(0, xa), min(self.w - 1, xb) + 1):
                row[x] = c

    def dot(self, p, c):
        self.span(int(p[0]), int(p[0]), int(p[1]), c)

    def rect(self, x0, y0, x1, y1, c):
        # x1/y1 exklusiv
        for y in range(y0, y1):
            self.span(x0, x1 - 1, y, c)

    def blob(self, cx, cy, r, c):
        for y in range(-int(r), int(r) + 1):
            hw = int(math.sqrt(max(0, r * r - y * y)))
            self.span(int(cx) - hw, int(cx) + hw, int(cy) + y, c)

    def poly(self, p, c):
        # konvexes Polygon füllen (Pixel-Mitten)
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

    def bbox(self):
        ys = [y for y in range(self.h) if any(self.px[y])]
        xs = [x for x in range(self.w) if any(self.px[y][x] for y in ys)]
        return xs[0], ys[0], xs[-1], ys[-1]

    def crop(self, box):
        x0, y0, x1, y1 = box
        return [row[x0:x1 + 1] for row in self.px[y0:y1 + 1]]


def part(*draws):
    """Zeichnet ein oder mehrere Bildchen und schneidet sie GEMEINSAM aus.
    Ergebnis: ([Pixel-Zeilen, ...], dx, dy) - dx/dy = linke obere Ecke ab Nullpunkt."""
    cs = []
    for draw in draws:
        c = Canvas()
        draw(c)
        cs.append(c)
    boxes = [c.bbox() for c in cs]
    box = (min(b[0] for b in boxes), min(b[1] for b in boxes),
           max(b[2] for b in boxes), max(b[3] for b in boxes))
    return [c.crop(box) for c in cs], box[0] - B, box[1] - B


def pack(tiles):
    """Kacheln nebeneinander in ein Blatt (alle so groß wie die größte)."""
    tw = max(len(t[0]) for t in tiles)
    th = max(len(t) for t in tiles)
    sheet = Canvas(tw * len(tiles), th)
    for i, t in enumerate(tiles):
        for y, row in enumerate(t):
            sheet.px[y][i * tw:i * tw + len(row)] = row
    return sheet


def joint(a, b, l1, l2, prefer):
    """Gelenk (Knie, Ellbogen) zwischen a und b: l1 von a entfernt, l2 von b.
    prefer = Richtung, in die das Gelenk zeigen soll."""
    dx, dy = b[0] - a[0], b[1] - a[1]
    d = math.hypot(dx, dy) or 0.001
    if d >= l1 + l2:                  # ganz gestreckt
        k = l1 / (l1 + l2)
        return a[0] + dx * k, a[1] + dy * k
    x = (l1 * l1 - l2 * l2 + d * d) / (2 * d)
    h = math.sqrt(max(0.0, l1 * l1 - x * x))
    ux, uy = dx / d, dy / d
    if -uy * prefer[0] + ux * prefer[1] < 0:
        h = -h
    return a[0] + ux * x - uy * h, a[1] + uy * x + ux * h


# ------------------------------------------------------------------
# Scooter und Fahrer
# ------------------------------------------------------------------
PAL_SCOOTER = (0, 0x17171C, 0x19C2A0, 0xA8AEB6)        # Reifen, Scooter-Farbe, Metall
PAL_LEGS = (0, 0x25356E, 0x33509A, 0xEDEDF2)           # Bein hinten, Bein vorn, Schuh
# Shirt, Shirt dunkel, Haut, Haut dunkel, Helm (= Scooter-Farbe), Helm hell, dunkel
PAL_TORSO = (0, 0xE84A3C, 0xB8372D, 0xF4C7A1, 0xD79F7A, 0x19C2A0, 0xF4F4F6, 0x20202A)
PAL_ARMS = (0, 0xE84A3C, 0xF4C7A1, 0xB8372D)           # Ärmel, Hand, Ärmel hinten
HELMET = 5                                              # Nummer der Helm-Farbe in PAL_TORSO


def frames(th):
    # S: Scooter-Koordinaten (Hinterachse = 0,0; x nach vorn, y nach oben) -> Bild
    # R: Fahrer-Koordinaten (Mitte Trittbrett = 0,0) -> Bild. Der Fahrer lehnt sich weniger.
    ct, st = math.cos(th), math.sin(th)
    cp, sp = math.cos(th * LEAN), math.sin(th * LEAN)
    mx = B + 9.5 * ct - 0.6 * st
    my = B - 9.5 * st - 0.6 * ct
    return (lambda x, y: (B + x * ct - y * st, B - x * st - y * ct),
            lambda x, y: (mx + x * cp - y * sp, my - x * sp - y * cp))


def draw_scooter(r, S):
    for x in (0, 26):                                       # Räder: Reifen, Felge, Nabe
        r.circle(S(x, 0), 5.0, 1)
        r.circle(S(x, 0), 2.7, 3)
        r.circle(S(x, 0), 1.0, 1)
    r.seg(S(26, 0), S(24.3, 5.5), 2.2, 1)                   # Gabel
    r.poly((S(1, 0.9), S(21, 0.9), S(21, -2.4), S(1, -2.4)), 2)       # Trittbrett
    r.seg(S(1.6, 0.2), S(-4.0, 4.8), 2.0, 2)                # Schutzblech hinten
    r.seg(S(19.5, -0.8), S(24.3, 5.0), 3.0, 2)              # Hals
    r.seg(S(24.3, 5.0), S(21.3, 22.5), 2.4, 2)              # Lenkstange
    r.seg(S(18.6, 22.8), S(23.8, 22.8), 2.4, 1)             # Lenker mit Griff
    r.seg(S(23.5, 17.0), S(23.9, 19.3), 2.2, 3)             # Licht


def body(th, pose):
    """Die wichtigen Punkte des Fahrers für Winkel th (rad) und Pose."""
    S, R = frames(th)
    hx, hy, lean = POSES[pose]
    hip = R(hx, hy)
    hip = (int(hip[0] + 0.5), int(hip[1] + 0.5))            # der Oberkörper sitzt auf ganzen Pixeln
    psi = math.degrees(th) * LEAN + lean
    return S, R, hip, psi


def draw_leg(r, S, R, hip, front):
    # ein Bein, das auf dem Trittbrett steht (hinteres Bein dunkler)
    o = R(0, 0)
    f = R(1, 0)
    ax, c = (14.5, 2) if front else (5.5, 1)
    ankle = S(ax, 2.3)
    knee = joint(ankle, hip, LEG, LEG, (f[0] - o[0], f[1] - o[1]))
    r.seg(ankle, knee, 3.2, c)
    r.circle(knee, 1.7, c)
    r.seg(knee, hip, 3.8, c)
    r.seg(S(ax - 2.2, 1.6), S(ax + 2.6, 1.6), 2.4, 3)       # Schuh
    if front:
        r.circle(hip, 2.2, 2)


def draw_legs(r, S, R, hip):
    draw_leg(r, S, R, hip, False)
    draw_leg(r, S, R, hip, True)


def draw_swing(r, hip, ph):
    # das freie Bein im Wheelie: hängt an der Hüfte, ph = Winkel nach hinten (rad)
    knee = (hip[0] - 8.6 * math.sin(ph), hip[1] + 8.6 * math.cos(ph))
    q = ph + 0.3                                            # Knie leicht gebeugt
    foot = (knee[0] - 8.4 * math.sin(q), knee[1] + 8.4 * math.cos(q))
    r.seg(hip, knee, 3.8, 2)
    r.circle(knee, 1.7, 2)
    r.seg(knee, foot, 3.2, 2)
    r.circle(hip, 2.2, 2)
    r.seg((foot[0] - 1.5 * math.cos(q), foot[1] - 1.5 * math.sin(q)),
          (foot[0] + 3.0 * math.cos(q), foot[1] + 3.0 * math.sin(q)), 2.4, 3)


def torso_axes(psi):
    # psi in Grad (plus = nach hinten gelehnt) -> Funktion (entlang, nach vorn) -> Bildpunkt ab Hüfte
    a = math.radians(psi)
    ux, uy = -math.sin(a), -math.cos(a)
    fx, fy = math.cos(a), -math.sin(a)
    return lambda hip, along, front=0.0: (hip[0] + ux * along + fx * front,
                                          hip[1] + uy * along + fy * front)


def draw_torso(r, hip, psi):
    # Oberkörper + Kopf + Helm, um die Hüfte gedreht
    P = torso_axes(psi)
    r.seg(P(hip, 0), P(hip, TORSO), 5.6, 1)                 # Shirt
    r.seg(P(hip, 0.6, -2.1), P(hip, TORSO - 0.6, -2.1), 1.5, 2)       # Schatten am Rücken
    r.seg(P(hip, TORSO - 0.4, 0.3), P(hip, TORSO + 2.6, 0.5), 2.8, 4)  # Hals
    head = P(hip, 16.1, 0.5)
    r.circle(head, 3.7, 3)                                  # Kopf
    a = math.radians(psi)
    dome = []
    for k in range(-1, 12):                                 # Helm: von der Stirn bis in den Nacken
        w = math.radians(8 + k * 17) - a
        dome.append((head[0] + 4.5 * math.cos(w), head[1] - 4.5 * math.sin(w) - 0.2))
    r.poly(dome, HELMET)
    r.seg(P(hip, 17.4, 2.0), P(hip, 19.2, 0.6), 1.2, 6)     # Glanzlicht
    r.seg(P(hip, 16.7, 2.6), P(hip, 16.3, 5.9), 1.3, 7)     # Schirm
    r.dot(P(hip, 15.2, 2.9), 7)                             # Auge


def shoulder(hip, psi):
    return torso_axes(psi)(hip, TORSO)


def draw_bar(r, sh, grip, psi):
    # Arm am Lenker: der Ellbogen zeigt nach unten/hinten
    a = math.radians(psi)
    el = joint(sh, grip, ARM, ARM, (math.sin(a) - 0.7 * math.cos(a), math.cos(a) + 0.7 * math.sin(a)))
    r.seg(sh, el, 2.6, 1)
    r.seg(el, grip, 2.4, 1)
    r.circle(grip, 1.5, 2)


def up_points(sh, phi, o):
    # Ellbogen und Hand eines hochgestreckten Arms (o = -1 hinten, 1 vorn), phi in Grad
    cp, sp = math.cos(math.radians(phi)), math.sin(math.radians(phi))
    return ((sh[0] + o * 3.5 * cp - 5.5 * sp, sh[1] - o * 3.5 * sp - 5.5 * cp),
            (sh[0] + o * 5.5 * cp - 11.5 * sp, sh[1] - o * 5.5 * sp - 11.5 * cp))


def draw_up(r, sh, phi, both):
    for o, c in (((-1, 3), (1, 1)) if both else ((-1, 3),)):
        el, hand = up_points(sh, phi, o)
        r.seg(sh, el, 2.6, c)
        r.seg(el, hand, 2.4, c)
        r.circle(hand, 1.5, 2)


def torso_tile(K, psi):
    return max(0, min(K["NT"] - 1, int((psi - TORSO_MIN) / TORSO_STEP + 0.5)))


def arm_tile(K, th_deg):
    return max(0, min(K["NU"] - 1, int(th_deg * LEAN / ARM_STEP + 0.5)))


def draw_crash(r, K, th_deg, lean):
    # ganzer Scooter + Fahrer in einem Bild (für den Sturz). Farben: 1-3 Scooter,
    # 4-6 Beine, 7-13 Oberkörper (die Arme benutzen dessen Farben mit)
    global LEAN
    keep = LEAN
    LEAN = lean
    S, R, hip, psi = body(math.radians(th_deg), 0)
    draw_scooter(r, S)
    r.co = 3
    draw_legs(r, S, R, hip)
    r.co = 6
    draw_torso(r, hip, psi)
    r.co = 0
    r.remap = (0, 7, 9, 8)            # Ärmel, Hand, Ärmel hinten -> Farben vom Oberkörper
    draw_up(r, shoulder(hip, psi), th_deg * lean, True)
    r.remap = None
    LEAN = keep


def build_rider(K):
    """Alle Bildchen für Scooter und Fahrer + die Tabelle, wo welches Teil hingehört."""
    n, step, nt, nu = K["NF"], K["STEP"], K["NT"], K["NU"]
    O = (B, B)
    torso = [part(lambda c, j=j: draw_torso(c, O, TORSO_MIN + TORSO_STEP * j)) for j in range(nt)]
    up = [part(lambda c, u=u: draw_up(c, O, ARM_STEP * u, False),      # [Einhänder, No-Hander]
               lambda c, u=u: draw_up(c, O, ARM_STEP * u, True)) for u in range(nu)]
    ns = K["NS"]                      # freies Bein: von 50 Grad nach vorn bis 75 Grad nach hinten
    swing = part(*[lambda c, u=u: draw_swing(c, O, -0.9 + 2.2 * (u + 0.5) / ns) for u in range(ns)])
    sc, legs, bleg, bar = [], [], [], []
    tab = bytearray()

    def ofs(*values):
        for v in values:
            assert -128 <= v <= 127, v
            tab.append(v + 128)

    for pose in range(len(POSES)):
        for i in range(n):
            S, R, hip, psi = body(math.radians(i * step), pose)
            if pose == 0:
                sc.append(part(lambda c: draw_scooter(c, S)))
            ofs(sc[i][1], sc[i][2])
            # Beine: im Stehen ein Bild pro Winkel. In der Hocke reicht eines für zwei
            # Winkel (gezeichnet für die Mitte) - das spart Speicher und fällt nicht auf.
            if pose == 0 or i % 2 == 0:
                S2, R2, hip2, _ = body(math.radians((i + (0.5 if pose else 0)) * step), pose)
                legs.append(part(lambda c: draw_leg(c, S2, R2, hip2, True)))
                bleg.append(part(lambda c: draw_leg(c, S2, R2, hip2, False)))
            tab.append(len(legs) - 1)
            ofs(legs[-1][1], legs[-1][2])
            j = torso_tile(K, psi)
            tab.append(j)
            ofs(hip[0] - B + torso[j][1], hip[1] - B + torso[j][2])
            psi = TORSO_MIN + TORSO_STEP * j                  # so steht der Oberkörper wirklich
            sh = shoulder(hip, psi)
            p = part(lambda c: draw_bar(c, sh, S(20.3, 22.8), psi))
            bar.append(p)
            ofs(p[1], p[2])
            u = arm_tile(K, i * step)
            tab.append(u)
            ofs(int(sh[0] + 0.5) - B + up[u][1], int(sh[1] + 0.5) - B + up[u][2])
            ofs(bleg[-1][1], bleg[-1][2], hip[0] - B, hip[1] - B)
    assert len(legs) == K["NL"], "NL in grafik.py muss %d sein" % len(legs)
    assert len(POSES) == K["NP"]

    crash = []                        # zwei Bilder: Scooter kippt, Fahrer fällt ab
    last = (n - 1) * step             # größter Winkel der normalen Bilder
    for k in (2, 3):
        p = part(lambda c: draw_crash(c, K, last + (100 - last) * k / 3, LEAN + (1 - LEAN) * k / 3))
        crash.append(p)
        ofs(p[1], p[2])
    ofs(swing[1], swing[2])

    cpal = PAL_SCOOTER + PAL_LEGS[1:] + PAL_TORSO[1:]
    out = [("sc", pack([p[0][0] for p in sc]), PAL_SCOOTER),
           ("bleg", pack([p[0][0] for p in bleg]), PAL_LEGS),
           ("swing", pack(swing[0]), PAL_LEGS),
           ("legs", pack([p[0][0] for p in legs]), PAL_LEGS),
           ("torso", pack([p[0][0] for p in torso]), PAL_TORSO),
           ("bar", pack([p[0][0] for p in bar]), PAL_ARMS),
           ("up", pack([p[0][0] for p in up] + [p[0][1] for p in up]), PAL_ARMS)]
    for k, p in enumerate(crash):
        out.append(("cr%d" % k, pack([p[0][0]]), cpal))
    return out, bytes(tab)


# ------------------------------------------------------------------
# Hintergrund und Kleinkram
# ------------------------------------------------------------------
class Band(Canvas):
    """Ein waagrechter Streifen des Hintergrunds, gezeichnet in Bildschirm-Koordinaten."""

    def __init__(self, y0, h, w=160):
        super().__init__(w, h)
        self.y0 = y0

    def span(self, xa, xb, y, c):
        super().span(xa, xb, y - self.y0, c)

    def get(self, x, y):
        return self.px[y - self.y0][x]

    def fade(self, y, c):
        # weicher Übergang über 3 Zeilen: Farbe c wird nach unten immer dichter
        for k in range(3):
            for x in range(self.w):
                if k == 0:
                    on = (x + 2 * y) % 4 == 0
                elif k == 1:
                    on = (x + y) % 2 == 0
                else:
                    on = (x + 2 * y) % 4 != 2
                if on:
                    self.span(x, x, y + k, c)


def build_background():
    W = 160
    # --- Himmel: 0 blau oben, 1 hellblau, 2 Sonne, 3 Wolken ---
    sky = Band(0, 53)
    pal_sky = (0x3E8EDE, 0x6FB4EE, 0xFFE27A, 0xFFFFFF)
    sky.rect(0, 30, W, 53, 1)
    sky.fade(27, 1)
    for y in range(8, 34):            # Sonne mit Schein
        for x in range(116, 144):
            d = (x - 129.5) ** 2 + (y - 20.5) ** 2
            if d < 81 or (d < 125 and (x + y) % 2 == 0):
                sky.span(x, x, y, 2)
    for cx, cy, s in ((20, 40, 1.0), (75, 35, 0.7), (128, 43, 0.85)):     # Wolken
        for dx, dy, r in ((0, 4, 5), (6, 1, 6), (13, 3, 5), (19, 5, 4), (7, 6, 5)):
            sky.blob(cx + dx * s, cy + dy * s, r * s, 3)

    # --- Stadt ---
    # 0 Himmel unten, 1 Himmel Mitte, 2/3 Hochhäuser + Fenster, 4-7 Wände,
    # 8/9 Dächer, 10 Fenster, 11 Fensterrahmen, 12 Tür, 13/14 Baum, 15 Stamm
    town = Band(53, 45)
    pal_town = (0xA8D8F5, 0x6FB4EE, 0x9DB9DA, 0xB9D0EA, 0xF0E7D3, 0xF3C9A2, 0xC3E0CC, 0xCBD8EA,
                0xB04E3E, 0x5C6781, 0x6C8DB8, 0xFFFFFF, 0x7A4E36, 0x55B462, 0x3D8F4B, 0x6B4A2B)
    town.rect(0, 53, W, 56, 1)
    for k, y in enumerate((56, 57, 58)):          # Übergang nach unten: Farbe 1 wird dünner
        for x in range(W):
            if (k == 0 and (x + 2 * y) % 4 != 2) or (k == 1 and (x + y) % 2 == 0) \
                    or (k == 2 and (x + 2 * y) % 4 == 0):
                town.span(x, x, y, 1)
    # Hochhäuser in der Ferne: (x, Breite, Höhe)
    for x, w, h in ((0, 13, 22), (15, 10, 31), (27, 16, 18), (46, 12, 27), (60, 9, 20),
                    (71, 15, 33), (88, 11, 24), (101, 14, 29), (117, 10, 19), (129, 13, 26),
                    (144, 16, 22)):
        top = 98 - h
        town.rect(x, top, x + w, 98, 2)
        for wy in range(top + 3, 92, 5):
            for wx in range(x + 2, x + w - 2, 4):
                if (wx * 7 + wy * 3) % 5 < 3:
                    town.rect(wx, wy, wx + 2, wy + 2, 3)

    def house(x, w, h, wall, roof, door=None, flat=False, rows=9):
        top = 98 - h
        town.rect(x, top, x + w, 98, wall)
        if flat:                                   # Flachdach mit Kante
            town.rect(x - 1, top - 2, x + w + 1, top, roof)
        else:                                      # Giebeldach
            for i in range(w // 2 + 2):
                town.rect(x - 1 + i, top - 1 - i, x + w + 1 - i, top - i, roof)
        cols = list(range(x + 4, x + w - 6, 9))
        pad = (x + w - 4 - (cols[-1] + 5)) // 2 if cols else 0
        for wy in list(range(top + 4, 86, 9))[:rows]:
            for wx in cols:
                town.rect(wx + pad - 1, wy - 1, wx + pad + 6, wy + 7, 11)
                town.rect(wx + pad, wy, wx + pad + 5, wy + 6, 10)
                town.rect(wx + pad, wy + 2, wx + pad + 5, wy + 3, 11)
        if door is not None:
            town.rect(x + door, 89, x + door + 6, 98, 12)
            town.span(x + door + 4, x + door + 4, 93, 11)

    def tree(tx):
        town.rect(tx - 1, 85, tx + 2, 98, 15)
        town.blob(tx, 79, 8, 14)
        town.blob(tx - 2, 76, 5, 13)
        town.blob(tx + 4, 81, 3, 13)

    house(-6, 30, 24, 5, 8, door=12)
    tree(33)
    house(42, 44, 37, 4, 9, flat=True, rows=1)      # helle, ruhige Wand hinter dem Fahrer
    town.rect(42, 95, 86, 98, 7)
    house(88, 24, 22, 6, 8, door=9)
    tree(120)
    house(128, 38, 33, 7, 9, flat=True, rows=1)     # ... und hinter dem Scooter im Menü
    town.rect(128, 95, 160, 98, 4)

    # --- Straße: 0 Asphalt, 1 Gehweg, 2 Bordstein, 3 heller Rand ---
    road = Band(98, 30)
    pal_road = (0x3B3B45, 0xB9B9C3, 0x7A7A86, 0x8E8E99)
    road.rect(0, 98, W, 104, 1)
    road.rect(0, 104, W, 107, 2)
    road.rect(0, 108, W, 109, 3)
    for x in range(0, W, 20):                      # Fugen im Gehweg
        road.rect(x + 7, 99, x + 8, 104, 3)
    return [("sky", sky, pal_sky), ("town", town, pal_town), ("road", road, pal_road)]


def build_font(K):
    chars = K["FONT_CHARS"]
    data = bytes.fromhex(FONT_HEX)
    assert len(data) == 7 * len(chars), "FONT_HEX passt nicht zu FONT_CHARS"
    font = Canvas(6 * len(chars), 8)
    for value, d in ((2, 1), (1, 0)):     # 2 = Schatten (um 1 Pixel versetzt), 1 = Schrift
        for g in range(len(chars)):
            for r in range(7):
                for c in range(5):
                    if data[g * 7 + r] & (16 >> c):
                        font.px[r + d][g * 6 + c + d] = value
    return [("font", font, (0, 0xFFFFFF, 0x101018))]


def build_props():
    lamp = Canvas(9, 40)              # Laterne
    lamp.rect(4, 8, 6, 40, 1)
    lamp.rect(3, 36, 7, 40, 3)
    lamp.rect(1, 2, 8, 8, 3)
    lamp.rect(2, 3, 7, 7, 2)
    lamp.rect(2, 0, 7, 2, 3)
    lamp.rect(3, 8, 7, 9, 3)
    tree = Canvas(17, 30)             # Baum
    tree.rect(7, 14, 10, 30, 3)
    tree.blob(8, 9, 8, 2)
    tree.blob(6, 6, 5, 1)
    tree.blob(12, 11, 3, 1)
    puff = Canvas(72, 12)             # 0-2 Rauch (klein, mittel, groß), 3-5 Flamme
    for i, r in enumerate((2.2, 3.8, 5.4)):
        puff.blob(i * 12 + 6, 6, r, 2)
        puff.blob(i * 12 + 6, 6, r - 1.2, 1)
        puff.blob(i * 12 + 42, 6, r, 5)
        puff.blob(i * 12 + 42, 6, r - 1, 4)
        puff.blob(i * 12 + 42, 6, r - 2.4, 3)
    return [("lamp", lamp, (0, 0x4A4F5A, 0xFFF3B8, 0x2E323A)),
            ("tree", tree, (0, 0x55B462, 0x3D8F4B, 0x6B4A2B)),
            ("puff", puff, (0, 0xE6E6EA, 0xB4B4BC, 0xFFF3A0, 0xFFB52E, 0xE8473C))]


# ------------------------------------------------------------------
# Ausgabe
# ------------------------------------------------------------------
ORDER = ("font", "sky", "town", "road", "lamp", "tree", "sc", "bleg", "swing", "legs", "torso", "bar", "up",
         "cr0", "cr1", "puff")


def bits_for(colors):
    return 2 if len(colors) <= 4 else 4


def encode(name, sheet, colors):
    bits = bits_for(colors)
    longest = 1 << (8 - bits)
    lines = ["#@ %s %d %d %s" % (name, sheet.w, sheet.h, " ".join("%06x" % c for c in colors))]
    runs = drawn = 0
    for row in sheet.px:
        assert max(row) < len(colors), "Farbe außerhalb der Palette: " + name
        end = sheet.w
        while end and row[end - 1] == 0:
            end -= 1
        out = bytearray()
        x = 0
        while x < end:
            c = row[x]
            k = x + 1
            while k < end and row[k] == c and k - x < longest:
                k += 1
            out.append(((k - x - 1) << bits) | c)
            runs += 1
            drawn += c != 0
            x = k
        lines.append("#" + out.hex())
    return lines, runs, drawn


def build(K=None, stats=None):
    """Alle Zeilen, die unter die Markierung in grafik.py gehören."""
    K = K or constants()
    rider, tab = build_rider(K)
    by_name = {name: (sheet, pal)
               for name, sheet, pal in build_font(K) + build_background() + build_props() + rider}
    lines = []
    for name in ORDER:
        sheet, pal = by_name[name]
        part_lines, runs, drawn = encode(name, sheet, pal)
        lines += part_lines
        if stats is not None:
            stats.append((name, sheet.w, sheet.h, len(pal),
                          ((sheet.w * bits_for(pal) + 31) // 32) * 4 * sheet.h, runs, drawn))
        if name == "up":
            lines.append("#= tab " + tab.hex())
    return lines, by_name, tab


def write(lines, path=GRAFIK):
    with open(path, encoding="utf-8") as f:
        src = f.read()
    head = src[:src.index("\n" + MARK) + 1]     # alles vor der Markierungs-Zeile
    with open(path, "w", encoding="utf-8", newline="\n") as f:
        f.write(head + MARK + " (automatisch erzeugt von tools/bilder.py - nicht ändern)\n")
        f.write("\n".join(lines) + "\n")


def preview(by_name, tab, K, path):
    """Alle Blätter und zusammengesetzte Posen als großes PNG (zum Anschauen)."""
    from PIL import Image
    Z = 5
    width = 560

    def rgb(c):
        return (c >> 16) & 255, (c >> 8) & 255, c & 255

    def render(sheet, pal, x0, x1):
        im = Image.new("RGB", (x1 - x0, sheet.h), (255, 0, 255))
        for y, row in enumerate(sheet.px):
            for x in range(x0, x1):
                if row[x] or name in ("sky", "town", "road"):
                    im.putpixel((x - x0, y), rgb(pal[row[x]]))
        return im

    def blit(dst, name, tile, count, x, y):
        sheet, pal = by_name[name]
        tw = sheet.w // count
        for yy, row in enumerate(sheet.px):
            for xx in range(tw):
                c = row[tile * tw + xx]
                if c and 0 <= x + xx < dst.width and 0 <= y + yy < dst.height:
                    dst.putpixel((x + xx, y + yy), rgb(pal[c]))

    n = K["NF"]
    strips = []
    # zusammengesetzte Posen (so wie Rider.show sie baut)
    for pose in range(len(POSES)):
        for arms in range(3):
            im = Image.new("RGB", (width, 62), (236, 228, 208) if arms != 1 else (150, 200, 240))
            for col, i in enumerate((0, 2, 4, 7, 10, 13, 16, 19, n - 1)):
                f = i + n * pose
                t = tab[f * 17:f * 17 + 17]
                ox, oy = 22 + col * 60, 54
                blit(im, "sc", i, n, ox + t[0] - 128, oy + t[1] - 128)
                if arms == 1:
                    blit(im, "swing", (col * 2 + 3) % K["NS"], K["NS"],
                         ox + t[15] - 128 + tab[-2] - 128, oy + t[16] - 128 + tab[-1] - 128)
                else:
                    blit(im, "legs", t[2], K["NL"], ox + t[3] - 128, oy + t[4] - 128)
                blit(im, "bleg", t[2], K["NL"], ox + t[13] - 128, oy + t[14] - 128)
                blit(im, "torso", t[5], K["NT"], ox + t[6] - 128, oy + t[7] - 128)
                if arms != 2:
                    blit(im, "bar", f, len(POSES) * n, ox + t[8] - 128, oy + t[9] - 128)
                if arms:
                    blit(im, "up", t[10] + (K["NU"] if arms == 2 else 0), 2 * K["NU"],
                         ox + t[11] - 128, oy + t[12] - 128)
            strips.append(im)
    im = Image.new("RGB", (width, 66), (150, 200, 240))
    for k in range(2):
        t = tab[len(POSES) * n * 17 + 2 * k:]
        blit(im, "cr%d" % k, 0, 1, 60 + k * 90 + t[0] - 128, 58 + t[1] - 128)
    strips.append(im)
    for name in ("sky", "town", "road", "font", "lamp", "tree", "puff", "torso", "up"):
        sheet, pal = by_name[name]
        for x0 in range(0, sheet.w, width):
            strips.append(render(sheet, pal, x0, min(sheet.w, x0 + width)))
    height = sum(s.height + 3 for s in strips)
    big = Image.new("RGB", (width, height), (60, 60, 60))
    y = 0
    for s in strips:
        big.paste(s, (0, y))
        y += s.height + 3
    big.resize((width * Z, height * Z), Image.NEAREST).save(path)


def main():
    K = constants()
    stats = []
    lines, by_name, tab = build(K, stats)
    write(lines)
    total = runs = drawn = 0
    for name, w, h, n, ram, r, d in stats:
        print("%-6s %4d x %-3d %2d Farben %6d Bytes RAM %6d Läufe (%d gezeichnet)"
              % (name, w, h, n, ram, r, d))
        total += ram
        runs += r
        drawn += d
    size = sum(len(line) + 1 for line in lines)
    print("Summe: %d Bytes RAM, %d Läufe (%d gezeichnet), %d Bytes Text in grafik.py"
          % (total, runs, drawn, size))
    if len(sys.argv) > 1:
        out = sys.argv[2] if len(sys.argv) > 2 else os.path.join(HERE, "vorschau.png")
        preview(by_name, tab, K, out)
        print("Vorschau:", out)


if __name__ == "__main__":
    main()
