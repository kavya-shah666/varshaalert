# 🌐 Put VarshaAlert online (free)

After these steps anyone can open VarshaAlert with a link like **https://varshaalert.vercel.app** –
no Python, no Node.js, nothing to install. Works on laptops and phones.

```
 Your laptop ──git push──►  GitHub  ──►  Render  (backend: FastAPI + ML)   https://varshaalert-api.onrender.com
                                     └─►  Vercel  (frontend: React website)  https://varshaalert.vercel.app
```

| Service | What it hosts | Cost |
|---------|---------------|------|
| GitHub | Your code | Free |
| Render | Python backend (`backend/`) | Free plan |
| Vercel | React website (`frontend/`) | Free (Hobby) plan |

Total time the first time: about **30–45 minutes**.

---

## Step 1 – Put the code on GitHub

1. Create a free account at <https://github.com/signup> (skip if you have one).
2. Click **+ → New repository**.
   - Name: `varshaalert`
   - Choose **Public** (easy to show judges) or **Private** (only you) – both work.
   - **Do NOT** tick "Add a README" (the project already has one).
   - Click **Create repository**.
3. Open a terminal **inside the `VarshaAlert` folder** and run (replace `YOUR-USERNAME`):

```bash
git remote add origin https://github.com/YOUR-USERNAME/varshaalert.git
```
```bash
git push -u origin main
```

A browser window opens to log in to GitHub the first time – log in and allow it.
Refresh the GitHub page: you should see the `backend`, `frontend` folders and the README.

---

## Step 2 – Put the backend on Render

1. Go to <https://render.com> → **Get Started** → **Sign up with GitHub**.
2. Click **New + → Blueprint**.
3. Connect your GitHub account if asked, then pick the **varshaalert** repository.
4. Render finds `render.yaml` and shows a service called **varshaalert-api**. Click **Apply / Deploy**.
5. Wait 5–10 minutes (it installs pandas, scikit-learn, rasterio…). When the log says
   `VarshaAlert ready: 35 district forecasts` it is live.
6. Copy the address at the top of the service page, e.g. `https://varshaalert-api.onrender.com`
   (yours may have extra letters if the name was taken).
7. Test it: open `https://YOUR-RENDER-ADDRESS/api/health` → you should see `{"status":"ok",...}`.

<details>
<summary>If "Blueprint" doesn't work – create the service by hand</summary>

**New + → Web Service** → pick the repo, then fill in:

| Setting | Value |
|---------|-------|
| Root Directory | `backend` |
| Runtime | Python 3 |
| Build Command | `pip install -r requirements.txt` |
| Start Command | `uvicorn app.main:app --host 0.0.0.0 --port $PORT` |
| Instance Type | Free |
| Environment variable | `PYTHON_VERSION` = `3.13.5` |

</details>

---

## Step 3 – Put the website on Vercel

1. Go to <https://vercel.com/signup> → **Continue with GitHub**.
2. Click **Add New… → Project** → **Import** the **varshaalert** repository.
3. Settings on the import page:
   - **Root Directory** → click *Edit* → choose **`frontend`**
   - **Framework Preset** → **Vite** (usually detected automatically)
   - **Environment Variables** → add:
     - Name: `VITE_API_URL`
     - Value: your Render address from Step 2, e.g. `https://varshaalert-api.onrender.com`
       (no `/api` and no `/` at the end)
4. Click **Deploy** and wait ~1 minute.
5. Vercel shows your link, e.g. **`https://varshaalert.vercel.app`** 🎉

---

## Step 4 – Share it

Send your friend / mentors the Vercel link:

- Dashboard: `https://varshaalert.vercel.app`
- Citizen app (open on a phone): `https://varshaalert.vercel.app/citizen`
  - Because it is **https**, phones can **install the app** ("Add to Home screen") and get
    **notifications** when you press *Send Alert*.

---

## Step 5 (optional) – Real SMS online

On Render → your **varshaalert-api** service → **Environment** → add:

| Key | Value |
|-----|-------|
| `TWILIO_ACCOUNT_SID` | from Twilio console |
| `TWILIO_AUTH_TOKEN` | from Twilio console |
| `TWILIO_FROM_NUMBER` | your Twilio number, e.g. `+1xxxxxxxxxx` |
| `ALERT_PHONE_NUMBERS` | verified numbers, e.g. `+91XXXXXXXXXX` |

Save → Render restarts the backend → the "Demo mode" banner disappears.
Keys stay secret on Render – never put them in the code or on GitHub.

---

## 🔁 Updating the website after you change code

In the `VarshaAlert` folder:

```bash
git add -A
```
```bash
git commit -m "Describe what you changed"
```
```bash
git push
```

Render and Vercel see the push and **re-deploy automatically** in a few minutes.

---

## ⚠️ Good to know (free plans)

| Thing | What happens | What to do |
|-------|--------------|------------|
| Backend sleeps | Render free servers sleep after ~15 min with no visitors. The first visit then takes **30–60 s** (the site shows "The server is waking up…") | Open the link **2 minutes before** your presentation |
| Alert history resets | The SQLite database lives on Render's temporary disk, so alerts/subscriptions are cleared when the server restarts or re-deploys | Fine for demos. For permanent storage use a database add-on later |
| Changed `VITE_API_URL` | Vercel only reads it while building | Vercel → Deployments → ⋯ → **Redeploy** |

## 🛠️ Troubleshooting

| Problem | Fix |
|---------|-----|
| Website always says "server is waking up" | Check `VITE_API_URL` in Vercel → Settings → Environment Variables (exact Render address, no `/api`, no trailing `/`), then Redeploy. Open `…onrender.com/api/health` to see if the backend is up |
| Render build failed | Open the **Logs** tab on Render and read the last red lines. Check the Root Directory is `backend` |
| Page `/citizen` shows 404 after refresh | Make sure `frontend/vercel.json` is on GitHub and Vercel Root Directory is `frontend` |
| `git push` asks for a password | Use the browser login window that pops up (GitHub no longer accepts account passwords in the terminal) |
| Old version still showing | Hard refresh with **Ctrl + Shift + R** (the app caches pages for offline use) |
