-- Mini-Roblox zum Testen: Datentypen, Instanzen (gegen die echte API-Liste geprüft),
-- Signale, task-Scheduler, Raycast, Remotes, Spieler mit R15-Figur.
-- API_PATH wird von test.sh gesetzt (api.luau, erzeugt mit gen_api.py).
local API = loadmodule(API_PATH)()

local R = {}
R.ERRORS = {}
R.WARNINGS = {}
R.NOW = 0
R.TIME_OFFSET = 0
R.TEXT_SEEN = {}
R.TEXT_ORDER = {}
R.FIRED = {}
R.KEYS = {}
R.PAD = {}
R.LAST_KMH = 0

local function report(msg)
	table.insert(R.ERRORS, msg)
	print("ERROR: " .. msg)
end
R.report = report

-- ------------------------------------------------------------------
-- typeof
-- ------------------------------------------------------------------
local function typeof(v)
	local mt = getmetatable(v)
	if type(v) == "table" and type(mt) == "table" and mt.__type then
		return mt.__type
	end
	return type(v)
end
R.typeof = typeof

-- ------------------------------------------------------------------
-- Vector3 / Vector2
-- ------------------------------------------------------------------
local V3mt = { __type = "Vector3" }
local function v3(x, y, z)
	return setmetatable({ X = x or 0, Y = y or 0, Z = z or 0 }, V3mt)
end
local function isV3(v)
	return getmetatable(v) == V3mt
end
local V3m = {}
function V3m.Dot(a, b)
	return a.X * b.X + a.Y * b.Y + a.Z * b.Z
end
function V3m.Cross(a, b)
	return v3(a.Y * b.Z - a.Z * b.Y, a.Z * b.X - a.X * b.Z, a.X * b.Y - a.Y * b.X)
end
function V3m.Lerp(a, b, t)
	return v3(a.X + (b.X - a.X) * t, a.Y + (b.Y - a.Y) * t, a.Z + (b.Z - a.Z) * t)
end
function V3m.Abs(a)
	return v3(math.abs(a.X), math.abs(a.Y), math.abs(a.Z))
end
V3mt.__index = function(v, k)
	if k == "Magnitude" then
		return math.sqrt(v.X * v.X + v.Y * v.Y + v.Z * v.Z)
	elseif k == "Unit" then
		local m = math.sqrt(v.X * v.X + v.Y * v.Y + v.Z * v.Z)
		if m == 0 then
			return v3(0, 0, 0)
		end
		return v3(v.X / m, v.Y / m, v.Z / m)
	end
	local f = V3m[k]
	if f then
		return f
	end
	error("'" .. tostring(k) .. "' is not a valid member of Vector3", 2)
end
V3mt.__newindex = function(_, k)
	error("Vector3." .. tostring(k) .. " cannot be assigned to", 2)
end
local function needV3(a, b, op)
	if not isV3(a) or not isV3(b) then
		error("Vector3 " .. op .. ": bad operand (" .. typeof(a) .. ", " .. typeof(b) .. ")", 3)
	end
end
V3mt.__add = function(a, b)
	needV3(a, b, "+")
	return v3(a.X + b.X, a.Y + b.Y, a.Z + b.Z)
end
V3mt.__sub = function(a, b)
	needV3(a, b, "-")
	return v3(a.X - b.X, a.Y - b.Y, a.Z - b.Z)
end
V3mt.__mul = function(a, b)
	if type(a) == "number" then
		return v3(a * b.X, a * b.Y, a * b.Z)
	elseif type(b) == "number" then
		return v3(a.X * b, a.Y * b, a.Z * b)
	end
	needV3(a, b, "*")
	return v3(a.X * b.X, a.Y * b.Y, a.Z * b.Z)
end
V3mt.__div = function(a, b)
	if type(b) == "number" then
		return v3(a.X / b, a.Y / b, a.Z / b)
	end
	needV3(a, b, "/")
	return v3(a.X / b.X, a.Y / b.Y, a.Z / b.Z)
end
V3mt.__unm = function(a)
	return v3(-a.X, -a.Y, -a.Z)
end
V3mt.__eq = function(a, b)
	return a.X == b.X and a.Y == b.Y and a.Z == b.Z
end
V3mt.__tostring = function(a)
	return string.format("%.3f, %.3f, %.3f", a.X, a.Y, a.Z)
end
local Vector3 = {
	new = function(x, y, z)
		for _, c in { x, y, z } do
			if c ~= nil and type(c) ~= "number" then
				error("Vector3.new: number expected", 2)
			end
		end
		return v3(x, y, z)
	end,
}
Vector3.zero = v3(0, 0, 0)
Vector3.one = v3(1, 1, 1)
Vector3.xAxis = v3(1, 0, 0)
Vector3.yAxis = v3(0, 1, 0)
Vector3.zAxis = v3(0, 0, 1)
R.Vector3 = Vector3

local V2mt = { __type = "Vector2" }
V2mt.__index = function(_, k)
	error("'" .. tostring(k) .. "' is not a valid member of Vector2", 2)
end
local Vector2 = {
	new = function(x, y)
		return setmetatable({ X = x or 0, Y = y or 0 }, V2mt)
	end,
}
Vector2.zero = Vector2.new(0, 0)
R.Vector2 = Vector2

-- ------------------------------------------------------------------
-- CFrame (Rotationsmatrix zeilenweise, Spalten = Right, Up, Back)
-- ------------------------------------------------------------------
local CFmt = { __type = "CFrame" }
local function cf(p, r)
	return setmetatable({ _p = p, _r = r }, CFmt)
end
local function isCF(c)
	return getmetatable(c) == CFmt
end
local ID_R = { 1, 0, 0, 0, 1, 0, 0, 0, 1 }
local function mulR(a, b)
	local r = {}
	for i = 0, 2 do
		for j = 0, 2 do
			r[i * 3 + j + 1] = a[i * 3 + 1] * b[j + 1] + a[i * 3 + 2] * b[3 + j + 1] + a[i * 3 + 3] * b[6 + j + 1]
		end
	end
	return r
end
local function mulRV(r, x, y, z)
	return r[1] * x + r[2] * y + r[3] * z, r[4] * x + r[5] * y + r[6] * z, r[7] * x + r[8] * y + r[9] * z
end
local function transpose(r)
	return { r[1], r[4], r[7], r[2], r[5], r[8], r[3], r[6], r[9] }
end
local function rotX(a)
	local c, s = math.cos(a), math.sin(a)
	return { 1, 0, 0, 0, c, -s, 0, s, c }
end
local function rotY(a)
	local c, s = math.cos(a), math.sin(a)
	return { c, 0, s, 0, 1, 0, -s, 0, c }
end
local function rotZ(a)
	local c, s = math.cos(a), math.sin(a)
	return { c, -s, 0, s, c, 0, 0, 0, 1 }
