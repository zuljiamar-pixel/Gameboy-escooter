--[[
	E-SCOOTER WHEELIE - Server
	* baut die Straße
	* gibt jedem Spieler einen Scooter
	* speichert Punkte, Rekorde und gekaufte Farben (DataStore)
]]

local Players = game:GetService("Players")
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local DataStoreService = game:GetService("DataStoreService")
local PhysicsService = game:GetService("PhysicsService")

local Shared = ReplicatedStorage:WaitForChild("Wheelie")
local E = require(Shared:WaitForChild("Einstellungen"))
local Farben = require(Shared:WaitForChild("Farben"))
local Welt = require(script:WaitForChild("Welt"))
local Scooter = require(script:WaitForChild("Scooter"))

Players.CharacterAutoLoads = false

-- Fahrer stoßen sich nicht gegenseitig um
pcall(function()
	PhysicsService:RegisterCollisionGroup("Fahrer")
end)
pcall(function()
	PhysicsService:CollisionGroupSetCollidable("Fahrer", "Fahrer", false)
end)

-- ------------------------------------------------------------------
-- Remotes (Verbindung zu den Spielern)
-- ------------------------------------------------------------------
local remotes = Instance.new("Folder")
remotes.Name = "Remotes"
local function remote(klasse, name)
	local r = Instance.new(klasse)
	r.Name = name
	r.Parent = remotes
	return r
end
local evPunkte = remote("RemoteEvent", "Punkte")
local evRekord = remote("RemoteEvent", "Rekord")
local evZustand = remote("RemoteEvent", "Zustand")
local fnShop = remote("RemoteFunction", "Shop")
remotes.Parent = Shared

-- ------------------------------------------------------------------
-- Welt
-- ------------------------------------------------------------------
Welt.licht()
Welt.bauen()

local scooterOrdner = Instance.new("Folder")
scooterOrdner.Name = "Scooters"
scooterOrdner.Parent = workspace

-- ------------------------------------------------------------------
-- Spielstand
-- ------------------------------------------------------------------
local store = nil
do
	local ok, res = pcall(function()
		return DataStoreService:GetDataStore("EScooterWheelie_v1")
	end)
	if ok then
		store = res
	else
		warn("DataStore geht nicht (in Studio: Game Settings > Security > API Services einschalten):", res)
	end
end

local daten = {} -- [Player] = Spielstand
local scooters = {} -- [Player] = Scooter-Modell

local function neueDaten()
	return { punkte = 0, farben = 1, farbe = 1, rekord = 0, trick = 0, blitz = 0 }
end

local function besitzt(d, i)
	return bit32.band(d.farben, bit32.lshift(1, i - 1)) ~= 0
end

local function laden(player)
	local d = neueDaten()
	if store then
		for versuch = 1, 3 do
			local ok, res = pcall(function()
				return store:GetAsync("spieler_" .. player.UserId)
			end)
			if ok then
				if type(res) == "table" then
					for k in d do
						if type(res[k]) == "number" then
							d[k] = res[k]
						end
					end
				end
				break
			end
			warn("Laden fehlgeschlagen (Versuch " .. versuch .. "):", res)
			task.wait(1)
		end
	end
	d.farben = bit32.bor(d.farben, 1)
	if not Farben[d.farbe] or not besitzt(d, d.farbe) then
		d.farbe = 1
	end
	return d
end

local function speichern(player)
	local d = daten[player]
	if not d or not store or not d.geaendert then
		return
	end
	d.geaendert = false
	local kopie = {
		punkte = d.punkte,
		farben = d.farben,
		farbe = d.farbe,
		rekord = d.rekord,
		trick = d.trick,
		blitz = d.blitz,
	}
	local ok, err = pcall(function()
		store:SetAsync("spieler_" .. player.UserId, kopie)
	end)
	if not ok then
		d.geaendert = true
		warn("Speichern fehlgeschlagen:", err)
	end
end

-- Spielstand an den Spieler und an die Bestenliste geben
local function zeigen(player)
	local d = daten[player]
	if not d then
		return
	end
	player:SetAttribute("Punkte", d.punkte)
	player:SetAttribute("Farben", d.farben)
	player:SetAttribute("Farbe", d.farbe)
	player:SetAttribute("Rekord", d.rekord)
	player:SetAttribute("TrickRekord", d.trick)
	player:SetAttribute("BlitzRekord", d.blitz)
	local ls = player:FindFirstChild("leaderstats")
	if ls then
		ls.Punkte.Value = d.punkte
		ls.Rekord.Value = math.floor(d.rekord * 10 + 0.5) / 10
	end
end

