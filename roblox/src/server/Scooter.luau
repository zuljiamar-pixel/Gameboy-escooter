--[[
	Baut das E-Scooter-Modell.
	Das Modell schaut in Richtung +X. Der Ursprung ist da, wo das Hinterrad
	die Straße berührt. Das unsichtbare Teil "Root" sitzt in der Hinterachse,
	alle anderen Teile sind daran festgeschweißt.
]]

local Scooter = {}

local SCHWARZ = Color3.fromRGB(24, 24, 28)
local GRAU = Color3.fromRGB(125, 128, 138)
local DUNKEL = Color3.fromRGB(55, 57, 64)
local MINT = Color3.fromRGB(25, 194, 160)

local function teil(model, root, name, size, cf, farbe, material, form, lack)
	local p = Instance.new("Part")
	p.Name = name
	if form then
		p.Shape = form
	end
	p.Size = size
	p.CFrame = cf
	p.Color = farbe
	p.Material = material or Enum.Material.SmoothPlastic
	p.TopSurface = Enum.SurfaceType.Smooth
	p.BottomSurface = Enum.SurfaceType.Smooth
	p.Anchored = false
	p.CanCollide = false
	p.CanTouch = false
	p.CanQuery = false
	p.Massless = true
	if lack then
		p:SetAttribute("Lack", true)
	end
	p.Parent = model
	local w = Instance.new("WeldConstraint")
	w.Part0 = root
	w.Part1 = p
	w.Parent = p
	return p
end

-- schräges Teil von Punkt a nach Punkt b (in der X/Y-Ebene)
local function stange(model, root, name, a, b, dicke, farbe, material, lack)
	local mitte = (a + b) / 2
	local laenge = (b - a).Magnitude
	local winkel = math.atan2(b.Y - a.Y, b.X - a.X) - math.pi / 2
	return teil(
		model,
		root,
		name,
		Vector3.new(dicke, laenge, dicke),
		CFrame.new(mitte) * CFrame.Angles(0, 0, winkel),
		farbe,
		material,
		nil,
		lack
	)
end

