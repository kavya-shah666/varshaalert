# 🌧️ VarshaAlert – Heavy Rainfall Early Warning & Inundation Prediction

**Smart India Hackathon · Problem Statement SIH26071 · Ministry of Earth Sciences (MoES)**

> AI/ML-based integrated heavy rainfall early warning and inundation prediction system using
> satellite, radar, observational weather and numerical weather prediction (NWP) model data.

*Varsha* (वर्षा) means *rain*. VarshaAlert predicts heavy rainfall for every district, converts it
into IMD colour codes (🟢 Green / 🟡 Yellow / 🟠 Orange / 🔴 Red), predicts which low-lying areas may
flood, and sends alerts to citizens by SMS and mobile-app notification in English, Hindi and the
regional language.

---

## ✨ Features

| # | Feature | Page |
|---|---------|------|
| 1 | **Live Risk Map** – districts coloured by IMD risk level, popup with rain (mm), level, confidence, state filter | `/` |
| 2 | **Rainfall Forecast Graph** – predicted vs actual for +6/12/24/48/72 h with IMD thresholds 64.5 / 115.6 / 204.5 mm | `/` |
| 3 | **Inundation Map** – blue flood cells (darker = deeper) from rain + DEM elevation/slope, 0–72 h slider | `/inundation` |
| 4 | **Alert Panel** – pick districts, auto message in English + Hindi + regional, *Send Alert* → Twilio SMS + app notification, history | `/alerts` |
| 5 | **Model Accuracy** – RMSE, MAE, R², confusion matrices, precision/recall/F1, feature importance, scatter plot (from the real trained model) | `/accuracy` |
| 6 | **Historical Replay** – Wayanad landslides 2024 & Chennai floods 2015, day-by-day, with computed warning lead time | `/replay` |
| 7 | **Citizen App (PWA)** – installable on phones: big risk colour, 3-day outlook, Do's & Don'ts, shelters, subscribe to alerts | `/citizen` |
| 8 | **Architecture page** – data-flow diagram and tech stack | `/about` |

**Key results (on 2024 test data the model never saw):**
- Rainfall model R² = **0.78**, **31 % lower error than the raw NWP forecast**
- Heavy-rain classifier recall = **89 %** (catches 9 out of 10 heavy-rain days)
- Historical replay: would have warned **Wayanad 66 hours** and **Chennai 36 hours** before the disaster

---

## 🧰 Tech stack

| Part | Technology |
|------|------------|
| Frontend | React + Vite, Tailwind CSS, react-leaflet (maps), recharts (graphs), react-router-dom |
| Mobile | PWA with vite-plugin-pwa (installable, offline cache, notifications) |
| Backend | Python FastAPI + Uvicorn |
| ML | pandas, numpy, scikit-learn (Random Forest), joblib |
| Geo | rasterio (DEM GeoTIFF), GeoJSON |
| Alerts | Twilio SMS (falls back to **demo mode** without keys) |
| Database | SQLite |

---

## 🚀 Setup and run (Windows)

You need **Python 3.10+** and **Node.js 18+** installed.

### 1. Backend (open a terminal in the `backend` folder)

```bash
cd backend
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
```

> If `activate` is blocked in PowerShell, run once:
> `Set-ExecutionPolicy -Scope CurrentUser RemoteSigned`

**Phase 1 – create the sample data** (already included, run again any time):

```bash
python -m scripts.generate_sample_data
```

**Phase 2 – train the ML models** (already included, run again after changing data):

```bash
python -m ml.train
```

**Phase 3 – start the API server:**

```bash
uvicorn app.main:app --reload
```

Open <http://localhost:8000/docs> to see and try every API.

### 2. Frontend (open a SECOND terminal in the `frontend` folder)

```bash
cd frontend
npm install
npm run dev
```

Open <http://localhost:5173> 🎉 (keep both terminals running).

### 3. Open the citizen app on your phone

1. Connect the phone and laptop to the **same Wi-Fi**.
2. `npm run dev` prints a *Network* address such as `http://192.168.1.5:5173` – open
   `http://192.168.1.5:5173/citizen` on the phone.
3. Allow Windows Firewall access for Node.js if asked.

> Browsers only allow **installing** the app and **system notifications** on `https://` or `localhost`.
> Over plain Wi-Fi (`http://192.168...`) the phone still gets the alert as a **red banner + vibration**
> inside the app. For full install + notifications, deploy the frontend on an HTTPS host
> (e.g. Vercel/Netlify) and the backend on Render/Railway.

