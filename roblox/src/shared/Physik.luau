--[[
	Wheelie-Physik (wie in der PyBadge-Version).
	Rechnet nur mit Zahlen, damit man sie auch ohne Roblox testen kann.

	z.v      Geschwindigkeit (m/s)
	z.th     Wheelie-Winkel (rad), 0 = Vorderrad auf dem Boden
	z.om     Drehgeschwindigkeit (rad/s)
	z.wmode  Wheelie-Mode an
	z.landing sanft landen
	z.arms   0 = beide Hände, 1 = Einhänder, 2 = No-Hander
	z.crouch in die Knie
	z.boostT Turbo nach dem Burnout (Sekunden)
	z.wt     Dauer des aktuellen Wheelies (s)
	z.t      Zeit (s)
]]

local Physik = {}

local CTRL = { 1, 0.75, 0.45 } -- Kontrolle mit 2 / 1 / 0 Händen
local WOBBLE = { 0, 0.6, 1.5 }

function Physik.neu()
	return {
		v = 0,
		th = 0,
		om = 0,
		wmode = false,
		landing = false,
		arms = 0,
		crouch = false,
		boostT = 0,
		wt = 0,
		t = 0,
	}
end

-- Ein kleiner Schritt. Gibt true zurück, wenn das Vorderrad gerade (wieder) auf dem Boden ist.
function Physik.schritt(z, dt, gas, bremse, E)
	local VMAX = E.MAX_KMH / 3.6
	local CRUISE = E.CRUISE_KMH / 3.6
	local PHI0 = math.rad(90 - E.BALANCE_DEG)

	local vv = z.v
	if bremse then
		vv -= E.BRAKE_DECEL * dt * (if z.th > 0 then 0.4 else 1)
	elseif gas then
		local f = vv / VMAX
		vv += E.ACCEL * dt * (1 - 0.6 * f * f)
		if z.boostT > 0 then
			vv += E.LAUNCH_BOOST * dt
		end
	elseif vv < CRUISE then
		vv = math.min(CRUISE, vv + E.CRUISE_ACCEL * dt)
	else
		vv = math.max(CRUISE, vv - E.COAST_DECEL * dt)
	end
	z.v = math.clamp(vv, 0, VMAX)

	local damp = E.DAMPING * (if z.crouch and z.wmode then 1.6 else 1)
	local a = -E.GRAVITY * math.cos(PHI0 + z.th) - damp * z.om
	if z.landing then
		a -= E.LAND_TORQUE
	elseif z.wmode then
		local c = CTRL[z.arms + 1]
		if gas then
			a += E.LIFT * c * math.min(1, z.v / 2)
		end
		if bremse and z.th > 0 then
			a -= E.BRAKE_TORQUE * c
		end
		a += WOBBLE[z.arms + 1] * math.sin(z.t * 6.3)
		-- je länger der Wheelie dauert, desto unruhiger wird er (Windböen)
		a += math.min(1.2, z.wt * 0.02) * math.sin(z.t * 2.3 + 3 * math.sin(z.t * 0.7))
	end
	z.om += a * dt
	if z.landing and z.om < -E.LAND_SPEED then
		z.om = -E.LAND_SPEED
	end
	z.th += z.om * dt
	if z.th <= 0 then
		z.th = 0
		if z.om < 0 then
			z.om = 0
			return true
		end
	end
	return false
end

-- Mehrere kleine Schritte (genauer bei wenig FPS)
function Physik.schritte(z, dt, gas, bremse, E)
	local gelandet = false
	local n = math.floor(dt / 0.01) + 1
	local h = dt / n
	for _ = 1, n do
		z.t += h
		if Physik.schritt(z, h, gas, bremse, E) then
			gelandet = true
		end
	end
	return gelandet
end

return Physik
