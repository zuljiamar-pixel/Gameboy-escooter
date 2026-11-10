// Nur für die Tests im Simulator. Diese Datei wird NICHT ins Spiel eingebaut
// (tools/build.sh hängt sie nur für den Test-Build an).
game.onUpdateInterval(100, function () {
    console.log("ST " + state + " " + Math.round(th * 1000) + " " + Math.round(om * 1000) + " " +
        Math.round(v * 100) + " " + Math.round(s * 10) + " " + (air ? 1 : 0) + " " + (inWheelie ? 1 : 0) + " " +
        points + " " + Math.round(alt * 100) + " " + (wmode ? 1 : 0) + " " + (burn ? 1 : 0) + " " +
        arms + " " + (crouch ? 1 : 0) + " " + comboMult() + " " + colorSel + " " + owned + " " + Math.round(best * 10))
})

control.simmessages.onReceived("test", function (buf: Buffer) {
    const cmd = buf.toString().split(" ")
    const x = cmd.length > 1 ? parseFloat(cmd[1]) : 0
    if (cmd[0] == "clock") clock = x
    else if (cmd[0] == "points") points = x
    else if (cmd[0] == "speed") v = x
    else if (cmd[0] == "nospawn") nextSpawn = 1e9
    else if (cmd[0] == "ramp") rampS = s + x + RAMP_LEN
    else if (cmd[0] == "blitz") { blitzS = s + x; blitzDone = false }
    else if (cmd[0] == "bump") bumpS.push(s + x)
    else if (cmd[0] == "coins") {
        for (let i = 0; i < 5; i++) { coinS.push(s + x + i * 0.8); coinH.push(14) }
    }
})
