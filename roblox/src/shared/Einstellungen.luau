--[[
	E-SCOOTER WHEELIE - EINSTELLUNGEN
	Hier kannst du das Spiel leichter oder schwerer machen.
	Die meisten Werte sind die gleichen wie in der PyBadge-Version.
]]

local Einstellungen = {
	-- Tempo
	MAX_KMH = 100, -- Höchstgeschwindigkeit mit Gas
	CRUISE_KMH = 25, -- so schnell rollt der Scooter von allein
	ACCEL = 6, -- Beschleunigung mit Gas (m/s²)
	CRUISE_ACCEL = 3, -- Beschleunigung von allein
	COAST_DECEL = 1.5, -- Ausrollen ohne Gas
	BRAKE_DECEL = 7, -- Bremsen
	LAUNCH_BOOST = 5, -- Extra-Schub nach einem Burnout
	LENKEN = 5, -- so schnell fährst du zur Seite (m/s)

	-- Wheelie
	POP = 1.8, -- wie kräftig die Wheelie-Taste das Vorderrad hochreißt
	BALANCE_DEG = 42, -- Gleichgewichtspunkt des Wheelies
	CRASH_DEG = 68, -- ab hier kippst du nach hinten um
	GRAVITY = 4, -- wie stark das Vorderrad nach unten will
	LIFT = 6.5, -- wie stark Gas das Vorderrad hochzieht
	BRAKE_TORQUE = 6, -- wie stark die Bremse es runterdrückt
	DAMPING = 1.8, -- Dämpfung (höher = gutmütiger)
	LAND_TORQUE = 5, -- sanftes Landen mit nochmal Wheelie-Taste
	LAND_SPEED = 1.6,
	MIN_WHEELIE = 0.5, -- so viele Meter muss ein Wheelie mindestens haben

	-- Sprung
	JUMP_GRAVITY = 9, -- Schwerkraft beim Sprung (m/s²)
	MAX_JUMP = 6, -- höchste Absprung-Geschwindigkeit nach oben (m/s)

	-- Punkte
	COIN_VALUE = 10, -- Punkte pro Münze
	BLITZ_KMH = 60, -- ab diesem Tempo blitzt der Blitzer
	RUNDEN_BONUS = 100, -- Punkte für eine ganze Runde

	-- Welt
	DAY_LENGTH = 300, -- so viele Sekunden dauert ein ganzer Tag
	STRECKE_M = 1500, -- so lang ist die Straße (Meter), danach geht es von vorne los
	STRASSE_BREITE = 40, -- Breite der Straße in Studs
	STUDS_PRO_M = 3.5, -- 1 Meter = 3.5 Studs
	SEED = 2024, -- eine andere Zahl ergibt eine andere Strecke

	-- Maße vom Scooter (Studs). Nur ändern, wenn du auch das Modell änderst.
	SCOOTER = {
		RADSTAND = 4.2, -- Abstand Hinterrad - Vorderrad
		RAD = 0.9, -- Radius der Räder
		DECK = 1.05, -- Höhe vom Trittbrett
		FUSS_X = 1.9, -- hier stehen die Füße (von der Hinterachse aus)
	},
}

return Einstellungen
