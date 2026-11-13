--[[
	Anzeige auf dem Bildschirm: Tempo, Punkte, Wheelie-Meter, Balance-Anzeige,
	Hilfe, Farben-Shop und (auf Handy/Tablet) große Knöpfe.
]]

local UserInputService = game:GetService("UserInputService")

local HUD = {}
HUD.__index = HUD

local SCHRIFT = Enum.Font.FredokaOne
local GELB = Color3.fromRGB(255, 214, 64)
local WEISS = Color3.new(1, 1, 1)
local SCHWARZ = Color3.new(0, 0, 0)

local function neu(klasse, props, parent)
	local o = Instance.new(klasse)
	for k, v in props do
		o[k] = v
	end
	o.Parent = parent
	return o
end

local function ecken(parent, r)
	neu("UICorner", { CornerRadius = UDim.new(r or 0.2, 0) }, parent)
end

local function text(parent, props)
	local l = neu("TextLabel", {
		BackgroundTransparency = 1,
		Font = SCHRIFT,
		TextScaled = true,
		TextColor3 = WEISS,
		Text = "",
		Size = UDim2.fromScale(0.2, 0.05),
	}, parent)
	for k, v in props do
		l[k] = v
	end
	neu("UIStroke", { Thickness = 2, Color = SCHWARZ, Transparency = 0.15 }, l)
	return l
end

local function knopf(parent, beschriftung, farbe, reihenfolge)
	local b = neu("TextButton", {
		Size = UDim2.fromScale(0.31, 1),
		BackgroundColor3 = farbe,
		Font = SCHRIFT,
		TextScaled = true,
		TextColor3 = WEISS,
		Text = beschriftung,
		LayoutOrder = reihenfolge,
		AutoButtonColor = true,
	}, parent)
	ecken(b, 0.3)
	neu("UIStroke", { Thickness = 1.5, Color = SCHWARZ, Transparency = 0.3 }, b)
	neu("UIPadding", {
		PaddingTop = UDim.new(0.15, 0),
		PaddingBottom = UDim.new(0.15, 0),
		PaddingLeft = UDim.new(0.06, 0),
		PaddingRight = UDim.new(0.06, 0),
	}, b)
	return b
end

local HILFE_PC = table.concat({
	"W / Pfeil hoch:  Gas  (im Wheelie: Vorderrad höher)",
	"S / Pfeil runter:  Bremse  (im Wheelie: tiefer)",
	"A D / Pfeile:  lenken",
	"LEERTASTE:  Wheelie an / sauber landen",
	"W + S halten:  Burnout, dann S loslassen = Turbo!",
	"Q: Einhänder   E: No-Hander   C: in die Knie",
	"F: Farben-Shop   V: Kamera   H: Hilfe",
}, "\n")

local HILFE_TOUCH = table.concat({
	"Stick links: lenken",
	"GAS / BREMSE: schneller / langsamer",
	"WHEELIE: Vorderrad hoch, nochmal = landen",
	"Im Wheelie: GAS = höher, BREMSE = tiefer",
	"GAS + BREMSE: Burnout, BREMSE loslassen = Turbo",
	"1-HAND, NO-HAND, KNIE: Tricks (halten)",
}, "\n")

