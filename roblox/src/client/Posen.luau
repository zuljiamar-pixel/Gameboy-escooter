--[[
	Körperhaltung der Fahrer (nur für R15-Figuren):
	Hände am Lenker, Einhänder, No-Hander, in die Knie, Sturz.
	Wird bei jedem Spieler für alle Fahrer berechnet.

	Zustand (Bits): 1 = Einhänder, 2 = No-Hander, 4 = Knie, 8 = Burnout, 16 = Sturz
]]

local Posen = {}

local GELENKE = {
	RS = { "RightUpperArm", "RightShoulder" },
	LS = { "LeftUpperArm", "LeftShoulder" },
	RE = { "RightLowerArm", "RightElbow" },
	LE = { "LeftLowerArm", "LeftElbow" },
	RH = { "RightUpperLeg", "RightHip" },
	LH = { "LeftUpperLeg", "LeftHip" },
	RK = { "RightLowerLeg", "RightKnee" },
	LK = { "LeftLowerLeg", "LeftKnee" },
	ROOT = { "LowerTorso", "Root" },
	WAIST = { "UpperTorso", "Waist" },
}

local cache = setmetatable({}, { __mode = "k" })
local rad = math.rad
local ID = CFrame.identity

local function rx(g)
	return CFrame.Angles(rad(g), 0, 0)
end

local function rz(g)
	return CFrame.Angles(0, 0, rad(g))
end

local function motoren(char)
	local c = cache[char]
	if c ~= nil then
		return c or nil
	end
	local hum = char:FindFirstChildOfClass("Humanoid")
	if not hum then
		return nil
	end
	if hum.RigType ~= Enum.HumanoidRigType.R15 then
		cache[char] = false
		return nil
	end
	local m = {}
	local anzahl = 0
	for key, def in GELENKE do
		local teil = char:FindFirstChild(def[1])
		local motor = teil and teil:FindFirstChild(def[2])
		if motor and motor:IsA("Motor6D") then
			m[key] = motor
			anzahl += 1
		end
	end
	if anzahl < 10 then
		return nil -- Figur ist noch nicht ganz geladen
	end
	c = { motoren = m, jetzt = {} }
	for key in m do
		c.jetzt[key] = ID
	end
	cache[char] = c
	return c
end

local function ziel(bits, lenker)
	local t = {}
	local knie = bit32.band(bits, 4) ~= 0
	-- Hände am Lenker
	local arm = rx((if knie then 88 else 62) + lenker)
	t.RS, t.LS = arm, arm
	t.RE, t.LE = rx(22), rx(22)
	if bit32.band(bits, 2) ~= 0 then
		-- No-Hander: beide Arme hoch
		t.RS, t.LS = rz(150), rz(-150)
		t.RE, t.LE = ID, ID
	elseif bit32.band(bits, 1) ~= 0 then
		-- Einhänder: linker Arm winkt zur Seite
		t.LS = CFrame.Angles(rad(15), 0, rad(-115))
		t.LE = rx(35)
	end
	if knie then
		t.ROOT = CFrame.new(0, -1.0, 0)
		t.RH, t.LH = rx(65), rx(65)
		t.RK, t.LK = rx(-110), rx(-110)
		t.WAIST = rx(-25)
	else
		t.ROOT = CFrame.new(0, -0.1, 0)
		t.RH, t.LH = rx(10), rx(-6)
		t.RK, t.LK = rx(-14), rx(-8)
		t.WAIST = ID
	end
	if bit32.band(bits, 8) ~= 0 then
		t.WAIST = rx(-15) -- Burnout: nach vorne lehnen
	end
	if bit32.band(bits, 16) ~= 0 then
		-- Sturz: Arme und Beine in die Luft
		t.RS, t.LS = rz(165), rz(-165)
		t.RE, t.LE = ID, ID
		t.RH, t.LH = rx(55), rx(25)
		t.RK, t.LK = rx(-30), rx(-10)
		t.ROOT = ID
		t.WAIST = rx(10)
	end
	return t
end

-- char: Figur, bits: Zustand, dt: Zeit seit dem letzten Bild, lenker: Extra-Winkel für die Arme (Grad)
function Posen.anwenden(char, bits, dt, lenker)
	local c = motoren(char)
	if not c then
		return
	end
	local t = ziel(bits, lenker or 0)
	local a = 1 - math.exp(-dt * 14)
	for key, motor in c.motoren do
		local neu = c.jetzt[key]:Lerp(t[key] or ID, a)
		c.jetzt[key] = neu
		motor.Transform = neu
	end
end

return Posen
