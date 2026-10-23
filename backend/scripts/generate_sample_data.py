"""
generate_sample_data.py - Creates realistic SAMPLE (synthetic) data so the
whole project works OFFLINE during the demo.

In a real deployment these files would come from:
  * IMD gridded rainfall / AWS stations  -> rainfall, humidity, temperature...
  * MOSDAC (INSAT-3D/3DR satellite)      -> cloud_top_temp
  * IMD Doppler Weather Radar            -> radar_dbz
  * NASA GPM IMERG                       -> rainfall where gauges are missing
  * NCMRWF NWP model (NCUM)              -> nwp_rain
  * SRTM DEM / ISRO Bhuvan               -> elevation GeoTIFFs (data/dem)
We keep the SAME column names, so real files can replace these later
without changing the ML or API code.

Run (from the backend folder):
    python -m scripts.generate_sample_data

Files created inside backend/data/:
    districts.json, districts.geojson   - district list + map shapes
    weather_history.csv                 - 3 years of daily data (ML training)
    current_scenario.csv                - "today" + next 3 days (live dashboard)
    events.json, events/*.csv           - Wayanad 2024 & Chennai 2015 replays
    shelters.json                       - relief shelters (citizen app)
    dem/<district>.tif                  - elevation grids (inundation map)
"""
import json
from datetime import date, timedelta

import numpy as np
import pandas as pd
import rasterio
from rasterio.transform import from_origin

from app.config import DATA_DIR, DEM_DIR, EVENTS_DIR

rng = np.random.default_rng(42)   # fixed seed -> same data every run

# ------------------------------------------------------------------
# 1. Districts: (id, name, state, lat, lon, elevation_m, rain_factor)
#    rain_factor > 1 means the district gets more rain than the state
#    average (e.g. Western Ghats slopes), < 1 means less (rain shadow).
# ------------------------------------------------------------------
DISTRICTS = [
    ("KL01", "Thiruvananthapuram", "Kerala", 8.52, 76.94, 40, 0.75),
    ("KL02", "Alappuzha", "Kerala", 9.50, 76.34, 3, 0.85),
    ("KL03", "Idukki", "Kerala", 9.85, 76.97, 1100, 1.25),
    ("KL04", "Ernakulam", "Kerala", 9.98, 76.30, 8, 1.00),
    ("KL05", "Thrissur", "Kerala", 10.53, 76.21, 15, 0.95),
    ("KL06", "Palakkad", "Kerala", 10.78, 76.65, 85, 0.65),
    ("KL07", "Malappuram", "Kerala", 11.07, 76.07, 40, 1.00),
    ("KL08", "Kozhikode", "Kerala", 11.26, 75.78, 10, 1.15),
    ("KL09", "Wayanad", "Kerala", 11.69, 76.08, 900, 1.30),
    ("KL10", "Kannur", "Kerala", 11.87, 75.37, 15, 1.20),
    ("TN01", "Chennai", "Tamil Nadu", 13.08, 80.27, 6, 1.15),
    ("TN02", "Tiruvallur", "Tamil Nadu", 13.14, 79.91, 40, 1.00),
    ("TN03", "Kancheepuram", "Tamil Nadu", 12.83, 79.70, 85, 1.00),
    ("TN04", "Cuddalore", "Tamil Nadu", 11.75, 79.75, 5, 1.05),
    ("TN05", "Thanjavur", "Tamil Nadu", 10.79, 79.14, 60, 0.85),
    ("TN06", "Madurai", "Tamil Nadu", 9.93, 78.12, 135, 0.60),
    ("TN07", "Tirunelveli", "Tamil Nadu", 8.71, 77.76, 50, 0.60),
    ("TN08", "Coimbatore", "Tamil Nadu", 11.02, 76.96, 410, 0.45),
    ("TN09", "Nilgiris", "Tamil Nadu", 11.41, 76.70, 2200, 0.90),
    ("MH01", "Mumbai", "Maharashtra", 19.08, 72.88, 14, 1.20),
    ("MH02", "Thane", "Maharashtra", 19.22, 73.10, 10, 1.10),
    ("MH03", "Raigad", "Maharashtra", 18.52, 73.18, 50, 1.35),
    ("MH04", "Ratnagiri", "Maharashtra", 16.99, 73.31, 30, 1.40),
    ("MH05", "Pune", "Maharashtra", 18.52, 73.86, 560, 0.35),
    ("MH06", "Kolhapur", "Maharashtra", 16.70, 74.24, 550, 0.60),
    ("MH07", "Nashik", "Maharashtra", 20.00, 73.79, 580, 0.35),
    ("MH08", "Nagpur", "Maharashtra", 21.15, 79.09, 310, 0.50),
    ("AS01", "Kamrup Metro", "Assam", 26.14, 91.74, 55, 0.80),
    ("AS02", "Barpeta", "Assam", 26.32, 91.00, 40, 0.85),
    ("AS03", "Dhubri", "Assam", 26.02, 89.98, 30, 0.95),
    ("AS04", "Nagaon", "Assam", 26.35, 92.68, 60, 0.70),
    ("AS05", "Jorhat", "Assam", 26.75, 94.20, 90, 0.90),
    ("AS06", "Lakhimpur", "Assam", 27.24, 94.10, 100, 1.10),
    ("AS07", "Dibrugarh", "Assam", 27.47, 94.91, 110, 1.00),
    ("AS08", "Cachar", "Assam", 24.83, 92.78, 25, 1.10),
]