function HUD.neu(player, Farben, E, istTouch)
	local self = setmetatable({}, HUD)
	self.Farben = Farben
	self.istTouch = istTouch
	self.touch = { gas = false, bremse = false, ein = false, nohand = false, knie = false }
	self.gehalten = {}
	self.shopOffen = false
	self.shopWahl = 1
	self.bannerT = 0
	self.toastT = 0
	self.flashT = 0
	self.kacheln = {}

	local gui = neu("ScreenGui", {
		Name = "WheelieHUD",
		ResetOnSpawn = false,
		ZIndexBehavior = Enum.ZIndexBehavior.Sibling,
		IgnoreGuiInset = false,
	}, player:WaitForChild("PlayerGui"))
	self.gui = gui

	-- links oben: Tempo, Punkte, Rekord, Knöpfe
	self.tempo = text(gui, {
		Position = UDim2.fromScale(0.015, 0.02),
		Size = UDim2.fromScale(0.2, 0.08),
		TextXAlignment = Enum.TextXAlignment.Left,
		Text = "0 km/h",
	})
	self.kontoText = text(gui, {
		Position = UDim2.fromScale(0.015, 0.105),
		Size = UDim2.fromScale(0.22, 0.042),
		TextXAlignment = Enum.TextXAlignment.Left,
		TextColor3 = GELB,
		Text = "Punkte: 0",
	})
	self.rekordText = text(gui, {
		Position = UDim2.fromScale(0.015, 0.15),
		Size = UDim2.fromScale(0.22, 0.036),
		TextXAlignment = Enum.TextXAlignment.Left,
		Text = "Rekord: 0.0 m",
	})
	local leiste = neu("Frame", {
		BackgroundTransparency = 1,
		Position = UDim2.fromScale(0.015, 0.195),
		Size = if istTouch then UDim2.fromScale(0.4, 0.085) else UDim2.fromScale(0.3, 0.05),
	}, gui)
	neu("UIListLayout", {
		FillDirection = Enum.FillDirection.Horizontal,
		Padding = UDim.new(0.02, 0),
		SortOrder = Enum.SortOrder.LayoutOrder,
	}, leiste)
	self.knopfShop = knopf(leiste, if istTouch then "Shop" else "Shop (F)", Color3.fromRGB(235, 80, 150), 1)
	self.knopfKamera = knopf(leiste, if istTouch then "Kamera" else "Kamera (V)", Color3.fromRGB(60, 120, 220), 2)
	self.knopfHilfe = knopf(leiste, if istTouch then "Hilfe" else "Hilfe (H)", Color3.fromRGB(90, 90, 110), 3)
	self.knopfShop.Activated:Connect(function()
		if self.onShop then
			self.onShop()
		end
	end)
	self.knopfKamera.Activated:Connect(function()
		if self.onKamera then
			self.onKamera()
		end
	end)
	self.knopfHilfe.Activated:Connect(function()
		self:hilfeUmschalten()
	end)

	-- Mitte oben: große Anzeige (Wheelie-Meter, Sprung, Sturz ...)
	self.big = text(gui, {
		AnchorPoint = Vector2.new(0.5, 0),
		Position = UDim2.fromScale(0.5, 0.07),
		Size = UDim2.fromScale(0.5, 0.11),
	})
	self.sub = text(gui, {
		AnchorPoint = Vector2.new(0.5, 0),
		Position = UDim2.fromScale(0.5, 0.18),
		Size = UDim2.fromScale(0.5, 0.05),
		TextColor3 = GELB,
	})

	-- Balance-Anzeige: grün = sicher, gelb = Balance, rot = gleich kippst du um
	local bal = math.clamp(E.BALANCE_DEG / E.CRASH_DEG, 0.2, 0.7)
	self.balance = neu("Frame", {
		AnchorPoint = Vector2.new(0.5, 0),
		Position = UDim2.fromScale(0.5, 0.245),
		Size = UDim2.fromScale(0.3, 0.022),
		BackgroundColor3 = WEISS,
		BorderSizePixel = 0,
		Visible = false,
	}, gui)
	ecken(self.balance, 0.5)
	neu("UIGradient", {
		Color = ColorSequence.new({
			ColorSequenceKeypoint.new(0, Color3.fromRGB(60, 200, 90)),
			ColorSequenceKeypoint.new(bal - 0.12, Color3.fromRGB(60, 200, 90)),
			ColorSequenceKeypoint.new(bal, Color3.fromRGB(255, 220, 60)),
			ColorSequenceKeypoint.new(math.min(0.97, bal + 0.22), Color3.fromRGB(255, 120, 40)),
			ColorSequenceKeypoint.new(1, Color3.fromRGB(230, 40, 40)),
		}),
	}, self.balance)
	neu("UIStroke", { Thickness = 2, Color = SCHWARZ, Transparency = 0.2 }, self.balance)
	neu("Frame", {
		AnchorPoint = Vector2.new(0.5, 0.5),
		Position = UDim2.fromScale(bal, 0.5),
		Size = UDim2.new(0, 3, 1.7, 0),
		BackgroundColor3 = WEISS,
		BorderSizePixel = 0,
	}, self.balance)
	self.zeiger = neu("Frame", {
		AnchorPoint = Vector2.new(0.5, 0.5),
		Position = UDim2.fromScale(0, 0.5),
		Size = UDim2.new(0, 10, 2.3, 0),
		BackgroundColor3 = SCHWARZ,
		BorderSizePixel = 0,
	}, self.balance)
	ecken(self.zeiger, 0.5)
	neu("UIStroke", { Thickness = 2, Color = WEISS }, self.zeiger)

	-- kurze Meldungen
	self.toastText = text(gui, {
		AnchorPoint = Vector2.new(0.5, 0.5),
		Position = UDim2.fromScale(0.5, 0.6),
		Size = UDim2.fromScale(0.6, 0.055),
		TextColor3 = WEISS,
	})

	-- weißer Blitz vom Blitzer
	self.flash = neu("Frame", {
		Size = UDim2.fromScale(1, 1),
		BackgroundColor3 = WEISS,
		BackgroundTransparency = 1,
		BorderSizePixel = 0,
		ZIndex = 20,
	}, gui)

	-- Hilfe
	self.hilfe = neu("Frame", {
		AnchorPoint = if istTouch then Vector2.new(0, 0) else Vector2.new(0, 1),
		Position = if istTouch then UDim2.fromScale(0.015, 0.3) else UDim2.fromScale(0.015, 0.97),
		Size = if istTouch then UDim2.fromScale(0.4, 0.34) else UDim2.fromScale(0.3, 0.2),
		BackgroundColor3 = SCHWARZ,
		BackgroundTransparency = 0.4,
		ZIndex = 8,
	}, gui)
	ecken(self.hilfe, 0.06)
	neu("TextLabel", {
		Position = UDim2.fromScale(0.04, 0.05),
		Size = UDim2.fromScale(0.92, 0.9),
		BackgroundTransparency = 1,
		Font = Enum.Font.SourceSansBold,
		TextScaled = true,
		TextWrapped = true,
		TextXAlignment = Enum.TextXAlignment.Left,
		TextYAlignment = Enum.TextYAlignment.Top,
		TextColor3 = WEISS,
		Text = if istTouch then HILFE_TOUCH else HILFE_PC,
		ZIndex = 9,
	}, self.hilfe)

	if istTouch then
		self:touchKnoepfe()
	end
	self:shopBauen()
	return self