end
local function orthonormal(r)
	local x = v3(r[1], r[4], r[7]).Unit
	local yv = v3(r[2], r[5], r[8])
	yv = (yv - x * yv:Dot(x)).Unit
	local zv = x:Cross(yv)
	return { x.X, yv.X, zv.X, x.Y, yv.Y, zv.Y, x.Z, yv.Z, zv.Z }
end
local CFm = {}
function CFm.Inverse(c)
	local rt = transpose(c._r)
	local x, y, z = mulRV(rt, c._p.X, c._p.Y, c._p.Z)
	return cf(v3(-x, -y, -z), rt)
end
function CFm.Lerp(a, b, t)
	local r = {}
	for i = 1, 9 do
		r[i] = a._r[i] + (b._r[i] - a._r[i]) * t
	end
	return cf(a._p:Lerp(b._p, t), orthonormal(r))
end
function CFm.ToWorldSpace(a, b)
	return a * b
end
function CFm.ToObjectSpace(a, b)
	return a:Inverse() * b
end
function CFm.PointToWorldSpace(a, v)
	return a * v
end
function CFm.PointToObjectSpace(a, v)
	return a:Inverse() * v
end
function CFm.VectorToWorldSpace(a, v)
	local x, y, z = mulRV(a._r, v.X, v.Y, v.Z)
	return v3(x, y, z)
end
function CFm.GetComponents(c)
	local r = c._r
	return c._p.X, c._p.Y, c._p.Z, r[1], r[2], r[3], r[4], r[5], r[6], r[7], r[8], r[9]
end
CFmt.__index = function(c, k)
	if k == "Position" or k == "p" then
		return c._p
	elseif k == "X" then
		return c._p.X
	elseif k == "Y" then
		return c._p.Y
	elseif k == "Z" then
		return c._p.Z
	elseif k == "Rotation" then
		return cf(v3(0, 0, 0), c._r)
	elseif k == "LookVector" then
		return v3(-c._r[3], -c._r[6], -c._r[9])
	elseif k == "RightVector" or k == "XVector" then
		return v3(c._r[1], c._r[4], c._r[7])
	elseif k == "UpVector" or k == "YVector" then
		return v3(c._r[2], c._r[5], c._r[8])
	elseif k == "ZVector" then
		return v3(c._r[3], c._r[6], c._r[9])
	end
	local f = CFm[k]
	if f then
		return f
	end
	error("'" .. tostring(k) .. "' is not a valid member of CFrame", 2)
end
CFmt.__newindex = function(_, k)
	error("CFrame." .. tostring(k) .. " cannot be assigned to", 2)
end
CFmt.__mul = function(a, b)
	if not isCF(a) then
		error("CFrame *: left side must be CFrame, got " .. typeof(a), 2)
	end
	if isCF(b) then
		local x, y, z = mulRV(a._r, b._p.X, b._p.Y, b._p.Z)
		return cf(v3(x + a._p.X, y + a._p.Y, z + a._p.Z), mulR(a._r, b._r))
	elseif isV3(b) then
		local x, y, z = mulRV(a._r, b.X, b.Y, b.Z)
		return v3(x + a._p.X, y + a._p.Y, z + a._p.Z)
	end
	error("CFrame *: bad right operand " .. typeof(b), 2)
end
CFmt.__add = function(a, b)
	if not isCF(a) or not isV3(b) then
		error("CFrame +: needs CFrame + Vector3", 2)
	end
	return cf(a._p + b, a._r)
end
CFmt.__sub = function(a, b)
	if not isCF(a) or not isV3(b) then
		error("CFrame -: needs CFrame - Vector3", 2)
	end
	return cf(a._p - b, a._r)
end
CFmt.__tostring = function(c)
	return "CFrame(" .. tostring(c._p) .. ")"
end
local CFrame = {}
CFrame.identity = cf(v3(0, 0, 0), ID_R)
function CFrame.new(a, b, c, ...)
	if select("#", ...) > 0 then
		error("CFrame.new mit 12 Zahlen wird im Test nicht unterstützt", 2)
	end
	if a == nil then
		return CFrame.identity
	end
	if isV3(a) then
		if b ~= nil then
			error("CFrame.new(pos, lookAt) ist veraltet - CFrame.lookAt benutzen", 2)
		end
		return cf(a, ID_R)
	end
	if type(a) ~= "number" or type(b) ~= "number" or type(c) ~= "number" then
		error("CFrame.new: bad arguments", 2)
	end
	return cf(v3(a, b, c), ID_R)
end
function CFrame.Angles(rx, ry, rz)
	return cf(v3(0, 0, 0), mulR(mulR(rotX(rx), rotY(ry)), rotZ(rz)))
end
CFrame.fromEulerAnglesXYZ = CFrame.Angles
function CFrame.lookAt(pos, target, up)
	up = up or v3(0, 1, 0)
	local look = (target - pos).Unit
	local right = look:Cross(up).Unit
	local up2 = right:Cross(look)
	return cf(pos, { right.X, up2.X, -look.X, right.Y, up2.Y, -look.Y, right.Z, up2.Z, -look.Z })
end
R.CFrame = CFrame
R.isCF = isCF

-- ------------------------------------------------------------------
-- Color3, UDim, UDim2, Sequenzen, TweenInfo, Random, RaycastParams
-- ------------------------------------------------------------------
local C3mt = { __type = "Color3" }
local function c3(r, g, b)
	return setmetatable({ R = r, G = g, B = b }, C3mt)
end
local C3m = {}
function C3m.Lerp(a, b, t)
	return c3(a.R + (b.R - a.R) * t, a.G + (b.G - a.G) * t, a.B + (b.B - a.B) * t)
end
C3mt.__index = function(c, k)
	local f = C3m[k]
	if f then
		return f
	end
	error("'" .. tostring(k) .. "' is not a valid member of Color3", 2)
end
C3mt.__eq = function(a, b)
	return math.abs(a.R - b.R) < 1e-6 and math.abs(a.G - b.G) < 1e-6 and math.abs(a.B - b.B) < 1e-6
end
local Color3 = {}
function Color3.new(r, g, b)
	return c3(r or 0, g or 0, b or 0)
end
function Color3.fromRGB(r, g, b)
	for _, v in { r, g, b } do
		if type(v) ~= "number" or v < 0 or v > 255 then
			error("Color3.fromRGB: 0..255 expected", 2)
		end
	end
	return c3(r / 255, g / 255, b / 255)
end
function Color3.fromHSV(h, s, v)
	local i = math.floor(h * 6)
	local f = h * 6 - i
	local p, q, t = v * (1 - s), v * (1 - f * s), v * (1 - (1 - f) * s)
	i = i % 6
	if i == 0 then
		return c3(v, t, p)
	elseif i == 1 then
		return c3(q, v, p)
	elseif i == 2 then
		return c3(p, v, t)
	elseif i == 3 then
		return c3(p, q, v)
	elseif i == 4 then
		return c3(t, p, v)
	end
	return c3(v, p, q)
