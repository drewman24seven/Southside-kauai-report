import math

# Refined calibration — adjust thresholds so 4ft@16s is cleanly safe
# Key insight: 4ft@16s energy = 4²×16 = 256
# To be cleanly safe under any calm condition, base caution must be > 256
# Setting snorkel caution=270, scuba caution=216 (same ratio)

print("=" * 100)
print("REFINED CALIBRATION — snorkel caution=270, scuba caution=216")
print("4ft@16s energy=256 → cleanly SAFE. 4ft@18s energy=288 → CAUTION.")
print("=" * 100)

def snorkel_pf(T):  return 1.0
def scuba_pf(T):
    if T >= 16: return 0.85
    if T >= 14: return 0.90
    if T >= 12: return 0.95
    if T <=  8: return 1.10
    return 1.0

def swell_thresholds(activity, wind_exp):
    if activity == "snorkel":
        base_c, base_d = 270, 540
    else:  # scuba
        base_c, base_d = 216, 432

    mods = {
        "offshore":    (1.25, 1.25),
        "onshore":     (0.80, 0.80),
        "cross-shore": (1.00, 1.00),
    }
    cm, dm = mods[wind_exp]
    return base_c * cm, base_d * dm

def wind_thresholds(activity, site_type, is_co, wind_exp):
    if activity == "snorkel":
        if site_type == "shore":
            return (8 if is_co else 11), (12 if is_co else 16)
        if wind_exp == "offshore":  return 18, 23
        if wind_exp == "onshore":   return 12, 16
        return 16, 20
    else:  # scuba
        if site_type == "shore":    return 14, 18
        if wind_exp == "offshore":  return 20, 25
        if wind_exp == "onshore":   return 14, 18
        return 18, 22

def classify(energy, sw_c, sw_d, wind, wc, wd, activity, stype):
    sw_s = "danger" if energy >= sw_d else ("caution" if energy >= sw_c else "safe")
    w_s  = "danger" if wind  >= wd   else ("caution" if wind  >= wc   else "safe")
    extreme = 20 if (activity == "snorkel" and stype == "shore") else \
              24 if activity == "snorkel" else \
              22 if stype == "shore" else 26
    if sw_s == "danger":
        final = "DANGER"
    elif w_s == "danger":
        final = "DANGER" if wind >= extreme else "CAUTION"
    elif sw_s == "caution" or w_s == "caution":
        final = "CAUTION"
    else:
        final = "safe"
    return final, sw_s, w_s

test_cases = [
    # ── Safe / calm ──────────────────────────────────────────────────────────
    (1.5, 12,  5,  "offshore",    "boat",  "Calm GS — 1.5ft@12s, 5mph offshore"),
    (2.0, 10,  8,  "offshore",    "boat",  "Normal trade — 2ft@10s, 8mph offshore"),
    (2.0, 12, 12,  "offshore",    "boat",  "Trade swell — 2ft@12s, 12mph offshore"),
    (3.0, 12, 10,  "offshore",    "boat",  "Moderate — 3ft@12s, 10mph offshore"),
    (3.0, 14, 12,  "offshore",    "boat",  "Moderate GS — 3ft@14s, 12mph offshore"),
    (4.0, 14, 15,  "offshore",    "boat",  "Active — 4ft@14s, 15mph offshore"),
    # ── Windswell ────────────────────────────────────────────────────────────
    (3.0,  7, 15,  "cross-shore", "boat",  "Windswell — 3ft@7s, 15mph cross"),
    (4.0,  7, 18,  "cross-shore", "boat",  "Strong WS — 4ft@7s, 18mph cross"),
    (4.0,  7, 22,  "onshore",     "boat",  "Strong WS + onshore — 4ft@7s, 22mph"),
    (3.5,  8, 20,  "onshore",     "boat",  "Onshore mess — 3.5ft@8s, 20mph onshore"),
    # ── Groundswell edge cases ───────────────────────────────────────────────
    (4.0, 16,  8,  "offshore",    "boat",  "GS safe — 4ft@16s, 8mph offshore"),
    (4.0, 16, 10,  "cross-shore", "boat",  "GS cross — 4ft@16s, 10mph cross"),
    (4.0, 16, 18,  "onshore",     "boat",  "GS onshore — 4ft@16s, 18mph onshore"),
    (4.0, 18, 10,  "cross-shore", "boat",  "4ft@18s — 10mph cross"),
    (4.5, 16, 10,  "cross-shore", "boat",  "4.5ft@16s — 10mph cross"),
    # ── Today ────────────────────────────────────────────────────────────────
    (4.9, 18, 23,  "cross-shore", "boat",  "TODAY boat — 4.9ft@18s, 23mph E"),
    (4.9, 18, 3.5, "cross-shore", "shore", "TODAY KOLOA shore — 3.5mph cove"),
    # ── Large / Dangerous ────────────────────────────────────────────────────
    (5.5, 18, 10,  "offshore",    "boat",  "Large GS — 5.5ft@18s, 10mph offshore"),
    (6.0, 18, 12,  "offshore",    "boat",  "Big GS — 6ft@18s, 12mph offshore"),
    (7.0, 18, 15,  "offshore",    "boat",  "Dangerous — 7ft@18s, 15mph offshore"),
    (8.0, 18, 18,  "offshore",    "boat",  "Very dangerous — 8ft@18s, 18mph"),
]

hdr = f"{'Conditions':<47} {'SnkE':>6} {'SnkW':>7} {'SNORKEL':>9}   {'ScuE':>6} {'ScuW':>7} {'SCUBA':>9}"
print(f"\n{hdr}")
print("-" * 100)

for (H, T, wind, wind_exp, stype, label) in test_cases:
    w_used = wind if stype == "boat" else min(wind, 6)

    results = {}
    for act in ["snorkel", "scuba"]:
        pf = snorkel_pf(T) if act == "snorkel" else scuba_pf(T)
        energy = (H * pf) ** 2 * T
        sw_c, sw_d = swell_thresholds(act, wind_exp)
        wc, wd = wind_thresholds(act, stype, False, wind_exp)
        final, sw_s, w_s = classify(energy, sw_c, sw_d, w_used, wc, wd, act, stype)
        results[act] = (energy, w_s, final)

    se, sw_ws, sf = results["snorkel"]
    ce, sc_ws, cf = results["scuba"]

    # flag rows of interest
    flag = " ◄" if "TODAY" in label else ("  ?" if "key" in label else "")
    print(f"{label+flag:<49} {se:>6.1f} {sw_ws:>7} {sf:>9}   {ce:>6.1f} {sc_ws:>7} {cf:>9}")

print("\n")
print("SWELL THRESHOLD SUMMARY (proposed):")
print(f"  {'Activity':<10} {'Base C':>7} {'Base D':>7}   {'Offshore C':>11} {'Onshore C':>10}")
for act, bc, bd in [("snorkel", 270, 540), ("scuba", 216, 432)]:
    print(f"  {act:<10} {bc:>7} {bd:>7}   {bc*1.25:>11.0f} {bc*0.80:>10.0f}")

print()
print("ENERGY CHECK — key swell sizes:")
checks = [(3,14),(4,14),(4,16),(4,18),(4.9,18),(5,16),(5.5,18),(6,18),(7,18)]
print(f"  {'H×T':^12} {'Snk Energy':>12} {'Scu Energy (pf)':>18}")
print(f"  {'-'*44}")
for h,t in checks:
    se = h**2 * t
    spf = scuba_pf(t)
    ce = (h*spf)**2 * t
    print(f"  {h}ft @ {t}s    {se:>10.1f}   {ce:>12.1f}  (pf={spf})")
