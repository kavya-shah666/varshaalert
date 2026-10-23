// Citizen.jsx - CITIZEN MOBILE APP (installable PWA).
// Shows the user's district risk in big colours, safety tips, shelters,
// and receives alerts as notifications.
import { useEffect, useRef, useState } from 'react'
import { getJSON, postJSON } from '../api.js'
import { LEVELS, STATES } from '../constants.js'

// localStorage can fail (private mode), so always use try/catch
const load = (key, fallback) => { try { return localStorage.getItem(key) ?? fallback } catch { return fallback } }
const save = (key, value) => { try { localStorage.setItem(key, value) } catch { /* ignore */ } }

// A random id for this phone (so the server can count subscribers)
function getClientId() {
  let id = load('va_client_id', null)
  if (!id) { id = 'device-' + Math.random().toString(36).slice(2, 10); save('va_client_id', id) }
  return id
}

const TIPS = {
  dos: [
    'Keep your phone charged and a torch, medicines and documents ready',
    'Store drinking water and dry food for 3 days',
    'Move to higher ground or the nearest shelter if water enters',
    'Follow only official updates (IMD, District Collector, SDMA)',
    'Switch off the main power supply if water rises indoors',
  ],
  donts: [
    'Do not walk or drive through flowing water – 15 cm can knock you down',
    'Do not go near rivers, drains, or landslide-prone hill slopes',
    'Do not touch electric poles or fallen wires',
    'Do not spread unverified forwards / rumours',
  ],
}

// Show a notification on the phone (through the service worker if possible)
async function notify(title, body) {
  if (!('Notification' in window) || Notification.permission !== 'granted') return
  try {
    const reg = await navigator.serviceWorker?.ready
    if (reg) await reg.showNotification(title, { body, icon: '/icon-192.png', vibrate: [300, 100, 300] })
    else new Notification(title, { body, icon: '/icon-192.png' })
  } catch { /* notifications not allowed on this device */ }
}

