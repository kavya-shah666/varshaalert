// ForecastChart.jsx - Predicted vs Actual rainfall for the next 6-72 hours,
// with IMD threshold lines (64.5 / 115.6 / 204.5 mm).
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, Legend, CartesianGrid, ReferenceLine,
} from 'recharts'
import { THRESHOLDS } from '../constants.js'

export default function ForecastChart({ leads, height = 300 }) {
  const data = leads.map((l) => ({ ...l, name: `+${l.hour} h` }))
  const maxValue = Math.max(...data.map((d) => Math.max(d.predicted, d.actual)))
  const yMax = Math.ceil(Math.max(maxValue, 220) / 50) * 50   // always show the red line

  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={data} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
        <XAxis dataKey="name" />
        <YAxis domain={[0, yMax]} unit=" mm" width={70} />
        <Tooltip formatter={(v) => `${v} mm`} />
        <Legend />
        {THRESHOLDS.map((t) => (
          <ReferenceLine key={t.value} y={t.value} stroke={t.color} strokeDasharray="6 4"
            label={{ value: t.label, position: 'insideTopLeft', fill: t.color, fontSize: 11 }} />
        ))}
        <Line type="monotone" dataKey="predicted" name="Predicted (ML model)" stroke="#2563eb" strokeWidth={3} dot={{ r: 5 }} />
        <Line type="monotone" dataKey="actual" name="Actual (observed)" stroke="#475569" strokeWidth={2} strokeDasharray="5 5" dot={{ r: 4 }} />
      </LineChart>
    </ResponsiveContainer>
  )
}
