#!/bin/sh
# Baut das Spiel aus main.ts.
#
#   ./build.sh          -> ../wheelie.uf2 (für den PyBadge / PyBadge LC)
#   ./build.sh test     -> Simulator-Version mit Test-Haken (für tools/run_tests.js)
#
# Braucht Node.js und Internet (lädt die MakeCode-Werkzeuge und die fertig
# übersetzte Laufzeit von Microsoft). Alles landet im Ordner BUILD_DIR
# (Standard: arcade/.build), der nicht ins Repository gehört.
set -e
cd "$(dirname "$0")"
SRC="$(pwd)"
B="${BUILD_DIR:-$SRC/.build}"
mkdir -p "$B"
if [ ! -d "$B/node_modules/pxt-arcade" ]; then
    (cd "$B" && npm init -y >/dev/null && npm install pxt pxt-arcade)
    echo '{"targetdir":"pxt-arcade"}' > "$B/node_modules/pxtcli.json"
fi
P="$B/projects/wheelie"
[ "$1" = "test" ] && P="$B/projects/wheelie-test"
mkdir -p "$P"
cp "$SRC/pxt.json" "$SRC/main.ts" "$P/"
cd "$P"
if [ "$1" = "test" ]; then
    cat "$SRC/tools/testhook.ts" >> main.ts
    [ -d pxt_modules ] || npx pxt install
    npx pxt build --debug > build.log 2>&1 || { grep -n "error" build.log; exit 1; }
    echo "Simulator-Version: $P/built/debug/binary.js"
else
    [ -d pxt_modules/hw---samd51 ] || npx pxt install --hw samd51
    npx pxt build --hw samd51 > build.log 2>&1 || { grep -n "error" build.log; exit 1; }
    cp built/binary.uf2 "$SRC/../wheelie.uf2"
    echo "Fertig: wheelie.uf2 ($(wc -c < built/binary.uf2) Bytes)"
fi