# Approximate monthly normal rainfall (mm per month, Jan..Dec) per state
MONTHLY_NORMAL = {
    "Kerala":      [10, 20, 35, 110, 220, 650, 700, 420, 250, 300, 160, 40],
    "Tamil Nadu":  [25, 10, 10, 25, 50, 50, 70, 100, 115, 180, 310, 150],
    "Maharashtra": [2, 1, 3, 5, 20, 500, 800, 550, 300, 80, 15, 5],
    "Assam":       [15, 30, 70, 180, 280, 380, 390, 330, 260, 120, 20, 10],
}
# Approximate monthly mean temperature at sea level (deg C)
MONTHLY_TEMP = {
    "Kerala":      [27, 28, 29, 29, 29, 26, 26, 26, 27, 27, 27, 27],
    "Tamil Nadu":  [25, 27, 29, 31, 33, 32, 31, 30, 30, 28, 26, 25],
    "Maharashtra": [24, 26, 29, 31, 32, 29, 27, 27, 27, 28, 27, 25],
    "Assam":       [17, 19, 23, 26, 28, 29, 29, 29, 28, 26, 22, 18],
}


def daily_normal(state, month, factor):
    """Average rainfall for one day (mm) in this district and month."""
    return MONTHLY_NORMAL[state][month - 1] / 30.0 * factor


def ar1(n, phi, sd):
    """AR(1) random series: today's value depends on yesterday's.
    This makes wet spells and dry spells last several days, like real weather."""
    x = np.zeros(n)
    for t in range(1, n):
        x[t] = phi * x[t - 1] + rng.normal(0, sd)
    return x


# ------------------------------------------------------------------
# 2. Turn a rainfall series into the 12 ML features
# ------------------------------------------------------------------
def build_feature_rows(dates, rain, z, dist, noise_scale=1.0, nwp_error=0.55):
    """For each day t, build the features we would know at 08:30 IST on day t,
    and the target = rainfall on day t+1 (next 24 hours).

    z is the 'storm strength' of each day. Satellite, radar and NWP all
    'see' a storm system before it arrives, so we link them to z[t+1]."""
    did, name, state, lat, lon, elev, factor = dist
    rows = []
    for t in range(7, len(dates) - 1):
        month = dates[t].month
        z_next = z[t + 1]
        clim = np.log1p(daily_normal(state, month, factor)) / np.log1p(30)  # 0..1
        n = lambda sd: rng.normal(0, sd * noise_scale)
        rows.append({
            "date": dates[t].isoformat(),
            "district_id": did,
            "state": state,
            "rain_today": round(rain[t], 1),
            "rain_1d": round(rain[t], 1),
            "rain_3d": round(rain[t - 2:t + 1].sum(), 1),
            "rain_7d": round(rain[t - 6:t + 1].sum(), 1),
            "humidity": round(float(np.clip(62 + 9 * z_next + 12 * clim + n(4), 25, 100)), 1),
            "temperature": round(MONTHLY_TEMP[state][month - 1] - 0.0065 * elev - 1.5 * z_next + n(1), 1),
            "pressure": round(1009 - 3.0 * z_next - 2 * clim + n(1.5), 1),
            "wind_speed": round(float(max(0, 9 + 7 * max(z_next, 0) + 6 * clim + n(3))), 1),
            "cloud_top_temp": round(float(np.clip(275 - 22 * z_next - 25 * clim + n(7), 190, 300)), 1),
            "radar_dbz": round(float(np.clip(12 + 10 * z_next + 4 * np.log1p(rain[t]) + 10 * clim + n(4), 0, 65)), 1),
            "nwp_rain": round(float(max(0, rain[t + 1] * np.exp(rng.normal(0, nwp_error)) + n(3))), 1),
            "month": month,
            "elevation": elev,
            "rain_next_24h": round(rain[t + 1], 1),
        })
    return rows


