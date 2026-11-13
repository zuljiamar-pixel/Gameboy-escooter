-- Spielt das Roblox-Spiel in einem nachgebauten Roblox durch (siehe test.sh).
-- MODE ("pc" oder "touch"), TOOLS, SRC und OUT setzt test.sh.
local HERE = TOOLS
local SRC = SRC
local MODE = MODE or "pc"
local Rb = loadmodule(HERE .. "mock.luau")()
local Export = loadmodule(HERE .. "export.luau")()
local OUT = OUT
local exportiert = {}
local function export(name)
	if not exportiert[name] then
		exportiert[name] = true
		Export.szene(Rb, OUT .. MODE .. "_" .. name .. ".json")
	end
end
local D = Rb.D
local touch = MODE == "touch"
Rb.DATASTORE_FAILS = touch -- im zweiten Lauf: DataStore geht nicht (wie in Studio ohne API)

local game, player, playerModule = Rb.setup({ touch = touch })
local workspace = Rb.workspace

-- ------------------------------------------------------------------
-- Skripte wie im Rojo-Projekt einhängen
-- ------------------------------------------------------------------
local MODULES = {}
local function modul(name, parent, path)
	local m = Rb.Instance.new("ModuleScript")
	m.Name = name
	m.Parent = parent
	MODULES[m] = path
	return m
end
local shared = Rb.Instance.new("Folder")
shared.Name = "Wheelie"
shared.Parent = Rb.services.ReplicatedStorage
modul("Einstellungen", shared, SRC .. "shared/Einstellungen.luau")
modul("Farben", shared, SRC .. "shared/Farben.luau")
modul("Physik", shared, SRC .. "shared/Physik.luau")
local serverScript = Rb.Instance.new("Script")
serverScript.Name = "WheelieServer"
serverScript.Parent = Rb.services.ServerScriptService
modul("Welt", serverScript, SRC .. "server/Welt.luau")
modul("Scooter", serverScript, SRC .. "server/Scooter.luau")
local clientScript = Rb.Instance.new("LocalScript")
clientScript.Name = "WheelieClient"
clientScript.Parent = Rb.services.StarterPlayer.StarterPlayerScripts
modul("HUD", clientScript, SRC .. "client/HUD.luau")
modul("Posen", clientScript, SRC .. "client/Posen.luau")
modul("Toene", clientScript, SRC .. "client/Toene.luau")

-- Ersatz für das PlayerModule von Roblox
local MOVE = Rb.Vector3.zero
local playerModuleValue = {
	GetControls = function()
		return {
			GetMoveVector = function()
				return MOVE
			end,
		}
	end,
}

-- globale Umgebung
local G = {
	math = math,
	string = string,
	table = table,
	bit32 = bit32,
	utf8 = utf8,
	coroutine = coroutine,
	os = os,
	debug = debug,
	pairs = pairs,
	ipairs = ipairs,
	next = next,
	select = select,
	type = type,
	tostring = tostring,
	tonumber = tonumber,
	pcall = pcall,
	xpcall = xpcall,
	error = error,
	assert = assert,
	setmetatable = setmetatable,
	getmetatable = getmetatable,
	rawget = rawget,
	rawset = rawset,
	rawequal = rawequal,
	rawlen = rawlen,
	unpack = table.unpack,
	print = function(...) end,
	warn = function(...)
		local t = {}
		for _, v in { ... } do
			table.insert(t, tostring(v))
		end
		table.insert(Rb.WARNINGS, "warn: " .. table.concat(t, " "))
	end,
	typeof = Rb.typeof,
	game = game,
	workspace = workspace,
	Instance = Rb.Instance,
	Vector3 = Rb.Vector3,
	Vector2 = Rb.Vector2,
	CFrame = Rb.CFrame,
	Color3 = Rb.Color3,
	UDim = Rb.UDim,
	UDim2 = Rb.UDim2,
	NumberRange = Rb.NumberRange,
	NumberSequence = Rb.NumberSequence,
	NumberSequenceKeypoint = Rb.NumberSequenceKeypoint,
	ColorSequence = Rb.ColorSequence,
	ColorSequenceKeypoint = Rb.ColorSequenceKeypoint,
	TweenInfo = Rb.TweenInfo,
	Random = Rb.Random,
	RaycastParams = Rb.RaycastParams,
	Enum = Rb.Enum,
	task = Rb.task,
}
local cache = {}
local function envFor(scriptInst)
	return setmetatable({ script = scriptInst }, {
		__index = function(_, k)
			local v = G[k]
			if v == nil then
				error("unbekannte globale Variable '" .. tostring(k) .. "'", 2)
			end
			return v
		end,
		__newindex = function(_, k)
			error("Zuweisung an globale Variable '" .. tostring(k) .. "'", 2)
		end,
	})
