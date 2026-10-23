// Accuracy.jsx - MODEL ACCURACY: every number here comes from models/metrics.json,
// which ml/train.py writes after testing the model on 2024 data it never saw.
import { useEffect, useState } from 'react'
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid,
  ScatterChart, Scatter, ReferenceLine,
} from 'recharts'
import { getJSON } from '../api.js'
import { LEVELS } from '../constants.js'
import { Card, Stat, ErrorBox } from '../components/Common.jsx'

const FEATURE_NAMES = {
  rain_1d: 'Rain – last 1 day', rain_3d: 'Rain – last 3 days', rain_7d: 'Rain – last 7 days',
  humidity: 'Humidity', temperature: 'Temperature', pressure: 'Pressure', wind_speed: 'Wind speed',
  cloud_top_temp: 'Cloud-top temp (INSAT-3D)', radar_dbz: 'Radar reflectivity (DWR)',
  nwp_rain: 'NWP rain forecast (NCMRWF)', month: 'Month (season)', elevation: 'Elevation (DEM)',
}

export default function Accuracy() {
  const [m, setM] = useState(null)
  const [error, setError] = useState(null)
  useEffect(() => { getJSON('/metrics').then(setM).catch(setError) }, [])
  if (!m) return <div><ErrorBox error={error} /><div className="h-96 rounded-xl bg-slate-200 animate-pulse" /></div>

  const r = m.regression
  const c = m.classification
  const [[tn, fp], [fn, tp]] = c.confusion_matrix
  const importance = m.feature_importance.map((f) => ({ ...f, name: FEATURE_NAMES[f.feature] ?? f.feature, pct: +(f.importance * 100).toFixed(1) }))
  const maxCell = Math.max(...m.level_confusion.matrix.flat())
  // Same scale on both axes so the "perfect forecast" diagonal is at 45 degrees
  const maxRain = Math.ceil(Math.max(...m.scatter.map((p) => Math.max(p.actual, p.predicted))) / 100) * 100

  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-600">
        Trained on <b>{m.trained_on}</b> ({m.train_rows.toLocaleString()} rows) · Tested on <b>{m.tested_on}</b> ({m.test_rows.toLocaleString()} rows, never seen during training).
      </p>

      {/* Regression metrics */}
      <h2 className="font-semibold text-slate-700">Rainfall amount model (Random Forest Regressor)</h2>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Stat label="RMSE" value={`${r.rmse} mm`} sub="Root Mean Squared Error – lower is better" />
        <Stat label="MAE" value={`${r.mae} mm`} sub="Average error per forecast" />
        <Stat label="R² score" value={r.r2} sub="1.0 = perfect, 0 = no skill" color="#2563eb" />
        <Stat label="Better than raw NWP" value={`${r.improvement_over_nwp_pct}%`} sub={`NWP alone RMSE = ${r.nwp_baseline_rmse} mm`} color="#16a34a" />
      </div>

      {/* Classification metrics */}
      <h2 className="font-semibold text-slate-700 pt-2">Heavy-rain classifier (≥ {c.threshold_mm} mm) – Random Forest Classifier</h2>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Stat label="Recall" value={`${Math.round(c.recall * 100)}%`} sub="Heavy-rain days we caught" color="#16a34a" />
        <Stat label="Precision" value={`${Math.round(c.precision * 100)}%`} sub="Our warnings that were correct" />
        <Stat label="F1 score" value={c.f1} sub="Balance of precision & recall" />
        <Stat label="Accuracy" value={`${(c.accuracy * 100).toFixed(1)}%`} sub="All days (most are dry)" />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <Card title="Confusion matrix – heavy rain YES / NO">
          <div className="grid grid-cols-[auto_1fr_1fr] gap-2 text-center text-sm">
            <div />
            <div className="text-xs font-semibold text-slate-500">Predicted: No heavy rain</div>
            <div className="text-xs font-semibold text-slate-500">Predicted: Heavy rain</div>
            <div className="text-xs font-semibold text-slate-500 self-center">Actual: No</div>
            <div className="bg-green-100 rounded-lg p-4"><div className="text-2xl font-bold">{tn.toLocaleString()}</div><div className="text-xs">True negative</div></div>
            <div className="bg-amber-100 rounded-lg p-4"><div className="text-2xl font-bold">{fp}</div><div className="text-xs">False alarm</div></div>
            <div className="text-xs font-semibold text-slate-500 self-center">Actual: Yes</div>
            <div className="bg-red-100 rounded-lg p-4"><div className="text-2xl font-bold">{fn}</div><div className="text-xs">Missed event</div></div>
            <div className="bg-green-200 rounded-lg p-4"><div className="text-2xl font-bold">{tp}</div><div className="text-xs">Correct warning</div></div>
          </div>
          <p className="text-xs text-slate-500 mt-3">
            For early warning, <b>missing</b> a heavy-rain day is worse than a false alarm, so the model is tuned for high recall.
          </p>
        </Card>

        <Card title="Colour-level confusion matrix (Green / Yellow / Orange / Red)">
          <table className="w-full text-center text-sm">
            <thead>
              <tr><th className="text-xs text-slate-500">Actual ↓ / Predicted →</th>
                {m.level_confusion.labels.map((l) => <th key={l} className="text-xs py-1" style={{ color: LEVELS[l].color === '#facc15' ? '#a16207' : LEVELS[l].color }}>{LEVELS[l].name}</th>)}
              </tr>
            </thead>
            <tbody>
              {m.level_confusion.matrix.map((row, i) => (
                <tr key={i}>
                  <td className="text-xs font-semibold py-1">{LEVELS[m.level_confusion.labels[i]].name}</td>
                  {row.map((v, j) => (
                    // Darker blue = more days. Diagonal = correct.
                    <td key={j} className={`p-2 font-mono ${i === j ? 'font-bold ring-2 ring-inset ring-slate-900/20' : ''}`}
                        style={{ background: `rgba(37,99,235,${v === 0 ? 0.03 : 0.12 + 0.88 * Math.log1p(v) / Math.log1p(maxCell)})`, color: v / maxCell > 0.3 ? '#fff' : '#0f172a' }}>
                      {v.toLocaleString()}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
          <p className="text-xs text-slate-500 mt-3">Diagonal cells = correct colour. Most other errors are only one level away.</p>
        </Card>

        <Card title="Feature importance – which data matters most">
          <ResponsiveContainer width="100%" height={340}>
            <BarChart data={importance} layout="vertical" margin={{ left: 40, right: 20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis type="number" unit="%" domain={[0, Math.ceil(importance[0].pct / 10) * 10]} />
              <YAxis type="category" dataKey="name" width={170} tick={{ fontSize: 12 }} />
              <Tooltip formatter={(v) => `${v}%`} />
              <Bar dataKey="pct" name="Importance" fill="#2563eb" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Card>

        <Card title="Predicted vs Actual rainfall (test year 2024)">
          <ResponsiveContainer width="100%" height={340}>
            <ScatterChart margin={{ top: 10, right: 20, bottom: 20, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis type="number" dataKey="actual" name="Actual" unit=" mm" domain={[0, maxRain]} label={{ value: 'Actual (mm)', position: 'insideBottom', offset: -10 }} />
              <YAxis type="number" dataKey="predicted" name="Predicted" unit=" mm" domain={[0, maxRain]} width={70} />
              <Tooltip cursor={{ strokeDasharray: '3 3' }} />
              {/* Perfect forecast line: predicted = actual */}
              <ReferenceLine segment={[{ x: 0, y: 0 }, { x: maxRain, y: maxRain }]} stroke="#dc2626" strokeDasharray="5 5" />
              <Scatter data={m.scatter} fill="#2563eb" fillOpacity={0.5} />
            </ScatterChart>
          </ResponsiveContainer>
          <p className="text-xs text-slate-500">Points close to the red dashed line = accurate forecasts.</p>
        </Card>
      </div>
    </div>
  )
}