def simulate_rain(dates, dist, regional_z, boost=None, gamma_shape=0.7, local_sd=0.5):
    """Simulate daily rainfall: seasonal normal x storm strength x randomness."""
    did, name, state, lat, lon, elev, factor = dist
    n = len(dates)
    z = 0.8 * regional_z + 0.6 * ar1(n, 0.5, local_sd)   # regional + local weather
    if boost is not None:
        z = z + boost                                # force a storm (scenario)
    normals = np.array([daily_normal(state, d.month, factor) for d in dates])
    noise = rng.gamma(gamma_shape, 1 / gamma_shape, n)  # mean 1, heavy tail
    rain = normals * np.exp(z - 0.42) * noise          # -0.42 keeps the average = normal
    rain[rain < 1.0] = 0.0                            # very light = dry day
    return np.clip(rain, 0, 500), z


# ------------------------------------------------------------------
# 3. District map shapes (simple polygons around each district centre)
# ------------------------------------------------------------------
def district_polygon(i, radius=0.32, n_points=36):
    """Draw a blob around district i. Each ray stops half-way to the nearest
    neighbouring district centre (a 'Voronoi' cell), so shapes don't overlap.
    Replace data/districts.geojson with real boundaries (e.g. Survey of India /
    DataMeet) for production - the app only needs the 'id' property."""
    _, _, state, lat, lon, _, _ = DISTRICTS[i]
    centre = np.array([lon, lat])
    others = np.array([[d[4], d[3]] for j, d in enumerate(DISTRICTS)
                       if j != i and d[2] == state])
    wobble = 1 + 0.08 * np.sin(np.arange(n_points) * 3 + i)   # natural-looking edge
    coords = []
    for k, angle in enumerate(np.linspace(0, 2 * np.pi, n_points, endpoint=False)):
        u = np.array([np.cos(angle), np.sin(angle)])
        t = radius * wobble[k]
        for o in others:
            d = o - centre
            dot = u @ d
            if dot > 0:                       # neighbour is in this direction
                t = min(t, (d @ d) / (2 * dot) * 0.97)
        p = centre + t * u
        coords.append([round(float(p[0]), 4), round(float(p[1]), 4)])
    coords.append(coords[0])                  # close the ring
    return coords


# ------------------------------------------------------------------
# 4. DEM (elevation) GeoTIFF for every district
# ------------------------------------------------------------------
def smooth_noise(size):
    """Random bumpy surface (0..1), smoothed with repeated averaging."""
    g = rng.normal(0, 1, (size, size))
    for _ in range(8):
        g = (g + np.roll(g, 1, 0) + np.roll(g, -1, 0) + np.roll(g, 1, 1) + np.roll(g, -1, 1)) / 5
    return (g - g.min()) / (g.max() - g.min())


def write_dem(dist, size=96, half_width=0.34):
    """Make a fake-but-realistic terrain: slope + hills + a river valley.
    Real version: clip SRTM 30 m DEM (from Bhuvan / USGS) to the district."""
    did, name, state, lat, lon, elev, factor = dist
    yy, xx = np.mgrid[0:1:size * 1j, 0:1:size * 1j]
    angle = rng.uniform(0, 2 * np.pi)
    slope = (np.cos(angle) * (xx - 0.5) + np.sin(angle) * (yy - 0.5)) + 0.5   # 0..1 tilt
    phase = rng.uniform(0, 2 * np.pi)
    river_y = 0.5 + 0.18 * np.sin(2 * np.pi * (xx * 1.1) + phase)
    river = np.exp(-((yy - river_y) / 0.05) ** 2)                            # 1 near river
    relief = 600 if elev > 500 else max(25, elev * 1.5)
    base = max(0, elev - relief * 0.4)
    dem = base + relief * (0.55 * slope + 0.45 * smooth_noise(size)) - 0.35 * relief * river
    dem = np.maximum(dem, 0).astype("float32")

    res = 2 * half_width / size
    transform = from_origin(lon - half_width, lat + half_width, res, res)
    with rasterio.open(DEM_DIR / f"{did}.tif", "w", driver="GTiff", height=size, width=size,
                       count=1, dtype="float32", crs="EPSG:4326", transform=transform) as f:
        f.write(dem, 1)


