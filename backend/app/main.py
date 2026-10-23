"""
main.py - The FastAPI web server (the "backend").

The React dashboard calls these URLs to get data:
    GET  /api/districts?state=...      districts + risk level (GeoJSON)
    GET  /api/summary                  counts for the summary cards
    GET  /api/forecast/{id}            6-72 hour forecast for one district
    GET  /api/inundation/{id}?hour=..  flood map for one district
    POST /api/alerts/preview           alert text (no sending)
    POST /api/alerts/send              send SMS + push, save to database
    GET  /api/alerts                   alert history
    GET  /api/metrics                  ML model accuracy
    GET  /api/events                   list of historical events
    GET  /api/replay/{event_id}        day-by-day replay of a past event
    POST /api/subscribe                citizen subscribes to alerts
    GET  /api/shelters/{id}            relief shelters in a district

Run (from the backend folder):
    uvicorn app.main:app --reload
Then open http://localhost:8000/docs to try every API in the browser.
"""
import json
from datetime import datetime
from typing import Optional

import pandas as pd
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from app import alerts, database
from app.config import DATA_DIR, EVENTS_DIR, LEVEL_INFO, MODELS_DIR
from app.inundation import inundation_geojson
from ml.predict import accumulated_rain, forecast_district, predict_rows

app = FastAPI(title="VarshaAlert API", description="SIH26071 - Heavy rainfall early warning")

# CORS lets the React app (another port / phone on the same Wi-Fi) call this API
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

# ---------- Load data once when the server starts ----------
DISTRICTS = {d["id"]: d for d in json.loads((DATA_DIR / "districts.json").read_text())}
SHAPES = json.loads((DATA_DIR / "districts.geojson").read_text())
SCENARIO = pd.read_csv(DATA_DIR / "current_scenario.csv")
EVENTS = {e["id"]: e for e in json.loads((DATA_DIR / "events.json").read_text())}
SHELTERS = json.loads((DATA_DIR / "shelters.json").read_text())
FORECASTS = {}   # district_id -> forecast dict (filled at startup)


@app.on_event("startup")
def startup():
    """Create the database and run the ML model for every district."""
    database.init_db()
    for did in DISTRICTS:
        f = forecast_district(SCENARIO[SCENARIO["district_id"] == did])
        FORECASTS[did] = f
        database.save_predictions(f["issue_date"], did, f["days"])
    mode = "DEMO MODE (no Twilio keys)" if alerts.DEMO_MODE else "Twilio SMS enabled"
    print(f"VarshaAlert ready: {len(FORECASTS)} district forecasts, {mode}")


def get_district(district_id):
    if district_id not in DISTRICTS:
        raise HTTPException(404, f"Unknown district {district_id}")
    return DISTRICTS[district_id]


# ---------- Map + summary ----------
@app.get("/api/states")
def states():
    return sorted({d["state"] for d in DISTRICTS.values()})


@app.get("/api/districts")
def districts(state: Optional[str] = None):
    """District shapes + today's forecast, as GeoJSON for the Leaflet map."""
    features = []
    for feat in SHAPES["features"]:
        did = feat["properties"]["id"]
        d = DISTRICTS[did]
        if state and d["state"] != state:
            continue
        f = FORECASTS[did]
        props = {**d, "predicted_rain": f["predicted_24h"], "level": f["level"],
                 "level_label": LEVEL_INFO[f["level"]]["label"],
                 "confidence": f["confidence"], "heavy_prob": f["heavy_prob"]}
        features.append({**feat, "properties": props})
    return {"type": "FeatureCollection", "features": features,
            "issued_at": f"{SCENARIO['issue_date'].iloc[0]}T08:30:00"}


@app.get("/api/summary")
def summary(state: Optional[str] = None):
    counts = {"red": 0, "orange": 0, "yellow": 0, "green": 0}
    for did, f in FORECASTS.items():
        if not state or DISTRICTS[did]["state"] == state:
            counts[f["level"]] += 1
    return {"counts": counts, "alerts_today": database.alerts_today_count(),
            "issued_at": f"{SCENARIO['issue_date'].iloc[0]}T08:30:00",
            "demo_mode": alerts.DEMO_MODE}


# ---------- Forecast + inundation ----------
@app.get("/api/forecast/{district_id}")
def forecast(district_id: str):
    return {"district": get_district(district_id), **FORECASTS[district_id]}


@app.get("/api/inundation/{district_id}")
def inundation(district_id: str, hour: int = 24):
    get_district(district_id)
    hour = max(0, min(hour, 72))
    daily = [d["predicted"] for d in FORECASTS[district_id]["days"]]
    rain = accumulated_rain(hour, daily)
    result = inundation_geojson(district_id, rain)
    result["hour"] = hour
    return result


# ---------- Alerts ----------
class AlertRequest(BaseModel):
    district_ids: list[str]
    level: Optional[str] = None      # if empty, use the model's forecast level