end
G.require = function(m)
	if m == playerModule then
		return playerModuleValue
	end
	if cache[m] ~= nil then
		return cache[m]
	end
	local path = MODULES[m]
	if not path then
		error("require: unbekanntes Modul " .. tostring(m), 2)
	end
	local res = table.pack(loadmodule(path, envFor(m))())
	if res.n ~= 1 then
		error("Module code did not return exactly one value: " .. path, 2)
	end
	cache[m] = res[1]
	return res[1]
end

local function starte(path, scriptInst)
	Rb.task.spawn(function()
		loadmodule(path, envFor(scriptInst))()
	end)
end

-- ------------------------------------------------------------------
-- Hilfen zum Beobachten
-- ------------------------------------------------------------------
local DT = 1 / 60
local function frames(sek, jedesBild)
	local n = math.floor(sek / DT + 0.5)
	for _ = 1, n do
		if jedesBild then
			jedesBild()
		end
		Rb.frame(DT)
	end
end

local CHECKS = {}
local function check(name, ok, info)
	table.insert(CHECKS, { name = name, ok = ok and true or false, info = info })
end

local function gesehen(muster)
	for _, t in Rb.TEXT_ORDER do
		if string.find(t, muster) then
			return t
		end
	end
	return nil
end

local function charakter()
	return player.Character
end
local function scooterRoot()
	local c = charakter()
	local link = c and c:FindFirstChild("Scooter")
	return link and link.Value and link.Value:FindFirstChild("Root")
end
local function pitch()
	local r = scooterRoot()
	if not r then
		return 0
	end
	local rv = r.CFrame.RightVector
	return math.deg(math.asin(math.clamp(rv.Y, -1, 1)))
end
local function posX()
	local r = scooterRoot()
	return r and r.CFrame.Position.X or 0
end

local function feuern(signal, ...)
	signal:Fire(...)
end

-- ------------------------------------------------------------------
-- Start
-- ------------------------------------------------------------------
starte(SRC .. "server/init.server.luau", serverScript)
frames(0.5)
starte(SRC .. "client/init.client.luau", clientScript)
frames(2)

local strecke = workspace:FindFirstChild("Strecke")
print("DEBUG Character:", player.Character, "leaderstats", player:FindFirstChild("leaderstats"), "Scooters", workspace:FindFirstChild("Scooters"), "Remotes", shared:FindFirstChild("Remotes"), "Warnungen:", table.concat(Rb.WARNINGS, " / "))
check("Strecke gebaut", strecke ~= nil and strecke:GetAttribute("Fertig") == true)
local anzahlTeile = 0
for _, x in Rb.descendants(workspace, {}) do
	if Rb.isA(D[x].class, "BasePart") then
		anzahlTeile += 1
	end
