--[[
	Baut die Wheelie-Straße: eine lange gerade Straße in Richtung +X mit
	Häusern, Laternen, Bäumen, Rampen, Münzen, Gullydeckeln und Blitzern.

	Am Ende der Straße geht es wieder von vorne los. Damit man den Sprung
	nicht sieht, wird der Anfang der Strecke hinter dem Ende noch einmal
	aufgebaut (und das Ende vor dem Anfang). Diese Kopien sind nur Deko.
]]

local ReplicatedStorage = game:GetService("ReplicatedStorage")
local Lighting = game:GetService("Lighting")

local E = require(ReplicatedStorage:WaitForChild("Wheelie"):WaitForChild("Einstellungen"))

local Welt = {}

local M = E.STUDS_PRO_M
local LEN = E.STRECKE_M * M
local HALB = E.STRASSE_BREITE / 2
local GEHWEG = 12
local HAUS_Z = HALB + GEHWEG + 2
local VOR = 1300 -- so weit wird der Anfang hinter dem Ende kopiert
local ZURUECK = 300 -- so weit das Ende vor dem Anfang
local SPUREN = { -HALB * 0.75, -HALB * 0.25, HALB * 0.25, HALB * 0.75 }

local ASPHALT = Color3.fromRGB(58, 58, 64)
local GEHWEG_FARBE = Color3.fromRGB(168, 166, 160)
local WEISS = Color3.fromRGB(240, 240, 240)
local GELB = Color3.fromRGB(255, 205, 60)
local GOLD = Color3.fromRGB(255, 196, 40)
local FENSTER_TAG = Color3.fromRGB(62, 92, 124)
local LAMPE_AUS = Color3.fromRGB(205, 205, 200)

local HAUSFARBEN = {
	Color3.fromRGB(214, 196, 168),
	Color3.fromRGB(186, 92, 70),
	Color3.fromRGB(235, 222, 196),
	Color3.fromRGB(152, 164, 178),
	Color3.fromRGB(204, 150, 96),
	Color3.fromRGB(120, 140, 112),
	Color3.fromRGB(226, 186, 120),
	Color3.fromRGB(176, 120, 110),
	Color3.fromRGB(96, 116, 146),
	Color3.fromRGB(238, 236, 228),
	Color3.fromRGB(240, 170, 150),
	Color3.fromRGB(140, 190, 200),
}
local MARKISEN = {
	Color3.fromRGB(200, 40, 50),
	Color3.fromRGB(30, 120, 80),
	Color3.fromRGB(40, 90, 170),
	Color3.fromRGB(240, 160, 30),
}

local ordner = {}

local function neuerOrdner(name, parent)
	local f = Instance.new("Folder")
	f.Name = name
	f.Parent = parent
	return f
end

-- Ein festes Teil bauen. o = { size, cf, farbe, material, form, parent, name, deko, schatten }
local function teil(o)
	local p = Instance.new("Part")
	p.Anchored = true
	p.TopSurface = Enum.SurfaceType.Smooth
	p.BottomSurface = Enum.SurfaceType.Smooth
	if o.form then
		p.Shape = o.form
	end
	p.Size = o.size
	p.CFrame = o.cf
	p.Color = o.farbe
	p.Material = o.material or Enum.Material.SmoothPlastic
	if o.deko then
		p.CanCollide = false
		p.CanQuery = false
		p.CanTouch = false
	end
	if o.schatten == false then
		p.CastShadow = false
	end
	if o.name then
		p.Name = o.name
	end
	p.Parent = o.parent or ordner.Deko
	return p
end

local SENKRECHT = CFrame.Angles(0, 0, math.pi / 2) -- Zylinder aufstellen

-- f(x, kopie) für die echte Stelle und für die Kopien am Anfang/Ende aufrufen
local function ueberall(x, f)
	f(x, false)
	if x < VOR then
		f(x + LEN, true)
	end
	if x > LEN - ZURUECK then
		f(x - LEN, true)
	end
