"""
inundation.py - Predicts which areas of a district may flood.

Simple, explainable logic (a 'bathtub' style model):
  1. Read the district's DEM (elevation grid) with rasterio.
  2. The first 50 mm of rain soaks into the soil (infiltration).
  3. Extra rain (runoff) flows downhill and collects in valleys and river beds,
     so the water level rises above the LOWEST NEARBY ground (within ~3 km).
     (This idea is called HAND - Height Above Nearest Drainage.)
  4. Depth = (water level - height of the cell above nearby lowest ground) x flatness.
     Steep slopes drain quickly, so they hold less water.

Result: GeoJSON squares (one per grid cell) with a 'depth' in metres,
which the map draws in blue (darker = deeper).
"""
import json
from functools import lru_cache

import numpy as np
import rasterio

from app.config import DATA_DIR, DEM_DIR

# District boundaries, so we only show flooding INSIDE the selected district
BOUNDARIES = {f["properties"]["id"]: np.array(f["geometry"]["coordinates"][0])
              for f in json.loads((DATA_DIR / "districts.geojson").read_text())["features"]}

INFILTRATION_MM = 50      # soil absorbs this much rain before runoff starts
CONCENTRATION = 12        # runoff from the whole area collects in low land (x12)
MAX_DEPTH_M = 3.0


def inside_polygon(xs, ys, polygon):
    """Ray-casting test: True for every point (x, y) that lies inside the polygon.
    Imagine a line going right from the point: an odd number of edge crossings = inside."""
    inside = np.zeros(xs.shape, dtype=bool)
    for (x1, y1), (x2, y2) in zip(polygon[:-1], polygon[1:]):
        crosses = ((y1 > ys) != (y2 > ys)) & (xs < (x2 - x1) * (ys - y1) / (y2 - y1 + 1e-12) + x1)
        inside ^= crosses
    return inside


@lru_cache(maxsize=64)
def read_dem(district_id):
    """Read a DEM GeoTIFF once and keep it in memory, plus a mask of the
    cells that are inside the district boundary."""
    with rasterio.open(DEM_DIR / f"{district_id}.tif") as f:
        dem = f.read(1).astype(float)
        transform = f.transform
    rows, cols = np.indices(dem.shape)
    xs, ys = transform * (cols + 0.5, rows + 0.5)          # centre of every cell (lon, lat)
    mask = inside_polygon(xs, ys, BOUNDARIES[district_id])
    return dem, transform, mask


def local_minimum(dem, radius=6):
    """For every cell, the lowest elevation within `radius` cells around it."""
    padded = np.pad(dem, radius, mode="edge")
    low = np.full_like(dem, np.inf)
    rows, cols = dem.shape
    for dy in range(2 * radius + 1):
        for dx in range(2 * radius + 1):
            low = np.minimum(low, padded[dy:dy + rows, dx:dx + cols])
    return low


def flood_depth(dem, cell_m, rain_mm):
    """Water depth (m) for every cell, given total rain so far."""
    height = dem - local_minimum(dem)                                  # metres above nearby drainage
    dy, dx = np.gradient(dem, cell_m)
    slope_deg = np.degrees(np.arctan(np.hypot(dx, dy)))
    flatness = 1 / (1 + slope_deg / 2)                                 # 1 = completely flat
    runoff_m = max(0.0, rain_mm - INFILTRATION_MM) / 1000              # mm -> metres
    water_level = runoff_m * CONCENTRATION                             # metres above lowest point
    depth = (water_level - height) * flatness
    return np.clip(depth, 0, MAX_DEPTH_M)


def inundation_geojson(district_id, rain_mm):
    dem, transform, mask = read_dem(district_id)
    res = transform.a                       # cell size in degrees
    cell_m = res * 111_000                  # 1 degree ~ 111 km
    depth = flood_depth(dem, cell_m, rain_mm) * mask    # 0 outside the district

    features = []
    rows, cols = np.nonzero(depth > 0.05)
    for r, c in zip(rows, cols):
        west, north = transform * (c, r)    # top-left corner of the cell
        east, south = west + res, north - res
        features.append({
            "type": "Feature",
            "properties": {"depth": round(float(depth[r, c]), 2),
                           "elevation": round(float(dem[r, c]), 1)},
            "geometry": {"type": "Polygon", "coordinates": [[
                [west, north], [east, north], [east, south], [west, south], [west, north]]]},
        })
    cell_km2 = (cell_m / 1000) ** 2
    return {
        "type": "FeatureCollection",
        "features": features,
        "stats": {
            "rain_mm": round(rain_mm, 1),
            "flooded_cells": len(features),
            "flooded_area_km2": round(len(features) * cell_km2, 1),
            "total_area_km2": round(float(mask.sum()) * cell_km2, 1),
            "cell_area_km2": round(cell_km2, 2),
            "max_depth_m": round(float(depth.max()), 2),
        },
    }