end
print("Teile in der Welt:", anzahlTeile)
check("Teile < 12000", anzahlTeile < 12000, anzahlTeile)
check("Münzen da", #strecke.Muenzen:GetChildren() > 50, #strecke.Muenzen:GetChildren())
check("Blitzer da", #strecke.Blitzer:GetChildren() > 0, #strecke.Blitzer:GetChildren())
check("Rampen da", #strecke.Boden:GetChildren() > 50, #strecke.Boden:GetChildren())
check("Figur geladen", charakter() ~= nil)
check("Scooter verbunden", scooterRoot() ~= nil)
check("leaderstats", player:FindFirstChild("leaderstats") ~= nil)
local hum = charakter() and charakter():FindFirstChildOfClass("Humanoid")
check("PlatformStand an", hum and hum.PlatformStand == true)
local hudGui = player.PlayerGui:FindFirstChild("WheelieHUD")
check("HUD da", hudGui ~= nil)

-- Bot: lenkt zur nächsten Rampe oder Münzreihe
local zielZ = nil
local function lenkBot()
	local r = scooterRoot()
	if not r then
		return
	end
	local p = r.CFrame.Position
	local bestX, bestZ = math.huge, nil
	for _, b in strecke.Boden:GetChildren() do
		if b.Name == "Rampe" then
			local bx = b.CFrame.Position.X
			if bx > p.X + 10 and bx < bestX then
				bestX, bestZ = bx, b.CFrame.Position.Z
			end
		end
	end
	zielZ = bestZ
	Rb.KEYS.A, Rb.KEYS.D = false, false
	if zielZ then
		if zielZ > p.Z + 1 then
			Rb.KEYS.D = true
		elseif zielZ < p.Z - 1 then
			Rb.KEYS.A = true
		end
	end
end

-- 1) Vollgas mit Lenk-Bot
local startX = posX()
local maxKmh = 0
Rb.KEYS.W = true
local t1 = Rb.NOW
frames(25, function()
	lenkBot()
	maxKmh = math.max(maxKmh, Rb.LAST_KMH)
	if Rb.NOW - t1 > 6 then
		export("fahren")
	end
	local r = scooterRoot()
	if r and r.CFrame.Position.Y > 8 then
		export("sprung")
	end
end)
Rb.KEYS.W, Rb.KEYS.A, Rb.KEYS.D = false, false, false
print("Höchstes Tempo:", maxKmh, "gefahren:", posX() - startX)
check("Tempo bis ~100 km/h", maxKmh >= 95 and maxKmh <= 100, maxKmh)
check("vorwärts gefahren", posX() - startX > 500, posX() - startX)
check("Sprung gelandet", gesehen("SAUBER GELANDET") ~= nil or gesehen("^SPRUNG") ~= nil)
check("Punkte geschickt", (Rb.FIRED.Punkte or 0) > 0, Rb.FIRED.Punkte)

-- ausrollen lassen auf ~25 km/h
frames(20)
check("rollt von allein mit 25 km/h", math.abs(Rb.LAST_KMH - 25) <= 2, Rb.LAST_KMH)

-- 2) Wheelie mit Balance-Regler
local function wheelieRegler(ziel, sek, extra)
	Rb.key("Space", true)
	Rb.key("Space", false)
	local maxP = 0
	frames(sek, function()
		local p = pitch()
		maxP = math.max(maxP, p)
		Rb.KEYS.W = p < ziel - 4
		Rb.KEYS.S = p > ziel + 6
		if extra then
			extra()
		end
	end)
	Rb.KEYS.W, Rb.KEYS.S = false, false
	return maxP
end
local maxP = wheelieRegler(38, 3)
print("Wheelie max. Neigung:", maxP)
check("Wheelie hebt das Vorderrad", maxP > 25, maxP)
check("Wheelie-Meter angezeigt", gesehen("^%d+%.%d m$") ~= nil)
Rb.key("Space", true)
Rb.key("Space", false)
frames(3)
check("neuer Rekord", gesehen("NEUER REKORD") ~= nil)
check("Rekord gespeichert", (player:GetAttribute("Rekord") or 0) > 0.5, player:GetAttribute("Rekord"))

-- 3) Wheelie mit Tricks (Combo) und danach Sturz
local t0 = Rb.NOW
local fahneGesehen = false
local vGedrueckt = 0
wheelieRegler(36, 9, function()
	if workspace:FindFirstChild("RekordFahne") then
		fahneGesehen = true
	end
	local tt = Rb.NOW - t0
	if tt > 1.3 and vGedrueckt == 0 then
		vGedrueckt = 1
		Rb.key("V", true)
		Rb.key("V", false)
	elseif tt > 2.2 and vGedrueckt == 1 then
		vGedrueckt = 2
		export("trick_seite")
		Rb.key("V", true)
		Rb.key("V", false)
	elseif tt > 4.1 and vGedrueckt == 2 then
		vGedrueckt = 3
		export("nohand_vorne")
		Rb.key("V", true)
		Rb.key("V", false)
	end
	local t = Rb.NOW - t0
	local q = t > 1 and t < 2.5
	local e = t > 3 and t < 4.5
	if q ~= (Rb.KEYS.Q == true) then
		Rb.key("Q", q)
	end
	if e ~= (Rb.KEYS.E == true) then
		Rb.key("E", e)
	end
end)
check("Trick-Name angezeigt", gesehen("EINHÄNDER! %+") ~= nil)
check("Combo", gesehen("COMBO x2") ~= nil)
check("Rekord-Fahne steht", fahneGesehen)
check("Rekord-Fahne erreicht", gesehen("REKORD GEKNACKT") ~= nil)
-- jetzt Vollgas im Wheelie: kippt nach hinten
Rb.KEYS.W = true
frames(4)
Rb.KEYS.W = false
check("Sturz", gesehen("GESTÜRZT") ~= nil)
frames(4)
check("nach Sturz weiter", pitch() < 5, pitch())

