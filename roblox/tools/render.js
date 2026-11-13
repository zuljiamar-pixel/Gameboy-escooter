// Zeichnet eine exportierte Szene mit three.js (3D) und HTML (HUD) und macht einen Screenshot.
// node render.js <szene.json> <bild.png> <breite> <hoehe> [scale]
const fs = require("fs");
const path = require("path");
const { chromium } = require("playwright");

const [, , inFile, outFile, W = "1280", H = "720", SCALE = "1"] = process.argv;
const THREE = process.env.THREE_JS || path.join(__dirname, "build", "three", "package", "build", "three.min.js");

const page = `<!doctype html><html><head><meta charset="utf-8"><style>
html,body{margin:0;padding:0;overflow:hidden;background:#000;font-family:"DejaVu Sans","Arial Rounded MT Bold",Arial,sans-serif}
#gui{position:absolute;left:0;top:0;width:${W}px;height:${H}px;pointer-events:none}
.g{position:absolute;box-sizing:border-box;display:flex;overflow:visible}
.topbar{position:absolute;left:12px;top:12px;width:44px;height:44px;border-radius:22px;background:rgba(0,0,0,.45)}
</style></head><body><canvas id="c" width="${W}" height="${H}"></canvas><div id="gui"></div></body></html>`;

function sceneScript() {
  /* läuft im Browser */
  const D = window.SZENE;
  const W = window.innerWidth, H = window.innerHeight;
  const renderer = new THREE.WebGLRenderer({ canvas: document.getElementById("c"), antialias: true, preserveDrawingBuffer: true });
  renderer.setSize(W, H, false);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  const scene = new THREE.Scene();

  // Tageszeit
  const uhr = D.uhr;
  const sonne = Math.sin(((uhr - 6) / 12) * Math.PI); // >0 tagsüber
  const tag = Math.max(0, Math.min(1, sonne * 3 + 0.2));
  const himmelTag = new THREE.Color(0.55, 0.72, 0.95), himmelNacht = new THREE.Color(0.03, 0.04, 0.10);
  const himmel = himmelNacht.clone().lerp(himmelTag, tag);
  scene.background = himmel;
  scene.fog = new THREE.Fog(himmel.clone().lerp(new THREE.Color(0.8, 0.82, 0.88), 0.4 * tag), 250, 1300);

  scene.add(new THREE.HemisphereLight(0xdfe8ff, 0x50504a, 0.35 + 1.3 * tag));
  const az = ((uhr - 6) / 12) * Math.PI;
  const sun = new THREE.DirectionalLight(0xfff2dd, 2.2 * tag);
  const cam = D.cam;
  const camPos = new THREE.Vector3(cam[0], cam[1], cam[2]);
  sun.position.set(camPos.x + Math.cos(az) * -300, 400 * Math.max(0.2, sonne), camPos.z + 220);
  sun.target.position.set(camPos.x + 60, 0, camPos.z);
  sun.castShadow = tag > 0.2;
  sun.shadow.mapSize.set(2048, 2048);
  const sc = sun.shadow.camera; sc.left = -160; sc.right = 160; sc.top = 160; sc.bottom = -160; sc.near = 10; sc.far = 1200;
  scene.add(sun); scene.add(sun.target);

  // Lichter (nur die nächsten, WebGL schafft nicht beliebig viele)
  const lichter = D.lichter.slice().sort((a, b) => {
    const da = (a.p[0] - cam[0]) ** 2 + (a.p[2] - cam[2]) ** 2, db = (b.p[0] - cam[0]) ** 2 + (b.p[2] - cam[2]) ** 2;
    return da - db;
  }).slice(0, 10);
  for (const l of lichter) {
    const pl = new THREE.PointLight(new THREE.Color(l.c[0], l.c[1], l.c[2]), l.b * 40, l.r * 1.4, 1.5);
    pl.position.set(l.p[0], l.p[1] - 1, l.p[2]);
    scene.add(pl);
  }

  const geoBox = new THREE.BoxGeometry(1, 1, 1);
  const geoCyl = new THREE.CylinderGeometry(0.5, 0.5, 1, 24); geoCyl.rotateZ(Math.PI / 2);
  const geoBall = new THREE.SphereGeometry(0.5, 20, 14);
  const mats = new Map();
  function mat(t) {
    const key = t.c.join(",") + t.m + t.t;
    if (mats.has(key)) return mats.get(key);
    const col = new THREE.Color().setRGB(t.c[0], t.c[1], t.c[2], THREE.SRGBColorSpace);
    let m;
    if (t.m === "Neon") {
      m = new THREE.MeshBasicMaterial({ color: col.clone().multiplyScalar(1.15) });
    } else {
      m = new THREE.MeshStandardMaterial({
        color: col,
        roughness: t.m === "Metal" || t.m === "Glass" || t.m === "DiamondPlate" ? 0.35 : 0.85,
        metalness: t.m === "Metal" || t.m === "DiamondPlate" ? 0.5 : 0.0,
      });
    }
    if (t.t > 0) { m.transparent = true; m.opacity = 1 - t.t; }
    mats.set(key, m);
    return m;
  }
  for (const t of D.teile) {
    let geo = geoBox, sx = t.s[0], sy = t.s[1], sz = t.s[2];
    if (t.sh === "Cylinder") { geo = geoCyl; const r = Math.min(sy, sz); sy = r; sz = r; }
    else if (t.sh === "Ball") { geo = geoBall; const r = Math.min(sx, sy, sz); sx = sy = sz = r; }
    const mesh = new THREE.Mesh(geo, mat(t));
    const c = t.cf;
    const m4 = new THREE.Matrix4().set(c[3], c[4], c[5], c[0], c[6], c[7], c[8], c[1], c[9], c[10], c[11], c[2], 0, 0, 0, 1);
    m4.multiply(new THREE.Matrix4().makeScale(sx, sy, sz));
    mesh.matrixAutoUpdate = false;
    mesh.matrix.copy(m4);
    mesh.castShadow = t.m !== "Neon" && t.s[0] * t.s[1] * t.s[2] < 400000;
    mesh.receiveShadow = true;
    scene.add(mesh);
  }

  const camera = new THREE.PerspectiveCamera(D.fov, W / H, 0.3, 3000);
  const cm = new THREE.Matrix4().set(cam[3], cam[4], cam[5], cam[0], cam[6], cam[7], cam[8], cam[1], cam[9], cam[10], cam[11], cam[2], 0, 0, 0, 1);
  camera.matrixAutoUpdate = false;
  camera.matrix.copy(cm);
  camera.matrixWorld.copy(cm);
  camera.matrixWorldInverse.copy(cm).invert();
  renderer.render(scene, camera);
}