end

-- ------------------------------------------------------------------
-- Große Knöpfe für Handy und Tablet
-- ------------------------------------------------------------------
function HUD:touchKnoepfe()
	local pad = neu("Frame", {
		AnchorPoint = Vector2.new(1, 1),
		Position = UDim2.fromScale(0.99, 0.97),
		Size = UDim2.fromScale(0.5, 0.62),
		BackgroundTransparency = 1,
	}, self.gui)
	neu("UIAspectRatioConstraint", { AspectRatio = 1.25 }, pad)
	self.touchFelder = {}

	local function rund(name, beschriftung, farbe, x, y, breite)
		local b = neu("TextButton", {
			Name = name,
			AnchorPoint = Vector2.new(1, 1),
			Position = UDim2.fromScale(x, y),
			Size = UDim2.fromScale(breite, breite * 1.25),
			BackgroundColor3 = farbe,
			BackgroundTransparency = 0.2,
			Font = SCHRIFT,
			TextScaled = true,
			TextColor3 = WEISS,
			Text = beschriftung,
			AutoButtonColor = false,
		}, pad)
		ecken(b, 0.5)
		neu("UIStroke", {
			Thickness = 3,
			Color = WEISS,
			Transparency = 0.35,
			ApplyStrokeMode = Enum.ApplyStrokeMode.Border,
		}, b)
		neu("UIPadding", {
			PaddingTop = UDim.new(0.3, 0),
			PaddingBottom = UDim.new(0.3, 0),
			PaddingLeft = UDim.new(0.12, 0),
			PaddingRight = UDim.new(0.12, 0),
		}, b)
		b.InputBegan:Connect(function(input)
			local art = input.UserInputType
			if art == Enum.UserInputType.Touch or art == Enum.UserInputType.MouseButton1 then
				self.gehalten[name] = input
				self.touch[name] = true
				b.BackgroundTransparency = 0
				if name == "wheelie" and self.onWheelie then
					self.onWheelie()
				end
			end
		end)
		self.touchFelder[name] = b
		return b
	end

	rund("gas", "GAS", Color3.fromRGB(40, 170, 70), 1, 1, 0.33)
	rund("bremse", "BREMSE", Color3.fromRGB(210, 50, 50), 0.65, 1, 0.27)
	rund("knie", "KNIE", Color3.fromRGB(150, 90, 200), 0.355, 1, 0.19)
	rund("wheelie", "WHEELIE", Color3.fromRGB(40, 110, 220), 1, 0.56, 0.27)
	rund("ein", "1-HAND", Color3.fromRGB(240, 140, 30), 0.69, 0.6, 0.19)
	rund("nohand", "NO-HAND", Color3.fromRGB(240, 90, 120), 0.48, 0.6, 0.19)

	UserInputService.InputEnded:Connect(function(input)
		for name, inp in self.gehalten do
			if inp == input then
				self.gehalten[name] = nil
				self.touch[name] = false
				self.touchFelder[name].BackgroundTransparency = 0.2
			end
		end
	end)