def alert_level(req: AlertRequest, did):
    return req.level if req.level in LEVEL_INFO else FORECASTS[did]["level"]


@app.post("/api/alerts/preview")
def preview_alerts(req: AlertRequest):
    return [{"district_id": did, "district_name": get_district(did)["name"], "level": alert_level(req, did),
             **alerts.build_messages(DISTRICTS[did], alert_level(req, did))} for did in req.district_ids]


@app.post("/api/alerts/send")
def send_alerts(req: AlertRequest):
    if not req.district_ids:
        raise HTTPException(400, "Select at least one district")
    sent = []
    for did in req.district_ids:
        d = get_district(did)
        level = alert_level(req, did)
        msgs = alerts.build_messages(d, level)
        sms_status = alerts.send_sms(msgs["message_en"] + "\n" + msgs["message_hi"])
        push_count = database.count_subscriptions(did)
        record = {"district_id": did, "district_name": d["name"], "state": d["state"], "level": level,
                  **msgs, "sms_status": sms_status, "push_count": push_count,
                  "status": "failed" if sms_status.startswith("failed") else "delivered"}
        record["id"] = database.add_alert(record)
        record["created_at"] = database.now()
        sent.append(record)
    return {"demo_mode": alerts.DEMO_MODE, "alerts": sent}


@app.get("/api/alerts")
def alert_history(limit: int = 50, after_id: int = 0, district_id: Optional[str] = None):
    return database.list_alerts(limit, after_id, district_id)


@app.post("/api/subscribe")
def subscribe(body: dict):
    """body = {"district_id": "TN01", "client_id": "...", "subscription": {...optional push data}}"""
    did = body.get("district_id")
    get_district(did)
    database.add_subscription(did, body.get("client_id", "anonymous"), body.get("subscription"))
    return {"ok": True, "district": DISTRICTS[did]["name"], "subscribers": database.count_subscriptions(did)}


@app.get("/api/shelters/{district_id}")
def shelters(district_id: str):
    get_district(district_id)
    return SHELTERS.get(district_id, [])


# ---------- Model metrics ----------
@app.get("/api/metrics")
def metrics():
    path = MODELS_DIR / "metrics.json"
    if not path.exists():
        raise HTTPException(404, "Model not trained yet. Run: python -m ml.train")
    return json.loads(path.read_text())


# ---------- Historical replay ----------
@app.get("/api/events")
def events():
    return list(EVENTS.values())


@app.get("/api/replay/{event_id}")
def replay(event_id: str):
    """Run today's model on a past event, day by day, and find when it
    would have first raised an Orange/Red warning for the affected district."""
    if event_id not in EVENTS:
        raise HTTPException(404, "Unknown event")
    event = EVENTS[event_id]
    df = predict_rows(pd.read_csv(EVENTS_DIR / f"{event_id}.csv"))
    event_time = datetime.fromisoformat(event["event_time"])

    days = []
    focus_days = []        # forecasts for the affected district issued before the event
    for date, group in df.groupby("date"):
        issue_time = datetime.fromisoformat(f"{date}T08:30:00")   # IMD issues forecasts at 08:30 IST
        day = {"date": date, "issue_time": issue_time.isoformat(), "districts": []}
        for _, r in group.iterrows():
            day["districts"].append({
                "id": r.district_id, "name": DISTRICTS[r.district_id]["name"],
                "observed_today": float(r.rain_today), "predicted_next_24h": float(r.predicted_rain),
                "actual_next_24h": float(r.rain_next_24h), "level": r.level,
                "confidence": float(r.confidence)})
            if r.district_id == event["focus_district"] and issue_time < event_time:
                focus_days.append({"date": date, "issue_time": issue_time.isoformat(), "level": r.level,
                                   "predicted": float(r.predicted_rain)})
        days.append(day)

    # Find the LAST Orange/Red warning before the event, then walk back through
    # the unbroken run of warning days -> the first day of that run is when we
    # would have first warned (older, unrelated warnings don't count).
    first_warning = None
    warned = [i for i, d in enumerate(focus_days) if d["level"] in ("orange", "red")]
    if warned:
        i = warned[-1]
        while i > 0 and focus_days[i - 1]["level"] in ("orange", "red"):
            i -= 1
        first_warning = focus_days[i]

    lead_hours = None
    if first_warning:
        lead_hours = round((event_time - datetime.fromisoformat(first_warning["issue_time"])).total_seconds() / 3600, 1)
    focus_name = DISTRICTS[event["focus_district"]]["name"]
    message = (f"VarshaAlert would have warned {focus_name} {lead_hours:.0f} hours in advance "
               f"({first_warning['level'].upper()} level on {first_warning['date']})."
               if first_warning else "No Orange/Red warning would have been issued before the event.")
    return {"event": event, "days": days, "first_warning": first_warning,
            "lead_hours": lead_hours, "message": message}


@app.get("/api/health")
def health():
    return {"status": "ok", "districts": len(DISTRICTS), "demo_mode": alerts.DEMO_MODE}