end

-- ------------------------------------------------------------------
-- Straße, Gehwege, Linien
-- ------------------------------------------------------------------
local function strasse()
	local von, bis = -ZURUECK - 300, LEN + VOR + 300
	local x = von
	while x < bis do
		local len = math.min(500, bis - x)
		local mx = x + len / 2
		teil({
			size = Vector3.new(len, 2, HALB * 2),
			cf = CFrame.new(mx, -1, 0),
			farbe = ASPHALT,
			material = Enum.Material.Asphalt,
			parent = ordner.Boden,
			name = "Strasse",
		})
		for _, s in { -1, 1 } do
			teil({
				size = Vector3.new(len, 1.6, GEHWEG),
				cf = CFrame.new(mx, -0.2, s * (HALB + GEHWEG / 2)),
				farbe = GEHWEG_FARBE,
				material = Enum.Material.Concrete,
				parent = ordner.Boden,
				name = "Gehweg",
			})
			teil({
				size = Vector3.new(len, 1, 400),
				cf = CFrame.new(mx, -0.9, s * (HALB + GEHWEG + 200)),
				farbe = Color3.fromRGB(86, 112, 70),
				material = Enum.Material.Grass,
				deko = true,
			})
			teil({
				size = Vector3.new(len, 0.05, 0.45),
				cf = CFrame.new(mx, 0.025, s * (HALB - 0.9)),
				farbe = WEISS,
				deko = true,
				schatten = false,
			})
		end
		x += len
	end

	-- gestrichelte Linien (Abstand passt genau in die Strecke, damit es beim Sprung gleich aussieht)
	local abstand = LEN / math.floor(LEN / 22 + 0.5)
	local i = math.floor(von / abstand)
	while i * abstand < bis do
		local dx = i * abstand
		for _, lz in { -HALB / 2, 0, HALB / 2 } do
			teil({
				size = Vector3.new(9, 0.05, if lz == 0 then 0.5 else 0.35),
				cf = CFrame.new(dx + 4.5, 0.025, lz),
				farbe = if lz == 0 then GELB else WEISS,
				deko = true,
				schatten = false,
			})
		end
		i += 1
	end
end

-- ------------------------------------------------------------------
-- Häuser
-- ------------------------------------------------------------------
local function fenster(size, cf, licht, immer)
	local f = teil({
		size = size,
		cf = cf,
		farbe = FENSTER_TAG,
		material = Enum.Material.Glass,
		parent = ordner.Fenster,
		deko = true,
		schatten = false,
		name = "Fenster",
	})
	f:SetAttribute("Licht", licht or immer or false)
	return f
end

