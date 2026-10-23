// Inundation.jsx - flood map: blue cells = predicted flooding (darker = deeper),
// with a 0-72 hour time slider and a Play button.
import { useEffect, useState } from 'react'
import { GeoJSON } from 'react-leaflet'
import { getJSON } from '../api.js'
import { STATES } from '../constants.js'
import { Card, Stat, LevelBadge, ErrorBox } from '../components/Common.jsx'
import RiskMap from '../components/RiskMap.jsx'

// Water depth (m) -> shade of blue
const DEPTH_COLORS = [
  { max: 0.3, color: '#bfdbfe', label: '< 0.3 m' },
  { max: 0.75, color: '#60a5fa', label: '0.3 – 0.75 m' },
  { max: 1.5, color: '#2563eb', label: '0.75 – 1.5 m' },
  { max: 2.5, color: '#1d4ed8', label: '1.5 – 2.5 m' },
  { max: 99, color: '#1e3a8a', label: '> 2.5 m' },
]
const depthColor = (d) => DEPTH_COLORS.find((c) => d < c.max).color

export default function Inundation() {
  const [allDistricts, setAllDistricts] = useState(null)
  const [districtId, setDistrictId] = useState('TN01')    // Chennai by default
  const [hour, setHour] = useState(24)
  const [playing, setPlaying] = useState(false)
  const [flood, setFlood] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => { getJSON('/districts').then(setAllDistricts).catch(setError) }, [])

  // Fetch the flood grid whenever district or hour changes
  useEffect(() => {
    getJSON(`/inundation/${districtId}?hour=${hour}`).then(setFlood).catch(setError)
  }, [districtId, hour])

  // Play button: move the slider forward 6 hours every 1.2 seconds
  useEffect(() => {
    if (!playing) return
    const timer = setInterval(() => {
      setHour((h) => {
        if (h >= 72) { setPlaying(false); return 72 }
        return h + 6
      })
    }, 1200)
    return () => clearInterval(timer)
  }, [playing])

  const feature = allDistricts?.features.find((f) => f.properties.id === districtId)
  const outline = feature ? { type: 'FeatureCollection', features: [feature] } : null
  const p = feature?.properties
  const s = flood?.stats

  return (
    <div>
      <ErrorBox error={error} />
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <Card className="xl:col-span-2" title="Inundation (flood) prediction map"
          right={
            <select value={districtId} onChange={(e) => setDistrictId(e.target.value)}
              className="border border-slate-300 rounded-lg px-3 py-1.5 text-sm bg-white">
              {STATES.map((st) => (
                <optgroup key={st} label={st}>
                  {allDistricts?.features.filter((f) => f.properties.state === st).map((f) => (
                    <option key={f.properties.id} value={f.properties.id}>
                      {f.properties.name} ({f.properties.level})
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
          }>
          <RiskMap data={outline} selectedId={districtId} fillOpacity={0.12} height={500}>
            {flood && (
              <GeoJSON key={`${districtId}-${hour}`} data={flood}
                style={(f) => ({ fillColor: depthColor(f.properties.depth), fillOpacity: 0.8, weight: 0 })}
                onEachFeature={(f, layer) => layer.bindTooltip(
                  `Depth ${f.properties.depth} m · Elevation ${f.properties.elevation} m`)} />
            )}
          </RiskMap>

          {/* Time slider */}
          <div className="mt-4 flex items-center gap-3">
            <button onClick={() => { if (hour >= 72) setHour(0); setPlaying(!playing) }}
              className="bg-sky-600 hover:bg-sky-700 text-white rounded-lg px-4 py-2 text-sm font-semibold w-24">
              {playing ? '⏸ Pause' : '▶ Play'}
            </button>
            <input type="range" min="0" max="72" step="6" value={hour}
              onChange={(e) => { setPlaying(false); setHour(Number(e.target.value)) }} className="flex-1 accent-sky-600" />
            <div className="font-mono font-bold w-20 text-right">+{hour} h</div>
          </div>
          <div className="flex justify-between text-xs text-slate-400 px-28 -mt-1">
            <span>Now</span><span>24 h</span><span>48 h</span><span>72 h</span>
          </div>

          <div className="mt-3 flex flex-wrap gap-4 text-xs">
            <b>Water depth:</b>
            {DEPTH_COLORS.map((c) => (
              <span key={c.label} className="flex items-center gap-1">
                <span className="w-4 h-4 rounded" style={{ background: c.color }} />{c.label}
              </span>
            ))}
          </div>
        </Card>

        <div className="space-y-4">
          {p && (
            <Card title={`${p.name}, ${p.state}`} right={<LevelBadge level={p.level} />}>
              <p className="text-sm text-slate-600">
                Predicted 24-hour rainfall: <b>{p.predicted_rain} mm</b> · Elevation {p.elevation} m
              </p>
            </Card>
          )}
          {s && (
            <div className="grid grid-cols-2 gap-3">
              <Stat label={`Rain till +${hour} h`} value={`${s.rain_mm} mm`} />
              <Stat label="Flooded area" value={`${s.flooded_area_km2} km²`}
                sub={`${((s.flooded_area_km2 / s.total_area_km2) * 100).toFixed(1)}% of district`} color="#1d4ed8" />
              <Stat label="Max depth" value={`${s.max_depth_m} m`} color="#1e3a8a" />
              <Stat label="Flooded cells" value={s.flooded_cells} sub={`each ≈ ${s.cell_area_km2} km²`} />
            </div>
          )}
          <Card title="How the flood model works">
            <ol className="list-decimal list-inside text-sm text-slate-600 space-y-1">
              <li>Read the district elevation grid (DEM GeoTIFF – SRTM / Bhuvan) using <code>rasterio</code>.</li>
              <li>Take the ML-predicted rainfall up to the selected hour.</li>
              <li>The first 50 mm soaks into the soil; the rest becomes runoff.</li>
              <li>Runoff collects in valleys: water rises above the lowest nearby ground (HAND method).</li>
              <li>Flat, low cells flood first; steep slopes drain away.</li>
            </ol>
          </Card>
        </div>
      </div>
    </div>
  )
}
