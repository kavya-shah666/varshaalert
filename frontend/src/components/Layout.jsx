// Layout.jsx - dark sidebar + top bar (with live clock) around every dashboard page.
import { useEffect, useState } from 'react'
import { NavLink, Outlet } from 'react-router-dom'

const NAV = [
  { to: '/', label: 'Live Risk Map', icon: '🗺️' },
  { to: '/inundation', label: 'Inundation Map', icon: '🌊' },
  { to: '/replay', label: 'Historical Replay', icon: '⏪' },
  { to: '/alerts', label: 'Alert Panel', icon: '📢' },
  { to: '/accuracy', label: 'Model Accuracy', icon: '📊' },
  { to: '/about', label: 'About / Architecture', icon: 'ℹ️' },
]

function Clock() {
  const [now, setNow] = useState(new Date())
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000)   // update every second
    return () => clearInterval(timer)
  }, [])
  return (
    <div className="text-right leading-tight">
      <div className="font-mono text-lg font-semibold">
        {now.toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata', hour12: false })} IST
      </div>
      <div className="text-xs text-slate-500">
        {now.toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata', weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
      </div>
    </div>
  )
}

export default function Layout() {
  const [menuOpen, setMenuOpen] = useState(false)   // sidebar on mobile

  return (
    <div className="min-h-screen flex">
      {/* ---------- Sidebar ---------- */}
      <aside className={`fixed inset-y-0 left-0 z-[1100] w-64 bg-slate-900 text-slate-200 flex flex-col
                         transform transition-transform md:translate-x-0 ${menuOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="px-5 py-5 border-b border-slate-700 flex items-center gap-3">
          <img src="/favicon.svg" alt="" className="w-10 h-10" />
          <div>
            <div className="text-xl font-bold text-white">VarshaAlert</div>
            <div className="text-xs text-slate-400">Early Warning System</div>
          </div>
        </div>
        <nav className="flex-1 py-4">
          {NAV.map((item) => (
            <NavLink key={item.to} to={item.to} end onClick={() => setMenuOpen(false)}
              className={({ isActive }) =>
                `flex items-center gap-3 px-5 py-3 text-sm border-l-4 ${isActive
                  ? 'bg-slate-800 border-sky-400 text-white font-semibold'
                  : 'border-transparent hover:bg-slate-800'}`}>
              <span className="text-lg">{item.icon}</span>{item.label}
            </NavLink>
          ))}
          <a href="/citizen" target="_blank" rel="noreferrer"
             className="flex items-center gap-3 px-5 py-3 text-sm border-l-4 border-transparent hover:bg-slate-800">
            <span className="text-lg">📱</span>Citizen App (PWA) ↗
          </a>
        </nav>
        <div className="p-4 text-xs text-slate-500 border-t border-slate-700">
          Smart India Hackathon<br />Problem Statement SIH26071
        </div>
      </aside>
      {menuOpen && <div className="fixed inset-0 bg-black/40 z-[1050] md:hidden" onClick={() => setMenuOpen(false)} />}

      {/* ---------- Main area ---------- */}
      <div className="flex-1 md:ml-64 min-w-0">
        <header className="sticky top-0 z-[1000] bg-white border-b border-slate-200 px-4 md:px-6 py-3 flex items-center gap-4">
          <button className="md:hidden text-2xl" onClick={() => setMenuOpen(true)} aria-label="Open menu">☰</button>
          <div className="flex-1 min-w-0">
            <div className="text-lg md:text-xl font-bold truncate">VarshaAlert – Heavy Rainfall Early Warning &amp; Inundation Prediction</div>
            <div className="text-xs md:text-sm text-slate-500">Ministry of Earth Sciences – SIH26071</div>
          </div>
          <div className="hidden sm:block"><Clock /></div>
        </header>
        <main className="p-4 md:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