-- ------------------------------------------------------------------
-- Scooter für jeden Spieler
-- ------------------------------------------------------------------
local function onCharacter(player, character)
	local alt = scooters[player]
	if alt then
		alt:Destroy()
		scooters[player] = nil
	end
	local hrp = character:WaitForChild("HumanoidRootPart", 10)
	local hum = character:WaitForChild("Humanoid", 10)
	if not hrp or not hum or character.Parent == nil then
		return
	end

	local function gruppe(obj)
		if obj:IsA("BasePart") then
			obj.CollisionGroup = "Fahrer"
		end
	end
	for _, obj in character:GetDescendants() do
		gruppe(obj)
	end
	character.DescendantAdded:Connect(gruppe)

	local model = Scooter.bauen(E)
	model.Name = "Scooter_" .. player.Name
	model:SetAttribute("Spieler", player.UserId)
	model:SetAttribute("Zustand", 0)
	local pos = hrp.Position
	model:PivotTo(CFrame.new(pos.X, E.SCOOTER.RAD, pos.Z))
	model.Parent = scooterOrdner
	local d = daten[player]
	Scooter.faerben(model, if d then d.farbe else 1, Farben)
	pcall(function()
		model.PrimaryPart:SetNetworkOwner(player)
	end)
	scooters[player] = model

	local link = Instance.new("ObjectValue")
	link.Name = "Scooter"
	link.Value = model
	link.Parent = character

	hum.Died:Connect(function()
		task.wait(3)
		if player.Parent and player.Character == character then
			player:LoadCharacter()
		end
	end)
	character.AncestryChanged:Connect(function(_, parent)
		if parent == nil and scooters[player] == model then
			model:Destroy()
			scooters[player] = nil
		end
	end)
end

local function onPlayer(player)
	local d = laden(player)
	if not player.Parent then
		return
	end
	daten[player] = d

	local ls = Instance.new("Folder")
	ls.Name = "leaderstats"
	local p = Instance.new("IntValue")
	p.Name = "Punkte"
	p.Parent = ls
	local r = Instance.new("NumberValue")
	r.Name = "Rekord"
	r.Parent = ls
	ls.Parent = player
	zeigen(player)

	player.CharacterAdded:Connect(function(c)
		onCharacter(player, c)
	end)
	player:LoadCharacter()
end

Players.PlayerAdded:Connect(onPlayer)
for _, p in Players:GetPlayers() do
	task.spawn(onPlayer, p)
end

Players.PlayerRemoving:Connect(function(player)
	speichern(player)
	daten[player] = nil
	if scooters[player] then
		scooters[player]:Destroy()
		scooters[player] = nil
	end
end)

game:BindToClose(function()
	local offen = 0
	for _, player in Players:GetPlayers() do
		offen += 1
		task.spawn(function()
			speichern(player)
			offen -= 1
		end)
	end
	local start = os.clock()
	while offen > 0 and os.clock() - start < 20 do
		task.wait(0.1)
	end
end)

task.spawn(function()
	while true do
		task.wait(60)
		for _, player in Players:GetPlayers() do
			speichern(player)
		end
	end
end)

-- ------------------------------------------------------------------
-- Nachrichten von den Spielern
-- ------------------------------------------------------------------
local function zahl(n)
	return type(n) == "number" and n == n and n > -math.huge and n < math.huge
end

evPunkte.OnServerEvent:Connect(function(player, n)
	local d = daten[player]
	if not d or not zahl(n) or n <= 0 then
		return
	end
	d.punkte += math.floor(math.min(n, 20000))
	d.geaendert = true
	zeigen(player)
end)

evRekord.OnServerEvent:Connect(function(player, art, wert)
	local d = daten[player]
	if not d or not zahl(wert) then
		return
	end
	if art == "wheelie" and wert > d.rekord and wert < 1000000 then
		d.rekord = wert
	elseif art == "trick" and wert > d.trick and wert < 10000000 then
		d.trick = math.floor(wert)
	elseif art == "blitz" and wert > d.blitz and wert <= 250 then
		d.blitz = math.floor(wert)
	else
		return
	end
	d.geaendert = true
	zeigen(player)
end)

evZustand.OnServerEvent:Connect(function(player, bits)
	local model = scooters[player]
	if model and zahl(bits) then
		model:SetAttribute("Zustand", math.clamp(math.floor(bits), 0, 255))
	end
end)

fnShop.OnServerInvoke = function(player, aktion, i)
	local d = daten[player]
	if not d or not zahl(i) then
		return false, "?"
	end
	i = math.floor(i)
	local f = Farben[i]
	if not f then
		return false, "?"
	end
	if not besitzt(d, i) then
		if aktion ~= "kaufen" then
			return false, "Noch nicht gekauft"
		end
		if d.punkte < f.preis then
			return false, "Zu wenig Punkte! Dir fehlen noch " .. (f.preis - d.punkte) .. "."
		end
		d.punkte -= f.preis
		d.farben = bit32.bor(d.farben, bit32.lshift(1, i - 1))
		d.farbe = i
		d.geaendert = true
		zeigen(player)
		if scooters[player] then
			Scooter.faerben(scooters[player], i, Farben)
		end
		task.spawn(speichern, player)
		return true, f.name .. " gekauft!"
	end
	d.farbe = i
	d.geaendert = true
	zeigen(player)
	if scooters[player] then
		Scooter.faerben(scooters[player], i, Farben)
	end
	return true, f.name .. " ausgewählt"
end
