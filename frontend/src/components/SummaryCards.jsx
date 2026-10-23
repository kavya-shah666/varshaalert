// SummaryCards.jsx - counts of districts on Red / Orange / Yellow / Green + alerts sent today.
import { LEVELS, LEVEL_ORDER } from '../constants.js'

export default function SummaryCards({ summary }) {
  if (!summary) return <div className="h-24 rounded-xl bg-slate-200 animate-pulse mb-4" />
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 mb-4">
      {LEVEL_ORDER.map((key) => (
        <div key={key} className="rounded-xl p-4 shadow-sm" style={{ background: LEVELS[key].color, color: LEVELS[key].text }}>
          <div className="text-xs font-semibold uppercase tracking-wide opacity-90">{LEVELS[key].name} – {LEVELS[key].label}</div>
          <div className="text-3xl font-bold mt-1">{summary.counts[key]}</div>
          <div className="text-xs opacity-90">districts</div>
        </div>
      ))}
      <div className="rounded-xl p-4 shadow-sm bg-slate-900 text-white col-span-2 sm:col-span-1">
        <div className="text-xs font-semibold uppercase tracking-wide text-slate-300">Alerts sent today</div>
        <div className="text-3xl font-bold mt-1">{summary.alerts_today}</div>
        <div className="text-xs text-slate-300">{summary.demo_mode ? 'SMS demo mode' : 'Twilio SMS live'}</div>
      </div>
    </div>
  )
}