end

-- ------------------------------------------------------------------
-- Farben-Shop
-- ------------------------------------------------------------------
function HUD:shopBauen()
	local shop = neu("Frame", {
		AnchorPoint = Vector2.new(0.5, 0.5),
		Position = UDim2.fromScale(0.5, 0.52),
		Size = UDim2.fromScale(0.7, 0.72),
		BackgroundColor3 = Color3.fromRGB(28, 30, 46),
		Visible = false,
		ZIndex = 10,
	}, self.gui)
	neu("UISizeConstraint", { MaxSize = Vector2.new(860, 540) }, shop)
	ecken(shop, 0.04)
	neu("UIStroke", { Thickness = 3, Color = Color3.fromRGB(255, 95, 162) }, shop)
	self.shop = shop

	text(shop, {
		Position = UDim2.fromScale(0.03, 0.03),
		Size = UDim2.fromScale(0.5, 0.1),
		TextXAlignment = Enum.TextXAlignment.Left,
		Text = "FARBEN-SHOP",
		ZIndex = 11,
	})
	self.shopKonto = text(shop, {
		AnchorPoint = Vector2.new(1, 0),
		Position = UDim2.fromScale(0.86, 0.045),
		Size = UDim2.fromScale(0.33, 0.07),
		TextXAlignment = Enum.TextXAlignment.Right,
		TextColor3 = GELB,
		ZIndex = 11,
	})
	local zu = neu("TextButton", {
		AnchorPoint = Vector2.new(1, 0),
		Position = UDim2.fromScale(0.98, 0.03),
		Size = UDim2.fromScale(0.08, 0.1),
		BackgroundColor3 = Color3.fromRGB(210, 50, 50),
		Font = SCHRIFT,
		TextScaled = true,
		TextColor3 = WEISS,
		Text = "X",
		ZIndex = 11,
	}, shop)
	ecken(zu, 0.3)
	zu.Activated:Connect(function()
		self:shopZeigen(false)
	end)

	local raster = neu("Frame", {
		Position = UDim2.fromScale(0.03, 0.17),
		Size = UDim2.fromScale(0.94, 0.66),
		BackgroundTransparency = 1,
		ZIndex = 11,
	}, shop)
	neu("UIGridLayout", {
		CellSize = UDim2.fromScale(0.235, 0.46),
		CellPadding = UDim2.fromScale(0.02, 0.06),
		SortOrder = Enum.SortOrder.LayoutOrder,
	}, raster)

	for i, f in self.Farben do
		local k = neu("TextButton", {
			Text = "",
			LayoutOrder = i,
			BackgroundColor3 = Color3.fromRGB(48, 50, 72),
			AutoButtonColor = true,
			ZIndex = 12,
		}, raster)
		ecken(k, 0.1)
		local rand = neu("UIStroke", { Thickness = 3, Color = WEISS, Transparency = 1 }, k)
		local farbe = neu("Frame", {
			Position = UDim2.fromScale(0.08, 0.07),
			Size = UDim2.fromScale(0.84, 0.5),
			BackgroundColor3 = f.farbe,
			ZIndex = 13,
		}, k)
		ecken(farbe, 0.15)
		if f.regenbogen then
			farbe.BackgroundColor3 = WEISS
			neu("UIGradient", {
				Color = ColorSequence.new({
					ColorSequenceKeypoint.new(0, Color3.fromRGB(255, 0, 0)),
					ColorSequenceKeypoint.new(0.2, Color3.fromRGB(255, 200, 0)),
					ColorSequenceKeypoint.new(0.4, Color3.fromRGB(0, 220, 0)),
					ColorSequenceKeypoint.new(0.6, Color3.fromRGB(0, 200, 255)),
					ColorSequenceKeypoint.new(0.8, Color3.fromRGB(80, 60, 255)),
					ColorSequenceKeypoint.new(1, Color3.fromRGB(255, 0, 200)),
				}),
			}, farbe)
		end
		local name = text(k, {
			Position = UDim2.fromScale(0.05, 0.6),
			Size = UDim2.fromScale(0.9, 0.18),
			Text = f.name,
			ZIndex = 13,
		})
		local preis = text(k, {
			Position = UDim2.fromScale(0.05, 0.8),
			Size = UDim2.fromScale(0.9, 0.15),
			Text = "",
			ZIndex = 13,
		})
		k.Activated:Connect(function()
			self.shopWahl = i
			if self.onKaufen then
				self.onKaufen(i)
			end
		end)
		self.kacheln[i] = { knopf = k, rand = rand, name = name, preis = preis }
	end

	self.shopStatusText = text(shop, {
		AnchorPoint = Vector2.new(0.5, 0),
		Position = UDim2.fromScale(0.5, 0.86),
		Size = UDim2.fromScale(0.9, 0.08),
		Text = "Klick auf eine Farbe zum Kaufen oder Auswählen.",
		ZIndex = 11,
	})
