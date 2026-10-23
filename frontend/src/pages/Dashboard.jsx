// Dashboard.jsx - HOME PAGE: summary cards + Live Risk Map + forecast graph.
import { useEffect, useState } from 'react'
import { getJSON } from '../api.js'
import { STATES, LEVEL_ORDER, formatDateTime } from '../constants.js'
import { Card, LevelBadge, Legend, ErrorBox } from '../components/Common.jsx'
import RiskMap from '../components/RiskMap.jsx'
import SummaryCards from '../components/SummaryCards.jsx'
import ForecastChart from '../components/ForecastChart.jsx'

export default function Dashboard() {
  const [state, setState] = useState('')            // '' = All India
  const [districts, setDistricts] = useState(null)  // GeoJSON from the API
  const [summary, setSummary] = useState(null)
  const [selectedId, setSelectedId] = useState(null)
  const [forecast, setForecast] = useState(null)
  const [error, setError] = useState(null)

  // Load map + summary whenever the state filter changes
  useEffect(() => {
    const q = state ? `?state=${encodeURIComponent(state)}` : ''
    Promise.all([getJSON(`/districts${q}`), getJSON(`/summary${q}`)])
      .then(([geo, sum]) => {
        setDistricts(geo)
        setSummary(sum)
        setError(null)
        // Select the most dangerous district by default
        const sorted = [...geo.features].sort((a, b) => b.properties.predicted_rain - a.properties.predicted_rain)
        setSelectedId(sorted[0]?.properties.id)
      })
      .catch(setError)
  }, [state])

  // Load the forecast for the selected district
  useEffect(() => {
    if (selectedId) getJSON(`/forecast/${selectedId}`).then(setForecast).catch(setError)
  }, [selectedId])

  // Districts sorted by danger for the table on the right
  const ranked = districts
    ? [...districts.features].map((f) => f.properties)
        .sort((a, b) => LEVEL_ORDER.indexOf(a.level) - LEVEL_ORDER.indexOf(b.level) || b.predicted_rain - a.predicted_rain)
    : []

  return (
    <div>
      <ErrorBox error={error} />
      <SummaryCards summary={summary} />

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        {/* ---------- Map ---------- */}
        <Card className="xl:col-span-2" title="Live Risk Map – next 24 hours"
          right={
            <select value={state} onChange={(e) => setState(e.target.value)}
              className="border border-slate-300 rounded-lg px-3 py-1.5 text-sm bg-white">
              <option value="">All states</option>
              {STATES.map((s) => <option key={s}>{s}</option>)}
            </select>
          }>
          <RiskMap data={districts} selectedId={selectedId} onSelect={setSelectedId} height={520} />
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
            <Legend />
            {districts && <span className="text-xs text-slate-500">Forecast issued {formatDateTime(districts.issued_at)} IST</span>}
          </div>
        </Card>

        {/* ---------- District ranking ---------- */}
        <Card title="Districts by risk">
          <div className="max-h-[575px] overflow-y-auto -mx-2">
            <table className="w-full text-sm">
              <thead className="text-xs text-slate-500 sticky top-0 bg-white">
                <tr><th className="text-left px-2 py-1">District</th><th className="px-2">Level</th><th className="text-right px-2">Rain (mm)</th></tr>
              </thead>
              <tbody>
                {ranked.map((d) => (
                  <tr key={d.id} onClick={() => setSelectedId(d.id)}
                      className={`cursor-pointer border-t border-slate-100 ${d.id === selectedId ? 'bg-sky-50' : 'hover:bg-slate-50'}`}>
                    <td className="px-2 py-1.5"><div className="font-medium">{d.name}</div><div className="text-xs text-slate-500">{d.state}</div></td>
                    <td className="px-2 text-center"><LevelBadge level={d.level} short /></td>
                    <td className="px-2 text-right font-mono">{d.predicted_rain.toFixed(1)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </div>

      {/* ---------- Forecast graph for the selected district ---------- */}
      {forecast && (
        <Card className="mt-4"
          title={`Rainfall forecast – ${forecast.district.name}, ${forecast.district.state}`}
          right={<LevelBadge level={forecast.level} />}>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="lg:col-span-2">
              <p className="text-xs text-slate-500 mb-2">
                Accumulated rainfall from now (08:30 IST) up to each lead time. Dashed lines = IMD 24-hour categories.
              </p>
              <ForecastChart leads={forecast.leads} />
            </div>
            <div>
              <table className="w-full text-sm">
                <thead className="text-xs text-slate-500">
                  <tr><th className="text-left py-1">Day</th><th className="text-right">Predicted</th><th className="text-right">Actual</th><th>Level</th></tr>
                </thead>
                <tbody>
                  {forecast.days.map((d) => (
                    <tr key={d.day} className="border-t border-slate-100">
                      <td className="py-2">Day {d.day}<div className="text-xs text-slate-500">{d.day * 24 - 24}–{d.day * 24} h</div></td>
                      <td className="text-right font-mono">{d.predicted} mm</td>
                      <td className="text-right font-mono text-slate-500">{d.actual} mm</td>
                      <td className="text-center"><LevelBadge level={d.level} short /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="grid grid-cols-2 gap-2 mt-4 text-center">
                <div className="bg-slate-50 rounded-lg p-3">
                  <div className="text-xs text-slate-500">Model confidence</div>
                  <div className="text-2xl font-bold">{Math.round(forecast.confidence * 100)}%</div>
                </div>
                <div className="bg-slate-50 rounded-lg p-3">
                  <div className="text-xs text-slate-500">Heavy-rain probability</div>
                  <div className="text-2xl font-bold">{Math.round(forecast.heavy_prob * 100)}%</div>
                </div>
              </div>
              <p className="text-xs text-slate-500 mt-3">
                Confidence = share of the 100 decision trees in the Random Forest that agree on this colour level.
              </p>
            </div>
          </div>
        </Card>
      )}
    </div>
  )
}
