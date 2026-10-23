// PhoneMockup.jsx - a drawn phone that shows the alert as a notification.
// This is the "demo mode" view: it shows what citizens receive, even without real SMS.
import { LEVELS } from '../constants.js'

export default function PhoneMockup({ alert }) {
  const level = alert ? LEVELS[alert.level] : null
  return (
    <div className="mx-auto w-[260px] h-[520px] rounded-[40px] bg-slate-900 p-3 shadow-2xl">
      <div className="relative w-full h-full rounded-[30px] overflow-hidden bg-gradient-to-b from-sky-900 to-slate-800">
        {/* status bar */}
        <div className="flex justify-between text-white text-xs px-5 pt-3">
          <span>{new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: false })}</span>
          <span>📶 5G 🔋</span>
        </div>
        <div className="mx-auto mt-1 w-24 h-5 rounded-full bg-black" />

        {alert ? (
          // key = alert id -> the slide-in animation replays for every new alert
          <div key={alert.id} className="animate-slide-down mx-3 mt-4 rounded-2xl bg-white/95 p-3 shadow-lg">
            <div className="flex items-center gap-2 text-xs text-slate-500">
              <img src="/icon-192.png" alt="" className="w-5 h-5 rounded" />
              <span className="font-semibold text-slate-700">VarshaAlert</span>
              <span className="ml-auto">now</span>
            </div>
            <div className="mt-2 text-sm font-bold" style={{ color: level.color === '#facc15' ? '#a16207' : level.color }}>
              {level.name.toUpperCase()} {level.label.toUpperCase()} – {alert.district_name}
            </div>
            <div className="text-xs text-slate-700 mt-1 leading-snug">{alert.message_en}</div>
            <div className="text-xs text-slate-700 mt-2 leading-snug">{alert.message_hi}</div>
            {alert.message_regional && <div className="text-xs text-slate-700 mt-2 leading-snug">{alert.message_regional}</div>}
          </div>
        ) : (
          <div className="text-center text-slate-300 text-sm mt-40 px-6">
            📱<br />Citizen phone<br /><span className="text-xs text-slate-400">Send an alert to see it arrive here</span>
          </div>
        )}
      </div>
    </div>
  )
}