export default function Citizen() {
  const [districts, setDistricts] = useState([])
  const [districtId, setDistrictId] = useState(load('va_district', 'TN01'))
  const [forecast, setForecast] = useState(null)
  const [shelters, setShelters] = useState([])
  const [subscribed, setSubscribed] = useState(load('va_subscribed', '') === districtId)
  const [banner, setBanner] = useState(null)        // newest alert shown at the top
  const [installPrompt, setInstallPrompt] = useState(null)
  const [error, setError] = useState(null)
  const lastSeen = useRef(0)                       // id of the newest alert we already showed

  useEffect(() => {
    getJSON('/districts').then((g) => setDistricts(g.features.map((f) => f.properties))).catch(setError)
    // "Install app" button (Chrome/Android)
    const handler = (e) => { e.preventDefault(); setInstallPrompt(e) }
    window.addEventListener('beforeinstallprompt', handler)
    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [])

  // Load forecast, shelters and latest alert when the district changes
  useEffect(() => {
    save('va_district', districtId)
    setSubscribed(load('va_subscribed', '') === districtId)
    getJSON(`/forecast/${districtId}`).then(setForecast).catch(setError)
    getJSON(`/shelters/${districtId}`).then(setShelters).catch(setError)
    getJSON(`/alerts?district_id=${districtId}&limit=1`).then((list) => {
      setBanner(list[0] ?? null)
      lastSeen.current = list[0]?.id ?? 0
    }).catch(setError)
  }, [districtId])

  // Check for new alerts every 8 seconds
  useEffect(() => {
    const timer = setInterval(async () => {
      try {
        const list = await getJSON(`/alerts?district_id=${districtId}&after_id=${lastSeen.current}`)
        if (list.length > 0) {
          const newest = list[0]
          lastSeen.current = newest.id
          setBanner({ ...newest, fresh: true })
          navigator.vibrate?.([300, 100, 300])
          notify(`${LEVELS[newest.level].name.toUpperCase()} ALERT – ${newest.district_name}`, newest.message_en)
        }
      } catch { /* offline - try again next time */ }
    }, 8000)
    return () => clearInterval(timer)
  }, [districtId])

  async function subscribe() {
    // 1. Register this phone for the district on the server
    await postJSON('/subscribe', { district_id: districtId, client_id: getClientId() }).catch(setError)
    save('va_subscribed', districtId)
    setSubscribed(true)
    // 2. Ask permission to show notifications (in-app banner works even if the user says no)
    if ('Notification' in window && Notification.permission === 'default') await Notification.requestPermission()
    notify('VarshaAlert', `You will now receive rainfall alerts for ${forecast?.district.name}.`)
  }

  // Use GPS to pick the nearest district (only works on https or localhost)
  function useMyLocation() {
    navigator.geolocation?.getCurrentPosition((pos) => {
      const { latitude, longitude } = pos.coords
      const nearest = [...districts].sort((a, b) =>
        Math.hypot(a.lat - latitude, a.lon - longitude) - Math.hypot(b.lat - latitude, b.lon - longitude))[0]
      if (nearest) setDistrictId(nearest.id)
    }, () => alert('Location not available – please choose your district.'))
  }

  const level = forecast ? LEVELS[forecast.level] : null

  return (
    <div className="min-h-screen bg-slate-100 max-w-md mx-auto pb-10">
      {/* Header */}
      <header className="bg-slate-900 text-white px-4 py-3 flex items-center gap-3 sticky top-0 z-10">
        <img src="/icon-192.png" alt="" className="w-9 h-9 rounded-lg" />
        <div className="flex-1">
          <div className="font-bold">VarshaAlert</div>
          <div className="text-xs text-slate-400">Rainfall & flood alerts · MoES</div>
        </div>
        {installPrompt && (
          <button onClick={() => { installPrompt.prompt(); setInstallPrompt(null) }}
            className="bg-sky-500 text-white text-xs font-semibold rounded-lg px-3 py-2">Install app</button>
        )}
      </header>

      {/* New alert banner */}
      {banner && (
        <div key={banner.id} className={`${banner.fresh ? 'animate-slide-down' : ''} m-3 rounded-xl p-3 text-sm shadow`}
             style={{ background: LEVELS[banner.level].color, color: LEVELS[banner.level].text }}>
          <div className="font-bold">📢 {banner.fresh ? 'NEW ' : ''}OFFICIAL ALERT</div>
          <div className="mt-1">{banner.message_en}</div>
          <div className="mt-1">{banner.message_hi}</div>
          {banner.message_regional && <div className="mt-1">{banner.message_regional}</div>}
        </div>
      )}

      <div className="p-3 space-y-3">
        {error && <div className="bg-red-50 text-red-700 rounded-xl p-3 text-sm">Cannot reach server – showing saved data if available.</div>}

        {/* District picker */}
        <div className="flex gap-2">
          <select value={districtId} onChange={(e) => setDistrictId(e.target.value)}
            className="flex-1 rounded-xl border border-slate-300 px-3 py-3 bg-white text-base">
            {STATES.map((st) => (
              <optgroup key={st} label={st}>
                {districts.filter((d) => d.state === st).map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
              </optgroup>
            ))}
          </select>
          <button onClick={useMyLocation} className="rounded-xl bg-white border border-slate-300 px-3" title="Use my location">📍</button>
        </div>

        {/* Big risk card */}
        {forecast && (
          <div className="rounded-2xl p-6 text-center shadow-lg" style={{ background: level.color, color: level.text }}>
            <div className="text-sm font-semibold uppercase tracking-wide opacity-90">{forecast.district.name} · next 24 hours</div>
            <div className="text-5xl font-black mt-2">{level.name.toUpperCase()}</div>
            <div className="text-xl font-semibold">{level.label}</div>
            <div className="mt-3 text-lg">Expected rain: <b>{Math.round(forecast.predicted_24h)} mm</b></div>
            <div className="text-xs opacity-90 mt-1">Confidence {Math.round(forecast.confidence * 100)}%</div>
          </div>
        )}

        {/* 3-day outlook */}
        {forecast && (
          <div className="grid grid-cols-3 gap-2">
            {forecast.days.map((d) => (
              <div key={d.day} className="bg-white rounded-xl p-3 text-center shadow-sm">
                <div className="text-xs text-slate-500">{['Today', 'Tomorrow', 'Day 3'][d.day - 1]}</div>
                <div className="w-6 h-6 rounded-full mx-auto my-2" style={{ background: LEVELS[d.level].color }} />
                <div className="font-bold">{Math.round(d.predicted)} mm</div>
              </div>
            ))}
          </div>
        )}

        {/* Subscribe */}
        <button onClick={subscribe} disabled={subscribed}
          className={`w-full rounded-xl py-4 font-bold text-lg shadow ${subscribed ? 'bg-green-100 text-green-800' : 'bg-sky-600 text-white'}`}>
          {subscribed ? '✅ Subscribed to alerts' : '🔔 Subscribe to alerts'}
        </button>

        {/* Do's and Don'ts */}
        <div className="bg-white rounded-xl p-4 shadow-sm">
          <h2 className="font-bold text-green-700 mb-2">✅ Do's</h2>
          <ul className="text-sm space-y-1 list-disc list-inside text-slate-700">{TIPS.dos.map((t) => <li key={t}>{t}</li>)}</ul>
          <h2 className="font-bold text-red-700 mt-4 mb-2">❌ Don'ts</h2>
          <ul className="text-sm space-y-1 list-disc list-inside text-slate-700">{TIPS.donts.map((t) => <li key={t}>{t}</li>)}</ul>
        </div>

        {/* Shelters */}
        <div className="bg-white rounded-xl p-4 shadow-sm">
          <h2 className="font-bold mb-2">🏠 Nearby relief shelters</h2>
          {shelters.map((s) => (
            <div key={s.name} className="border-t border-slate-100 py-2 flex items-center gap-2">
              <div className="flex-1">
                <div className="text-sm font-medium">{s.name}</div>
                <div className="text-xs text-slate-500">Capacity {s.capacity} people</div>
              </div>
              <a href={`https://www.google.com/maps?q=${s.lat},${s.lon}`} target="_blank" rel="noreferrer"
                 className="text-xs bg-slate-100 rounded-lg px-2 py-1">Map ↗</a>
            </div>
          ))}
          <p className="text-xs text-slate-400 mt-2">Sample shelter data for the demo.</p>
        </div>

        {/* Emergency numbers */}
        <div className="grid grid-cols-2 gap-2">
          <a href="tel:1077" className="bg-red-600 text-white rounded-xl p-4 text-center font-bold shadow">📞 1077<div className="text-xs font-normal">District disaster helpline</div></a>
          <a href="tel:112" className="bg-slate-900 text-white rounded-xl p-4 text-center font-bold shadow">📞 112<div className="text-xs font-normal">Emergency</div></a>
        </div>
      </div>
    </div>
  )
}
