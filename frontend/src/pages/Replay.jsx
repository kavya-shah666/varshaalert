// Replay.jsx - HISTORICAL REPLAY: run our model on a real past disaster, day by day,
// and show how many hours in advance VarshaAlert would have warned.
import { useEffect, useState } from 'react'
import {
  ResponsiveContainer, ComposedChart, Bar, Line, XAxis, YAxis, Tooltip, Legend, CartesianGrid, ReferenceLine,
} from 'recharts'
import { getJSON } from '../api.js'
import { formatDate, formatDateTime } from '../constants.js'
import { Card, LevelBadge, Legend as MapLegend, ErrorBox } from '../components/Common.jsx'
import RiskMap from '../components/RiskMap.jsx'

export default function Replay() {
  const [events, setEvents] = useState([])
  const [eventId, setEventId] = useState('wayanad_2024')
  const [replay, setReplay] = useState(null)
  const [shapes, setShapes] = useState(null)
  const [dayIndex, setDayIndex] = useState(0)
  const [playing, setPlaying] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => { getJSON('/events').then(setEvents).catch(setError) }, [])

  // Load the replay + district shapes for that state
  useEffect(() => {
    setPlaying(false)
    getJSON(`/replay/${eventId}`).then((r) => {
      setReplay(r)
      setDayIndex(0)
      return getJSON(`/districts?state=${encodeURIComponent(r.event.state)}`)
    }).then(setShapes).catch(setError)
  }, [eventId])

  // Play: one day per second
  useEffect(() => {
    if (!playing || !replay) return
    const timer = setInterval(() => {
      setDayIndex((i) => {
        if (i >= replay.days.length - 1) { setPlaying(false); return i }
        return i + 1
      })
    }, 1000)
    return () => clearInterval(timer)
  }, [playing, replay])

  if (!replay || !shapes) return <div><ErrorBox error={error} /><div className="h-96 rounded-xl bg-slate-200 animate-pulse" /></div>

  const { event, days, first_warning: warn } = replay
  const day = days[dayIndex]
  const focus = day.districts.find((d) => d.id === event.focus_district)
  const eventDate = event.event_time.slice(0, 10)

  // Colour the map with the forecast issued on this day
  const byId = Object.fromEntries(day.districts.map((d) => [d.id, d]))
  const dayMap = {
    type: 'FeatureCollection',
    features: shapes.features.map((f) => {
      const d = byId[f.properties.id]
      return { ...f, properties: { ...f.properties, level: d.level, predicted_rain: d.predicted_next_24h, confidence: d.confidence, heavy_prob: undefined } }
    }),
  }

  // Status banner for the current day
  let status = { text: 'No warning for ' + focus.name, color: '#16a34a' }
  if (day.date === eventDate) status = { text: `💥 Event day – ${event.name}`, color: '#7f1d1d' }
  else if (day.date > eventDate) status = { text: 'After the event', color: '#475569' }
  else if (warn && day.date >= warn.date) status = { text: `⚠️ ${warn.level.toUpperCase()} warning active for ${focus.name}`, color: warn.level === 'red' ? '#dc2626' : '#f97316' }

  // Timeline data for the focus district
  const timeline = days.map((d) => {
    const f = d.districts.find((x) => x.id === event.focus_district)
    return { date: d.date, label: formatDate(d.date).slice(0, 6), predicted: f.predicted_next_24h, actual: f.actual_next_24h }
  })

  return (
    <div>
      <ErrorBox error={error} />
      {/* Headline result */}
      <div className="rounded-xl bg-slate-900 text-white p-5 mb-4 flex flex-col md:flex-row md:items-center gap-4">
        <div className="text-center md:border-r md:border-slate-700 md:pr-6">
          <div className="text-5xl font-bold text-sky-400">{replay.lead_hours !== null ? Math.round(replay.lead_hours) : '–'}</div>
          <div className="text-sm text-slate-300">hours advance warning</div>
        </div>
        <div className="flex-1">
          <div className="text-xl font-semibold">{replay.message}</div>
          <div className="text-sm text-slate-400 mt-1">{event.description}</div>
        </div>
        <select value={eventId} onChange={(e) => setEventId(e.target.value)}
          className="bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-sm">
          {events.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
        </select>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <Card className="xl:col-span-2" title={`Forecast issued ${formatDateTime(day.issue_time)} IST`}
          right={<span className="text-white text-sm font-semibold rounded-lg px-3 py-1" style={{ background: status.color }}>{status.text}</span>}>
          <RiskMap data={dayMap} selectedId={event.focus_district} height={460} />
          {/* Day slider */}
          <div className="mt-4 flex items-center gap-3">
            <button onClick={() => { if (dayIndex >= days.length - 1) setDayIndex(0); setPlaying(!playing) }}
              className="bg-sky-600 hover:bg-sky-700 text-white rounded-lg px-4 py-2 text-sm font-semibold w-24">
              {playing ? '⏸ Pause' : '▶ Play'}
            </button>
            <input type="range" min="0" max={days.length - 1} value={dayIndex}
              onChange={(e) => { setPlaying(false); setDayIndex(Number(e.target.value)) }} className="flex-1 accent-sky-600" />
            <div className="font-semibold w-28 text-right">{formatDate(day.date)}</div>
          </div>
          <div className="mt-3"><MapLegend /></div>
        </Card>

        <div className="space-y-4">
          <Card title={`${focus.name} on ${formatDate(day.date)}`} right={<LevelBadge level={focus.level} />}>
            <table className="w-full text-sm">
              <tbody>
                <tr><td className="py-1 text-slate-500">Rain observed today</td><td className="text-right font-mono">{focus.observed_today} mm</td></tr>
                <tr><td className="py-1 text-slate-500">Model forecast (next 24 h)</td><td className="text-right font-mono font-bold">{focus.predicted_next_24h} mm</td></tr>
                <tr><td className="py-1 text-slate-500">What actually fell</td><td className="text-right font-mono">{focus.actual_next_24h} mm</td></tr>
                <tr><td className="py-1 text-slate-500">Confidence</td><td className="text-right font-mono">{Math.round(focus.confidence * 100)}%</td></tr>
              </tbody>
            </table>
          </Card>
          <Card title="Key moments">
            <ul className="text-sm space-y-2">
              {warn && <li>⚠️ <b>First warning:</b> {formatDateTime(warn.issue_time)} – <LevelBadge level={warn.level} short /> ({warn.predicted} mm predicted)</li>}
              <li>💥 <b>Event:</b> {formatDateTime(event.event_time)}</li>
              <li>⏱️ <b>Lead time:</b> {replay.lead_hours ?? '–'} hours</li>
            </ul>
          </Card>
        </div>
      </div>

      <Card className="mt-4" title={`Timeline – ${focus.name}: forecast vs actual rainfall (next 24 h)`}>
        <ResponsiveContainer width="100%" height={280}>
          <ComposedChart data={timeline} margin={{ top: 24, right: 10 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
            <XAxis dataKey="label" />
            <YAxis unit=" mm" width={70} />
            <Tooltip formatter={(v) => `${v} mm`} />
            <Legend />
            <ReferenceLine y={115.6} stroke="#f97316" strokeDasharray="6 4" label={{ value: 'Orange 115.6', fill: '#ea580c', fontSize: 11, position: 'insideTopLeft' }} />
            <ReferenceLine y={204.5} stroke="#dc2626" strokeDasharray="6 4" label={{ value: 'Red 204.5', fill: '#dc2626', fontSize: 11, position: 'insideTopLeft' }} />
            {warn && <ReferenceLine x={formatDate(warn.date).slice(0, 6)} stroke="#f97316" strokeWidth={2} label={{ value: 'First warning', fill: '#ea580c', fontSize: 12, position: 'top' }} />}
            <ReferenceLine x={formatDate(eventDate).slice(0, 6)} stroke="#7f1d1d" strokeWidth={2} label={{ value: 'Event', fill: '#7f1d1d', fontSize: 12, position: 'top' }} />
            <ReferenceLine x={timeline[dayIndex].label} stroke="#0ea5e9" strokeDasharray="3 3" />
            <Bar dataKey="actual" name="Actual rainfall" fill="#94a3b8" />
            <Line dataKey="predicted" name="VarshaAlert forecast" stroke="#2563eb" strokeWidth={3} />
          </ComposedChart>
        </ResponsiveContainer>
      </Card>
    </div>
  )
}
