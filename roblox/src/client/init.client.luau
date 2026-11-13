--[[
	E-SCOOTER WHEELIE - Steuerung (läuft bei jedem Spieler)

	W / Pfeil hoch   = Gas (im Wheelie: Vorderrad höher)
	S / Pfeil runter = Bremse (im Wheelie: Vorderrad runter)
	A / D            = lenken
	LEERTASTE        = Wheelie an / nochmal = sauber landen
	W + S            = Burnout (S loslassen = Turbo-Start)
	Q / E / C        = Einhänder / No-Hander / in die Knie
	F = Farben-Shop, V = Kamera, H = Hilfe
	Handy: Stick zum Lenken und große Knöpfe rechts.
	Controller: RT Gas, LT Bremse, A Wheelie, X/Y/B Tricks, Steuerkreuz hoch = Shop, runter = Kamera
]]

local Players = game:GetService("Players")
local RunService = game:GetService("RunService")
local UserInputService = game:GetService("UserInputService")
local ContextActionService = game:GetService("ContextActionService")
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local TweenService = game:GetService("TweenService")
local Lighting = game:GetService("Lighting")

local player = Players.LocalPlayer
local Shared = ReplicatedStorage:WaitForChild("Wheelie")
local E = require(Shared:WaitForChild("Einstellungen"))
local Farben = require(Shared:WaitForChild("Farben"))
local Physik = require(Shared:WaitForChild("Physik"))
local Remotes = Shared:WaitForChild("Remotes")
local HUD = require(script:WaitForChild("HUD"))
local Posen = require(script:WaitForChild("Posen"))
local Toene = require(script:WaitForChild("Toene"))

local M = E.STUDS_PRO_M
local LEN = E.STRECKE_M * M
local HALB = E.STRASSE_BREITE / 2
local WB = E.SCOOTER.RADSTAND
local RAD = E.SCOOTER.RAD
local DECK = E.SCOOTER.DECK
local FUSS_X = E.SCOOTER.FUSS_X
local VMAX = E.MAX_KMH / 3.6
local CRASH_RAD = math.rad(E.CRASH_DEG)
local STUFE = 2.2 -- so hohe Kanten fährt man einfach hoch
local KANTE = 0.6 -- fällt der Boden mehr ab, ist man in der Luft
local GELB = Color3.fromRGB(255, 214, 64)
local WEISS = Color3.new(1, 1, 1)

local hud = HUD.neu(player, Farben, E, UserInputService.TouchEnabled)

-- ------------------------------------------------------------------
-- Strecke einlesen
-- ------------------------------------------------------------------
local strecke = workspace:WaitForChild("Strecke")
if not strecke:GetAttribute("Fertig") then
	strecke:GetAttributeChangedSignal("Fertig"):Wait()
end
local boden = strecke:WaitForChild("Boden")
local rayParams = RaycastParams.new()
rayParams.FilterType = Enum.RaycastFilterType.Include
rayParams.FilterDescendantsInstances = { boden }

local muenzen = {}
local blitzer = {}
local gullys = {}
local fenster = {}
local lampen = {}

local function streckeEinlesen()
	table.clear(muenzen)
	for _, p in strecke:WaitForChild("Muenzen"):GetChildren() do
		if p:IsA("BasePart") then
			table.insert(muenzen, {
				teil = p,
				x = p.Position.X,
				y = p.Position.Y,
				z = p.Position.Z,
				cf = p.CFrame,
				size = p.Size,
				weg = false,
			})
		end
	end
	table.sort(muenzen, function(a, b)
		return a.x < b.x
	end)
	table.clear(blitzer)
	for _, b in strecke:WaitForChild("Blitzer"):GetChildren() do
		local blitz = b:FindFirstChild("Blitz")
		if blitz then
			table.insert(blitzer, { x = blitz.Position.X, licht = blitz:FindFirstChildOfClass("PointLight") })
		end
	end
	table.clear(gullys)
	for _, g in strecke:WaitForChild("Gullys"):GetChildren() do
		if g:IsA("BasePart") then
			table.insert(gullys, { x = g.Position.X, z = g.Position.Z })
		end
	end
	fenster = strecke:WaitForChild("Fenster"):GetChildren()
	lampen = strecke:WaitForChild("Lampen"):GetChildren()
end
streckeEinlesen()

local function bodenHoehe(x, zz, yRef)
	local res = workspace:Raycast(Vector3.new(x, yRef + 6, zz), Vector3.new(0, -80, 0), rayParams)
	if res then
		return res.Position.Y
	end
	return 0
end

-- ------------------------------------------------------------------
-- Zustand der Fahrt
-- ------------------------------------------------------------------
local z = Physik.neu()
local modus = "fahren" -- "fahren" oder "sturz"
local xw, zl, y = 20, 0, 0 -- Position vom Hinterrad (x längs, zl quer, y Höhe)
local vy, air, airT, jp = 0, false, 0, 0
local pitchBoden, pitchLuft = 0, 0
local lenkVis = 0
local inWheelie, wd, tp, combo, trickT = false, 0, 0, 0, 0
local burn, burnT = false, 0
local sturzT, sturzFall = 0, 0
local wackelT, wackelStark = 0, 0
local hopT = 0
local flaggeS, flaggeDone = -1, true
local runde = 0
local offen, unterwegs, sendT = 0, 0, 0
local lokalRekord = 0
local muenzIdx = 1
local muenzSerie, muenzSerieT = 0, 0
local spin = 0

