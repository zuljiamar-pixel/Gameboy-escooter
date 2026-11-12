#!/usr/bin/env node
// Macht das App-Icon und die Bilder für den Play Store aus dem echten Spiel.
//   node tools/icon.js && python3 tools/icons.py     (braucht playwright und Pillow)
// Ergebnis: tools/out/hero.png (Scooter im Wheelie, 1536 x 1536) und store/*.png
const path = require('path');
const fs = require('fs');
const { chromium } = require('playwright');

const WWW = 'file://' + path.join(__dirname, '..', 'www', 'index.html');
const OUT = path.join(__dirname, 'out');
const STORE = path.join(__dirname, '..', 'store');

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  fs.mkdirSync(STORE, { recursive: true });
  const browser = await chromium.launch();

  // --- Icon: Dualtron im Wheelie, ohne Anzeigen ---
  let page = await browser.newPage({ viewport: { width: 480, height: 360 }, deviceScaleFactor: 4 });
  await page.addInitScript(() => localStorage.setItem('escooter-wheelie-1',
    JSON.stringify({ scooter: 2, owned: [true, true, true], color: [0, 9, 3] })));
  await page.goto(WWW);
  await page.waitForTimeout(300);
  const box = await page.evaluate(() => {
    const { G } = window.__game;
    G.state = 1; G.photo = true; G.wmode = true; G.inWheelie = true;
    G.th = 0.70; G.ph = 0.5; G.v = 0; G.dist = 395;
    window.__game.step = () => {};
    return null;
  });
  void box;
  await page.waitForTimeout(200);
  // 1 Einheit = 3 CSS-Pixel. Hinterachse bei x = 60, Boden bei y = 92 (Einheiten)
  const u = 3, size = 96;
  await page.screenshot({ path: path.join(OUT, 'hero.png'),
    clip: { x: (60 - 34) * u, y: (92 - 76) * u, width: size * u, height: size * u } });
  await page.close();

  // --- Screenshots für den Play Store (Handy quer, 16:9) ---
  page = await browser.newPage({ viewport: { width: 960, height: 540 }, deviceScaleFactor: 2, hasTouch: true });
  await page.addInitScript(() => localStorage.setItem('escooter-wheelie-1',
    JSON.stringify({ scooter: 1, owned: [true, true, true], coins: 740, best: 182.4, tbest: 365,
      tune: [[1, 0, 0, 0], [2, 1, 1, 0], [3, 2, 2, 1]] })));
  await page.goto(WWW);
  await page.waitForTimeout(300);
  const U = 540 / 120, Wd = 960 / U;
  const tap = async (x, y) => { await page.touchscreen.tap(x * U, y * U); await page.waitForTimeout(250); };
  await page.screenshot({ path: path.join(STORE, 'screenshot-1-menue.png') });
  await tap(Wd / 2 + 10, 110);
  await page.screenshot({ path: path.join(STORE, 'screenshot-2-tuning.png') });
  await tap(Wd / 2 + 60, 100);                    // FERTIG
  await tap(Wd / 2 + 49, 70);                     // nächster Scooter
  await page.screenshot({ path: path.join(STORE, 'screenshot-3-dualtron.png') });
  await tap(Wd - 25, 110);                        // START
  const pose = (o) => page.evaluate((o) => {
    const { G } = window.__game;
    Object.assign(G, o);
  }, o);
  await page.evaluate(() => { const g = window.__game; g.realStep = g.step; });
  await pose({ wmode: true, th: 0.72, om: 0, v: 24, wd: 86.3, wt: 4.1, tp: 122, inWheelie: true, arms: 2, ph: 0.4 });
  await page.waitForTimeout(60);
  await page.screenshot({ path: path.join(STORE, 'screenshot-4-wheelie.png') });
  await browser.close();
  console.log('fertig:', OUT, STORE);
})();
