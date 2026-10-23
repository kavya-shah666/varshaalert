// api.js - small helpers to call the FastAPI backend.
//
// On your laptop: we call "/api/..." and Vite forwards it to http://localhost:8000 (see vite.config.js).
// Online (Vercel): the backend lives on another website (Render), so we set its address
// in the VITE_API_URL setting, e.g. https://varshaalert-api.onrender.com
const API_BASE = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '')   // remove a trailing "/"

export async function getJSON(path) {
  const res = await fetch(`${API_BASE}/api${path}`)
  if (!res.ok) throw new Error(`API error ${res.status} on ${path}`)
  return res.json()
}

export async function postJSON(path, body) {
  const res = await fetch(`${API_BASE}/api${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) throw new Error(`API error ${res.status} on ${path}`)
  return res.json()
}