local char, hum, hrp, scooterRoot = nil, nil, nil, nil
local hipOffset = 3
local bereit = false

local kameraModus = 1
local camPos = nil
local kameraNamen = { "Kamera: hinten", "Kamera: von der Seite", "Kamera: von vorne" }

local function fmt1(x)
	return string.format("%.1f", x)
end

local function rekord()
	return math.max(player:GetAttribute("Rekord") or 0, lokalRekord)
end

local function kontoStand()
	return (player:GetAttribute("Punkte") or 0) + offen + unterwegs
end

local function punkte(n)
	n = math.floor(n)
	if n > 0 then
		offen += n
		hud:konto(kontoStand())
	end
end

local function wackeln(t, stark)
	wackelT = math.max(wackelT, t)
	wackelStark = math.max(if wackelT > 0 then wackelStark else 0, stark)
end

-- ------------------------------------------------------------------
-- Tricks
-- ------------------------------------------------------------------
local TRICK_NAMEN = { [0] = "", "EINHÄNDER", "NO-HANDER" }
local TRICK_WERT = { [0] = 0, 1, 3 }

local function trickId()
	return z.arms + (if z.crouch then 3 else 0)
end

local function trickName()
	local n = TRICK_NAMEN[z.arms]
	if z.crouch then
		return if n ~= "" then "KNIE-" .. n else "IN DIE KNIE"
	end
	return n
end

local function trickRate()
	local r = TRICK_WERT[z.arms] + (if z.crouch then 1 else 0)
	return if z.arms > 0 and z.crouch then r * 2 else r
end

local function comboMult()
	local n = 1
	for i = 1, 5 do
		if bit32.band(combo, bit32.lshift(1, i)) ~= 0 then
			n += 1
		end
	end
	return math.max(1, n - 1)
end

local function zustandsBits()
	local b = 0
	if z.arms == 1 then
		b += 1
	elseif z.arms == 2 then
		b += 2
	end
	if z.crouch then
		b += 4
	end
	if burn then
		b += 8
	end
	if modus == "sturz" then
		b += 16
	end
	return b
end

local letzteBits = -1
local function sendeZustand()
	local b = zustandsBits()
	if b ~= letzteBits then
		letzteBits = b
		Remotes.Zustand:FireServer(b)
	end
end

-- ------------------------------------------------------------------
-- Rekord-Fahne (nur du siehst sie): bis hier wäre der Wheelie ein neuer Rekord
-- ------------------------------------------------------------------
local flagge = Instance.new("Model")
flagge.Name = "RekordFahne"
local fahnenMast = Instance.new("Part")
fahnenMast.Size = Vector3.new(0.3, 10, 0.3)
fahnenMast.Color = Color3.fromRGB(230, 230, 230)
fahnenMast.Material = Enum.Material.Metal
fahnenMast.Parent = flagge
local fahnenTuch = Instance.new("Part")
fahnenTuch.Size = Vector3.new(3.2, 2, 0.1)
fahnenTuch.Color = Color3.fromRGB(230, 30, 40)
fahnenTuch.Material = Enum.Material.Neon
fahnenTuch.Parent = flagge
for _, p in { fahnenMast, fahnenTuch } do
	p.Anchored = true
	p.CanCollide = false
	p.CanQuery = false
	p.CanTouch = false
end

local function flaggeSetzen(x)
	x = x % LEN
	fahnenMast.CFrame = CFrame.new(x, 5.6, HALB + 1)
	fahnenTuch.CFrame = CFrame.new(x + 1.75, 9.4, HALB + 1)
	flagge.Parent = workspace
end

local function flaggeWeg()
	flagge.Parent = nil
end

-- Konfetti bei einem neuen Rekord
local konfettiTeil = Instance.new("Part")
konfettiTeil.Name = "Konfetti"
konfettiTeil.Anchored = true
konfettiTeil.CanCollide = false
konfettiTeil.CanQuery = false
konfettiTeil.CanTouch = false
konfettiTeil.Transparency = 1
konfettiTeil.Size = Vector3.new(4, 1, 4)
konfettiTeil.Parent = workspace
local konfetti = Instance.new("ParticleEmitter")
konfetti.Texture = "rbxasset://textures/particles/sparkles_main.dds"
konfetti.Rate = 0
konfetti.Lifetime = NumberRange.new(1.2, 2)
konfetti.Speed = NumberRange.new(14, 26)
konfetti.SpreadAngle = Vector2.new(60, 60)
konfetti.Acceleration = Vector3.new(0, -25, 0)
konfetti.Size = NumberSequence.new(0.6)
konfetti.Color = ColorSequence.new({
	ColorSequenceKeypoint.new(0, Color3.fromRGB(255, 60, 60)),
	ColorSequenceKeypoint.new(0.33, Color3.fromRGB(255, 220, 40)),
	ColorSequenceKeypoint.new(0.66, Color3.fromRGB(60, 220, 120)),
	ColorSequenceKeypoint.new(1, Color3.fromRGB(80, 140, 255)),
})
konfetti.LightEmission = 0.6
konfetti.EmissionDirection = Enum.NormalId.Top
konfetti.Parent = konfettiTeil