end

function HUD:shopZeigen(an)
	self.shopOffen = an
	self.shop.Visible = an
	if an then
		self.hilfe.Visible = false
	end
end

function HUD:shopAktualisieren(punkte, besitz, gewaehlt)
	self.shopKonto.Text = "Punkte: " .. punkte
	for i, k in self.kacheln do
		local f = self.Farben[i]
		local hat = bit32.band(besitz, bit32.lshift(1, i - 1)) ~= 0
		if i == gewaehlt then
			k.preis.Text = "AUSGEWÄHLT"
			k.preis.TextColor3 = Color3.fromRGB(120, 255, 140)
		elseif hat then
			k.preis.Text = "gekauft - wählen"
			k.preis.TextColor3 = WEISS
		else
			k.preis.Text = f.preis .. " Punkte"
			k.preis.TextColor3 = if punkte >= f.preis then GELB else Color3.fromRGB(150, 150, 160)
		end
		k.rand.Transparency = if i == self.shopWahl then 0 else 1
	end
end

function HUD:shopStatus(t, gut)
	self.shopStatusText.Text = t
	self.shopStatusText.TextColor3 = if gut then Color3.fromRGB(120, 255, 140) else Color3.fromRGB(255, 120, 120)
end

function HUD:shopAuswahl(schritt)
	local n = #self.Farben
	self.shopWahl = (self.shopWahl - 1 + schritt) % n + 1
end

-- ------------------------------------------------------------------
-- Anzeigen
-- ------------------------------------------------------------------
function HUD:tempoSetzen(kmh)
	self.tempo.Text = math.floor(kmh + 0.5) .. " km/h"
end

function HUD:konto(n)
	self.kontoText.Text = "Punkte: " .. n
end

function HUD:rekord(m)
	self.rekordText.Text = "Rekord: " .. string.format("%.1f", m) .. " m"
end

-- sek = 0: bleibt stehen, bis etwas anderes kommt (z.B. während des Wheelies)
function HUD:banner(gross, klein, farbe, sek)
	self.big.Text = gross
	self.sub.Text = klein
	self.sub.TextColor3 = farbe or GELB
	self.bannerT = sek or 0
end

function HUD:bannerWeg()
	self.big.Text = ""
	self.sub.Text = ""
	self.bannerT = 0
end

-- nur löschen, wenn die Anzeige gerade "fest" ist (kein Ergebnis, das noch stehen soll)
function HUD:bannerWegWennFest()
	if self.bannerT == 0 then
		self:bannerWeg()
	end
end

function HUD:bannerFrei()
	return self.bannerT == 0
end

function HUD:toast(t)
	self.toastText.Text = t
	self.toastT = 1.8
end

function HUD:balanceZeigen(an, anteil)
	self.balance.Visible = an
	if an then
		self.zeiger.Position = UDim2.fromScale(math.clamp(anteil, 0, 1), 0.5)
	end
end

function HUD:blitz()
	self.flashT = 0.2
end

function HUD:hilfeUmschalten()
	self.hilfe.Visible = not self.hilfe.Visible
end

function HUD:hilfeZeigen(an)
	self.hilfe.Visible = an
end

function HUD:update(dt)
	if self.bannerT > 0 then
		self.bannerT -= dt
		if self.bannerT <= 0 then
			self:bannerWeg()
		end
	end
	if self.toastT > 0 then
		self.toastT -= dt
		if self.toastT <= 0 then
			self.toastText.Text = ""
		end
	end
	if self.flashT > 0 then
		self.flashT = math.max(0, self.flashT - dt)
		self.flash.BackgroundTransparency = 1 - (self.flashT / 0.2) * 0.85
	else
		self.flash.BackgroundTransparency = 1
	end
end

return HUD