# ------------------------------------------------------------------
# 5. Historical events (rainfall shaped like the real disasters)
# ------------------------------------------------------------------
EVENTS = [
    {
        "id": "wayanad_2024",
        "name": "Wayanad Landslides 2024",
        "state": "Kerala",
        "focus_district": "KL09",
        "start": "2024-07-13",          # 7 warm-up days + 15 replay days
        "event_time": "2024-07-30T02:00:00",
        "description": "Extremely heavy rain triggered the Mundakkai-Chooralmala "
                       "landslides in Wayanad in the early hours of 30 July 2024.",
        # daily rainfall (mm) in the focus district, 20 Jul -> 3 Aug
        "focus_rain": [35, 48, 60, 42, 55, 70, 85, 110, 160, 320, 140, 60, 30, 20, 12],
        # how much of the focus rain the other districts got
        "share": {"KL08": 0.70, "KL07": 0.65, "KL10": 0.60, "KL05": 0.55, "KL04": 0.50,
                  "KL03": 0.60, "KL06": 0.45, "KL02": 0.35, "KL01": 0.25},
    },
    {
        "id": "chennai_2015",
        "name": "Chennai Floods 2015",
        "state": "Tamil Nadu",
        "focus_district": "TN01",
        "start": "2015-11-15",          # 7 warm-up days + 14 replay days
        "event_time": "2015-12-01T20:00:00",
        "description": "Record rainfall on 1 December 2015 and the release of water "
                       "from Chembarambakkam lake flooded large parts of Chennai.",
        "focus_rain": [40, 120, 90, 30, 15, 10, 20, 60, 180, 345, 120, 40, 10, 5],
        "share": {"TN02": 0.90, "TN03": 1.05, "TN04": 0.80, "TN05": 0.40, "TN06": 0.20,
                  "TN07": 0.30, "TN08": 0.15, "TN09": 0.25},
    },
]


def make_event(event):
    start = date.fromisoformat(event["start"])
    focus = np.array(event["focus_rain"], dtype=float)
    n = 7 + len(focus) + 1                             # warm-up + replay + 1 for target
    dates = [start + timedelta(days=i) for i in range(n)]
    rows = []
    for dist in DISTRICTS:
        did, _, state, _, _, _, factor = dist
        if state != event["state"]:
            continue
        share = 1.0 if did == event["focus_district"] else event["share"].get(did, 0.3)
        warmup = rng.gamma(2, 8, 7) * share
        tail = [focus[-1] * 0.8]
        rain = np.concatenate([warmup, focus * share * rng.uniform(0.85, 1.15, len(focus)), tail])
        normals = np.array([daily_normal(state, d.month, factor) for d in dates])
        z = np.clip(np.log((rain + 0.5) / (normals + 0.5)), -2.5, 3.5) * 0.8   # storm strength
        rows += build_feature_rows(dates, rain, z, dist, noise_scale=0.8, nwp_error=0.35)
    df = pd.DataFrame(rows)
    df.to_csv(EVENTS_DIR / f"{event['id']}.csv", index=False)
    meta = {k: v for k, v in event.items() if k not in ("focus_rain", "share")}
    meta["replay_start"] = df["date"].min()
    meta["replay_end"] = df["date"].max()
    return meta


# ------------------------------------------------------------------
# 6. Live scenario: a Bay of Bengal depression hitting north Tamil Nadu
#    (typical for October-November North-East monsoon)
# ------------------------------------------------------------------
SCENARIO_BOOST = {   # storm strength added on the forecast day (bigger = more rain)
    "TN01": 3.7, "TN02": 3.55, "TN03": 3.85, "TN04": 3.45, "TN05": 3.1, "TN07": 2.8,
    "TN06": 2.1, "KL01": 3.35, "KL03": 2.45, "KL02": 2.6, "KL04": 1.9, "KL05": 1.4,
    "AS08": 3.25, "MH04": 1.5,
}