local function konfettiWerfen(n)
	konfettiTeil.CFrame = CFrame.new(xw + 6, y + 6, zl)
	konfetti:Emit(n)
end

-- ------------------------------------------------------------------
-- Ereignisse der Fahrt
-- ------------------------------------------------------------------
local function neustart()
	local alt = z
	z = Physik.neu()
	z.t = alt.t
	modus = "fahren"
	inWheelie, wd, tp, combo, trickT = false, 0, 0, 0, 0
	burn, burnT = false, 0
	air, vy, airT, jp = false, 0, 0, 0
	pitchBoden, pitchLuft = 0, 0
	y = bodenHoehe(xw, zl, y + 2)
	flaggeWeg()
	hud:bannerWeg()
	hud:balanceZeigen(false, 0)
	sendeZustand()
end

local function sturz(warum)
	modus = "sturz"
	inWheelie = false
	z.wmode = false
	z.landing = false
	burn = false
	flaggeWeg()
	sturzT, sturzFall = 0, 0
	wackeln(0.45, 1.3)
	local text = warum
	if text == "" then
		text = if wd >= E.MIN_WHEELIE then fmt1(wd) .. " m ZÄHLT NICHT" else "AUTSCH!"
	end
	hud:banner("GESTÜRZT!", text, WEISS, 99)
	hud:balanceZeigen(false, 0)
	Toene.spielen("sturz")
	sendeZustand()
end

local function wheelieEnde()
	inWheelie = false
	flaggeWeg()
	if wd < E.MIN_WHEELIE then
		hud:bannerWegWennFest()
		return
	end
	if wd > rekord() then
		lokalRekord = wd
		Remotes.Rekord:FireServer("wheelie", wd)
		hud:banner(fmt1(wd) .. " m", "NEUER REKORD!", GELB, 3)
		hud:rekord(wd)
		Toene.spielen("rekord")
		konfettiWerfen(70)
	else
		local wort = if wd < 10
			then "OK!"
			elseif wd < 30 then "NICE!"
			elseif wd < 80 then "STARK!"
			elseif wd < 200 then "MEGA!"
			elseif wd < 500 then "WAHNSINN!"
			else "LEGENDE!"
		hud:banner(fmt1(wd) .. " m", wort .. "  " .. fmt1(z.wt) .. " s", GELB, 3)
		Toene.spielen("muenze", 0.8)
	end
	-- 1 Punkt pro Meter Wheelie, dazu die Trick-Punkte
	punkte(wd)
	local pts = math.floor(tp)
	if pts > 0 then
		punkte(pts)
		if pts > (player:GetAttribute("TrickRekord") or 0) then
			Remotes.Rekord:FireServer("trick", pts)
			hud:toast("TRICK-REKORD " .. pts .. "!")
		else
			hud:toast("TRICKS +" .. pts)
		end
	end
end

local function landen()
	air = false
	vy = 0
	hopT = 0.12
	if airT < 0.3 then
		return -- nur ein kleiner Hüpfer
	end
	wackeln(0.15, 0.35)
	if z.arms == 2 then
		sturz("OHNE HÄNDE GELANDET!")
		return
	end
	local pts = math.floor(jp)
	punkte(pts)
	Toene.spielen("landen")
	if inWheelie then
		hud:toast("SPRUNG! +" .. pts)
	else
		hud:banner("+" .. pts .. " P", "SAUBER GELANDET!", GELB, 2)
	end
end

local function muenzeNehmen(m)
	m.weg = true
	local p = m.teil
	TweenService:Create(p, TweenInfo.new(0.3, Enum.EasingStyle.Quad, Enum.EasingDirection.Out), {
		CFrame = m.cf + Vector3.new(0, 4, 0),
		Size = m.size * 0.3,
		Transparency = 1,
	}):Play()
	punkte(E.COIN_VALUE)
	if muenzSerieT > 0 then
		muenzSerie = math.min(muenzSerie + 1, 10)
	else
		muenzSerie = 0
	end
	muenzSerieT = 0.6
	Toene.spielen("muenze", 1 + muenzSerie * 0.08)
end

local function muenzenZurueck()
	for _, m in muenzen do
		if m.weg then
			m.weg = false
			m.teil.Size = m.size
			m.teil.Transparency = 0
			m.teil.CFrame = m.cf
		end
	end
	muenzIdx = 1
end

local function geblitzt(b, kmh)
	hud:blitz()
	Toene.spielen("blitz")
	if b.licht then
		b.licht.Enabled = true
		task.delay(0.15, function()
			b.licht.Enabled = false
		end)
	end
	punkte(kmh)
	hud:toast("GEBLITZT! " .. kmh .. " km/h  +" .. kmh)
	if kmh > (player:GetAttribute("BlitzRekord") or 0) then
		Remotes.Rekord:FireServer("blitz", kmh)
	end
end

-- ------------------------------------------------------------------
-- Eingabe
-- ------------------------------------------------------------------
local tasten = { ein = false, nohand = false, knie = false }
local wheelieGedrueckt = false
local controls = nil

task.spawn(function()
	local ok, pm = pcall(function()
		return require(player:WaitForChild("PlayerScripts"):WaitForChild("PlayerModule"))
	end)
	if ok and pm then
		controls = pm:GetControls()
	end
end)

