"""
predict.py - Uses the trained models to make forecasts. The API calls these.

Main functions:
    predict_rows(df)          -> predicted rain, level, confidence for each row
    forecast_district(rows)   -> 6/12/24/48/72-hour forecast for one district
    accumulated_rain(...)     -> rain expected up to any hour (for flood map)
"""
import joblib
import numpy as np
import pandas as pd

from app.config import FEATURES, MODELS_DIR, risk_level

_models = {}   # loaded once, then reused (loading from disk is slow)

# Typical share of a day's rain in each 6-hour block after 08:30 IST
# (afternoon/evening thunderstorms carry the most rain)
DIURNAL_PROFILE = [0.20, 0.35, 0.30, 0.15]
LEAD_HOURS = [6, 12, 24, 48, 72]


def load_models():
    if not _models:
        _models["reg"] = joblib.load(MODELS_DIR / "rain_regressor.joblib")
        _models["clf"] = joblib.load(MODELS_DIR / "heavy_classifier.joblib")
    return _models["reg"], _models["clf"]


def predict_rows(df: pd.DataFrame) -> pd.DataFrame:
    """Add predicted_rain, heavy_prob, level and confidence columns to df."""
    reg, clf = load_models()
    X = df[FEATURES]
    out = df.copy()
    out["predicted_rain"] = reg.predict(X).round(1)
    out["heavy_prob"] = clf.predict_proba(X)[:, 1].round(3)
    out["level"] = [risk_level(v) for v in out["predicted_rain"]]

    # Confidence = how many of the 100 trees agree on the same colour level.
    # e.g. 87 trees say "red" -> 87% confidence.
    tree_preds = np.stack([tree.predict(X.values) for tree in reg.estimators_])  # (trees, rows)
    confidence = []
    for i, level in enumerate(out["level"]):
        votes = [risk_level(v) for v in tree_preds[:, i]]
        confidence.append(round(votes.count(level) / len(votes), 2))
    out["confidence"] = confidence
    return out


def _lags(series):
    """rain_1d, rain_3d, rain_7d from a list of daily rain (last item = today)."""
    return series[-1], sum(series[-3:]), sum(series[-7:])


def forecast_district(rows: pd.DataFrame) -> dict:
    """Forecast for the next 3 days for ONE district.

    rows = 3 rows from current_scenario.csv (lead_day 1, 2, 3).
    Day 2 and day 3 use OUR OWN predicted rain as their 'past rain' inputs
    (because that rain has not happened yet) - this is called rolling forecasting."""
    rows = rows.sort_values("lead_day").reset_index(drop=True).copy()
    first = rows.iloc[0]
    # Rebuild approximate daily rain for the past 7 days from the 1/3/7-day totals
    past = ([(first.rain_7d - first.rain_3d) / 4] * 4 +
            [(first.rain_3d - first.rain_1d) / 2] * 2 + [first.rain_1d])

    days = []
    for i in range(len(rows)):
        if i > 0:   # replace past-rain features with our rolling series
            rows.loc[i, ["rain_1d", "rain_3d", "rain_7d"]] = _lags(past)
        p = predict_rows(rows.iloc[[i]]).iloc[0]
        past.append(float(p.predicted_rain))
        days.append({"day": i + 1, "predicted": float(p.predicted_rain), "actual": float(p.rain_next_24h),
                     "level": p.level, "confidence": float(p.confidence), "heavy_prob": float(p.heavy_prob)})

    pred_daily = [d["predicted"] for d in days]
    actual_daily = [d["actual"] for d in days]
    actual_profile = [float(first[c]) for c in ["frac_0_6", "frac_6_12", "frac_12_18", "frac_18_24"]]
    leads = [{"hour": h,
              "predicted": round(accumulated_rain(h, pred_daily, DIURNAL_PROFILE), 1),
              "actual": round(accumulated_rain(h, actual_daily, actual_profile), 1)} for h in LEAD_HOURS]
    return {"issue_date": first.issue_date, "days": days, "leads": leads,
            "level": days[0]["level"], "predicted_24h": days[0]["predicted"],
            "confidence": days[0]["confidence"], "heavy_prob": days[0]["heavy_prob"]}


def accumulated_rain(hour, daily, profile=DIURNAL_PROFILE):
    """Total rain (mm) from now (08:30 IST) until `hour` hours later.
    Day 1 is split into 6-hour blocks using `profile`; days 2-3 are spread evenly."""
    total = 0.0
    for d, amount in enumerate(daily):
        start = d * 24
        if hour <= start:
            break
        hours_in_day = min(hour - start, 24)
        if d == 0:
            for b, share in enumerate(profile):
                covered = min(max(hours_in_day - b * 6, 0), 6)  # hours of this block that passed
                total += amount * share * covered / 6
        else:
            total += amount * hours_in_day / 24
    return total
