// Spielt das Spiel im Simulator durch und prüft alle Funktionen.
//   ./build.sh test && node tools/run_tests.js [Bilder-Ordner]
const path = require('path');
const fs = require('fs');
const { startSim, balanceBot } = require('./simtest.js');

const BUILD = process.env.BUILD_DIR || path.join(__dirname, '..', '.build');
const OUT = process.argv[2] || path.join(BUILD, 'shots');
fs.mkdirSync(OUT, { recursive: true });

function check(cond, msg) {
    if (!cond) throw new Error('FEHLER: ' + msg);
    console.log('  ok  ' + msg);
}

(async () => {
    const sim = await startSim(BUILD, { verbose: !!process.env.VERBOSE });
    const shot = name => sim.shot(path.join(OUT, name + '.png'));
    try {
        // --- Startbildschirm und Farben-Shop ---
        await sim.wait(1200);
        await shot('01_titel');
        check(sim.st.state == 0, 'Startbildschirm');
        await sim.send('points 300');
        await sim.tap('right');
        await sim.wait(300);
        await shot('02_shop');
        await sim.tap('B');
        await sim.waitFor(st => st.color == 1 && st.owned == 3 && st.points == 200, 3000, 'Blau gekauft (100 P)');
        check(sim.hasEvent('buy 1'), 'Farbe BLAU für 100 Punkte gekauft');
        await sim.tap('right');
        await sim.tap('B');
        await sim.wait(300);
        check(sim.st.owned == 3 && sim.st.points == 200, 'PINK (250 P) ist zu teuer');
        await sim.tap('left');

        // --- Losfahren: A gibt nur Gas ---
        await sim.tap('A');
        await sim.waitFor(st => st.state == 1, 3000, 'Spiel gestartet');
        await sim.send('nospawn');
        check(sim.st.color == 1, 'gekaufte Farbe bleibt beim Start');
        await sim.key('A', true);
        await sim.wait(3000);
        check(sim.st.th == 0 && !sim.st.inWheelie, 'A allein hebt das Vorderrad nicht');
        check(sim.st.kmh > 50, 'mit Gas schneller als 50 km/h (' + Math.round(sim.st.kmh) + ')');
        await sim.key('A', false);
        await sim.wait(1500);

        // --- Wheelie-Mode mit OBEN, balancieren, Tricks, sauber landen ---
        await sim.tap('up');
        sim.onState = balanceBot(sim, 30, []);
        await sim.waitFor(st => st.inWheelie == 1, 2000, 'Wheelie läuft');
        await sim.wait(2000);
        await shot('03_wheelie');
        check(sim.st.inWheelie == 1 && sim.st.wmode == 1, 'Wheelie wird mit A/B gehalten (' + Math.round(sim.st.thDeg) + ' Grad)');
        sim.onState = balanceBot(sim, 30, ['left']);
        await sim.waitFor(st => st.arms == 1, 1000, 'Einhänder');
        await sim.wait(1000);
        await shot('04_einhaender');
        sim.onState = balanceBot(sim, 30, ['down']);
        await sim.waitFor(st => st.crouch == 1 && st.arms == 0, 1000, 'in die Knie');
        await sim.wait(1000);
        await shot('05_knie');
        check(sim.st.combo >= 2, 'Trick-Combo x' + sim.st.combo);
        sim.onState = balanceBot(sim, 30, ['down', 'right']);
        await sim.waitFor(st => st.arms == 2 && st.crouch == 1, 1000, 'Knie-No-Hander');
        await sim.wait(900);
        await shot('06_knie_nohander');
        check(sim.st.inWheelie == 1, 'Wheelie hält auch mit Tricks');
        const ptsBefore = sim.st.points;
        sim.onState = null;
        await sim.keys([]);
        await sim.tap('up');
        await sim.waitFor(st => st.inWheelie == 0 && st.wmode == 0, 4000, 'gelandet');
        await sim.wait(300);
        await shot('07_ergebnis');
        check(sim.hasEvent('wheelie'), 'Wheelie gezählt: ' + sim.events.filter(e => e.startsWith('wheelie')).pop());
        check(sim.st.best > 50, 'Rekord gespeichert (' + sim.st.best / 10 + ' m)');
        check(sim.st.points > ptsBefore, 'Trick-Punkte aufs Konto (+' + (sim.st.points - ptsBefore) + ')');

        // --- Ohne Gas fällt das Vorderrad von selbst runter ---
        await sim.wait(800);
        await sim.tap('up');
        await sim.waitFor(st => st.inWheelie == 1, 1500, 'Vorderrad oben');
        await sim.wait(250);
        await shot('07b_rekordfahne');
        await sim.waitFor(st => st.inWheelie == 0 && st.wmode == 0 && st.state == 1, 4000, 'fällt von selbst runter');
        check(true, 'ohne Gas endet der Wheelie von selbst');

        // --- Münzen ---
        const p0 = sim.st.points;
        await sim.send('coins 3');
        await sim.waitFor(st => st.points >= p0 + 50, 5000, '5 Münzen gesammelt');
        check(true, '5 Münzen = +50 Punkte');

        // --- Rampe: Sprung mit Trick, sauber landen ---
        const p1 = sim.st.points;
        await sim.send('ramp 4');
        await sim.waitFor(st => st.air == 1, 5000, 'Absprung');
        await sim.keys(['left', 'down']);
        await sim.wait(250);
        await shot('08_sprung');
        await sim.wait(150);
        await sim.keys([]);
        await sim.waitFor(st => st.air == 0, 4000, 'gelandet');
        check(sim.st.state == 1 && sim.st.points > p1, 'Sprung-Punkte (+' + (sim.st.points - p1) + ')');
        check(sim.hasEvent('jump'), 'Sprung gezählt');

        // --- Mit No-Hander landen = Sturz, A = nochmal ---
        await sim.wait(1200);
        await sim.send('ramp 4');
        await sim.waitFor(st => st.air == 1, 5000, 'Absprung 2');
        await sim.keys(['right']);
        await sim.waitFor(st => st.state == 2, 4000, 'Sturz');
        await sim.keys([]);
        await sim.wait(500);
        await shot('09_ohne_haende');
        await sim.wait(900);
        await sim.tap('A');
        await sim.waitFor(st => st.state == 1 && st.th == 0, 3000, 'weiter nach Sturz');
        await sim.send('nospawn');
        check(true, 'ohne Hände gelandet = Sturz, A = nochmal');

        // --- Blitzer ---
        await sim.send('speed 22');
        await sim.key('A', true);
        await sim.send('blitz 4');
        const p2 = sim.st.points;
        await sim.wait(700);
        await shot('10_blitzer');
        await sim.waitFor(st => st.points > p2, 4000, 'geblitzt');
        await sim.key('A', false);
        check(sim.hasEvent('blitz'), 'Blitzer: ' + sim.events.filter(e => e.startsWith('blitz')).pop() + ' km/h');

        // --- Burnout und Turbo-Start ---
        await sim.keys(['A', 'B']);
        await sim.waitFor(st => st.burn == 1 && st.v == 0, 8000, 'Burnout im Stand');
        await sim.wait(1500);
        await shot('11_burnout');
        await sim.keys(['A']);
        await sim.wait(300);
        check(sim.hasEvent('launch'), 'Turbo-Start nach dem Burnout');
        await sim.keys([]);

        // --- Dauer-Gas im Wheelie = Überschlag ---
        await sim.wait(800);
        await sim.tap('up');
        await sim.key('A', true);
        await sim.waitFor(st => st.state == 2, 5000, 'Überschlag');
        await sim.key('A', false);
        await sim.wait(600);
        await shot('12_sturz');
        check(sim.hasEvent('crash'), 'Dauer-Gas im Wheelie kippt nach hinten');
        await sim.wait(700);
        await sim.tap('A');
        await sim.waitFor(st => st.state == 1, 3000, 'weiter');
        await sim.send('nospawn');

        // --- Tag und Nacht ---
        await sim.send('clock 50');
        await sim.wait(700);
        await shot('13_abendrot');
        await sim.send('clock 75');
        await sim.wait(700);
        await shot('14_nacht');
        await sim.send('clock 5');
        await sim.wait(500);

        // --- Pause-Menü: Eintrag "Rekorde löschen" ---
        await sim.tap('menu');
        await sim.wait(900);
        await shot('15_menue');
        for (let i = 0; i < 5; i++) await sim.tap('right');
        await sim.wait(300);
        await shot('16_menue_loeschen');
        await sim.tap('A');
        await sim.wait(900);
        await shot('17_frage');
        await sim.tap('A');
        await sim.waitFor(st => st.state == 0 && st.best == 0 && st.points == 0 && st.owned == 1, 4000, 'alles gelöscht');
        await sim.wait(400);
        await shot('18_nach_loeschen');
        check(true, 'Rekorde löschen über das Menü');

        check(sim.errors.length == 0, 'keine Fehler im Simulator ' + JSON.stringify(sim.errors.slice(0, 3)));
        console.log('\nAlle Checks OK - Bilder in ' + OUT);
    } catch (e) {
        await shot('fehler');
        console.error(String(e.message || e));
        console.error('Ereignisse:', sim.events.join(' | '));
        process.exitCode = 1;
    }
    await sim.close();
})();