local function bewegungsVektor()
	if controls then
		local ok, v = pcall(function()
			return controls:GetMoveVector()
		end)
		if ok and typeof(v) == "Vector3" then
			return v
		end
	end
	return Vector3.zero
end

local function taste(k)
	return UserInputService:IsKeyDown(k)
end

local function padTaste(k)
	return UserInputService:IsGamepadButtonDown(Enum.UserInputType.Gamepad1, k)
end

local function eingabe()
	local gas, bremse, steer = false, false, 0
	if UserInputService:GetFocusedTextBox() == nil then
		gas = taste(Enum.KeyCode.W) or taste(Enum.KeyCode.Up)
		bremse = taste(Enum.KeyCode.S) or taste(Enum.KeyCode.Down)
		if taste(Enum.KeyCode.A) or taste(Enum.KeyCode.Left) then
			steer -= 1
		end
		if taste(Enum.KeyCode.D) or taste(Enum.KeyCode.Right) then
			steer += 1
		end
	end
	if padTaste(Enum.KeyCode.ButtonR2) then
		gas = true
	end
	if padTaste(Enum.KeyCode.ButtonL2) then
		bremse = true
	end
	local mv = bewegungsVektor()
	if steer == 0 and math.abs(mv.X) > 0.2 then
		steer = math.clamp(mv.X, -1, 1)
	end
	if mv.Z < -0.6 then
		gas = true
	elseif mv.Z > 0.6 then
		bremse = true
	end
	if hud.touch.gas then
		gas = true
	end
	if hud.touch.bremse then
		bremse = true
	end
	local r = {
		gas = gas,
		bremse = bremse,
		steer = steer,
		wheelie = wheelieGedrueckt,
		ein = tasten.ein or hud.touch.ein,
		nohand = tasten.nohand or hud.touch.nohand,
		knie = tasten.knie or hud.touch.knie,
	}
	wheelieGedrueckt = false
	if hud.shopOffen then
		r.gas, r.bremse, r.steer, r.wheelie = false, true, 0, false
		r.ein, r.nohand, r.knie = false, false, false
	end
	return r
end

-- ------------------------------------------------------------------
-- Farben-Shop
-- ------------------------------------------------------------------
local function shopAktualisieren()
	hud:shopAktualisieren(kontoStand(), player:GetAttribute("Farben") or 1, player:GetAttribute("Farbe") or 1)
end

local function shopUmschalten()
	hud:shopZeigen(not hud.shopOffen)
	if hud.shopOffen then
		hud.shopWahl = player:GetAttribute("Farbe") or 1
		hud:shopStatus("Klick auf eine Farbe zum Kaufen oder Auswählen.", true)
		shopAktualisieren()
	end
end

local kaufLaeuft = false
local function kaufen(i)
	if kaufLaeuft then
		return
	end
	kaufLaeuft = true
	-- erst die offenen Punkte zum Server schicken, damit sie mitzählen
	if offen > 0 then
		Remotes.Punkte:FireServer(offen)
		unterwegs += offen
		offen = 0
	end
	local besitz = player:GetAttribute("Farben") or 1
	local aktion = if bit32.band(besitz, bit32.lshift(1, i - 1)) ~= 0 then "waehlen" else "kaufen"
	local ok, gut, meldung = pcall(function()
		return Remotes.Shop:InvokeServer(aktion, i)
	end)
	kaufLaeuft = false
	if not ok then
		hud:shopStatus("Das hat nicht geklappt, versuch es nochmal.", false)
		return
	end
	hud:shopStatus(meldung or "", gut)
	Toene.spielen(if gut then "kaufen" else "nein", if gut then 1.3 else 1)
	shopAktualisieren()
end
hud.onKaufen = kaufen
hud.onShop = shopUmschalten

local function kameraWechseln()
	kameraModus = kameraModus % #kameraNamen + 1
	camPos = nil
	hud:toast(kameraNamen[kameraModus])
end
hud.onKamera = kameraWechseln
hud.onWheelie = function()
	wheelieGedrueckt = true
end

-- Tasten (mit hoher Priorität, damit z.B. die Leertaste nicht springt)
local PRIO = Enum.ContextActionPriority.High.Value + 10

local function halten(name)
	return function(_, state)
		tasten[name] = state == Enum.UserInputState.Begin or state == Enum.UserInputState.Change
		return Enum.ContextActionResult.Sink
	end
end

ContextActionService:BindActionAtPriority("WheelieTaste", function(_, state)
	if state == Enum.UserInputState.Begin then
		if hud.shopOffen then
			kaufen(hud.shopWahl)
		else
			wheelieGedrueckt = true
		end
	end
	return Enum.ContextActionResult.Sink
end, false, PRIO, Enum.KeyCode.Space, Enum.KeyCode.ButtonA)

ContextActionService:BindActionAtPriority("TrickEinhaender", halten("ein"), false, PRIO, Enum.KeyCode.Q, Enum.KeyCode.ButtonX)
ContextActionService:BindActionAtPriority("TrickNoHander", halten("nohand"), false, PRIO, Enum.KeyCode.E, Enum.KeyCode.ButtonY)
ContextActionService:BindActionAtPriority(
	"TrickKnie",
	halten("knie"),
	false,
	PRIO,
	Enum.KeyCode.C,
	Enum.KeyCode.LeftControl,
	Enum.KeyCode.ButtonB
)