function Scooter.bauen(E)
	local S = E.SCOOTER
	local WB, R, DECK = S.RADSTAND, S.RAD, S.DECK

	local model = Instance.new("Model")
	model.Name = "Scooter"

	local root = Instance.new("Part")
	root.Name = "Root"
	root.Size = Vector3.new(0.4, 0.4, 0.4)
	root.CFrame = CFrame.new(0, R, 0)
	root.Transparency = 1
	root.Anchored = false
	root.CanCollide = true
	root.CanTouch = false
	root.CanQuery = false
	root.CollisionGroup = "Fahrer"
	root.Parent = model
	model.PrimaryPart = root

	-- Räder: Zylinder liegen quer zur Fahrtrichtung
	local quer = CFrame.Angles(0, math.pi / 2, 0)
	for _, rx in { 0, WB } do
		teil(model, root, "Rad", Vector3.new(0.55, 2 * R, 2 * R), CFrame.new(rx, R, 0) * quer, SCHWARZ, nil, Enum.PartType.Cylinder)
		teil(model, root, "Felge", Vector3.new(0.6, R * 0.9, R * 0.9), CFrame.new(rx, R, 0) * quer, GRAU, Enum.Material.Metal, Enum.PartType.Cylinder)
	end

	-- Trittbrett
	teil(model, root, "Deck", Vector3.new(3.4, 0.3, 1.2), CFrame.new(1.95, DECK - 0.2, 0), MINT, nil, nil, true)
	teil(model, root, "Griptape", Vector3.new(3.1, 0.06, 1.0), CFrame.new(1.95, DECK - 0.03, 0), SCHWARZ)
	teil(model, root, "Akku", Vector3.new(2.6, 0.25, 0.9), CFrame.new(1.95, DECK - 0.45, 0), DUNKEL)

	-- Schutzblech und Rücklicht
	teil(model, root, "Schutzblech", Vector3.new(1.5, 0.16, 0.62), CFrame.new(-0.05, 2 * R + 0.12, 0), MINT, nil, nil, true)
	teil(model, root, "Ruecklicht", Vector3.new(0.14, 0.22, 0.5), CFrame.new(-0.8, 2 * R + 0.02, 0), Color3.fromRGB(255, 40, 40), Enum.Material.Neon)
	stange(model, root, "Halter", Vector3.new(0.1, DECK - 0.1, 0), Vector3.new(-0.3, 2 * R + 0.05, 0), 0.22, MINT, nil, true)

	-- Lenkstange: von vorne unten schräg nach hinten oben
	local unten = Vector3.new(WB - 0.15, DECK, 0)
	local oben = Vector3.new(WB - 0.6, 4.5, 0)
	stange(model, root, "Hals", Vector3.new(3.55, DECK - 0.2, 0), unten, 0.5, MINT, nil, true)
	stange(model, root, "Lenkstange", unten, oben, 0.34, MINT, nil, true)
	stange(model, root, "Gabel", Vector3.new(WB, R, 0), unten + Vector3.new(0, 0.2, 0), 0.3, DUNKEL, Enum.Material.Metal)

	-- Lenker mit Griffen
	teil(model, root, "Lenker", Vector3.new(0.24, 0.24, 2.6), CFrame.new(oben), DUNKEL, Enum.Material.Metal)
	for _, gz in { -1.15, 1.15 } do
		teil(model, root, "Griff", Vector3.new(0.32, 0.32, 0.55), CFrame.new(oben.X, oben.Y, gz), SCHWARZ)
	end
	teil(model, root, "Display", Vector3.new(0.3, 0.12, 0.5), CFrame.new(oben.X - 0.05, oben.Y + 0.16, 0), SCHWARZ)

	-- Scheinwerfer (die Vorderseite der Lampe zeigt nach vorne = +X)
	local lampenHoehe = 3.7
	local t = (lampenHoehe - unten.Y) / (oben.Y - unten.Y)
	local lampeX = unten.X + (oben.X - unten.X) * t + 0.25
	local lampe = teil(
		model,
		root,
		"Scheinwerfer",
		Vector3.new(0.45, 0.4, 0.2),
		CFrame.new(lampeX, lampenHoehe, 0) * CFrame.Angles(0, -math.pi / 2, 0),
		Color3.fromRGB(255, 250, 220),
		Enum.Material.Neon
	)
	local licht = Instance.new("SpotLight")
	licht.Face = Enum.NormalId.Front
	licht.Angle = 55
	licht.Range = 40
	licht.Brightness = 2
	licht.Shadows = false
	licht.Color = Color3.fromRGB(255, 245, 220)
	licht.Parent = lampe

	-- Rauch für den Burnout (am Hinterrad)
	local auspuff = Instance.new("Attachment")
	auspuff.Name = "RauchPunkt"
	auspuff.Position = Vector3.new(-0.4, -R + 0.25, 0)
	auspuff.Parent = root
	local rauch = Instance.new("ParticleEmitter")
	rauch.Name = "Rauch"
	rauch.Texture = "rbxasset://textures/particles/smoke_main.dds"
	rauch.Rate = 40
	rauch.Lifetime = NumberRange.new(0.8, 1.4)
	rauch.Speed = NumberRange.new(3, 7)
	rauch.SpreadAngle = Vector2.new(35, 35)
	rauch.Size = NumberSequence.new({ NumberSequenceKeypoint.new(0, 1.2), NumberSequenceKeypoint.new(1, 5.5) })
	rauch.Transparency = NumberSequence.new({ NumberSequenceKeypoint.new(0, 0.3), NumberSequenceKeypoint.new(1, 1) })
	rauch.Color = ColorSequence.new(Color3.fromRGB(225, 225, 225))
	rauch.Acceleration = Vector3.new(0, 2.5, 0)
	rauch.RotSpeed = NumberRange.new(-40, 40)
	rauch.Rotation = NumberRange.new(0, 360)
	rauch.EmissionDirection = Enum.NormalId.Top
	rauch.Enabled = false
	rauch.Parent = auspuff

	return model
end

-- Scooter umfärben (index = Nummer in Farben)
function Scooter.faerben(model, index, Farben)
	local f = Farben[index] or Farben[1]
	model:SetAttribute("Farbe", index)
	for _, p in model:GetDescendants() do
		if p:IsA("BasePart") and p:GetAttribute("Lack") then
			p.Color = f.farbe
		end
	end
end

return Scooter