-- 4) Burnout und Launch
Rb.KEYS.W, Rb.KEYS.S = true, true
frames(2)
check("Burnout angezeigt", gesehen("BURNOUT") ~= nil)
local rauchAn = false
local root = scooterRoot()
local rauch = root and root:FindFirstChild("Rauch", true)
rauchAn = rauch and rauch.Enabled
Rb.KEYS.S = false
frames(3)
Rb.KEYS.W = false
check("Rauch beim Burnout", rauchAn == true)
check("Launch", gesehen("LAUNCH") ~= nil)

-- 5) eine ganze Runde (Vollgas)
Rb.KEYS.W = true
local runde = false
frames(75, function()
	lenkBot()
	if gesehen("RUNDE 1") then
		runde = true
	end
end)
Rb.KEYS.W, Rb.KEYS.A, Rb.KEYS.D = false, false, false
check("Runde geschafft", runde)
check("Blitzer", gesehen("GEBLITZT") ~= nil)
check("Münzen-Ton", (Rb.FIRED["Sound:rbxasset://sounds/electronicpingshort.wav"] or 0) > 5)
frames(2)
print("Punkte jetzt:", player:GetAttribute("Punkte"))

-- 6) Shop: Blau kaufen
local vorher = player:GetAttribute("Punkte") or 0
Rb.key("F", true)
Rb.key("F", false)
frames(0.2)
local shopFrame = nil
for _, x in Rb.descendants(hudGui, {}) do
	if D[x].class == "UIGridLayout" then
		shopFrame = x.Parent
	end
end
check("Shop offen", shopFrame and shopFrame.Parent.Visible == true)
export("shop")
local blau = nil
for _, k in shopFrame:GetChildren() do
	if D[k].class == "TextButton" and k.LayoutOrder == 2 then
		blau = k
	end
end
feuern(blau.Activated)
frames(0.5)
local nachher = player:GetAttribute("Punkte") or 0
print("Shop:", vorher, "->", nachher, "Farbe", player:GetAttribute("Farbe"))
check("Blau gekauft", player:GetAttribute("Farbe") == 2 and vorher - nachher >= 99, tostring(vorher) .. " -> " .. tostring(nachher))
local lackBlau = false
for _, p in Rb.descendants(scooterRoot().Parent, {}) do
	if p:GetAttribute("Lack") and p.Color == Rb.Color3.fromRGB(47, 125, 225) then
		lackBlau = true
	end
end
check("Scooter ist blau", lackBlau)
Rb.key("F", true)
Rb.key("F", false)
check("Shop zu", shopFrame.Parent.Visible == false)

-- 7) Nacht
do
	local start = Rb.services.Lighting:GetAttribute("TagStart")
	local jetzt = workspace:GetServerTimeNow()
	Rb.TIME_OFFSET += 300 * (0.85 - 1 / 9) - (jetzt - start)
end
frames(2)
local an, alle = 0, 0
for _, f in strecke.Fenster:GetChildren() do
	if f:GetAttribute("Licht") then
		alle += 1
		if f.Material == Rb.Enum.Material.Neon then
			an += 1
		end
	end
end
export("nacht")
local lampeAn = strecke.Lampen:GetChildren()[1]:FindFirstChildOfClass("SpotLight").Enabled
print("Nacht: Uhr", Rb.services.Lighting.ClockTime, "Fenster an", an, "/", alle)
check("Nacht: Fenster leuchten", alle > 0 and an == alle, an .. "/" .. alle)
check("Nacht: Laternen an", lampeAn == true)
do
	local start = Rb.services.Lighting:GetAttribute("TagStart")
	local jetzt = workspace:GetServerTimeNow()
	Rb.TIME_OFFSET += 300 * (0.3 - 1 / 9) - (jetzt - start)
