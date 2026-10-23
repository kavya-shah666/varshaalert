"""
database.py - Small SQLite database (a single file: data/varshaalert.db).

Tables:
    alerts         - every alert an official sends
    subscriptions  - citizens/devices that subscribed to alerts
    predictions    - forecasts made by the model (history / audit)
"""
import json
import sqlite3
from contextlib import contextmanager
from datetime import datetime

from app.config import DB_PATH


@contextmanager
def get_conn():
    """Open the database, save changes, and always close it again.
    Use it like:  with get_conn() as conn: ..."""
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row      # rows behave like dictionaries
    try:
        yield conn
        conn.commit()
    finally:
        conn.close()


def init_db():
    with get_conn() as conn:
        conn.executescript("""
        CREATE TABLE IF NOT EXISTS alerts (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            created_at TEXT, district_id TEXT, district_name TEXT, state TEXT,
            level TEXT, message_en TEXT, message_hi TEXT, message_regional TEXT,
            regional_language TEXT, sms_status TEXT, push_count INTEGER, status TEXT
        );
        CREATE TABLE IF NOT EXISTS subscriptions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            created_at TEXT, district_id TEXT, client_id TEXT, subscription TEXT
        );
        CREATE TABLE IF NOT EXISTS predictions (
            issue_date TEXT, district_id TEXT, lead_day INTEGER,
            predicted_rain REAL, level TEXT, confidence REAL,
            PRIMARY KEY (issue_date, district_id, lead_day)
        );
        """)


def now():
    return datetime.now().isoformat(timespec="seconds")


# ---------- predictions ----------
def save_predictions(issue_date, district_id, days):
    with get_conn() as conn:
        conn.executemany(
            "INSERT OR REPLACE INTO predictions VALUES (?, ?, ?, ?, ?, ?)",
            [(issue_date, district_id, d["day"], d["predicted"], d["level"], d["confidence"]) for d in days])


# ---------- alerts ----------
def add_alert(a: dict) -> int:
    with get_conn() as conn:
        cur = conn.execute(
            """INSERT INTO alerts (created_at, district_id, district_name, state, level, message_en,
               message_hi, message_regional, regional_language, sms_status, push_count, status)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            (now(), a["district_id"], a["district_name"], a["state"], a["level"], a["message_en"],
             a["message_hi"], a["message_regional"], a["regional_language"], a["sms_status"],
             a["push_count"], a["status"]))
        return cur.lastrowid


def list_alerts(limit=50, after_id=0, district_id=None):
    sql = "SELECT * FROM alerts WHERE id > ?"
    params = [after_id]
    if district_id:
        sql += " AND district_id = ?"
        params.append(district_id)
    sql += " ORDER BY id DESC LIMIT ?"
    params.append(limit)
    with get_conn() as conn:
        return [dict(r) for r in conn.execute(sql, params)]


def alerts_today_count():
    today = datetime.now().date().isoformat()
    with get_conn() as conn:
        return conn.execute("SELECT COUNT(*) FROM alerts WHERE created_at LIKE ?", (today + "%",)).fetchone()[0]


# ---------- subscriptions ----------
def add_subscription(district_id, client_id, subscription=None):
    with get_conn() as conn:
        conn.execute("DELETE FROM subscriptions WHERE client_id = ?", (client_id,))   # one per device
        conn.execute("INSERT INTO subscriptions (created_at, district_id, client_id, subscription) VALUES (?, ?, ?, ?)",
                     (now(), district_id, client_id, json.dumps(subscription) if subscription else None))


def count_subscriptions(district_id):
    with get_conn() as conn:
        return conn.execute("SELECT COUNT(*) FROM subscriptions WHERE district_id = ?", (district_id,)).fetchone()[0]
