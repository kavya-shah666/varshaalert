"""
train.py - Trains the two ML models and saves them + their accuracy metrics.

  1. Rainfall REGRESSOR  -> predicts how many mm of rain in the next 24 hours
  2. Heavy-rain CLASSIFIER -> predicts YES/NO "heavy rain (>= 64.5 mm) tomorrow?"

Both are Random Forests: many decision trees that each make a guess,
and the forest takes the average (regressor) or the majority vote (classifier).

We train on 2022-2023 and TEST on 2024 (data the model has never seen),
so the accuracy numbers are honest.

Run (from the backend folder):
    python -m ml.train
"""
import json

import joblib
import numpy as np
import pandas as pd
from sklearn.ensemble import RandomForestClassifier, RandomForestRegressor
from sklearn.metrics import (accuracy_score, confusion_matrix, f1_score, mean_absolute_error,
                             mean_squared_error, precision_score, r2_score, recall_score)

from app.config import DATA_DIR, FEATURES, HEAVY, MODELS_DIR, TARGET, risk_level

LEVELS = ["green", "yellow", "orange", "red"]


def main():
    MODELS_DIR.mkdir(exist_ok=True)

    # ---- 1. Load data and split by time ----
    df = pd.read_csv(DATA_DIR / "weather_history.csv")
    train = df[df["date"] < "2024-01-01"]
    test = df[df["date"] >= "2024-01-01"]
    X_train, y_train = train[FEATURES], train[TARGET]
    X_test, y_test = test[FEATURES], test[TARGET]
    print(f"Training rows: {len(train)}, testing rows: {len(test)}")

    # ---- 2. Rainfall regressor ----
    reg = RandomForestRegressor(n_estimators=100, max_depth=16, min_samples_leaf=3,
                                n_jobs=-1, random_state=42)
    reg.fit(X_train, y_train)
    pred = reg.predict(X_test)
    rmse = float(np.sqrt(mean_squared_error(y_test, pred)))
    mae = float(mean_absolute_error(y_test, pred))
    r2 = float(r2_score(y_test, pred))
    # Baseline: how good is the raw NWP forecast alone? (shows the value ML adds)
    nwp_rmse = float(np.sqrt(mean_squared_error(y_test, X_test["nwp_rain"])))
    print(f"Regressor  RMSE={rmse:.2f} mm  MAE={mae:.2f} mm  R2={r2:.3f}  (raw NWP RMSE={nwp_rmse:.2f})")

    # ---- 3. Heavy-rain classifier ----
    # Heavy rain is rare, so class_weight="balanced_subsample" makes the
    # model pay extra attention to the few heavy-rain days.
    clf = RandomForestClassifier(n_estimators=100, max_depth=12, min_samples_leaf=3,
                                 class_weight="balanced_subsample", n_jobs=-1, random_state=42)
    clf.fit(X_train, y_train >= HEAVY)
    y_true_cls = y_test >= HEAVY
    y_pred_cls = clf.predict(X_test)
    cm = confusion_matrix(y_true_cls, y_pred_cls, labels=[False, True])
    precision = float(precision_score(y_true_cls, y_pred_cls))
    recall = float(recall_score(y_true_cls, y_pred_cls))
    f1 = float(f1_score(y_true_cls, y_pred_cls))
    accuracy = float(accuracy_score(y_true_cls, y_pred_cls))
    print(f"Classifier precision={precision:.2f} recall={recall:.2f} F1={f1:.2f} accuracy={accuracy:.3f}")

    # ---- 4. Colour-level confusion matrix (Green/Yellow/Orange/Red) ----
    true_levels = [risk_level(v) for v in y_test]
    pred_levels = [risk_level(v) for v in pred]
    level_cm = confusion_matrix(true_levels, pred_levels, labels=LEVELS)

    # ---- 5. Feature importance (which inputs matter most) ----
    importance = sorted(
        [{"feature": f, "importance": round(float(i), 4)} for f, i in zip(FEATURES, reg.feature_importances_)],
        key=lambda d: d["importance"], reverse=True)

    # ---- 6. Points for the Predicted-vs-Actual scatter plot ----
    # all heavy-rain days + 500 random normal days (to keep the chart light)
    sample = test.assign(predicted=pred)
    sample = pd.concat([sample[sample[TARGET] >= HEAVY],
                        sample[sample[TARGET] < HEAVY].sample(500, random_state=1)])
    scatter = [{"actual": float(a), "predicted": round(float(p), 1)}
               for a, p in zip(sample[TARGET], sample["predicted"])]

    # ---- 7. Save models and metrics ----
    joblib.dump(reg, MODELS_DIR / "rain_regressor.joblib", compress=3)
    joblib.dump(clf, MODELS_DIR / "heavy_classifier.joblib", compress=3)
    metrics = {
        "trained_on": "2022-01-01 to 2023-12-31",
        "tested_on": "2024-01-01 to 2024-12-31",
        "train_rows": len(train), "test_rows": len(test),
        "features": FEATURES,
        "regression": {"rmse": round(rmse, 2), "mae": round(mae, 2), "r2": round(r2, 3),
                       "nwp_baseline_rmse": round(nwp_rmse, 2),
                       "improvement_over_nwp_pct": round((1 - rmse / nwp_rmse) * 100, 1)},
        "classification": {"threshold_mm": HEAVY, "precision": round(precision, 3),
                           "recall": round(recall, 3), "f1": round(f1, 3), "accuracy": round(accuracy, 4),
                           "confusion_matrix": cm.tolist(), "labels": ["No heavy rain", "Heavy rain"]},
        "level_confusion": {"labels": LEVELS, "matrix": level_cm.tolist()},
        "feature_importance": importance,
        "scatter": scatter,
    }
    (MODELS_DIR / "metrics.json").write_text(json.dumps(metrics, indent=2))
    print("Saved models/rain_regressor.joblib, models/heavy_classifier.joblib, models/metrics.json")


if __name__ == "__main__":
    main()
