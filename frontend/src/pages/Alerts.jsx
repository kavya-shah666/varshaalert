// Alerts.jsx - ALERT PANEL: an official picks districts, checks the message
// (English + Hindi + regional language) and presses "Send Alert".
import { useEffect, useState } from 'react'
import { getJSON, postJSON } from '../api.js'
import { STATES, LEVELS, LEVEL_ORDER, formatDateTime } from '../constants.js'
import { Card, LevelBadge, ErrorBox } from '../components/Common.jsx'
import PhoneMockup from '../components/PhoneMockup.jsx'

export default function Alerts() {
  const [districts, setDistricts] = useState([])   // list of district properties
  const [selected, setSelected] = useState([])     // chosen district ids
  const [level, setLevel] = useState('')           // '' = use the model's level
  const [preview, setPreview] = useState([])
  const [history, setHistory] = useState([])
  const [sending, setSending] = useState(false)
  const [result, setResult] = useState(null)
  const [demoMode, setDemoMode] = useState(true)
  const [error, setError] = useState(null)

  const loadHistory = () => getJSON('/alerts').then(setHistory).catch(setError)

  useEffect(() => {
    getJSON('/districts').then((geo) => {
      const list = geo.features.map((f) => f.properties)
      setDistricts(list)
      // Pre-select every Red and Orange district
      setSelected(list.filter((d) => d.level === 'red' || d.level === 'orange').map((d) => d.id))
    }).catch(setError)
    getJSON('/summary').then((s) => setDemoMode(s.demo_mode)).catch(setError)
    loadHistory()
  }, [])

  // Update the message preview when the selection changes
  useEffect(() => {
    if (selected.length === 0) { setPreview([]); return }
    postJSON('/alerts/preview', { district_ids: selected, level: level || null }).then(setPreview).catch(setError)
  }, [selected, level])

  const toggle = (id) => setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]))
  const selectLevels = (levels) => setSelected(districts.filter((d) => levels.includes(d.level)).map((d) => d.id))

  async function send() {
    setSending(true)
    try {
      const res = await postJSON('/alerts/send', { district_ids: selected, level: level || null })
      setResult(res)
      loadHistory()
    } catch (e) { setError(e) }
    setSending(false)
  }

  // Show the most serious alert just sent on the phone
  const phoneAlert = result?.alerts.slice().sort((a, b) => LEVEL_ORDER.indexOf(a.level) - LEVEL_ORDER.indexOf(b.level))[0]

  return (
    <div>
      <ErrorBox error={error} />
      {demoMode && (
        <div className="bg-amber-50 border border-amber-200 text-amber-800 rounded-xl p-3 mb-4 text-sm">
          <b>Demo mode:</b> Twilio keys are not set, so no real SMS is sent – the phone on the right shows what citizens receive.
          Add your keys to <code>backend/.env</code> to send real SMS.
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        {/* ---------- 1. Choose districts ---------- */}
        <Card title="1. Select districts" right={<span className="text-sm text-slate-500">{selected.length} selected</span>}>
          <div className="flex flex-wrap gap-2 mb-3">
            <button onClick={() => selectLevels(['red'])} className="text-xs px-2 py-1 rounded bg-red-100 text-red-700 font-semibold">All Red</button>
            <button onClick={() => selectLevels(['red', 'orange'])} className="text-xs px-2 py-1 rounded bg-orange-100 text-orange-700 font-semibold">Red + Orange</button>
            <button onClick={() => setSelected([])} className="text-xs px-2 py-1 rounded bg-slate-100 text-slate-700 font-semibold">Clear</button>
          </div>
          <div className="max-h-[480px] overflow-y-auto pr-1">
            {STATES.map((st) => (
              <div key={st} className="mb-3">
                <div className="text-xs font-bold uppercase text-slate-500 mb-1">{st}</div>
                {districts.filter((d) => d.state === st).map((d) => (
                  <label key={d.id} className="flex items-center gap-2 py-1 px-1 rounded hover:bg-slate-50 cursor-pointer text-sm">
                    <input type="checkbox" checked={selected.includes(d.id)} onChange={() => toggle(d.id)} className="accent-sky-600" />
                    <span className="flex-1">{d.name}</span>
                    <span className="font-mono text-xs text-slate-500">{d.predicted_rain} mm</span>
                    <LevelBadge level={d.level} short />
                  </label>
                ))}
              </div>
            ))}
          </div>
        </Card>

        {/* ---------- 2. Message preview + send ---------- */}
        <Card title="2. Check message & send">
          <label className="text-sm text-slate-600">Alert level</label>
          <select value={level} onChange={(e) => setLevel(e.target.value)}
            className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm mb-3 mt-1 bg-white">
            <option value="">Automatic (from ML forecast)</option>
            {LEVEL_ORDER.map((l) => <option key={l} value={l}>{LEVELS[l].name} – {LEVELS[l].label}</option>)}
          </select>
          <div className="max-h-[330px] overflow-y-auto space-y-3">
            {preview.slice(0, 3).map((p) => (
              <div key={p.district_id} className="border border-slate-200 rounded-lg p-3 text-xs space-y-2">
                <div className="flex justify-between items-center"><b className="text-sm">{p.district_name}</b><LevelBadge level={p.level} /></div>
                <p><span className="text-slate-400">EN:</span> {p.message_en}</p>
                <p><span className="text-slate-400">HI:</span> {p.message_hi}</p>
                {p.message_regional && <p><span className="text-slate-400">{p.regional_language}:</span> {p.message_regional}</p>}
              </div>
            ))}
            {preview.length > 3 && <p className="text-xs text-slate-500">+ {preview.length - 3} more districts</p>}
          </div>
          <button onClick={send} disabled={sending || selected.length === 0}
            className="mt-4 w-full bg-red-600 hover:bg-red-700 disabled:bg-slate-300 text-white font-bold text-lg rounded-xl py-4 shadow">
            {sending ? 'Sending…' : `📢 SEND ALERT (${selected.length})`}
          </button>
          {result && (
            <div className="mt-3 bg-green-50 border border-green-200 text-green-800 rounded-lg p-3 text-sm">
              ✅ {result.alerts.length} alert(s) sent · SMS: <b>{result.alerts[0]?.sms_status}</b> ·
              Push subscribers reached: <b>{result.alerts.reduce((n, a) => n + a.push_count, 0)}</b>
            </div>
          )}
        </Card>

        {/* ---------- 3. Phone ---------- */}
        <Card title="3. What citizens receive">
          <PhoneMockup alert={phoneAlert} />
          <p className="text-xs text-slate-500 text-center mt-3">
            Citizens who installed the app (<a href="/citizen" target="_blank" className="text-sky-600 underline">/citizen</a>) also get a notification.
          </p>
        </Card>
      </div>

      {/* ---------- History ---------- */}
      <Card className="mt-4" title="Alert history">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-xs text-slate-500 text-left">
              <tr><th className="py-2">Time</th><th>District</th><th>Level</th><th>SMS</th><th>Push</th><th>Status</th></tr>
            </thead>
            <tbody>
              {history.length === 0 && <tr><td colSpan="6" className="py-4 text-center text-slate-400">No alerts sent yet</td></tr>}
              {history.map((a) => (
                <tr key={a.id} className="border-t border-slate-100">
                  <td className="py-2 whitespace-nowrap">{formatDateTime(a.created_at)}</td>
                  <td>{a.district_name}<span className="text-xs text-slate-400"> · {a.state}</span></td>
                  <td><LevelBadge level={a.level} short /></td>
                  <td className="text-xs">{a.sms_status}</td>
                  <td>{a.push_count}</td>
                  <td><span className={`text-xs font-semibold ${a.status === 'delivered' ? 'text-green-700' : 'text-red-700'}`}>{a.status}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  )
}