### 🌐 Put it online for anyone to open

See **[DEPLOY.md](DEPLOY.md)** – free hosting on GitHub + Render (backend) + Vercel (website),
so friends and mentors just open a link.

### 4. Real SMS with Twilio (optional)

1. Create a free account at <https://www.twilio.com/try-twilio> and get a trial phone number.
2. In the Twilio console, **verify** the phone number(s) that should receive SMS (trial accounts can only send to verified numbers).
3. Copy `backend/.env.example` to `backend/.env` and fill in:
   ```
   TWILIO_ACCOUNT_SID=ACxxxxxxxx
   TWILIO_AUTH_TOKEN=xxxxxxxx
   TWILIO_FROM_NUMBER=+1xxxxxxxxxx
   ALERT_PHONE_NUMBERS=+91XXXXXXXXXX
   ```
4. Restart the backend. The Alert Panel banner "Demo mode" disappears and *Send Alert* sends real SMS.

Never share or commit your `.env` file – it contains secret keys.

---

## 🎤 Demo script for mentors / judges (≈ 5 minutes)

1. **Live Risk Map** – "A depression from the Bay of Bengal is hitting north Tamil Nadu. Our model
   puts Chennai and Tiruvallur on **Red**." Click Chennai → show the popup and forecast graph.
2. **Inundation Map** – choose Chennai, press **▶ Play** → blue flood areas spread from 0 to 72 h.
3. **Historical Replay** – choose *Wayanad Landslides 2024*, press **▶ Play** → map turns orange on
   27 July → "**VarshaAlert would have warned 66 hours in advance.**"
4. **Alert Panel** (big moment) – open `/citizen` on a phone (subscribe to Chennai), then click
   **📢 SEND ALERT** → the phone receives the alert (SMS with Twilio, and in-app alert).
5. **Model Accuracy** – show R² 0.78, 89 % recall, confusion matrix → "the ML is real".
6. **About** – walk through the data-flow diagram.

---

## 📁 Project structure – what every file does

```
VarshaAlert/
├── README.md                     ← this file
├── backend/
│   ├── requirements.txt          ← Python libraries to install
│   ├── .env.example              ← template for Twilio keys (copy to .env)
│   ├── scripts/
│   │   └── generate_sample_data.py ← PHASE 1: creates all sample data (districts, weather, DEMs, events)
│   ├── ml/
│   │   ├── train.py              ← PHASE 2: trains the 2 Random Forest models, saves metrics
│   │   └── predict.py            ← uses the models: forecasts, confidence, rolling 3-day forecast
│   ├── app/
│   │   ├── config.py             ← paths, IMD thresholds, feature list, risk_level() function
│   │   ├── main.py               ← PHASE 3: FastAPI server with all /api endpoints
│   │   ├── database.py           ← SQLite tables: alerts, subscriptions, predictions
│   │   ├── alerts.py             ← alert text (EN + HI + regional) and Twilio SMS sending
│   │   └── inundation.py         ← flood model: DEM + rainfall → flooded cells (GeoJSON)
│   ├── data/                     ← generated data (CSV, GeoJSON, GeoTIFF, SQLite)
│   └── models/                   ← trained models (.joblib) + metrics.json
└── frontend/
    ├── vite.config.js            ← dev server, /api proxy to FastAPI, PWA settings
    ├── index.html                ← the single HTML page React runs in
    ├── public/                   ← app icons (favicon.svg, icon-192.png, icon-512.png)
    └── src/
        ├── main.jsx              ← starts React + router
        ├── App.jsx               ← which page shows for which URL
        ├── api.js                ← getJSON / postJSON helpers to call the backend
        ├── constants.js          ← IMD colours, thresholds, state list, date formatting
        ├── index.css             ← Tailwind + small custom styles
        ├── components/
        │   ├── Layout.jsx        ← dark sidebar + top bar with live IST clock
        │   ├── RiskMap.jsx       ← Leaflet map coloured by risk level (used on 3 pages)
        │   ├── SummaryCards.jsx  ← Red/Orange/Yellow/Green counts + alerts today
        │   ├── ForecastChart.jsx ← 6–72 h predicted vs actual line chart
        │   ├── PhoneMockup.jsx   ← drawn phone showing the alert notification
        │   └── Common.jsx        ← Card, LevelBadge, Legend, Stat, ErrorBox
        └── pages/
            ├── Dashboard.jsx     ← Feature 1 + 2 (home page)
            ├── Inundation.jsx    ← Feature 3
            ├── Alerts.jsx        ← Feature 4
            ├── Accuracy.jsx      ← Feature 5
            ├── Replay.jsx        ← Feature 6
            ├── Citizen.jsx       ← Feature 7 (mobile PWA)
            └── About.jsx         ← Feature 8
```

