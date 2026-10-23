// RiskMap.jsx - Leaflet map that colours each district by its risk level.
// Used by: Live Risk Map, Inundation Map (with extra layers) and Historical Replay.
import { useEffect } from 'react'
import { MapContainer, TileLayer, GeoJSON, useMap } from 'react-leaflet'
import L from 'leaflet'
import { LEVELS } from '../constants.js'

// Zoom the map so all districts in `data` are visible
function FitBounds({ data }) {
  const map = useMap()
  useEffect(() => {
    if (data?.features?.length) {
      map.invalidateSize()   // re-measure the map box first, otherwise it may zoom to the maximum
      map.fitBounds(L.geoJSON(data).getBounds(), { padding: [20, 20] })
    }
  }, [data, map])
  return null
}

// HTML shown when a district is clicked
function popupHtml(p) {
  const level = LEVELS[p.level]
  return `
    <div style="min-width:180px">
      <div style="font-weight:700;font-size:15px">${p.name}</div>
      <div style="color:#64748b;font-size:12px;margin-bottom:6px">${p.state}</div>
      <div style="background:${level.color};color:${level.text};padding:3px 8px;border-radius:6px;display:inline-block;font-weight:600">
        ${level.name} – ${level.label}
      </div>
      <table style="margin-top:8px;font-size:13px">
        <tr><td>Predicted rain (24 h)</td><td style="padding-left:8px;font-weight:700">${p.predicted_rain} mm</td></tr>
        <tr><td>Confidence</td><td style="padding-left:8px;font-weight:700">${Math.round(p.confidence * 100)}%</td></tr>
        ${p.heavy_prob !== undefined ? `<tr><td>Heavy-rain probability</td><td style="padding-left:8px;font-weight:700">${Math.round(p.heavy_prob * 100)}%</td></tr>` : ''}
      </table>
    </div>`
}

export default function RiskMap({ data, selectedId, onSelect, height = 480, fillOpacity = 0.75, children }) {
  if (!data) return <div style={{ height }} className="rounded-xl bg-slate-200 animate-pulse" />

  const style = (feature) => {
    const p = feature.properties
    const selected = p.id === selectedId
    return {
      fillColor: LEVELS[p.level]?.color ?? '#94a3b8',
      fillOpacity,
      color: selected ? '#0f172a' : '#ffffff',
      weight: selected ? 3 : 1,
    }
  }

  const onEachFeature = (feature, layer) => {
    layer.bindTooltip(feature.properties.name, { sticky: true })
    if (feature.properties.predicted_rain !== undefined) layer.bindPopup(popupHtml(feature.properties))
    layer.on('click', () => onSelect?.(feature.properties.id))
  }

  // GeoJSON layers don't redraw by themselves, so we give them a "key" that
  // changes whenever the colours or selection change -> React re-creates the layer.
  const key = data.features.map((f) => f.properties.id + f.properties.level).join() + selectedId

  return (
    // fadeAnimation off: with React StrictMode the tile fade-in can get stuck invisible
    <MapContainer center={[20.5, 78.9]} zoom={5} fadeAnimation={false} style={{ height, width: '100%' }} className="rounded-xl z-0">
      {/* Background map (needs internet). Offline, the coloured districts still work. */}
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <GeoJSON key={key} data={data} style={style} onEachFeature={onEachFeature} />
      <FitBounds data={data} />
      {children}
    </MapContainer>
  )
}