local function einmal(f)
	return function(_, state)
		if state == Enum.UserInputState.Begin then
			f()
		end
		return Enum.ContextActionResult.Sink
	end
end

ContextActionService:BindActionAtPriority("Shop", einmal(shopUmschalten), false, PRIO, Enum.KeyCode.F, Enum.KeyCode.DPadUp)
ContextActionService:BindActionAtPriority("Kamera", einmal(kameraWechseln), false, PRIO, Enum.KeyCode.V, Enum.KeyCode.DPadDown)
ContextActionService:BindActionAtPriority("Hilfe", einmal(function()
	hud:hilfeUmschalten()
end), false, PRIO, Enum.KeyCode.H)

-- im Shop mit Pfeilen / Steuerkreuz eine Farbe aussuchen
UserInputService.InputBegan:Connect(function(input, verarbeitet)
	if not hud.shopOffen or verarbeitet then
		return
	end
	local k = input.KeyCode
	if k == Enum.KeyCode.Left or k == Enum.KeyCode.A or k == Enum.KeyCode.DPadLeft then
		hud:shopAuswahl(-1)
		shopAktualisieren()
	elseif k == Enum.KeyCode.Right or k == Enum.KeyCode.D or k == Enum.KeyCode.DPadRight then
		hud:shopAuswahl(1)
		shopAktualisieren()
	elseif k == Enum.KeyCode.Return then
		kaufen(hud.shopWahl)
	elseif k == Enum.KeyCode.Escape then
		hud:shopZeigen(false)
	end
end)

-- ------------------------------------------------------------------
-- Fahren
-- ------------------------------------------------------------------
-- seitwärts lenken, vorwärts fahren, Boden und Sprünge
local function bewegen(dt, steer)
	local lenkTempo = E.LENKEN * M * math.clamp(z.v / 4, 0.25, 1) * (if air then 0.5 else 1)
	if modus ~= "fahren" then
		steer = 0
	end
	local neuZ = math.clamp(zl + steer * lenkTempo * dt, -HALB + 2, HALB - 2)
	lenkVis += (steer - lenkVis) * math.min(1, dt * 6)
	local neuX = xw + z.v * M * dt

	local g = bodenHoehe(neuX, neuZ, y)
	if not air and g > y + STUFE then
		-- seitlich gegen eine Rampe: nicht weiter zur Seite
		neuZ = zl
		g = bodenHoehe(neuX, neuZ, y)
	end
	xw, zl = neuX, neuZ

	if air then
		vy -= E.JUMP_GRAVITY * M * dt
		y += vy * dt
		airT += dt
		if modus == "fahren" then
			jp += dt * 20 * (1 + trickRate()) * comboMult()
		end
		pitchLuft += (-0.12 - pitchLuft) * math.min(1, dt * 1.2)
		if y <= g then
			y = g
			pitchBoden = 0
			if modus == "fahren" then
				landen()
			else
				air = false
				vy = 0
			end
		end
	elseif y - g > KANTE then
		-- abheben!
		air = true
		airT = 0
		jp = 5
		vy = math.max(0, math.min(z.v * math.tan(pitchBoden), E.MAX_JUMP)) * M
		pitchLuft = pitchBoden
		if vy > 3 * M then
			Toene.spielen("sprung")
		end
	else
		y = g
		-- Neigung aus Hinter- und Vorderrad
		local vorne = bodenHoehe(xw + WB, zl, y)
		if vorne < y - KANTE then
			vorne = y + math.tan(pitchBoden) * WB -- Vorderrad schon über der Kante
		end
		pitchBoden = math.atan2(vorne - y, WB)
	end
end

local function ereignissePruefen(xVorher)
	-- Gullydeckel
	if not air then
		for _, g in gullys do
			if g.x > xVorher and g.x <= xw and math.abs(g.z - zl) < 2.6 then
				hopT = 0.1
				wackeln(0.12, 0.25)
				if z.th > 0 then
					z.om += (math.random() * 1.8 - 0.7) * (0.4 + 0.6 * z.v / VMAX)
				end
				Toene.spielen("gully")
			end
		end
	end

	-- Münzen
	local oben = y + 7.5 + 4 * math.sin(z.th)
	local unten = y - 1
	local i = muenzIdx
	while i <= #muenzen do
		local m = muenzen[i]
		if m.x > xw + WB + 2 then
			break
		end
		if not m.weg and m.x > xVorher - 2 and math.abs(m.z - zl) < 3.2 and m.y <= oben and m.y >= unten then
			muenzeNehmen(m)
		end
		i += 1
	end
	while muenzIdx <= #muenzen and muenzen[muenzIdx].x < xw - 4 do
		muenzIdx += 1
	end

	-- Rekord-Fahne
	if inWheelie and not flaggeDone and flaggeS > 0 and wd >= flaggeS then
		flaggeDone = true
		hud:toast("REKORD GEKNACKT!")
		Toene.spielen("kaufen", 1.5)
		konfettiWerfen(25)
	end

	-- Blitzer
	for _, b in blitzer do
		if b.x > xVorher and b.x <= xw then
			local kmh = math.floor(z.v * 3.6 + 0.5)
			if kmh >= E.BLITZ_KMH then
				geblitzt(b, kmh)
			end
		end
	end

	-- Ende der Straße: wieder von vorne
	if xw >= LEN then
		xw -= LEN
		runde += 1
		muenzenZurueck()
		punkte(E.RUNDEN_BONUS)
		hud:toast("RUNDE " .. runde .. " GESCHAFFT!  +" .. E.RUNDEN_BONUS)
		if camPos then
			camPos -= Vector3.new(LEN, 0, 0)
		end
	end
