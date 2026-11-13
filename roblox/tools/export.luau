-- Exportiert die Szene (Teile, Kamera, Lichter, GUI) als JSON für die three.js-Vorschau
local X = {}

local function enc(v, out)
	local t = type(v)
	if t == "number" then
		if v ~= v or v == math.huge or v == -math.huge then
			v = 0
		end
		table.insert(out, string.format("%.4g", v))
	elseif t == "string" then
		local s = string.gsub(v, '[%c"\\]', function(ch)
			if ch == "\n" then
				return "\\n"
			end
			return string.format("\\u%04x", string.byte(ch))
		end)
		table.insert(out, '"' .. s .. '"')
	elseif t == "boolean" then
		table.insert(out, tostring(v))
	elseif t == "nil" then
		table.insert(out, "null")
	elseif t == "table" then
		if #v > 0 or next(v) == nil then
			table.insert(out, "[")
			for i, x in v do
				if i > 1 then
					table.insert(out, ",")
				end
				enc(x, out)
			end
			table.insert(out, "]")
		else
			table.insert(out, "{")
			local first = true
			for k, x in v do
				if not first then
					table.insert(out, ",")
				end
				first = false
				enc(tostring(k), out)
				table.insert(out, ":")
				enc(x, out)
			end
			table.insert(out, "}")
		end
	end
end
local function json(v)
	local out = {}
	enc(v, out)
	return table.concat(out)
end

local function cfArr(c)
	return { c:GetComponents() }
end

local GUI_PROPS = {
	"Visible",
	"BackgroundColor3",
	"BackgroundTransparency",
	"Text",
	"TextColor3",
	"TextScaled",
	"ZIndex",
	"LayoutOrder",
	"TextXAlignment",
	"TextYAlignment",
	"Font",
	"AnchorPoint",
	"Position",
	"Size",
	"CornerRadius",
	"Thickness",
	"Color",
	"Transparency",
	"ApplyStrokeMode",
	"AspectRatio",
	"MaxSize",
	"CellSize",
	"CellPadding",
	"Padding",
	"FillDirection",
	"PaddingTop",
	"PaddingBottom",
	"PaddingLeft",
	"PaddingRight",
	"Enabled",
}

local function wert(Rb, v)
	local ty = Rb.typeof(v)
	if ty == "UDim2" then
		return { v.X.Scale, v.X.Offset, v.Y.Scale, v.Y.Offset }
	elseif ty == "UDim" then
		return { v.Scale, v.Offset }
	elseif ty == "Vector2" then
		return { v.X, v.Y }
	elseif ty == "Color3" then
		return { v.R, v.G, v.B }
	elseif ty == "EnumItem" then
		return v.Name
	elseif ty == "ColorSequence" then
		local k = {}
		for _, kp in v.Keypoints do
			table.insert(k, { kp.Time, kp.Value.R, kp.Value.G, kp.Value.B })
		end
		return k
	elseif ty == "number" or ty == "string" or ty == "boolean" then
		return v
	end
	return nil
end

local function guiNode(Rb, inst)
	local D = Rb.D
	local n = { cls = D[inst].class, name = D[inst].props.Name, kids = {} }
	for _, k in GUI_PROPS do
		if Rb.memberOf(D[inst].class, k) then
			local ok, v = pcall(function()
				return inst[k]
			end)
			if ok and v ~= nil then
				n[k] = wert(Rb, v)
			end
		end
	end
	for _, c in D[inst].children do
		table.insert(n.kids, guiNode(Rb, c))
	end
	return n
end

function X.szene(Rb, pfad, radius)
	local D = Rb.D
	local cam = Rb.workspace.CurrentCamera
	local camCF = cam.CFrame
	local fokus = camCF.Position + camCF.LookVector * 80
	radius = radius or 1000
	local char = Rb.LocalPlayer.Character
	local teile = {}
	local function add(p, c)
		local pr = D[p].props
		local t = pr.Transparency or 0
		if t >= 1 then
			return
		end
		c = c or pr.CFrame or Rb.CFrame.identity
		if (c.Position - fokus).Magnitude > radius then
			return
		end
		local size = p.Size
		local col = pr.Color or Rb.Color3.new(0.64, 0.64, 0.64)
		table.insert(teile, {
			s = { size.X, size.Y, size.Z },
			cf = cfArr(c),
			c = { col.R, col.G, col.B },
			t = t,
			sh = if pr.Shape then pr.Shape.Name else "Block",
			m = if pr.Material then pr.Material.Name else "Plastic",
		})
	end
	for _, p in Rb.descendants(Rb.workspace, {}) do
		if Rb.isA(D[p].class, "BasePart") and not (char and p:IsDescendantOf(char)) then
			add(p)
		end
	end
	-- Figur über die Gelenke
	if char then
		local hrp = char:FindFirstChild("HumanoidRootPart")
		local cfs = { HumanoidRootPart = hrp.CFrame }
		for _, def in Rb.R15 do
			local part = char:FindFirstChild(def[1])
			local m = part and part:FindFirstChild(def[2])
			if m then
				local p0 = cfs[D[m].props.Part0.Name]
				local c = p0 * m.C0 * m.Transform * m.C1:Inverse()
				cfs[def[1]] = c
				add(part, c)
			end
		end
	end
	-- Lichter
	local lichter = {}
	for _, l in Rb.descendants(Rb.workspace, {}) do
		local cls = D[l].class
		if (cls == "SpotLight" or cls == "PointLight") and l.Enabled then
			local p = D[l].props.Parent
			local c = D[p].props.CFrame
			if c and (c.Position - fokus).Magnitude < 400 then
				local col = l.Color
				table.insert(lichter, { p = { c.Position.X, c.Position.Y, c.Position.Z }, c = { col.R, col.G, col.B }, r = l.Range, b = l.Brightness, cls = cls })
			end
		end
	end
	local gui = {}
	for _, g in Rb.LocalPlayer.PlayerGui:GetChildren() do
		table.insert(gui, guiNode(Rb, g))
	end
	writefile(pfad, json({
		cam = cfArr(camCF),
		fov = cam.FieldOfView,
		uhr = Rb.services.Lighting.ClockTime,
		teile = teile,
		lichter = lichter,
		gui = gui,
	}))
	print("Export:", pfad, #teile, "Teile", #lichter, "Lichter")
end

return X
