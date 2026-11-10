// Startet eine Test-Version des Spiels (./build.sh test) im MakeCode-Arcade-
// Simulator in einem unsichtbaren Browser (Playwright) und steuert die Knöpfe.
const { chromium } = require('playwright');
const http = require('http');
const fs = require('fs');
const path = require('path');

const KEY = { left: 1, up: 2, right: 3, down: 4, A: 5, B: 6, menu: 7 };
const ST_FIELDS = ['state', 'th', 'om', 'v', 's', 'air', 'inWheelie', 'points', 'alt', 'wmode', 'burn',
    'arms', 'crouch', 'combo', 'color', 'owned', 'best'];

const PAGE = `<!doctype html><html><head><meta charset="utf-8">
<script src="/pxtsim.js"></script><script src="/sim.js"></script></head>
<body id="root"><div id="wrap"><div class="game-player"><div id="debug-stats"></div>
<div class="game-embed"><canvas id="game-screen" tabindex="0"></canvas></div>
<div class="game-sys-button-group"><button class="game-sys-button game-menu-button">Menu</button>
<button class="game-sys-button game-reset-button"><i></i></button></div>
<div id="game-buttons-container" class="game-buttons"><svg class="game-button-svg">
<circle class="button-b"/><text class="label-b">B</text><circle class="button-a"/><text class="label-a">A</text></svg></div>
<div id="joystick-container" class="game-joystick"><svg class="game-joystick-svg"><circle class="joystick-background"/>
<rect class="dpad-up"/><rect class="dpad-down"/><rect class="dpad-right"/><rect class="dpad-left"/>
<circle class="joystick-handle"/></svg></div><div class="game-player-background"></div>
<div class="game-player-msft"></div></div><div id="safari-enable-game" style="display:none"><button></button></div></div>
</body></html>`;

async function startSim(buildDir, opts) {
    opts = opts || {};
    const files = {
        '/pxtsim.js': path.join(buildDir, 'node_modules/pxt-core/built/web/pxtsim.js'),
        '/sim.js': path.join(buildDir, 'node_modules/pxt-arcade/built/sim.js'),
    };
    const server = http.createServer((req, res) => {
        const url = req.url.split('?')[0];
        if (files[url]) {
            res.writeHead(200, { 'content-type': 'text/javascript' });
            res.end(fs.readFileSync(files[url]));
        } else {
            res.writeHead(200, { 'content-type': 'text/html' });
            res.end(PAGE);
        }
    });
    await new Promise(r => server.listen(0, '127.0.0.1', r));
    const browser = await chromium.launch();
    const page = await browser.newPage({ viewport: { width: 400, height: 400 } });
    const sim = { page, st: null, events: [], errors: [], onState: null };
    page.on('console', m => {
        const text = m.text().replace(/^l>/, '').trim();
        if (text.startsWith('ST ')) {
            const n = text.split(' ').slice(1).map(Number);
            const st = {};
            ST_FIELDS.forEach((f, i) => { st[f] = n[i]; });
            st.thDeg = st.th / 1000 * 180 / Math.PI;
            st.omDeg = st.om / 1000 * 180 / Math.PI;
            st.kmh = st.v / 100 * 3.6;
            sim.st = st;
            if (sim.onState) sim.onState(st);
        } else if (text.startsWith('EV ')) {
            sim.events.push(text.slice(3));
            if (opts.verbose) console.log('   [event]', text.slice(3));
        } else if (/crash|PANIC|error/i.test(text)) {
            sim.errors.push(text);
        }
    });
    page.on('pageerror', e => { if (!/multiplayerState/.test(e.message)) sim.errors.push(e.message); });
    await page.goto(`http://127.0.0.1:${server.address().port}/`);
    await page.waitForFunction(() => window.pxsim && pxsim.Embed && pxsim.Embed.run);
    const code = fs.readFileSync(path.join(buildDir, 'projects/wheelie-test/built/debug/binary.js'), 'utf8');
    await page.evaluate((code) => {
        pxsim.Embed.run({ type: 'run', code, parts: [], partDefinitions: {}, fnArgs: {}, mute: true,
            highContrast: false, cdnUrl: '', localizedStrings: {}, version: 'local', storedState: {}, single: true });
    }, code);

    const held = new Set();
    sim.wait = ms => page.waitForTimeout(ms);
    sim.key = async (name, down) => {
        if (down == held.has(name)) return;
        if (down) held.add(name); else held.delete(name);
        await page.evaluate(([k, d]) => pxsim.board().setButton(k, d), [KEY[name], down]);
    };
    sim.keys = async (names) => {
        for (const k of Object.keys(KEY)) await sim.key(k, names.includes(k));
    };
    sim.tap = async (name, ms) => { await sim.key(name, true); await sim.wait(ms || 90); await sim.key(name, false); await sim.wait(60); };
    sim.send = (cmd) => page.evaluate((cmd) => pxsim.board().controlMessageState.enqueue({
        type: 'messagepacket', channel: 'test', broadcast: false, data: new TextEncoder().encode(cmd) }), cmd);
    sim.shot = async (file) => {
        const url = await page.evaluate(() => document.getElementById('game-screen').toDataURL('image/png'));
        fs.writeFileSync(file, Buffer.from(url.split(',')[1], 'base64'));
    };
    sim.waitFor = async (pred, timeout, what) => {
        const end = Date.now() + (timeout || 5000);
        while (Date.now() < end) {
            if (sim.st && pred(sim.st)) return;
            await sim.wait(30);
        }
        throw new Error('Timeout: ' + (what || pred.toString()) + '  Zustand: ' + JSON.stringify(sim.st));
    };
    sim.hasEvent = (prefix) => sim.events.some(e => e.startsWith(prefix));
    sim.close = async () => { await browser.close(); server.close(); };
    await sim.waitFor(() => true, 8000, 'Spiel startet');
    return sim;
}

// Hält den Wheelie ungefähr bei target Grad (wie ein Mensch: A antippen, B wenn zu hoch)
function balanceBot(sim, target, extraKeys) {
    return (st) => {
        const p = st.thDeg + st.omDeg * 0.25;
        const keys = (extraKeys || []).slice();
        if (p < target) keys.push('A');
        else if (p > target + 10) keys.push('B');
        sim.keys(keys);
    };
}

module.exports = { startSim, balanceBot };