end

local function updateFahren(dt, inp)
	-- Wheelie-Taste
	if inp.wheelie then
		if not z.wmode then
			z.wmode = true
			z.landing = false
			z.om += E.POP
		elseif z.th > 0 then
			z.landing = true
		else
			z.wmode = false
		end
	end

	-- Tricks
	local na = if inp.nohand then 2 elseif inp.ein then 1 else 0
	local nc = inp.knie
	if na ~= z.arms or nc ~= z.crouch then
		z.arms = na
		z.crouch = nc
		trickT = 0
		if (inWheelie or air) and trickId() > 0 then
			Toene.spielen("trick")
		end
	end
	if (inWheelie or air) and trickId() > 0 then
		trickT += dt
		local bit = bit32.lshift(1, trickId())
		if trickT > 0.6 and bit32.band(combo, bit) == 0 then
			combo = bit32.bor(combo, bit)
			if comboMult() > 1 then
				hud:toast("COMBO x" .. comboMult() .. "!")
			end
		end
	end

	-- Burnout
	local nb = inp.gas and inp.bremse and not z.wmode and z.th == 0 and not air
	if nb and not burn then
		burnT = 0
		hud:banner("BURNOUT!", "", GELB, 0)
	elseif burn and not nb then
		hud:bannerWegWennFest()
		if inp.gas and burnT >= 1 then
			z.boostT = 1.5
			hud:toast("LAUNCH!")
			Toene.spielen("launch", 0.8)
		end
	end
	burn = nb
	if burn then
		burnT += dt
		hud:banner("BURNOUT!", fmt1(burnT) .. " s", GELB, 0)
	end
	if z.boostT > 0 then
		z.boostT -= dt
	end

	-- Physik
	local gelandet = Physik.schritte(z, dt, inp.gas, inp.bremse, E)

	if z.th > 0 and not inWheelie then
		inWheelie = true
		wd, tp = 0, 0
		z.wt = 0
		if not air then
			combo = 0
		end
		hud:bannerWeg()
		local best = rekord()
		if best >= 3 then
			flaggeS = best
			flaggeDone = false
			flaggeSetzen(xw + best * M)
		else
			flaggeS = -1
			flaggeDone = true
		end
	end
	if inWheelie then
		wd += z.v * dt
		z.wt += dt
		tp += z.v * dt * trickRate() * comboMult()
		local name = trickName()
		hud:banner(
			fmt1(wd) .. " m",
			if name ~= "" then name .. "! +" .. math.floor(tp) else fmt1(z.wt) .. " s",
			GELB,
			0
		)
	end
	if z.th >= CRASH_RAD then
		sturz("")
		return
	end
	if gelandet then
		z.wmode = false
		z.landing = false
		if inWheelie then
			wheelieEnde()
		end
	end

	local xVorher = xw
	bewegen(dt, inp.steer)
	if modus ~= "fahren" then
		return
	end
	ereignissePruefen(xVorher)
	if modus ~= "fahren" then
		return
	end

	if not inWheelie and not air and trickId() == 0 then
		combo = 0
	end
	if air and not inWheelie and airT > 0.2 then
		local name = trickName()
		hud:banner("SPRUNG!", if name ~= "" then "AIR " .. name .. "! +" .. math.floor(jp) else "+" .. math.floor(jp), GELB, 0.3)
	end
	hud:balanceZeigen(z.wmode or z.th > 0, z.th / CRASH_RAD)
end

local function updateSturz(dt, inp)
	sturzT += dt
	local limit = math.rad(100)
	if z.th < limit then
		z.om += 6 * dt
		z.th = math.min(z.th + z.om * dt, limit)
	end
	sturzFall = math.min(math.rad(85), sturzFall + dt * 4)
	z.v = math.max(0, z.v - 7 * dt)
	bewegen(dt, 0)
	if (sturzT > 1.2 and (inp.gas or inp.wheelie)) or sturzT > 3.5 then
		neustart()
	end
end

