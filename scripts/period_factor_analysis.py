import math

# Physics analysis of period factor applied to energy scoring

raw_h = 4.9
period = 18.0
swell_dir = 192.0

print("=" * 70)
print("PERIOD FACTOR PHYSICS ANALYSIS")
print("=" * 70)

# What the code does
pf = 0.50  # for 18s period
eff_h = raw_h * pf
energy_with_pf = eff_h**2 * period

# What raw energy would be
energy_raw = raw_h**2 * period

print(f"\n--- Current Code ---")
print(f"  Raw swell:            {raw_h} ft")
print(f"  Period:               {period} s")
print(f"  Period factor (>=16s): {pf}  ← applied to H before squaring")
print(f"  Effective H:          {eff_h} ft  (4.9 x 0.50)")
print(f"  Energy = effH² x T:   {energy_with_pf:.1f}  ({eff_h}² × {period})")
print(f"  Reduction vs raw:     {energy_with_pf/energy_raw*100:.1f}% of full energy  (75% discount!)")

print(f"\n--- Raw formula (no period factor) ---")
print(f"  Energy = H² x T:      {energy_raw:.1f}  ({raw_h}² × {period})")

# The factor applied to H before squaring compounds:
# (H × 0.50)² = H² × 0.25  →  then × T → 25% of H²×T
# That is a 75% energy discount just from the period factor
print(f"\n--- Why the discount is so large ---")
print(f"  pf=0.50 applied to H before squaring: H² becomes (0.5H)² = 0.25 × H²")
print(f"  So energy gets multiplied by 0.50² = {0.50**2}  →  75% reduction")
print(f"  The comment says 'orbital velocity scaling' but the math is transit comfort math")

print(f"\n--- Marine Physics: Two completely different physics ---")
print()
print("  TRANSIT COMFORT (boat ride quality):")
print("  - Surface steepness = H/L = H/(gT²/2π) ∝ H/T²")
print("  - Long period = gentle slope = easy to ride over  ← period factor CORRECT here")
print(f"  - 4.9ft @ 18s steepness: {raw_h/(1.56*period**2):.5f}  (very gentle slope)")
print(f"  - 4.9ft @ 8s  steepness: {raw_h/(1.56*8**2):.5f}  (much steeper)")
print()
print("  WAVE POWER at a reef/shore (what actually creates surge):")
print("  - Wave power (energy flux) = ρg²H²T / (32π)  ∝  H² × T")
print("  - MORE period = MORE power per wave, not less")
print(f"  - 4.9ft @ 18s power (relative): {raw_h**2 * period:.1f}")
print(f"  - 4.9ft @ 8s  power (relative): {raw_h**2 * 8:.1f}")
print(f"  - 18s swell carries {period/8:.1f}x MORE wave power than same-height 8s swell")
print()
print("  SHORE SURGE specifically:")
print("  - Long period = more water mass moving shoreward per wave")
print("  - Long period = surge lasts longer (pull-back danger)")
print("  - 18s groundswell surge at a ramp is MORE dangerous, not less")
print()
print("  ORBITAL VELOCITY at dive depth:")
print("  Deep water: v_orb = π×H/T × e^(-2πd/L)")
print("  Wavelength L = gT²/2π = 1.56 × T²")
L_18 = 1.56 * period**2
L_8  = 1.56 * 8**2
depth_ft = 30; depth_m = depth_ft * 0.3048
v_18 = (math.pi * raw_h * 0.3048 / period) * math.exp(-2*math.pi*depth_m/L_18)
v_8  = (math.pi * raw_h * 0.3048 / 8.0)   * math.exp(-2*math.pi*depth_m/L_8)
print(f"  At {depth_ft}ft depth, 4.9ft swell:")
print(f"    18s period: L={L_18:.0f}m, orbital vel = {v_18:.3f} m/s")
print(f"    8s  period: L={L_8:.0f}m,  orbital vel = {v_8:.3f} m/s")
print(f"  18s actually has {v_18/v_8:.2f}x the orbital velocity at {depth_ft}ft depth (longer wavelength doesn't attenuate)")

print()
print("=" * 70)
print("CONCLUSION")
print("=" * 70)
print()
print("  The period factor (0.50 for 18s) belongs in TRANSIT COMFORT calculations")
print("  (boat ride quality) - and it IS correctly applied there separately.")
print()
print("  Applying it to the ENERGY score for dive/snorkel safety:")
print("  - Cuts energy from 432.2 down to 108.0  (75% reduction)")
print("  - Treats 4.9ft @ 18s as equivalent to 2.45ft for safety scoring")
print("  - Physically backwards: longer period = more shore/reef energy")
print()
print("  OPTION A: Remove period factor from energy (use raw H²×T)")
print(f"    Raw energy = {energy_raw:.1f} → ALL sites would be at caution/danger")
print(f"    BUT thresholds were tuned to factor-adjusted scores → would need recalibration")
print()
print("  OPTION B: Keep factor but raise thresholds to compensate")
print(f"    Current: energy=108, threshold=110. Thresholds are already tuned low.")
print(f"    The period factor + thresholds work together as a calibrated system")
print(f"    Problem: only works if period factor is physically appropriate")
print()
print("  OPTION C: Use raw H²×T for SHORE sites, keep factor for BOAT sites")
print(f"    Shore energy (no factor): {energy_raw:.1f} → well into caution (threshold 90)")
print(f"    Boat energy (with factor): {energy_with_pf:.1f} → near caution (threshold 110)")
print(f"    This matches the actual physics: shore ramp feels raw power, boats dampen it")