function guiScript(inset) {
  /* läuft im Browser: einfacher Nachbau der Roblox-GUI-Anordnung */
  const root = document.getElementById("gui");
  const W = window.innerWidth, H = window.innerHeight;
  const meas = document.createElement("canvas").getContext("2d");
  const rgb = (c, a = 1) => `rgba(${Math.round(c[0] * 255)},${Math.round(c[1] * 255)},${Math.round(c[2] * 255)},${a})`;
  const fontFor = (f) => (f === "FredokaOne" ? "bold" : f === "SourceSansBold" ? "bold" : "normal");
  function fitText(text, w, h, weight) {
    const lines = String(text).split("\n");
    let lo = 4, hi = 100;
    while (hi - lo > 1) {
      const mid = (lo + hi) >> 1;
      meas.font = `${weight} ${mid}px "DejaVu Sans", Arial`;
      const wMax = Math.max(...lines.map((l) => meas.measureText(l).width));
      if (wMax <= w && lines.length * mid * 1.15 <= h) lo = mid; else hi = mid;
    }
    return lo;
  }
  function kids(n, cls) { return (n.kids || []).filter((k) => k.cls === cls)[0]; }
  function isGui(n) { return ["Frame", "TextLabel", "TextButton", "ImageLabel", "ImageButton", "ScrollingFrame"].includes(n.cls); }

  function draw(n, rect, layoutRect) {
    if (n.Visible === false) return;
    let w, h, x, y;
    if (layoutRect) { ({ x, y, w, h } = layoutRect); }
    else {
      const s = n.Size || [0, 100, 0, 100], p = n.Position || [0, 0, 0, 0], a = n.AnchorPoint || [0, 0];
      w = rect.w * s[0] + s[1]; h = rect.h * s[2] + s[3];
      const ar = kids(n, "UIAspectRatioConstraint");
      if (ar) { const r = ar.AspectRatio; if (w / h > r) w = h * r; else h = w / r; }
      const sz = kids(n, "UISizeConstraint");
      if (sz && sz.MaxSize) { w = Math.min(w, sz.MaxSize[0]); h = Math.min(h, sz.MaxSize[1]); }
      x = rect.x + rect.w * p[0] + p[1] - a[0] * w;
      y = rect.y + rect.h * p[2] + p[3] - a[1] * h;
    }
    const el = document.createElement("div");
    el.className = "g";
    Object.assign(el.style, { left: x + "px", top: y + "px", width: w + "px", height: h + "px" });
    const bt = n.BackgroundTransparency ?? 0;
    const grad = kids(n, "UIGradient");
    if (bt < 1 && n.BackgroundColor3) {
      if (grad && grad.Color) {
        el.style.background = "linear-gradient(90deg," + grad.Color.map((k) => `${rgb([k[1], k[2], k[3]], 1 - bt)} ${k[0] * 100}%`).join(",") + ")";
      } else el.style.background = rgb(n.BackgroundColor3, 1 - bt);
    }
    const corner = kids(n, "UICorner");
    if (corner) el.style.borderRadius = Math.min(w, h) * corner.CornerRadius[0] + corner.CornerRadius[1] + "px";
    const strokes = (n.kids || []).filter((k) => k.cls === "UIStroke");
    const isText = n.cls === "TextLabel" || n.cls === "TextButton";
    for (const st of strokes) {
      const col = rgb(st.Color || [0, 0, 0], 1 - (st.Transparency || 0));
      if (st.ApplyStrokeMode === "Border" || !isText) el.style.border = `${st.Thickness}px solid ${col}`;
      else el.style.webkitTextStroke = `${Math.min(st.Thickness, 2)}px ${col}`, (el.style.paintOrder = "stroke fill");
    }
    const pad = kids(n, "UIPadding");
    let inner = { x: 0, y: 0, w, h };
    if (pad) {
      const pt = (pad.PaddingTop || [0, 0]), pb = (pad.PaddingBottom || [0, 0]), pl = (pad.PaddingLeft || [0, 0]), pr = (pad.PaddingRight || [0, 0]);
      const t = h * pt[0] + pt[1], b = h * pb[0] + pb[1], l = w * pl[0] + pl[1], r = w * pr[0] + pr[1];
      inner = { x: l, y: t, w: w - l - r, h: h - t - b };
    }
    if (isText && n.Text) {
      const span = document.createElement("div");
      const weight = fontFor(n.Font);
      const size = n.TextScaled ? fitText(n.Text, inner.w, inner.h, weight) : 14;
      Object.assign(span.style, {
        position: "absolute", left: inner.x + "px", top: inner.y + "px", width: inner.w + "px", height: inner.h + "px",
        display: "flex", whiteSpace: "pre", lineHeight: "1.15", fontWeight: weight, fontSize: size + "px",
        color: rgb(n.TextColor3 || [0, 0, 0]),
        justifyContent: n.TextXAlignment === "Left" ? "flex-start" : n.TextXAlignment === "Right" ? "flex-end" : "center",
        alignItems: n.TextYAlignment === "Top" ? "flex-start" : n.TextYAlignment === "Bottom" ? "flex-end" : "center",
        textAlign: n.TextXAlignment === "Left" ? "left" : "center",
      });
      if (el.style.webkitTextStroke) { span.style.webkitTextStroke = el.style.webkitTextStroke; span.style.paintOrder = "stroke fill"; el.style.webkitTextStroke = ""; }
      span.textContent = n.Text;
      el.appendChild(span);
    }
    root.appendChild(el);
    // Kinder
    const childRect = { x: x + inner.x, y: y + inner.y, w: inner.w, h: inner.h };
    const guiKids = (n.kids || []).filter(isGui).sort((a, b) => (a.ZIndex || 1) - (b.ZIndex || 1));
    const grid = kids(n, "UIGridLayout"), list = kids(n, "UIListLayout");
    if (grid) {
      const cs = grid.CellSize, cp = grid.CellPadding;
      const cw = childRect.w * cs[0] + cs[1], ch = childRect.h * cs[2] + cs[3];
      const px = childRect.w * cp[0] + cp[1], py = childRect.h * cp[2] + cp[3];
      const cols = Math.max(1, Math.floor((childRect.w + px) / (cw + px)));
      guiKids.sort((a, b) => (a.LayoutOrder || 0) - (b.LayoutOrder || 0)).forEach((k, i) => {
        draw(k, childRect, { x: childRect.x + (i % cols) * (cw + px), y: childRect.y + Math.floor(i / cols) * (ch + py), w: cw, h: ch });
      });
    } else if (list) {
      let cur = 0;
      const horiz = list.FillDirection === "Horizontal";
      const padd = list.Padding || [0, 0];
      guiKids.sort((a, b) => (a.LayoutOrder || 0) - (b.LayoutOrder || 0)).forEach((k) => {
        const s = k.Size || [0, 0, 0, 0];
        const kw = childRect.w * s[0] + s[1], kh = childRect.h * s[2] + s[3];
        draw(k, childRect, horiz ? { x: childRect.x + cur, y: childRect.y, w: kw, h: kh } : { x: childRect.x, y: childRect.y + cur, w: kw, h: kh });
        cur += (horiz ? kw + childRect.w * padd[0] : kh + childRect.h * padd[0]) + padd[1];
      });
    } else {
      for (const k of guiKids) draw(k, childRect);
    }
  }
  const tb = document.createElement("div"); tb.className = "topbar"; root.appendChild(tb);
  for (const g of window.SZENE.gui) {
    if (g.cls !== "ScreenGui") continue;
    const rect = { x: 0, y: inset, w: W, h: H - inset };
    for (const k of (g.kids || []).filter(isGui).sort((a, b) => (a.ZIndex || 1) - (b.ZIndex || 1))) draw(k, rect);
  }
}

(async () => {
  const browser = await chromium.launch({ args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"] });
  const ctx = await browser.newContext({ viewport: { width: +W, height: +H }, deviceScaleFactor: +SCALE });
  const p = await ctx.newPage();
  p.on("console", (m) => console.log("browser:", m.text()));
  p.on("pageerror", (e) => console.log("pageerror:", e.message));
  await p.setContent(page);
  await p.addScriptTag({ path: THREE });
  await p.evaluate((data) => { window.SZENE = data; }, JSON.parse(fs.readFileSync(inFile, "utf8")));
  await p.evaluate(`(${sceneScript.toString()})()`);
  await p.evaluate(`(${guiScript.toString()})(58)`);
  await p.waitForTimeout(200);
  await p.screenshot({ path: outFile });
  await browser.close();
  console.log("Bild:", outFile);
})();
