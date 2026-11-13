#!/bin/sh
# Testet das Roblox-Spiel ohne Roblox: Ein kleiner Luau-Läufer (luaucheck)
# führt Server und Spieler in einem nachgebauten Roblox aus (mock.luau). Jede
# Eigenschaft, Methode und jedes Enum wird gegen die echte Roblox-API-Liste
# geprüft (aus dem npm-Paket @rbxts/types). Dann fährt ein Bot: Vollgas,
# Rampen, Wheelies, Tricks, Sturz, Burnout, Runde, Shop, Nacht, Respawn.
#
#   ./test.sh          -> Tests (PC- und Handy-Steuerung)
#   ./test.sh bilder   -> zusätzlich Vorschaubilder mit three.js
#                         (braucht Playwright mit Chromium)
#
# Braucht Rust (cargo), Node.js, Python 3 und beim ersten Mal Internet.
# Alles Erzeugte landet in BUILD_DIR (Standard: roblox/tools/build).
set -e
cd "$(dirname "$0")"
T="$(pwd)"
B="${BUILD_DIR:-$T/build}"
mkdir -p "$B/out"

(cd luaucheck && cargo build --release --quiet --target-dir "$B/target")
L="$B/target/release/luaucheck"

if [ ! -f "$B/api.luau" ]; then
    (cd "$B" && rm -rf package rbxts && npm pack @rbxts/types --silent >/dev/null && tar xzf rbxts-types-*.tgz && mv package rbxts)
    python3 gen_api.py "$B/rbxts/include/generated" "$B/api.luau"
fi

"$L" syntax ../src/*/*.luau

for MODE in pc touch; do
    cat > "$B/start_$MODE.luau" <<EOF
MODE = "$MODE"
TOOLS = "$T/"
SRC = "$T/../src/"
OUT = "$B/out/"
API_PATH = "$B/api.luau"
loadmodule("$T/test.luau")()
EOF
    if ! "$L" run "$B/start_$MODE.luau" > "$B/test_$MODE.txt" 2>&1; then
        cat "$B/test_$MODE.txt"
        exit 1
    fi
    sed -n '/==== Prüfungen/,$p' "$B/test_$MODE.txt"
done

if [ "$1" = "bilder" ]; then
    if [ ! -d "$B/three" ]; then
        (cd "$B" && npm pack three@0.160.0 --silent >/dev/null && mkdir three && tar xzf three-0.160.0.tgz -C three)
    fi
    for f in "$B"/out/*.json; do
        n=$(basename "$f" .json)
        case "$n" in
            touch_*) W=844; H=390 ;;
            *) W=1280; H=720 ;;
        esac
        THREE_JS="$B/three/package/build/three.min.js" node render.js "$f" "$B/out/$n.png" $W $H | grep -v deprecated
    done
fi