---

## 🧠 How it works (simple explanation)

**1. Data (12 inputs per district per day, at 08:30 IST)**

| Feature | Real source |
|---------|-------------|
| Rain in last 1 / 3 / 7 days | IMD rain gauges, NASA GPM IMERG |
| Humidity, temperature, pressure, wind | IMD automatic weather stations |
| Cloud-top temperature | INSAT-3D/3DR satellite (MOSDAC) – colder = taller storm clouds |
| Radar reflectivity (dBZ) | IMD Doppler Weather Radar |
| NWP rain forecast | NCMRWF NCUM model |
| Month, elevation | Calendar, SRTM DEM / Bhuvan |

**2. ML models** (`ml/train.py`) – two **Random Forests** (100 decision trees each):
- *Regressor* → how many mm of rain in the next 24 h
- *Classifier* → will it be heavy rain (≥ 64.5 mm)? Uses `class_weight="balanced"` because heavy-rain days are rare.
- Trained on 2022–2023, tested on 2024 (honest evaluation on unseen data).

**3. Risk level** – IMD rules: ≥ 64.5 mm Yellow, ≥ 115.6 mm Orange, ≥ 204.5 mm Red.
**Confidence** = % of the 100 trees that agree on the same colour.

**4. Rolling forecast** – for day 2 and 3, the model's own predicted rain is used as "past rain".

**5. Flood model** (`app/inundation.py`) – first 50 mm soaks into the soil; the rest flows into valleys
(HAND – Height Above Nearest Drainage). Low, flat cells near drainage flood first.

**6. Replay lead time** – find the last Orange/Red warning before the disaster and walk back through the
unbroken run of warning days; the first day of that run is when we would have warned.

---

## 🔄 Using real data later

The sample data uses the **same column names** as the real sources, so you only replace files:

| Replace this file | With real data from |
|-------------------|---------------------|
| `data/weather_history.csv` | IMD gridded rainfall + AWS + MOSDAC + radar + NCMRWF, one row per district per day |
| `data/current_scenario.csv` | Today's observations + NWP forecast for the next 3 days |
| `data/districts.geojson` | Real district boundaries (Survey of India / DataMeet) – keep the `id` property |
| `data/dem/<id>.tif` | SRTM 30 m DEM clipped to each district (Bhuvan / USGS EarthExplorer) |

Then run `python -m ml.train` again.

> **Honest note for the presentation:** this prototype runs on realistic **synthetic** data so the demo
> works offline. District shapes are approximate (they may extend over the sea on the coast). The historical replays follow the real rainfall pattern of the
> Wayanad (30 July 2024) and Chennai (1 December 2015) events, but the numbers are simulated.

---

## 🌐 API endpoints

| Method | URL | Returns |
|--------|-----|---------|
| GET | `/api/districts?state=Kerala` | GeoJSON of districts with risk level |
| GET | `/api/summary` | Counts per level + alerts today |
| GET | `/api/forecast/TN01` | 6–72 h forecast for one district |
| GET | `/api/inundation/TN01?hour=24` | Flood cells GeoJSON + stats |
| POST | `/api/alerts/preview` | Alert messages (not sent) |
| POST | `/api/alerts/send` | Sends SMS + push, saves to DB |
| GET | `/api/alerts` | Alert history |
| GET | `/api/metrics` | Model accuracy metrics |
| GET | `/api/events` | Historical events list |
| GET | `/api/replay/wayanad_2024` | Day-by-day replay + lead time |
| POST | `/api/subscribe` | Citizen subscribes to a district |
| GET | `/api/shelters/TN01` | Relief shelters |

---

## 🛠️ Troubleshooting

| Problem | Fix |
|---------|-----|
| Red box "Cannot reach the backend" | Start the backend: `cd backend` → `.venv\Scripts\activate` → `uvicorn app.main:app --reload` |
| `Model not trained yet` | Run `python -m ml.train` in the backend folder |
| `pip install` fails with a *long path* error | Move the project to a short path like `C:\VarshaAlert`, or enable Windows long paths |
| Map background is grey | The map tiles need internet. Coloured districts still work offline |
| Port 8000 / 5173 already in use | Close the other terminal running the server, or restart the PC |
| Old data after changing code | Hard refresh the browser (Ctrl+Shift+R) – the PWA caches pages |