-- ------------------------------------------------------------------
-- Zeichnen: Scooter und Fahrer an die richtige Stelle setzen
-- ------------------------------------------------------------------
local function zeichnen(dt)
	if hopT > 0 then
		hopT -= dt
	end
	local hop = if hopT > 0 then 0.25 else 0
	local pitch = if air then pitchLuft else pitchBoden
	local yaw = -lenkVis * 0.18
	local roll = lenkVis * 0.22 * math.min(1, z.v / 6)
	local basis = CFrame.new(xw, y + hop, zl) * CFrame.Angles(0, yaw, 0) * CFrame.Angles(roll, 0, 0)
	local scooterCF = basis * CFrame.Angles(0, 0, pitch + z.th)
	local vel = Vector3.new(z.v * M, if air then vy else 0, 0)

	if scooterRoot and scooterRoot.Parent then
		scooterRoot.CFrame = scooterCF * CFrame.new(0, RAD, 0)
		scooterRoot.AssemblyLinearVelocity = vel
		scooterRoot.AssemblyAngularVelocity = Vector3.zero
	end

	local fussCF, lehne
	if modus == "sturz" then
		-- nach hinten vom Scooter fallen
		fussCF = basis * CFrame.new(FUSS_X - 1, DECK * 0.6, 0)
		lehne = pitch + sturzFall
	else
		fussCF = CFrame.new(scooterCF * Vector3.new(FUSS_X, DECK, 0)) * basis.Rotation
		lehne = pitch + z.th * 0.3
	end
	if hum.RigType == Enum.HumanoidRigType.R15 then
		hipOffset = hum.HipHeight + hrp.Size.Y / 2
	else
		hipOffset = 2 + hrp.Size.Y / 2
	end
	hrp.CFrame = fussCF * CFrame.Angles(0, 0, lehne) * CFrame.Angles(0, -math.pi / 2, 0) * CFrame.new(0, hipOffset, 0)
	hrp.AssemblyLinearVelocity = vel
	hrp.AssemblyAngularVelocity = Vector3.zero
end

local function kamera(dt)
	local cam = workspace.CurrentCamera
	if not cam then
		return
	end
	cam.CameraType = Enum.CameraType.Scriptable
	local k = 1 - math.exp(-dt * 6)
	local fahrer = Vector3.new(xw, y, zl)
	local ziel, blick, fov
	if kameraModus == 1 then
		local zurueck = 13 + 5 * (z.v / VMAX)
		ziel = Vector3.new(xw - zurueck, y + 6.5, zl * 0.85)
		blick = fahrer + Vector3.new(12, 3 + z.th * 2, 0)
		fov = 70 + 12 * (z.v / VMAX)
	elseif kameraModus == 2 then
		-- wie auf dem PyBadge: von der Seite. Die Kamera bleibt über der Straße
		-- (vor den Laternen und Bäumen). Fährst du ganz rechts, geht sie höher.
		local seiteZ = math.min(zl + 22, HALB - 1)
		local hoeher = (22 - (seiteZ - zl)) * 0.75
		ziel = Vector3.new(xw + 4, y + 4.5 + hoeher, seiteZ)
		blick = fahrer + Vector3.new(4, 3, 0)
		fov = 60
	else
		ziel = Vector3.new(xw + 15, y + 5, zl - 2)
		blick = fahrer + Vector3.new(0, 3.5, 0)
		fov = 65
	end
	if not camPos then
		camPos = ziel
	end
	-- längs genau mitfahren, Höhe und Seite weich nachziehen
	camPos = Vector3.new(ziel.X, camPos.Y + (ziel.Y - camPos.Y) * k, camPos.Z + (ziel.Z - camPos.Z) * k)
	local pos = camPos
	if wackelT > 0 then
		wackelT -= dt
		local s = wackelStark * math.clamp(wackelT / 0.3, 0, 1)
		pos += Vector3.new(0, (math.random() - 0.5) * s, (math.random() - 0.5) * s)
	end
	cam.CFrame = CFrame.lookAt(pos, blick)
	cam.FieldOfView = fov
end

-- ------------------------------------------------------------------
-- Tag und Nacht (jeder rechnet die Uhrzeit selbst aus)
-- ------------------------------------------------------------------
local function uhrzeit()
	local start = Lighting:GetAttribute("TagStart") or 0
	local sek = workspace:GetServerTimeNow() - start
	local p = (sek / E.DAY_LENGTH + 1 / 9) % 1
	if p < 2 / 3 then
		return 6 + 18 * p -- Tag: 6 bis 18 Uhr (2/3 der Zeit)
	end
	return (18 + 36 * (p - 2 / 3)) % 24 -- Nacht geht schneller vorbei
end

local istNacht = nil
local FENSTER_TAG = Color3.fromRGB(62, 92, 124)
local FENSTER_NACHT = Color3.fromRGB(255, 210, 120)
local LAMPE_AUS = Color3.fromRGB(205, 205, 200)
local LAMPE_AN = Color3.fromRGB(255, 225, 160)

local function nachtSetzen(nacht)
	istNacht = nacht
	task.spawn(function()
		for i, f in fenster do
			if f:GetAttribute("Licht") then
				f.Color = if nacht then FENSTER_NACHT else FENSTER_TAG
				f.Material = if nacht then Enum.Material.Neon else Enum.Material.Glass
			end
			if i % 400 == 0 then
				task.wait()
			end
		end
		for _, l in lampen do
			l.Color = if nacht then LAMPE_AN else LAMPE_AUS
			l.Material = if nacht then Enum.Material.Neon else Enum.Material.SmoothPlastic
			local licht = l:FindFirstChildOfClass("SpotLight")
			if licht then
				licht.Enabled = nacht
			end
		end
	end)
end

local nachtPruefT = 0
local function tagUndNacht(dt)
	local uhr = uhrzeit()
	Lighting.ClockTime = uhr
	nachtPruefT -= dt
	if nachtPruefT <= 0 then
		nachtPruefT = 0.5
		local nacht = uhr >= 18.2 or uhr < 5.8
		if nacht ~= istNacht then
			nachtSetzen(nacht)
		end
	end
