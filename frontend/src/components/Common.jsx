// Common.jsx - small building blocks used on many pages.
import { LEVELS, LEVEL_ORDER } from '../constants.js'

// White box with a title
export function Card({ title, right, children, className = '' }) {
  return (
    <section className={`bg-white rounded-xl shadow-sm border border-slate-200 p-4 ${className}`}>
      {(title || right) && (
        <div className="flex items-center justify-between gap-2 mb-3">
          <h2 className="font-semibold text-slate-800">{title}</h2>
          {right}
        </div>
      )}
      {children}
    </section>
  )
}

// Coloured pill such as "Red – Warning"
export function LevelBadge({ level, short = false }) {
  const l = LEVELS[level]
  if (!l) return null
  return (
    <span className="inline-block px-2 py-0.5 rounded-md text-xs font-semibold whitespace-nowrap"
          style={{ background: l.color, color: l.text }}>
      {short ? l.name : `${l.name} – ${l.label}`}
    </span>
  )
}

// Map legend: the four IMD colours with their rainfall ranges
export function Legend() {
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-2 text-xs">
      {LEVEL_ORDER.map((key) => (
        <div key={key} className="flex items-center gap-2">
          <span className="w-4 h-4 rounded" style={{ background: LEVELS[key].color }} />
          <span><b>{LEVELS[key].name}</b> ({LEVELS[key].label}) {LEVELS[key].range}</span>
        </div>
      ))}
    </div>
  )
}

// Big number with a label (used for metrics)
export function Stat({ label, value, sub, color = '#0f172a' }) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
      <div className="text-xs uppercase tracking-wide text-slate-500">{label}</div>
      <div className="text-2xl md:text-3xl font-bold mt-1" style={{ color }}>{value}</div>
      {sub && <div className="text-xs text-slate-500 mt-1">{sub}</div>}
    </div>
  )
}

// Red error box (e.g. backend not running)
export function ErrorBox({ error }) {
  if (!error) return null
  // Online version: the free backend server "sleeps" when nobody uses it
  if (import.meta.env.VITE_API_URL) {
    return (
      <div className="bg-amber-50 border border-amber-200 text-amber-800 rounded-xl p-4 mb-4 text-sm">
        <b>The server is waking up…</b> Free hosting sleeps when not in use. Please wait 30–60 seconds and refresh the page.
      </div>
    )
  }
  return (
    <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl p-4 mb-4 text-sm">
      <b>Cannot reach the backend.</b> Make sure FastAPI is running:
      <code className="block mt-1 bg-red-100 rounded px-2 py-1">cd backend &amp;&amp; uvicorn app.main:app --reload</code>
      <span className="text-xs">({error.message})</span>
    </div>
  )
}