local function haus(h, x, seite)
	local rng = Random.new(h.seed)
	local zMitte = seite * (HAUS_Z + h.d / 2)
	local fz = seite * (HAUS_Z - 0.1) -- Fenster sitzen auf der Seite zur Straße
	teil({
		size = Vector3.new(h.w, h.h, h.d),
		cf = CFrame.new(x, h.h / 2 - 0.5, zMitte),
		farbe = h.farbe,
		material = h.material,
		parent = ordner.Gebaeude,
		name = "Haus",
	})
	teil({
		size = Vector3.new(h.w + 1, 1.2, h.d + 1),
		cf = CFrame.new(x, h.h + 0.1, zMitte),
		farbe = h.farbe:Lerp(Color3.new(0, 0, 0), 0.35),
		parent = ordner.Gebaeude,
		deko = true,
	})

	local reihen = math.clamp(math.floor((h.h - 8) / 10), 1, 8)
	local start = 1
	if h.typ == 3 then
		-- Laden unten: großes Schaufenster und Markise
		fenster(Vector3.new(h.w - 8, 6.5, 0.3), CFrame.new(x, 4.2, fz), true, true)
		teil({
			size = Vector3.new(h.w - 6, 0.4, 3.2),
			cf = CFrame.new(x, 8.4, seite * (HAUS_Z - 1.6)) * CFrame.Angles(-seite * 0.25, 0, 0),
			farbe = MARKISEN[rng:NextInteger(1, #MARKISEN)],
			material = Enum.Material.Fabric,
			deko = true,
		})
		start = 2
	end
	if h.typ == 2 or h.typ == 3 then
		-- Fensterbänder
		for r = start, reihen do
			fenster(Vector3.new(h.w - 5, 4.2, 0.3), CFrame.new(x, r * 10 - 4, fz), rng:NextNumber() < 0.7)
		end
	else
		-- einzelne Fenster und eine Tür
		local spalten = math.clamp(math.floor((h.w - 6) / 9), 1, 4)
		local breite = (h.w - 6) / spalten
		for r = 1, reihen do
			for c = 1, spalten do
				local wx = x - h.w / 2 + 3 + breite * (c - 0.5)
				if r == 1 and c == math.ceil(spalten / 2) then
					teil({
						size = Vector3.new(3.6, 7, 0.3),
						cf = CFrame.new(wx, 3.0, fz),
						farbe = Color3.fromRGB(92, 62, 44),
						material = Enum.Material.Wood,
						deko = true,
					})
				else
					fenster(Vector3.new(4, 5, 0.3), CFrame.new(wx, r * 10 - 4, fz), rng:NextNumber() < 0.6)
				end
			end
		end
	end
end

local function haeuser(rng)
	for _, seite in { -1, 1 } do
		local liste = {}
		local x = 0
		while x < LEN - 30 do
			local w = math.min(rng:NextInteger(28, 56), LEN - x)
			local r = rng:NextNumber()
			table.insert(liste, {
				x = x + w / 2,
				w = w,
				h = rng:NextInteger(24, 110),
				d = rng:NextInteger(26, 44),
				farbe = HAUSFARBEN[rng:NextInteger(1, #HAUSFARBEN)],
				material = if rng:NextNumber() < 0.3 then Enum.Material.Brick else Enum.Material.SmoothPlastic,
				typ = if r < 0.45 then 2 elseif r < 0.8 then 1 else 3,
				seed = rng:NextInteger(1, 1000000),
			})
			x += w + rng:NextInteger(2, 8)
		end
		for _, h in liste do
			ueberall(h.x, function(px)
				haus(h, px, seite)
			end)
		end
	end
end

-- ------------------------------------------------------------------
-- Laternen und Bäume
-- ------------------------------------------------------------------
local function laterne(x, seite)
	local z = seite * (HALB + 1.6)
	teil({
		form = Enum.PartType.Cylinder,
		size = Vector3.new(15, 0.6, 0.6),
		cf = CFrame.new(x, 0.6 + 7.5, z) * SENKRECHT,
		farbe = Color3.fromRGB(60, 64, 70),
		material = Enum.Material.Metal,
		deko = true,
	})
	teil({
		size = Vector3.new(0.4, 0.4, 3.2),
		cf = CFrame.new(x, 15.6, z - seite * 1.4),
		farbe = Color3.fromRGB(60, 64, 70),
		material = Enum.Material.Metal,
		deko = true,
	})
	local kopf = teil({
		size = Vector3.new(1.4, 0.5, 2.4),
		cf = CFrame.new(x, 15.45, z - seite * 3.0),
		farbe = LAMPE_AUS,
		parent = ordner.Lampen,
		deko = true,
		name = "Leuchte",
	})
	local licht = Instance.new("SpotLight")
	licht.Face = Enum.NormalId.Bottom
	licht.Angle = 120
	licht.Range = 36
	licht.Brightness = 3
	licht.Color = Color3.fromRGB(255, 214, 150)
	licht.Shadows = false
	licht.Enabled = false
	licht.Parent = kopf
end

local function baum(x, seite, nummer)
	local rng = Random.new(E.SEED * 7 + nummer * 2 + (if seite > 0 then 1 else 0))
	local z = seite * (HALB + GEHWEG - 3.5)
	local h = 6 + rng:NextNumber() * 3
	teil({
		form = Enum.PartType.Cylinder,
		size = Vector3.new(h, 1.2, 1.2),
		cf = CFrame.new(x, 0.6 + h / 2, z) * SENKRECHT,
		farbe = Color3.fromRGB(110, 76, 50),
		material = Enum.Material.Wood,
		deko = true,
	})
	local gruen = Color3.fromRGB(60, 140, 60):Lerp(Color3.fromRGB(120, 170, 50), rng:NextNumber())
	teil({
		form = Enum.PartType.Ball,
		size = Vector3.one * (7 + rng:NextNumber() * 3),
		cf = CFrame.new(x, 0.6 + h + 2.5, z),
		farbe = gruen,
		material = Enum.Material.Grass,
		deko = true,
	})
end

local function strassenrand()
	local abstand = 70
	local n = math.floor(LEN / abstand)
	abstand = LEN / n
	for k = 0, n - 1 do
		for _, seite in { -1, 1 } do
			ueberall(k * abstand + 20, function(px)
				laterne(px, seite)
			end)
			ueberall(k * abstand + 20 + abstand / 2, function(px)
				baum(px, seite, k)
			end)
		end
	end
end

-- ------------------------------------------------------------------
-- Dinge auf der Straße
-- ------------------------------------------------------------------
local function muenze(pos, kopie)
	teil({
		form = Enum.PartType.Cylinder,
		size = Vector3.new(0.4, 2.6, 2.6),
		cf = CFrame.new(pos),
		farbe = GOLD,
		material = Enum.Material.Neon,
		parent = if kopie then ordner.Deko else ordner.Muenzen,
		deko = true,
		schatten = false,
		name = "Muenze",
	})
end

local function gully(x, z, kopie)
	teil({
		form = Enum.PartType.Cylinder,
		size = Vector3.new(0.12, 4.2, 4.2),
		cf = CFrame.new(x, 0.03, z) * SENKRECHT,
		farbe = Color3.fromRGB(40, 40, 44),
		material = Enum.Material.DiamondPlate,
		parent = if kopie then ordner.Deko else ordner.Gullys,
		deko = true,
		schatten = false,
		name = "Gully",
	})
end

local function rampe(x, z, gross, kopie)
	local L = (if gross then 8 else 5) * M -- Länge
	local H = (if gross then 2.4 else 1.4) * M -- Höhe
	local W = 12 -- Breite
	local t = 0.8 -- Dicke vom Brett
	local a = math.atan2(H, L)
	-- Oberseite vom Brett geht genau von (x, 0) bis (x + L, H)
	local brett = teil({
		size = Vector3.new(math.sqrt(L * L + H * H), t, W),
		cf = CFrame.new(x + L / 2 + math.sin(a) * t / 2, H / 2 - math.cos(a) * t / 2, z) * CFrame.Angles(0, 0, a),
		farbe = if gross then Color3.fromRGB(230, 90, 40) else Color3.fromRGB(196, 140, 84),
		material = Enum.Material.WoodPlanks,
		parent = if kopie then ordner.Deko else ordner.Boden,
		name = "Rampe",
	})
	if kopie then
		brett.CanQuery = false
	end
	-- Stützen
	teil({
		size = Vector3.new(0.8, H - 0.3, W - 0.6),
		cf = CFrame.new(x + L - 0.6, (H - 0.3) / 2, z),
		farbe = Color3.fromRGB(70, 70, 76),
		material = Enum.Material.Metal,
		deko = true,
	})
	for _, sz in { -1, 1 } do
		teil({
			size = Vector3.new(0.5, H * 0.5, 0.5),
			cf = CFrame.new(x + L * 0.5, H * 0.25, z + sz * (W / 2 - 0.6)),
			farbe = Color3.fromRGB(70, 70, 76),
			material = Enum.Material.Metal,
			deko = true,
		})
	end
	-- gelbe Kante oben
	teil({
		size = Vector3.new(0.4, 0.1, W),
		cf = CFrame.new(x + L - 0.2, H + 0.02, z),
		farbe = GELB,
		material = Enum.Material.Neon,
		deko = true,
		schatten = false,
	})
	-- Münzbogen hinter der Rampe (passt für ca. 55 bzw. 70 km/h)
	local v = (if gross then 70 else 55) / 3.6
	local vy = math.min(v * math.tan(a), E.MAX_JUMP)
	for i = 1, 5 do
		local d = i * (if gross then 4 else 3) -- Meter nach der Rampe
		local zeit = d / v
		local hoehe = H + (vy * zeit - 0.5 * E.JUMP_GRAVITY * zeit * zeit) * M
		if hoehe > 1.5 then
			muenze(Vector3.new(x + L + d * M, hoehe + 3, z), kopie)
		end
	end
end

local function schild(part, face, text)
	local sg = Instance.new("SurfaceGui")
	sg.Face = face
	sg.SizingMode = Enum.SurfaceGuiSizingMode.PixelsPerStud
	sg.PixelsPerStud = 40
	sg.LightInfluence = 0
	sg.Parent = part
	local kreis = Instance.new("Frame")
	kreis.Size = UDim2.fromScale(0.9, 0.9)
	kreis.Position = UDim2.fromScale(0.05, 0.05)
	kreis.BackgroundColor3 = Color3.new(1, 1, 1)
	kreis.Parent = sg
	local ecke = Instance.new("UICorner")
	ecke.CornerRadius = UDim.new(0.5, 0)
	ecke.Parent = kreis
	local rand = Instance.new("UIStroke")
	rand.Color = Color3.fromRGB(220, 30, 30)
	rand.Thickness = 10
	rand.ApplyStrokeMode = Enum.ApplyStrokeMode.Border
	rand.Parent = kreis
	local zahl = Instance.new("TextLabel")
	zahl.BackgroundTransparency = 1
	zahl.Size = UDim2.fromScale(1, 1)
	zahl.Font = Enum.Font.FredokaOne
	zahl.TextScaled = true
	zahl.Text = text
	zahl.TextColor3 = Color3.new(0, 0, 0)
	zahl.Parent = kreis
	local pad = Instance.new("UIPadding")
	pad.PaddingTop = UDim.new(0.2, 0)
	pad.PaddingBottom = UDim.new(0.2, 0)
	pad.PaddingLeft = UDim.new(0.15, 0)
	pad.PaddingRight = UDim.new(0.15, 0)
	pad.Parent = zahl
end

local function blitzer(x, kopie)
	local model = Instance.new("Model")
	model.Name = "Blitzer"
	local z = HALB + 3.5
	local function t(o)
		o.parent = model
		o.deko = true
		return teil(o)
	end
	t({
		form = Enum.PartType.Cylinder,
		size = Vector3.new(9.5, 0.7, 0.7),
		cf = CFrame.new(x, 0.6 + 4.75, z) * SENKRECHT,
		farbe = Color3.fromRGB(230, 230, 230),
		material = Enum.Material.Metal,
	})
	for i = 1, 3 do
		t({
			form = Enum.PartType.Cylinder,
			size = Vector3.new(0.7, 0.78, 0.78),
			cf = CFrame.new(x, 0.6 + i * 1.6, z) * SENKRECHT,
			farbe = Color3.fromRGB(210, 30, 30),
		})
	end
	local kasten = t({
		size = Vector3.new(1.8, 2.6, 2.8),
		cf = CFrame.new(x, 11.3, z),
		farbe = Color3.fromRGB(70, 72, 78),
		material = Enum.Material.Metal,
		name = "Kasten",
	})
	t({
		size = Vector3.new(0.2, 1.1, 1.1),
		cf = CFrame.new(x - 0.95, 11.1, z - 0.5),
		farbe = Color3.fromRGB(10, 10, 14),
		material = Enum.Material.Glass,
	})
	local blitz = t({
		size = Vector3.new(0.2, 0.5, 1.9),
		cf = CFrame.new(x - 0.95, 12.25, z),
		farbe = Color3.fromRGB(255, 255, 240),
		material = Enum.Material.Neon,
		name = "Blitz",
	})
	local licht = Instance.new("PointLight")
	licht.Range = 45
	licht.Brightness = 10
	licht.Color = Color3.fromRGB(255, 255, 255)
	licht.Shadows = false
	licht.Enabled = false
	licht.Parent = blitz
	-- Schild "60" am Mast, gut sichtbar für die Fahrer
	local tafel = t({
		size = Vector3.new(0.15, 3.2, 3.2),
		cf = CFrame.new(x - 0.45, 7.4, z),
		farbe = Color3.fromRGB(235, 235, 235),
	})
	tafel.Transparency = 1
	schild(tafel, Enum.NormalId.Left, tostring(E.BLITZ_KMH))
	model.PrimaryPart = kasten
	model.Parent = if kopie then ordner.Deko else ordner.Blitzer
end

local function tor(x)
	for _, s in { -1, 1 } do
		teil({
			size = Vector3.new(2.5, 21, 2.5),
			cf = CFrame.new(x, 10.5, s * (HALB + 2)),
			farbe = Color3.fromRGB(220, 40, 40),
			deko = true,
		})
	end
	local balken = teil({
		size = Vector3.new(2, 4, HALB * 2 + 7),
		cf = CFrame.new(x, 21, 0),
		farbe = WEISS,
		deko = true,
	})
	for _, face in { Enum.NormalId.Left, Enum.NormalId.Right } do
		local sg = Instance.new("SurfaceGui")
		sg.Face = face
		sg.SizingMode = Enum.SurfaceGuiSizingMode.PixelsPerStud
		sg.PixelsPerStud = 20
		sg.LightInfluence = 0
		sg.Parent = balken
		local spalten = 24
		for i = 0, spalten - 1 do
			for j = 0, 1 do
				local f = Instance.new("Frame")
				f.BorderSizePixel = 0
				f.Size = UDim2.fromScale(1 / spalten, 0.5)
				f.Position = UDim2.fromScale(i / spalten, j * 0.5)
				f.BackgroundColor3 = if (i + j) % 2 == 0 then Color3.new(0, 0, 0) else Color3.new(1, 1, 1)
				f.Parent = sg
			end
		end
		local schrift = Instance.new("TextLabel")
		schrift.AnchorPoint = Vector2.new(0.5, 0.5)
		schrift.Position = UDim2.fromScale(0.5, 0.5)
		schrift.Size = UDim2.fromScale(0.45, 0.8)
		schrift.BackgroundColor3 = Color3.new(1, 1, 1)
		schrift.BorderSizePixel = 0
		schrift.Font = Enum.Font.FredokaOne
		schrift.TextScaled = true
		schrift.Text = "START  ZIEL"
		schrift.TextColor3 = Color3.new(0, 0, 0)
		schrift.ZIndex = 2
		schrift.Parent = sg
	end
end

local function ereignisse()
	local rng = Random.new(E.SEED)
	local s = 45 -- Meter
	while s < E.STRECKE_M - 50 do
		local r = rng:NextInteger(0, 99)
		local gap = rng:NextInteger(14, 26)
		local spur = SPUREN[rng:NextInteger(1, #SPUREN)]
		local x = s * M
		if r < 20 then
			ueberall(x, function(px, kopie)
				gully(px, spur, kopie)
			end)
			if rng:NextNumber() < 0.4 then
				local spur2 = SPUREN[rng:NextInteger(1, #SPUREN)]
				ueberall(x + 9, function(px, kopie)
					gully(px, spur2, kopie)
				end)
			end
		elseif r < 42 then
			-- Münzen am Boden
			for i = 0, 4 do
				ueberall(x + i * 0.8 * M, function(px, kopie)
					muenze(Vector3.new(px, 2.6, spur), kopie)
				end)
			end
			gap += 4
		elseif r < 56 then
			-- hohe Münzen: nur im Wheelie erreichbar
			for i = 0, 3 do
				ueberall(x + i * 1.2 * M, function(px, kopie)
					muenze(Vector3.new(px, 10, spur), kopie)
				end)
			end
			gap += 5
		elseif r < 80 then
			ueberall(x, function(px, kopie)
				rampe(px, spur, false, kopie)
			end)
			gap += 14
		elseif r < 88 then
			ueberall(x, function(px, kopie)
				rampe(px, spur, true, kopie)
			end)
			gap += 20
		else
			ueberall(x, function(px, kopie)
				blitzer(px, kopie)
			end)
			gap += 4
		end
		s += gap
	end
end

-- ------------------------------------------------------------------
function Welt.bauen()
	local alt = workspace:FindFirstChild("Strecke")
	if alt then
		alt:Destroy()
	end
	local strecke = Instance.new("Folder")
	strecke.Name = "Strecke"
	strecke:SetAttribute("Laenge", LEN)
	for _, name in { "Boden", "Deko", "Gebaeude", "Fenster", "Lampen", "Muenzen", "Gullys", "Blitzer" } do
		ordner[name] = neuerOrdner(name, strecke)
	end

	local rng = Random.new(E.SEED + 1)
	strasse()
	haeuser(rng)
	strassenrand()
	ueberall(0, function(px)
		tor(px)
	end)
	ereignisse()

	local spawn = Instance.new("SpawnLocation")
	spawn.Name = "Start"
	spawn.Anchored = true
	spawn.Size = Vector3.new(8, 0.2, 8)
	spawn.CFrame = CFrame.new(18, 0.1, 0)
	spawn.Transparency = 1
	spawn.CanCollide = false
	spawn.CanQuery = false
	spawn.Neutral = true
	spawn.Duration = 0
	spawn.Parent = strecke

	strecke.Parent = workspace
	strecke:SetAttribute("Fertig", true)
	return strecke
end

function Welt.licht()
	Lighting.ClockTime = 8
	Lighting.Brightness = 2.2
	Lighting.Ambient = Color3.fromRGB(70, 70, 82)
	Lighting.OutdoorAmbient = Color3.fromRGB(128, 128, 142)
	Lighting.GlobalShadows = true
	for _, k in { "Atmosphere", "BloomEffect", "SunRaysEffect", "ColorCorrectionEffect" } do
		local alt = Lighting:FindFirstChildOfClass(k)
		if alt then
			alt:Destroy()
		end
	end
	local atm = Instance.new("Atmosphere")
	atm.Density = 0.36
	atm.Offset = 0.15
	atm.Color = Color3.fromRGB(199, 206, 222)
	atm.Decay = Color3.fromRGB(110, 116, 132)
	atm.Glare = 0.25
	atm.Haze = 1.4
	atm.Parent = Lighting
	local bloom = Instance.new("BloomEffect")
	bloom.Intensity = 0.7
	bloom.Size = 28
	bloom.Threshold = 1.3
	bloom.Parent = Lighting
	local rays = Instance.new("SunRaysEffect")
	rays.Intensity = 0.06
	rays.Spread = 0.8
	rays.Parent = Lighting
	local cc = Instance.new("ColorCorrectionEffect")
	cc.Saturation = 0.12
	cc.Contrast = 0.05
	cc.Parent = Lighting
	-- Uhrzeit rechnet jeder Spieler selbst aus (siehe Steuerung)
	Lighting:SetAttribute("TagStart", workspace:GetServerTimeNow())
end

return Welt