end

-- ------------------------------------------------------------------
-- Hauptschleife
-- ------------------------------------------------------------------
local function update(dt)
	dt = math.min(dt, 0.1)
	tagUndNacht(dt)
	hud:update(dt)

	-- sich drehende Münzen
	spin = (spin + dt * 3) % (math.pi * 2)
	local i = muenzIdx
	while i <= #muenzen and muenzen[i].x < xw + 500 do
		local m = muenzen[i]
		if not m.weg then
			m.teil.CFrame = m.cf * CFrame.Angles(0, spin + m.x * 0.05, 0)
		end
		i += 1
	end

	if not bereit or not hrp or not hrp.Parent or hum.Health <= 0 then
		return
	end
	if not hum.PlatformStand then
		hum.PlatformStand = true
	end

	local inp = eingabe()
	if modus == "fahren" then
		updateFahren(dt, inp)
	else
		updateSturz(dt, inp)
	end
	sendeZustand()
	if muenzSerieT > 0 then
		muenzSerieT -= dt
	end

	-- Punkte zum Server schicken
	sendT -= dt
	if sendT <= 0 then
		sendT = 0.8
		if offen > 0 then
			Remotes.Punkte:FireServer(offen)
			unterwegs += offen
			offen = 0
		end
	end

	zeichnen(dt)
	kamera(dt)
	hud:tempoSetzen(z.v * 3.6)
end

RunService:BindToRenderStep("EScooterWheelie", Enum.RenderPriority.Camera.Value + 1, update)

-- Körperhaltung und Burnout-Rauch für alle Fahrer
local lackCache = setmetatable({}, { __mode = "k" })
RunService.Stepped:Connect(function(_, dt)
	local hue = (os.clock() * 0.25) % 1
	for _, p in Players:GetPlayers() do
		local c = p.Character
		if c then
			local link = c:FindFirstChild("Scooter")
			local sc = link and link.Value
			local bits = if p == player then zustandsBits() elseif sc then (sc:GetAttribute("Zustand") or 0) else 0
			local lenker = if p == player and modus == "fahren" then math.deg(z.th) * 0.7 else 0
			Posen.anwenden(c, bits, dt, lenker)
			if sc and sc.Parent then
				local info = lackCache[sc]
				if not info then
					info = { lack = {}, rauch = sc:FindFirstChild("Rauch", true) }
					for _, d in sc:GetDescendants() do
						if d:IsA("BasePart") and d:GetAttribute("Lack") then
							table.insert(info.lack, d)
						end
					end
					lackCache[sc] = info
				end
				if info.rauch then
					info.rauch.Enabled = bit32.band(bits, 8) ~= 0
				end
				local f = Farben[sc:GetAttribute("Farbe") or 1]
				if f and f.regenbogen then
					local farbe = Color3.fromHSV(hue, 0.85, 1)
					for _, part in info.lack do
						part.Color = farbe
					end
				end
			end
		end
	end
end)

-- ------------------------------------------------------------------
-- Figur und Scooter übernehmen
-- ------------------------------------------------------------------
local function figurUebernehmen(c)
	bereit = false
	char = c
	hum = c:WaitForChild("Humanoid")
	hrp = c:WaitForChild("HumanoidRootPart")
	local link = c:WaitForChild("Scooter", 30)
	if not link or char ~= c then
		return
	end
	while not link.Value do
		link.Changed:Wait()
	end
	local root = link.Value:WaitForChild("Root", 10)
	if not root or char ~= c then
		return
	end
	scooterRoot = root
	hum.PlatformStand = true
	hum.AutoRotate = false
	hum:SetStateEnabled(Enum.HumanoidStateType.Jumping, false)
	hum:SetStateEnabled(Enum.HumanoidStateType.FallingDown, false)
	hum:SetStateEnabled(Enum.HumanoidStateType.Ragdoll, false)
	hum.JumpPower = 0
	hum.JumpHeight = 0

	xw = math.clamp(hrp.Position.X, 10, LEN - 60)
	zl = math.random(-12, 12)
	y = 0
	neustart()
	camPos = nil
	bereit = true
end

player.CharacterAdded:Connect(function(c)
	task.spawn(figurUebernehmen, c)
end)
if player.Character then
	task.spawn(figurUebernehmen, player.Character)
end

-- Anzeigen, wenn sich der Spielstand ändert
local function kontoGeaendert()
	unterwegs = 0
	hud:konto(kontoStand())
	if hud.shopOffen then
		shopAktualisieren()
	end
end
player:GetAttributeChangedSignal("Punkte"):Connect(kontoGeaendert)
player:GetAttributeChangedSignal("Farben"):Connect(shopAktualisieren)
player:GetAttributeChangedSignal("Farbe"):Connect(shopAktualisieren)
player:GetAttributeChangedSignal("Rekord"):Connect(function()
	hud:rekord(rekord())
end)
hud:konto(kontoStand())
hud:rekord(rekord())

-- Hilfe nach einer Weile ausblenden
task.delay(if UserInputService.TouchEnabled then 15 else 25, function()
	hud:hilfeZeigen(false)
end)
hud:toast(if UserInputService.TouchEnabled then "WHEELIE-Knopf = Vorderrad hoch!" else "LEERTASTE = WHEELIE!")
