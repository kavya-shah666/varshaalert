"""
config.py - Settings shared by the whole backend.

Every other file imports paths, rainfall thresholds and the
risk_level() function from here, so we change them in ONE place.
"""
from pathlib import Path

# ---------- Folder paths ----------
BASE_DIR = Path(__file__).resolve().parent.parent   # .../backend
DATA_DIR = BASE_DIR / "data"                         # generated sample data
DEM_DIR = DATA_DIR / "dem"                           # elevation GeoTIFF files
EVENTS_DIR = DATA_DIR / "events"                     # historical flood events
MODELS_DIR = BASE_DIR / "models"                     # trained ML models
DB_PATH = DATA_DIR / "varshaalert.db"                # SQLite database file

# ---------- IMD 24-hour rainfall categories (mm) ----------
HEAVY = 64.5          # Heavy rainfall            -> Yellow
VERY_HEAVY = 115.6    # Very heavy rainfall       -> Orange
EXTREME = 204.5       # Extremely heavy rainfall  -> Red

# ---------- Features the ML model uses (same order everywhere) ----------
FEATURES = [
    "rain_1d",          # rainfall in the last 1 day (mm)        - IMD gauges / GPM IMERG
    "rain_3d",          # rainfall in the last 3 days (mm)
    "rain_7d",          # rainfall in the last 7 days (mm)
    "humidity",         # relative humidity (%)                  - AWS stations
    "temperature",      # air temperature (deg C)
    "pressure",         # mean sea level pressure (hPa)
    "wind_speed",       # wind speed (km/h)
    "cloud_top_temp",   # cloud-top brightness temp (K)          - INSAT-3D/3DR (MOSDAC)
    "radar_dbz",        # max radar reflectivity (dBZ)           - Doppler Weather Radar
    "nwp_rain",         # rainfall forecast by NWP model (mm)    - NCMRWF NCUM
    "month",            # month number 1-12 (season)
    "elevation",        # district elevation (m)                 - SRTM DEM / Bhuvan
]
TARGET = "rain_next_24h"   # what we predict: rainfall in the next 24 hours (mm)


def risk_level(rain_mm: float) -> str:
    """Convert predicted 24-hour rainfall into an IMD-style colour code."""
    if rain_mm >= EXTREME:
        return "red"
    if rain_mm >= VERY_HEAVY:
        return "orange"
    if rain_mm >= HEAVY:
        return "yellow"
    return "green"


# Text shown on the dashboard for each level
LEVEL_INFO = {
    "green":  {"label": "Normal",  "en": "GREEN - No warning",
               "desc": "No heavy rainfall expected"},
    "yellow": {"label": "Watch",   "en": "YELLOW WATCH",
               "desc": "Heavy rainfall (64.5-115.5 mm) likely"},
    "orange": {"label": "Alert",   "en": "ORANGE ALERT",
               "desc": "Very heavy rainfall (115.6-204.4 mm) likely"},
    "red":    {"label": "Warning", "en": "RED WARNING",
               "desc": "Extremely heavy rainfall (204.5 mm or more) likely"},
}