end
frames(2)
local tagAus = 0
for _, f in strecke.Fenster:GetChildren() do
	if f.Material == Rb.Enum.Material.Neon then
		tagAus += 1
	end
end
print("Tag: Uhr", Rb.services.Lighting.ClockTime)
check("Tag: Fenster aus", tagAus == 0, tagAus)

-- 8) Handy-Knöpfe
if touch then
	local gas = hudGui:FindFirstChild("gas", true)
	check("Touch-Knöpfe da", gas ~= nil)
	local input = setmetatable({ UserInputType = Rb.Enum.UserInputType.Touch, KeyCode = Rb.Enum.KeyCode.Unknown }, { __type = "InputObject" })
	local v0 = Rb.LAST_KMH
	feuern(gas.InputBegan, input)
	frames(3)
	check("Touch-Gas beschleunigt", Rb.LAST_KMH > v0 + 10, tostring(v0) .. " -> " .. Rb.LAST_KMH)
	feuern(Rb.signalOf(Rb.services.UserInputService, "InputEnded"), input, false)
	frames(0.5)
	local whl = hudGui:FindFirstChild("wheelie", true)
	local input2 = setmetatable({ UserInputType = Rb.Enum.UserInputType.Touch, KeyCode = Rb.Enum.KeyCode.Unknown }, { __type = "InputObject" })
	feuern(whl.InputBegan, input2)
	frames(0.3)
	check("Touch-Wheelie", pitch() > 3, pitch())
	feuern(Rb.signalOf(Rb.services.UserInputService, "InputEnded"), input2, false)
	frames(3)
end

-- 9) Sterben und neu spawnen
local alterScooter = scooterRoot().Parent
charakter():FindFirstChildOfClass("Humanoid").Health = 0
frames(4.5)
check("neu gespawnt", scooterRoot() ~= nil and scooterRoot().Parent ~= alterScooter)
check("alter Scooter weg", alterScooter.Parent == nil)
local x0 = posX()
Rb.KEYS.W = true
frames(3)
Rb.KEYS.W = false
check("fährt nach Respawn", posX() > x0 + 20, posX() - x0)

-- 10) Spieler geht: speichern
Rb.services.Players.PlayerRemoving:Fire(player)
frames(1)
if touch then
	check("ohne DataStore: Warnung", #Rb.WARNINGS > 0)
else
	local s = Rb.STORE["spieler_4242"]
	check("gespeichert", s ~= nil and s.farbe == 2 and s.rekord > 0, s and s.punkte)
end

-- ------------------------------------------------------------------
-- Bericht
-- ------------------------------------------------------------------
print("\n==== Texte, die angezeigt wurden ====")
local n = 0
for _, t in Rb.TEXT_ORDER do
	if not string.find(t, "^%d+%.%d m$") and not string.find(t, "^Punkte") and not string.find(t, "^%d+%.%d s$") then
		n += 1
		if n <= 70 then
			print(string.format("  %6.1f  %s", Rb.TEXT_SEEN[t], (string.gsub(t, "\n", " | "))))
		end
	end
end
print("\n==== Remotes ====")
for k, v in Rb.FIRED do
	if not string.find(k, "^Sound") then
		print("  " .. k .. ": " .. v)
	end
end
print("\n==== Warnungen ====")
for _, w in Rb.WARNINGS do
	print("  " .. w)
end
print("\n==== Prüfungen (" .. MODE .. ") ====")
local fehler = 0
for _, c in CHECKS do
	if not c.ok then
		fehler += 1
	end
	print((if c.ok then "  ok    " else "  FEHLER") .. "  " .. c.name .. (if c.info ~= nil then "  (" .. tostring(c.info) .. ")" else ""))
end
print("\nLaufzeitfehler: " .. #Rb.ERRORS .. ", fehlgeschlagene Prüfungen: " .. fehler)
if #Rb.ERRORS > 0 or fehler > 0 then
	error("TEST FEHLGESCHLAGEN")
end
