#!/bin/sh
# Baut EScooterWheelie.rbxlx (die Datei für Roblox Studio) aus src/.
# Braucht Rojo (https://rojo.space), z.B. mit: cargo install rojo
set -e
cd "$(dirname "$0")"
rojo build default.project.json -o EScooterWheelie.rbxlx