end
R.Color3 = Color3

local function valueType(name, fields)
	local mt = { __type = name }
	mt.__index = function(_, k)
		error("'" .. tostring(k) .. "' is not a valid member of " .. name, 2)
	end
	return function(t)
		return setmetatable(t, mt)
	end
end
local mkUDim = valueType("UDim")
local mkUDim2 = valueType("UDim2")
local UDim = {
	new = function(s, o)
		return mkUDim({ Scale = s or 0, Offset = o or 0 })
	end,
}
local UDim2 = {}
function UDim2.new(xs, xo, ys, yo)
	return mkUDim2({ X = UDim.new(xs, xo), Y = UDim.new(ys, yo) })
end
function UDim2.fromScale(x, y)
	return UDim2.new(x, 0, y, 0)
end
function UDim2.fromOffset(x, y)
	return UDim2.new(0, x, 0, y)
end
R.UDim, R.UDim2 = UDim, UDim2

local mkNR = valueType("NumberRange")
R.NumberRange = {
	new = function(a, b)
		b = b or a
		if a > b then
			error("NumberRange: min > max", 2)
		end
		return mkNR({ Min = a, Max = b })
	end,
}
local mkNSK = valueType("NumberSequenceKeypoint")
local mkNS = valueType("NumberSequence")
local mkCSK = valueType("ColorSequenceKeypoint")
local mkCS = valueType("ColorSequence")
local function checkKeypoints(kps, what)
	if #kps < 2 then
		error(what .. ": mindestens 2 Keypoints", 3)
	end
	if kps[1].Time ~= 0 or kps[#kps].Time ~= 1 then
		error(what .. ": erster Keypoint muss Zeit 0, letzter Zeit 1 haben", 3)
	end
	for i = 2, #kps do
		if kps[i].Time <= kps[i - 1].Time then
			error(what .. ": Zeiten müssen aufsteigend sein", 3)
		end
	end
end
R.NumberSequenceKeypoint = {
	new = function(t, v, e)
		return mkNSK({ Time = t, Value = v, Envelope = e or 0 })
	end,
}
R.NumberSequence = {
	new = function(a, b)
		if type(a) == "number" then
			b = b or a
			return mkNS({ Keypoints = { R.NumberSequenceKeypoint.new(0, a), R.NumberSequenceKeypoint.new(1, b) } })
		end
		checkKeypoints(a, "NumberSequence")
		return mkNS({ Keypoints = a })
	end,
}
R.ColorSequenceKeypoint = {
	new = function(t, c)
		if typeof(c) ~= "Color3" then
			error("ColorSequenceKeypoint: Color3 expected", 2)
		end
		return mkCSK({ Time = t, Value = c })
	end,
}
R.ColorSequence = {
	new = function(a, b)
		if typeof(a) == "Color3" then
			b = b or a
			return mkCS({ Keypoints = { R.ColorSequenceKeypoint.new(0, a), R.ColorSequenceKeypoint.new(1, b) } })
		end
		checkKeypoints(a, "ColorSequence")
		return mkCS({ Keypoints = a })
	end,
}
local mkTI = valueType("TweenInfo")
R.TweenInfo = {
	new = function(time, style, dir)
		return mkTI({ Time = time or 1, EasingStyle = style, EasingDirection = dir })
	end,
}

local RandomMt = { __type = "Random" }
local RandomM = {}
function RandomM:NextNumber(a, b)
	self._s = (self._s * 1103515245 + 12345) % 2147483648
	local f = self._s / 2147483648
	if a then
		return a + (b - a) * f
	end
	return f
end
function RandomM:NextInteger(a, b)
	if type(a) ~= "number" or type(b) ~= "number" or a > b then
		error("Random:NextInteger bad range", 2)
	end
	return a + math.floor(self:NextNumber() * (b - a + 1))
end
RandomMt.__index = function(_, k)
	local f = RandomM[k]
	if f then
		return f
	end
	error("'" .. tostring(k) .. "' is not a valid member of Random", 2)
end
R.Random = {
	new = function(seed)
		local r = setmetatable({ _s = math.floor(math.abs(seed or 1)) % 2147483648 }, RandomMt)
		r:NextNumber()
		return r
	end,
}

local RPmt = { __type = "RaycastParams" }
local RP_OK = {
	FilterType = true,
	FilterDescendantsInstances = true,
	IgnoreWater = true,
	CollisionGroup = true,
	RespectCanCollide = true,
}
RPmt.__index = function(t, k)
	if RP_OK[k] then
		return rawget(t, "_" .. k)
	end
	error("'" .. tostring(k) .. "' is not a valid member of RaycastParams", 2)
end
RPmt.__newindex = function(t, k, v)
	if not RP_OK[k] then
		error("'" .. tostring(k) .. "' is not a valid member of RaycastParams", 2)
	end
	rawset(t, "_" .. k, v)
end

-- ------------------------------------------------------------------
-- Enum (gegen die echte Liste geprüft)
-- ------------------------------------------------------------------
local EnumItemMt = { __type = "EnumItem" }
EnumItemMt.__tostring = function(e)
	return "Enum." .. e.EnumType .. "." .. e.Name
end
local enumCache = {}
local Enum = setmetatable({}, {
	__index = function(_, typ)
		local list = API.enums[typ]
		if not list then
			error("Enum." .. tostring(typ) .. " gibt es nicht", 2)
		end
		local t = enumCache[typ]
		if not t then
			t = {}
			for i, name in list do
				t[name] = setmetatable({ Name = name, Value = i * 100, EnumType = typ }, EnumItemMt)
			end
			setmetatable(t, {
				__index = function(_, n)
					error("Enum." .. typ .. "." .. tostring(n) .. " gibt es nicht", 2)
				end,
			})
			enumCache[typ] = t
		end
		return t
	end,
})
R.Enum = Enum
R.RaycastParams = {
	new = function()
		local p = setmetatable({}, RPmt)
		p.FilterType = Enum.RaycastFilterType.Exclude
		p.FilterDescendantsInstances = {}
		return p
	end,
}

-- ------------------------------------------------------------------
-- task-Scheduler
-- ------------------------------------------------------------------
local SLEEP = {}
R.SLEEP = SLEEP
local function resume(co, ...)
	local ok, err = coroutine.resume(co, ...)
	if not ok then
		report(debug.traceback(co, tostring(err)))
	end
end
local task = {}
function task.spawn(f, ...)
	local co = if type(f) == "thread" then f else coroutine.create(f)
	resume(co, ...)
	return co
end
function task.defer(f, ...)
	local co = if type(f) == "thread" then f else coroutine.create(f)
	table.insert(SLEEP, { co = co, wake = R.NOW, args = { ... } })
	return co
end
function task.delay(t, f, ...)
	local co = if type(f) == "thread" then f else coroutine.create(f)
	table.insert(SLEEP, { co = co, wake = R.NOW + (t or 0), args = { ... } })
	return co
end
function task.wait(t)
	if not coroutine.isyieldable() then
		error("task.wait im Haupt-Thread", 2)
	end
	local start = R.NOW
	table.insert(SLEEP, { co = coroutine.running(), wake = R.NOW + math.max(t or 0, 1 / 60) - 1e-9 })
	coroutine.yield()
	return R.NOW - start
end
function task.cancel(co)
	for i = #SLEEP, 1, -1 do
		if SLEEP[i].co == co then
			table.remove(SLEEP, i)
		end
	end
end
R.task = task
function R.stepScheduler()
	local ready = {}
	for i = #SLEEP, 1, -1 do
		if SLEEP[i].wake <= R.NOW then
			table.insert(ready, table.remove(SLEEP, i))
		end
	end
	table.sort(ready, function(a, b)
		return a.wake < b.wake
	end)
	for _, s in ready do
		if coroutine.status(s.co) == "suspended" then
			resume(s.co, table.unpack(s.args or {}))
		end
	end
end

-- ------------------------------------------------------------------
-- Signale
-- ------------------------------------------------------------------
local SigMt = { __type = "RBXScriptSignal" }
local SigM = {}
SigMt.__index = function(_, k)
	local f = SigM[k]
	if f then
		return f
	end
	error("'" .. tostring(k) .. "' is not a valid member of RBXScriptSignal", 2)
end
local function newSignal(name)
	return setmetatable({ handlers = {}, waiting = {}, name = name }, SigMt)
end
function SigM:Connect(fn)
	if type(fn) ~= "function" then
		error("Connect: function expected", 2)
	end
	local c = { fn = fn, connected = true }
	table.insert(self.handlers, c)
	return {
		Disconnect = function()
			c.connected = false
		end,
	}
end
function SigM:Once(fn)
	local conn
	conn = self:Connect(function(...)
		conn.Disconnect()
		fn(...)
	end)
	return conn
end
function SigM:Wait()
	table.insert(self.waiting, coroutine.running())
	return coroutine.yield()
end
function SigM:Fire(...)
	for _, c in table.clone(self.handlers) do
		if c.connected then
			task.spawn(c.fn, ...)
		end
	end
	local w = self.waiting
	self.waiting = {}
	for _, co in w do
		resume(co, ...)
	end
end
R.newSignal = newSignal

-- ------------------------------------------------------------------
-- Instanzen
-- ------------------------------------------------------------------
local D = {}
local InstMt = { __type = "Instance" }
local memberCache = {}
local function memberOf(class, name)
	local key = class .. "." .. name
	local hit = memberCache[key]
	if hit ~= nil then
		return hit or nil
	end
	local c = class
	while c do
		local def = API.classes[c]
		if not def then
			break
		end
		local m = def.m[name]
		if m then
			memberCache[key] = m
			return m
		end
		c = def.super
	end
	memberCache[key] = false
	return nil
end
local function isA(class, base)
	local c = class
	while c do
		if c == base then
			return true
		end
		local def = API.classes[c]
		c = def and def.super
	end
	return false
end
R.isA = isA

local function isInst(v)
	return getmetatable(v) == InstMt
end
R.isInst = isInst

local SPECIAL = {
	["BasePart.Size"] = v3(4, 1.2, 2),
	["BasePart.CanCollide"] = true,
	["BasePart.CanQuery"] = true,
	["BasePart.CanTouch"] = true,
	["BasePart.CastShadow"] = true,
	["Humanoid.Health"] = 100,
	["Humanoid.MaxHealth"] = 100,
	["Humanoid.HipHeight"] = 2,
	["Humanoid.JumpPower"] = 50,
	["Sound.Volume"] = 0.5,
	["Sound.PlaybackSpeed"] = 1,
	["Light.Enabled"] = true,
	["Light.Brightness"] = 1,
	["GuiObject.Visible"] = true,
	["ScreenGui.ResetOnSpawn"] = true,
	["LayerCollector.Enabled"] = true,
	["Camera.FieldOfView"] = 70,
	["ParticleEmitter.Enabled"] = true,
	["Players.CharacterAutoLoads"] = true,
	["UserInputService.KeyboardEnabled"] = true,
	["Instance.Archivable"] = true,
}
for _, k in { "TextLabel", "TextButton", "TextBox" } do
	SPECIAL[k .. ".TextXAlignment"] = "Center"
	SPECIAL[k .. ".TextYAlignment"] = "Center"
end
SPECIAL["UIStroke.ApplyStrokeMode"] = "Contextual"
SPECIAL["GuiObject.BackgroundColor3"] = { 163, 162, 165 }

local function defaultFor(class, name, typ)
	local c = class
	while c do
		local s = SPECIAL[c .. "." .. name]
		if s ~= nil then
			if type(s) == "string" and string.match(typ, "^Enum%.") then
				return Enum[string.sub(typ, 6)][s]
			elseif type(s) == "table" and typ == "Color3" then
				return Color3.fromRGB(s[1], s[2], s[3])
			end
			return s
		end
		local def = API.classes[c]
		c = def and def.super
	end
	if typ == "number" then
		return 0
	elseif typ == "boolean" then
		return false
	elseif typ == "string" then
		return ""
	elseif typ == "Vector3" then
		return Vector3.zero
	elseif typ == "CFrame" then
		return CFrame.identity
	elseif typ == "Color3" then
		return Color3.new(0.64, 0.64, 0.64)
	elseif typ == "UDim2" then
		return UDim2.new()
	elseif typ == "Vector2" then
		return Vector2.new()
	end
	local e = string.match(typ, "^Enum%.(%w+)$")
	if e then
		local list = API.enums[e]
		return list and Enum[e][list[1]]
	end
	return nil
end

local VALUE_TYPES = {
	Vector3 = true,
	CFrame = true,
	Color3 = true,
	UDim2 = true,
	UDim = true,
	Vector2 = true,
	NumberRange = true,
	NumberSequence = true,
	ColorSequence = true,
}
local function checkType(where, typ, v)
	local function bad()
		error(where .. ": falscher Typ " .. typeof(v) .. " (erwartet " .. typ .. ")", 4)
	end
	if typ == "number" then
		if type(v) ~= "number" then
			bad()
		end
	elseif typ == "boolean" then
		if type(v) ~= "boolean" then
			bad()
		end
	elseif typ == "string" then
		if type(v) ~= "string" and type(v) ~= "number" then
			bad()
		end
	elseif VALUE_TYPES[typ] then
		if typeof(v) ~= typ then
			bad()
		end
	else
		local e = string.match(typ, "^Enum%.(%w+)$")
		if e then
			if typeof(v) ~= "EnumItem" or v.EnumType ~= e then
				bad()
			end
		end
	end
end

local Instance = {}
local METHODS = {}
local SIG = {}

local function newInstance(class)
	if not API.classes[class] then
		error("Instance.new: Klasse '" .. tostring(class) .. "' gibt es nicht", 3)
	end
	local inst = setmetatable({}, InstMt)
	D[inst] = { class = class, props = { Name = class }, children = {}, attrs = {}, signals = {}, attrSignals = {}, propSignals = {} }
	return inst
end
R.newInstance = newInstance

local function signalOf(inst, name)
	local d = D[inst]
	local s = d.signals[name]
	if not s then
		s = newSignal(name)
		d.signals[name] = s
	end
	return s
end
local function fireIf(inst, name, ...)
	local s = D[inst].signals[name]
	if s then
		s:Fire(...)
	end
end
local function descendants(inst, out)
	for _, c in D[inst].children do
		table.insert(out, c)
		descendants(c, out)
	end
	return out
end
local function propChanged(inst, name)
	local d = D[inst]
	local ps = d.propSignals[name]
	if ps then
		ps:Fire()
	end
	if d.signals.Changed then
		if isA(d.class, "ValueBase") and name == "Value" then
			d.signals.Changed:Fire(d.props.Value)
		elseif not isA(d.class, "ValueBase") then
			d.signals.Changed:Fire(name)
		end
	end
end

local function setParent(inst, parent)
	local d = D[inst]
	if d.destroyed then
		error("The Parent property of " .. tostring(d.props.Name) .. " is locked", 3)
	end
	if parent ~= nil and not isInst(parent) then
		error("Parent: Instance erwartet", 3)
	end
	local old = d.props.Parent
	if old == parent then
		return
	end
	if old then
		local list = D[old].children
		local i = table.find(list, inst)
		if i then
			table.remove(list, i)
		end
		fireIf(old, "ChildRemoved", inst)
	end
	d.props.Parent = parent
	if parent then
		table.insert(D[parent].children, inst)
		fireIf(parent, "ChildAdded", inst)
		local all = descendants(inst, { inst })
		local a = parent
		while a do
			if D[a].signals.DescendantAdded then
				for _, x in all do
					D[a].signals.DescendantAdded:Fire(x)
				end
			end
			a = D[a].props.Parent
		end
	end
	for _, x in descendants(inst, { inst }) do
		fireIf(x, "AncestryChanged", inst, parent)
	end
	propChanged(inst, "Parent")
end

InstMt.__tostring = function(inst)
	return tostring(D[inst].props.Name)
end

InstMt.__index = function(inst, k)
	local d = D[inst]
	if k == "Parent" or k == "Name" then
		return d.props[k]
	elseif k == "ClassName" then
		return d.class
	end
	local m = memberOf(d.class, k)
	if m then
		local kind = m[1]
		if kind == "method" then
			local f = METHODS[k]
			if not f then
				error("Mock: Methode " .. d.class .. ":" .. k .. " nicht nachgebaut", 2)
			end
			return f
		elseif kind == "signal" then
			return signalOf(inst, k)
		end
		local v = d.props[k]
		if v == nil and kind == "prop" then
			if k == "Position" and isA(d.class, "BasePart") then
				return (d.props.CFrame or CFrame.identity).Position
			end
			v = defaultFor(d.class, k, m[2])
		end
		return v
	end
	for _, c in d.children do
		if D[c].props.Name == k then
			return c
		end
	end
	error("'" .. tostring(k) .. "' is not a valid member of " .. d.class .. " \"" .. tostring(d.props.Name) .. "\"", 2)
end

InstMt.__newindex = function(inst, k, v)
	local d = D[inst]
	if k == "Parent" then
		setParent(inst, v)
		return
	end
	local m = memberOf(d.class, k)
	if not m then
		error("'" .. tostring(k) .. "' is not a valid member of " .. d.class, 2)
	end
	if m[1] == "method" or m[1] == "signal" then
		error("kann " .. d.class .. "." .. k .. " nicht zuweisen", 2)
	end
	if m[3] then
		error(d.class .. "." .. k .. " ist schreibgeschützt", 2)
	end
	if m[1] == "callback" then
		d.props[k] = v
		return
	end
	if k == "Name" and type(v) ~= "string" then
		error("Name muss ein String sein", 2)
	end
	checkType(d.class .. "." .. k, m[2], v)
	if k == "Position" and isA(d.class, "BasePart") then
		local old = d.props.CFrame or CFrame.identity
		d.props.CFrame = old.Rotation + v
		propChanged(inst, "CFrame")
		return
	end
	if k == "Text" and v ~= "" and v ~= d.props.Text then
		local kmh = string.match(v, "^(%d+) km/h$")
		if kmh then
			R.LAST_KMH = tonumber(kmh)
		elseif not R.TEXT_SEEN[v] then
			R.TEXT_SEEN[v] = R.NOW
			table.insert(R.TEXT_ORDER, v)
		end
	end
	if d.class == "Humanoid" and k == "Health" and v <= 0 and (d.props.Health or 100) > 0 then
		d.props[k] = v
		fireIf(inst, "Died")
		return
	end
	d.props[k] = v
	if d.class == "WeldConstraint" and (k == "Part0" or k == "Part1") then
		local p0, p1 = d.props.Part0, d.props.Part1
		if p0 and p1 then
			local w = D[p0].welds or {}
			D[p0].welds = w
			table.insert(w, { part = p1, rel = (D[p0].props.CFrame or CFrame.identity):Inverse() * (D[p1].props.CFrame or CFrame.identity) })
		end
	end
	if k == "CFrame" and d.welds then
		for _, w in d.welds do
			D[w.part].props.CFrame = v * w.rel
		end
	end
	propChanged(inst, k)
end

function Instance.new(class, parent)
	local inst = newInstance(class)
	if parent then
		inst.Parent = parent
	end
	return inst
end
R.Instance = Instance
R.D = D

-- allgemeine Methoden
function METHODS.GetChildren(self)
	return table.clone(D[self].children)
end
function METHODS.GetDescendants(self)
	return descendants(self, {})
end
function METHODS.FindFirstChild(self, name, rec)
	for _, c in D[self].children do
		if D[c].props.Name == name then
			return c
		end
	end
	if rec then
		for _, c in D[self].children do
			local f = METHODS.FindFirstChild(c, name, true)
			if f then
				return f
			end
		end
	end
	return nil
end
function METHODS.FindFirstChildOfClass(self, class)
	for _, c in D[self].children do
		if D[c].class == class then
			return c
		end
	end
	return nil
end
function METHODS.FindFirstChildWhichIsA(self, class)
	for _, c in D[self].children do
		if isA(D[c].class, class) then
			return c
		end
	end
	return nil
end
function METHODS.WaitForChild(self, name, timeout)
	local f = METHODS.FindFirstChild(self, name)
	if f then
		return f
	end
	if not coroutine.isyieldable() then
		error("WaitForChild im Haupt-Thread: " .. name, 2)
	end
	local start = R.NOW
	local warned = false
	while true do
		task.wait()
		f = METHODS.FindFirstChild(self, name)
		if f then
			return f
		end
		if timeout and R.NOW - start >= timeout then
			return nil
		end
		if not timeout and not warned and R.NOW - start > 5 then
			warned = true
			table.insert(R.WARNINGS, "Infinite yield possible on WaitForChild(" .. name .. ") in " .. tostring(self))
		end
	end
end
function METHODS.IsA(self, class)
	return isA(D[self].class, class)
end
function METHODS.IsDescendantOf(self, anc)
	local p = D[self].props.Parent
	while p do
		if p == anc then
			return true
		end
		p = D[p].props.Parent
	end
	return false
end
function METHODS.GetFullName(self)
	local parts = {}
	local p = self
	while p do
		table.insert(parts, 1, tostring(D[p].props.Name))
		p = D[p].props.Parent
	end
	return table.concat(parts, ".")
end
local ATTR_OK = { boolean = true, number = true, string = true, Vector3 = true, Color3 = true, CFrame = true, UDim2 = true, UDim = true, Vector2 = true, ["nil"] = true }
function METHODS.SetAttribute(self, name, value)
	if not ATTR_OK[typeof(value)] then
		error("SetAttribute: Typ " .. typeof(value) .. " ist nicht erlaubt", 2)
	end
	local d = D[self]
	if d.attrs[name] == value then
		return
	end
	d.attrs[name] = value
	local s = d.attrSignals[name]
	if s then
		s:Fire()
	end
	fireIf(self, "AttributeChanged", name)
end
function METHODS.GetAttribute(self, name)
	return D[self].attrs[name]
end
function METHODS.GetAttributes(self)
	return table.clone(D[self].attrs)
end
function METHODS.GetAttributeChangedSignal(self, name)
	local d = D[self]
	local s = d.attrSignals[name]
	if not s then
		s = newSignal("attr " .. name)
		d.attrSignals[name] = s
	end
	return s
end
function METHODS.GetPropertyChangedSignal(self, name)
	local d = D[self]
	if not memberOf(d.class, name) then
		error("GetPropertyChangedSignal: '" .. name .. "' gibt es nicht bei " .. d.class, 2)
	end
	local s = d.propSignals[name]
	if not s then
		s = newSignal("prop " .. name)
		d.propSignals[name] = s
	end
	return s
end
function METHODS.Destroy(self)
	local d = D[self]
	if d.destroyed then
		return
	end
	for _, c in table.clone(d.children) do
		METHODS.Destroy(c)
	end
	if d.props.Parent then
		setParent(self, nil)
	end
	d.destroyed = true
	fireIf(self, "Destroying")
end
function METHODS.ClearAllChildren(self)
	for _, c in table.clone(D[self].children) do
		METHODS.Destroy(c)
	end
end
function METHODS.GetPivot(self)
	local d = D[self]
	if isA(d.class, "BasePart") then
		return d.props.CFrame or CFrame.identity
	end
	local pp = d.props.PrimaryPart
	if pp then
		return D[pp].props.CFrame or CFrame.identity
	end
	return d.props.WorldPivot or CFrame.identity
end
function METHODS.PivotTo(self, target)
	if not isCF(target) then
		error("PivotTo: CFrame erwartet", 2)
	end
	local d = D[self]
	if isA(d.class, "BasePart") then
		self.CFrame = target
		return
	end
	local delta = target * METHODS.GetPivot(self):Inverse()
	for _, p in descendants(self, {}) do
		if isA(D[p].class, "BasePart") then
			p.CFrame = delta * (D[p].props.CFrame or CFrame.identity)
		end
	end
	if not d.props.PrimaryPart then
		d.props.WorldPivot = target
	end
end
function METHODS.SetNetworkOwner(self, player)
	if self.Anchored then
		error("SetNetworkOwner: Teil ist verankert", 2)
	end
	if not METHODS.IsDescendantOf(self, R.workspace) then
		error("SetNetworkOwner: Teil ist nicht im Workspace", 2)
	end
	D[self].owner = player
end
function METHODS.Play(self)
	D[self].played = (D[self].played or 0) + 1
	R.FIRED["Sound:" .. tostring(self.SoundId)] = (R.FIRED["Sound:" .. tostring(self.SoundId)] or 0) + 1
end
function METHODS.Stop(self) end
function METHODS.Emit(self, n)
	D[self].emitted = (D[self].emitted or 0) + n
end
function METHODS.SetStateEnabled(self, state, on)
	if typeof(state) ~= "EnumItem" or state.EnumType ~= "HumanoidStateType" or type(on) ~= "boolean" then
		error("SetStateEnabled: falsche Argumente", 2)
	end
end
function METHODS.ChangeState(self, state) end
function METHODS.GetState(self)
	return Enum.HumanoidStateType.Running
end
function METHODS.GetServerTimeNow(self)
	return 1700000000 + R.NOW + R.TIME_OFFSET
end
function METHODS.FireServer(self, ...)
	local args = { ... }
	R.FIRED[self.Name] = (R.FIRED[self.Name] or 0) + 1
	R.FIRED_ARGS = R.FIRED_ARGS or {}
	R.FIRED_ARGS[self.Name] = R.FIRED_ARGS[self.Name] or {}
	table.insert(R.FIRED_ARGS[self.Name], args)
	for _, a in args do
		if type(a) == "table" and not isInst(a) and getmetatable(a) ~= nil and typeof(a) == "table" then
			error("FireServer: Tabelle mit Metatable", 2)
		end
	end
	signalOf(self, "OnServerEvent"):Fire(R.LocalPlayer, table.unpack(args))
end
function METHODS.InvokeServer(self, ...)
	local f = D[self].props.OnServerInvoke
	if not f then
		error("InvokeServer: kein OnServerInvoke", 2)
	end
	R.FIRED[self.Name] = (R.FIRED[self.Name] or 0) + 1
	return f(R.LocalPlayer, ...)
end

-- Raycast gegen Quader
local function rayBox(part, origin, dir)
	local c = D[part].props.CFrame or CFrame.identity
	local size = D[part].props.Size or SPECIAL["BasePart.Size"]
	local inv = c:Inverse()
	local o = inv * origin
	local dx, dy, dz = mulRV(inv._r, dir.X, dir.Y, dir.Z)
	local d = { dx, dy, dz }
	local oo = { o.X, o.Y, o.Z }
	local h = { size.X / 2, size.Y / 2, size.Z / 2 }
	local tmin, tmax = 0, 1
	for i = 1, 3 do
		if math.abs(d[i]) < 1e-9 then
			if oo[i] < -h[i] or oo[i] > h[i] then
				return nil
			end
		else
			local t1 = (-h[i] - oo[i]) / d[i]
			local t2 = (h[i] - oo[i]) / d[i]
			if t1 > t2 then
				t1, t2 = t2, t1
			end
			tmin = math.max(tmin, t1)
			tmax = math.min(tmax, t2)
			if tmin > tmax then
				return nil
			end
		end
	end
	return tmin
end
function METHODS.Raycast(self, origin, dir, params)
	if not isV3(origin) or not isV3(dir) then
		error("Raycast: Vector3 erwartet", 2)
	end
	local parts = {}
	params = params or R.RaycastParams.new()
	if params.FilterType == Enum.RaycastFilterType.Include then
		for _, inst in params.FilterDescendantsInstances do
			if isA(D[inst].class, "BasePart") then
				table.insert(parts, inst)
			end
			for _, x in descendants(inst, {}) do
				if isA(D[x].class, "BasePart") then
					table.insert(parts, x)
				end
			end
		end
	else
		error("Mock: nur Include-Raycasts nachgebaut", 2)
	end
	local best, bestT = nil, math.huge
	for _, p in parts do
		if p.CanQuery then
			local t = rayBox(p, origin, dir)
			if t and t < bestT then
				best, bestT = p, t
			end
		end
	end
	if not best then
		return nil
	end
	return { Instance = best, Position = origin + dir * bestT, Distance = dir.Magnitude * bestT, Normal = Vector3.yAxis }
end

-- Dienste
function METHODS.GetService(self, name)
	local s = R.services[name]
	if not s then
		error("GetService: '" .. tostring(name) .. "' nicht nachgebaut", 2)
	end
	return s
end
function METHODS.BindToClose(self, f)
	R.closeHandlers = R.closeHandlers or {}
	table.insert(R.closeHandlers, f)
end
R.RENDER = {}
function METHODS.BindToRenderStep(self, name, prio, fn)
	if type(name) ~= "string" or type(prio) ~= "number" or type(fn) ~= "function" then
		error("BindToRenderStep: falsche Argumente", 2)
	end
	R.RENDER[name] = { prio = prio, fn = fn }
end
function METHODS.UnbindFromRenderStep(self, name)
	R.RENDER[name] = nil
end
function METHODS.IsClient()
	return true
end
function METHODS.IsServer()
	return true
end
function METHODS.IsStudio()
	return true
end
function METHODS.IsKeyDown(self, key)
	if typeof(key) ~= "EnumItem" or key.EnumType ~= "KeyCode" then
		error("IsKeyDown: KeyCode erwartet", 2)
	end
	return R.KEYS[key.Name] == true
end
function METHODS.IsGamepadButtonDown(self, gp, key)
	if typeof(gp) ~= "EnumItem" or gp.EnumType ~= "UserInputType" or typeof(key) ~= "EnumItem" or key.EnumType ~= "KeyCode" then
		error("IsGamepadButtonDown: falsche Argumente", 2)
	end
	return R.PAD[key.Name] == true
end
function METHODS.GetFocusedTextBox()
	return nil
end
R.ACTIONS = {}
function METHODS.BindActionAtPriority(self, name, fn, touch, prio, ...)
	if type(name) ~= "string" or type(fn) ~= "function" or type(touch) ~= "boolean" or type(prio) ~= "number" then
		error("BindActionAtPriority: falsche Argumente", 2)
	end
	local keys = {}
	for _, k in { ... } do
		if typeof(k) ~= "EnumItem" then
			error("BindActionAtPriority: Eingabe muss ein Enum sein", 2)
		end
		keys[k.Name] = true
	end
	R.ACTIONS[name] = { fn = fn, keys = keys, prio = prio }
end
function METHODS.BindAction(self, name, fn, touch, ...)
	METHODS.BindActionAtPriority(self, name, fn, touch, 2000, ...)
end
function METHODS.UnbindAction(self, name)
	R.ACTIONS[name] = nil
end
function METHODS.Create(self, inst, info, props)
	if not isInst(inst) or typeof(info) ~= "TweenInfo" or type(props) ~= "table" then
		error("TweenService:Create: falsche Argumente", 2)
	end
	for k in props do
		if not memberOf(D[inst].class, k) then
			error("Tween: '" .. k .. "' gibt es nicht bei " .. D[inst].class, 2)
		end
	end
	return {
		Play = function()
			for k, v in props do
				inst[k] = v
			end
		end,
		Cancel = function() end,
		Completed = newSignal("Completed"),
	}
end
function METHODS.RegisterCollisionGroup(self, name)
	R.groups = R.groups or {}
	if R.groups[name] then
		error("Collision group schon registriert", 2)
	end
	R.groups[name] = true
end
function METHODS.CollisionGroupSetCollidable(self, a, b, on)
	if not R.groups or not R.groups[a] then
		error("Collision group gibt es nicht: " .. tostring(a), 2)
	end
end
function METHODS.GetPlayers(self)
	return { R.LocalPlayer }
end
function METHODS.PlayLocalSound(self, s) end
R.STORE = {}
function METHODS.GetDataStore(self, name)
	if R.DATASTORE_FAILS then
		error("You must publish this place to the web to access DataStore.", 2)
	end
	return {
		GetAsync = function(_, key)
			task.wait(0.1)
			return R.STORE[key]
		end,
		SetAsync = function(_, key, value)
			if type(value) ~= "table" then
				error("SetAsync: Tabelle erwartet")
			end
			R.STORE[key] = table.clone(value)
		end,
	}
end

-- Spieler mit R15-Figur
local HAUT = { 255, 204, 153 }
local SHIRT = { 230, 70, 60 }
local HOSE = { 40, 70, 140 }
local R15 = {
	-- Teil, Gelenk, Teil davor, Größe, C0, C1, Farbe
	{ "LowerTorso", "Root", "HumanoidRootPart", { 2, 0.4, 1 }, { 0, -0.8, 0 }, { 0, 0, 0 }, HOSE },
	{ "UpperTorso", "Waist", "LowerTorso", { 2, 1.6, 1 }, { 0, 0.2, 0 }, { 0, -0.8, 0 }, SHIRT },
	{ "Head", "Neck", "UpperTorso", { 1.2, 1.2, 1.2 }, { 0, 0.8, 0 }, { 0, -0.6, 0 }, HAUT },
	{ "LeftUpperArm", "LeftShoulder", "UpperTorso", { 1, 1.2, 1 }, { -1.5, 0.7, 0 }, { 0, 0.5, 0 }, SHIRT },
	{ "LeftLowerArm", "LeftElbow", "LeftUpperArm", { 1, 1.0, 1 }, { 0, -0.5, 0 }, { 0, 0.45, 0 }, HAUT },
	{ "LeftHand", "LeftWrist", "LeftLowerArm", { 1, 0.3, 1 }, { 0, -0.5, 0 }, { 0, 0.15, 0 }, HAUT },
	{ "RightUpperArm", "RightShoulder", "UpperTorso", { 1, 1.2, 1 }, { 1.5, 0.7, 0 }, { 0, 0.5, 0 }, SHIRT },
	{ "RightLowerArm", "RightElbow", "RightUpperArm", { 1, 1.0, 1 }, { 0, -0.5, 0 }, { 0, 0.45, 0 }, HAUT },
	{ "RightHand", "RightWrist", "RightLowerArm", { 1, 0.3, 1 }, { 0, -0.5, 0 }, { 0, 0.15, 0 }, HAUT },
	{ "LeftUpperLeg", "LeftHip", "LowerTorso", { 1, 1.0, 1 }, { -0.5, -0.2, 0 }, { 0, 0.5, 0 }, HOSE },
	{ "LeftLowerLeg", "LeftKnee", "LeftUpperLeg", { 1, 0.8, 1 }, { 0, -0.5, 0 }, { 0, 0.4, 0 }, HOSE },
	{ "LeftFoot", "LeftAnkle", "LeftLowerLeg", { 1, 0.2, 1.2 }, { 0, -0.4, 0 }, { 0, 0.1, 0 }, { 50, 50, 50 } },
	{ "RightUpperLeg", "RightHip", "LowerTorso", { 1, 1.0, 1 }, { 0.5, -0.2, 0 }, { 0, 0.5, 0 }, HOSE },
	{ "RightLowerLeg", "RightKnee", "RightUpperLeg", { 1, 0.8, 1 }, { 0, -0.5, 0 }, { 0, 0.4, 0 }, HOSE },
	{ "RightFoot", "RightAnkle", "RightLowerLeg", { 1, 0.2, 1.2 }, { 0, -0.4, 0 }, { 0, 0.1, 0 }, { 50, 50, 50 } },
}
R.R15 = R15
function METHODS.LoadCharacter(self)
	local old = self.Character
	if old then
		METHODS.Destroy(old)
	end
	local model = Instance.new("Model")
	model.Name = self.Name
	local hum = Instance.new("Humanoid")
	hum.RigType = Enum.HumanoidRigType.R15
	hum.Parent = model
	local hrp = Instance.new("Part")
	hrp.Name = "HumanoidRootPart"
	hrp.Size = Vector3.new(2, 2, 1)
	hrp.Transparency = 1
	hrp.Parent = model
	local teile = { HumanoidRootPart = hrp }
	for _, def in R15 do
		local p = Instance.new("MeshPart")
		p.Name = def[1]
		p.Size = Vector3.new(def[4][1], def[4][2], def[4][3])
		p.Color = Color3.fromRGB(def[7][1], def[7][2], def[7][3])
		p.Parent = model
		teile[def[1]] = p
		local m = Instance.new("Motor6D")
		m.Name = def[2]
		m.Part0 = teile[def[3]]
		m.Part1 = p
		m.C0 = CFrame.new(def[5][1], def[5][2], def[5][3])
		m.C1 = CFrame.new(def[6][1], def[6][2], def[6][3])
		m.Parent = p
	end
	model.PrimaryPart = hrp
	local spawnCF = CFrame.new(0, 3, 0)
	for _, x in descendants(R.workspace, {}) do
		if D[x].class == "SpawnLocation" then
			spawnCF = (D[x].props.CFrame or CFrame.identity) + Vector3.new(0, 3, 0)
		end
	end
	hrp.CFrame = spawnCF
	model.Parent = R.workspace
	D[self].props.Character = model
	signalOf(self, "CharacterAdded"):Fire(model)
	R.stepScheduler()
end

-- ------------------------------------------------------------------
-- Spielwelt und Dienste aufbauen
-- ------------------------------------------------------------------
function R.setup(opts)
	local game = newInstance("DataModel")
	D[game].props.Name = "Game"
	R.game = game
	R.services = {}
	for _, name in {
		"Workspace",
		"Players",
		"ReplicatedStorage",
		"ServerScriptService",
		"StarterPlayer",
		"StarterGui",
		"Lighting",
		"RunService",
		"UserInputService",
		"ContextActionService",
		"TweenService",
		"SoundService",
		"DataStoreService",
		"PhysicsService",
	} do
		local s = newInstance(name)
		D[s].props.Name = name
		s.Parent = game
		R.services[name] = s
	end
	R.workspace = R.services.Workspace
	D[game].props.Workspace = R.workspace
	local cam = Instance.new("Camera")
	cam.Parent = R.workspace
	D[R.workspace].props.CurrentCamera = cam
	local sps = Instance.new("StarterPlayerScripts")
	sps.Parent = R.services.StarterPlayer
	D[R.services.UserInputService].props.TouchEnabled = opts.touch or false

	local player = newInstance("Player")
	D[player].props.Name = "Tester"
	D[player].props.UserId = 4242
	D[player].props.DisplayName = "Tester"
	local gui = Instance.new("PlayerGui")
	gui.Parent = player
	local ps = Instance.new("PlayerScripts")
	ps.Parent = player
	local pm = Instance.new("ModuleScript")
	pm.Name = "PlayerModule"
	pm.Parent = ps
	R.LocalPlayer = player
	player.Parent = R.services.Players
	D[R.services.Players].props.LocalPlayer = player
	return game, player, pm
end

-- Taste drücken / loslassen (inkl. ContextActionService)
local function inputObject(keyName, state)
	return setmetatable({
		KeyCode = Enum.KeyCode[keyName],
		UserInputType = Enum.UserInputType.Keyboard,
		UserInputState = state,
		Position = Vector3.zero,
	}, { __type = "InputObject" })
end
function R.key(keyName, down)
	R.KEYS[keyName] = down
	local state = if down then Enum.UserInputState.Begin else Enum.UserInputState.End
	local input = inputObject(keyName, state)
	local handled = false
	local best = nil
	for name, a in R.ACTIONS do
		if a.keys[keyName] and (not best or a.prio > best.prio) then
			best = { name = name, fn = a.fn, prio = a.prio }
		end
	end
	if best then
		handled = true
		task.spawn(best.fn, best.name, state, input)
	end
	local uis = R.services.UserInputService
	if down then
		signalOf(uis, "InputBegan"):Fire(input, false)
	else
		signalOf(uis, "InputEnded"):Fire(input, false)
	end
	return handled
end

function R.frame(dt)
	R.NOW += dt
	R.stepScheduler()
	local rs = R.services.RunService
	fireIf(rs, "Stepped", R.NOW, dt)
	fireIf(rs, "Heartbeat", dt)
	local list = {}
	for name, r in R.RENDER do
		table.insert(list, { name = name, prio = r.prio, fn = r.fn })
	end
	table.sort(list, function(a, b)
		return a.prio < b.prio
	end)
	for _, r in list do
		local co = coroutine.create(r.fn)
		local ok, err = coroutine.resume(co, dt)
		if not ok then
			report("RenderStep " .. r.name .. ": " .. debug.traceback(co, tostring(err)))
			R.RENDER[r.name] = nil
		elseif coroutine.status(co) ~= "dead" then
			report("RenderStep " .. r.name .. " hat geyieldet")
		end
	end
	fireIf(rs, "RenderStepped", dt)
end

R.signalOf = signalOf
R.descendants = descendants
R.memberOf = memberOf
return R
