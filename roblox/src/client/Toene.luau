--[[
	Töne. Es werden nur Töne benutzt, die bei Roblox schon dabei sind
	(rbxasset://), damit man nichts hochladen muss.
]]

local SoundService = game:GetService("SoundService")

local Toene = {}

local IDS = {
	muenze = { "rbxasset://sounds/electronicpingshort.wav", 0.5 },
	trick = { "rbxasset://sounds/swoosh.wav", 0.6 },
	sprung = { "rbxasset://sounds/action_jump.mp3", 0.6 },
	landen = { "rbxasset://sounds/action_jump_land.mp3", 0.8 },
	sturz = { "rbxasset://sounds/splat.wav", 0.7 },
	blitz = { "rbxasset://sounds/snap.wav", 1 },
	gully = { "rbxasset://sounds/clickfast.wav", 0.8 },
	launch = { "rbxasset://sounds/swoosh.wav", 0.9 },
	rekord = { "rbxasset://sounds/victory.wav", 0.6 },
	kaufen = { "rbxasset://sounds/electronicpingshort.wav", 0.7 },
	nein = { "rbxasset://sounds/clickfast.wav", 0.7 },
}

local sounds = {}
for name, def in IDS do
	local s = Instance.new("Sound")
	s.Name = "Wheelie_" .. name
	s.SoundId = def[1]
	s.Volume = def[2]
	s.Parent = SoundService
	sounds[name] = s
end

function Toene.spielen(name, tonhoehe)
	local s = sounds[name]
	if s then
		s.PlaybackSpeed = tonhoehe or 1
		s.TimePosition = 0
		s:Play()
	end
end

return Toene