def make_scenario(today):
    """Rows for lead day 1, 2, 3 (issued today at 08:30 IST) for every district."""
    n = 30
    dates = [today - timedelta(days=n - 4) + timedelta(days=i) for i in range(n)]
    t_today = n - 4
    regional = {s: ar1(n, 0.75, 0.2) for s in MONTHLY_NORMAL}
    rows = []
    for dist in DISTRICTS:
        did, _, state, *_ = dist
        boost = np.zeros(n)
        strength = SCENARIO_BOOST.get(did, 0.0)
        boost[t_today:t_today + 4] = strength * np.array([0.6, 1.0, 0.85, 0.55])
        rain, z = simulate_rain(dates, dist, regional[state], boost, gamma_shape=12, local_sd=0.15)
        feats = build_feature_rows(dates, rain, z, dist, nwp_error=0.3)
        lead_rows = [r for r in feats if r["date"] >= today.isoformat()][:3]
        frac = rng.dirichlet(np.array([0.2, 0.35, 0.3, 0.15]) * 20)   # rain per 6-hour block
        for lead, r in enumerate(lead_rows, start=1):
            r["lead_day"] = lead
            r["issue_date"] = today.isoformat()
            for k, name in enumerate(["frac_0_6", "frac_6_12", "frac_12_18", "frac_18_24"]):
                r[name] = round(float(frac[k]), 3)
            rows.append(r)
    pd.DataFrame(rows).to_csv(DATA_DIR / "current_scenario.csv", index=False)


# ------------------------------------------------------------------
# 7. Shelters for the citizen app
# ------------------------------------------------------------------
def make_shelters():
    kinds = ["Govt. Higher Secondary School", "Community Relief Hall", "Multi-purpose Flood Shelter"]
    shelters = {}
    for did, name, state, lat, lon, *_ in DISTRICTS:
        shelters[did] = [{
            "name": f"{kind}, {name}",
            "lat": round(lat + rng.uniform(-0.08, 0.08), 4),
            "lon": round(lon + rng.uniform(-0.08, 0.08), 4),
            "capacity": int(rng.integers(2, 15)) * 100,
            "helpline": "1077",            # district disaster helpline in India
        } for kind in kinds]
    return shelters


# ------------------------------------------------------------------
# MAIN
# ------------------------------------------------------------------
def main():
    for folder in (DATA_DIR, DEM_DIR, EVENTS_DIR):
        folder.mkdir(parents=True, exist_ok=True)

    # District list + GeoJSON map shapes
    meta = [{"id": d[0], "name": d[1], "state": d[2], "lat": d[3], "lon": d[4],
             "elevation": d[5], "rain_factor": d[6]} for d in DISTRICTS]
    (DATA_DIR / "districts.json").write_text(json.dumps(meta, indent=2))
    features = [{"type": "Feature",
                 "properties": {"id": d[0], "name": d[1], "state": d[2]},
                 "geometry": {"type": "Polygon", "coordinates": [district_polygon(i)]}}
                for i, d in enumerate(DISTRICTS)]
    (DATA_DIR / "districts.geojson").write_text(json.dumps({"type": "FeatureCollection", "features": features}))
    print(f"Districts: {len(DISTRICTS)}")

    # 3 years of daily training data (2022-2024)
    start = date(2022, 1, 1)
    dates = [start + timedelta(days=i) for i in range((date(2024, 12, 31) - start).days + 1)]
    regional = {s: ar1(len(dates), 0.75, 0.7) for s in MONTHLY_NORMAL}   # one weather system per state
    rows = []
    for dist in DISTRICTS:
        rain, z = simulate_rain(dates, dist, regional[dist[2]])
        rows += build_feature_rows(dates, rain, z, dist)
    history = pd.DataFrame(rows)
    history.to_csv(DATA_DIR / "weather_history.csv", index=False)
    heavy = (history["rain_next_24h"] >= 64.5).mean() * 100
    print(f"weather_history.csv: {len(history)} rows, heavy-rain days: {heavy:.1f}%")

    # Live scenario, events, shelters, DEMs
    make_scenario(date.today())
    print("current_scenario.csv: done")
    events = [make_event(e) for e in EVENTS]
    (DATA_DIR / "events.json").write_text(json.dumps(events, indent=2))
    print(f"events: {[e['id'] for e in events]}")
    (DATA_DIR / "shelters.json").write_text(json.dumps(make_shelters(), indent=2))
    for dist in DISTRICTS:
        write_dem(dist)
    print(f"DEM GeoTIFFs: {len(DISTRICTS)} files in data/dem/")
    print("Sample data ready!")


if __name__ == "__main__":
    main()
