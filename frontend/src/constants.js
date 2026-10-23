// constants.js - values shared by many pages (colours, thresholds, states).

// IMD-style colour codes for each risk level
export const LEVELS = {
  green:  { color: '#16a34a', name: 'Green',  label: 'Normal',  text: '#ffffff', range: '< 64.5 mm' },
  yellow: { color: '#facc15', name: 'Yellow', label: 'Watch',   text: '#0f172a', range: '64.5 - 115.5 mm' },
  orange: { color: '#f97316', name: 'Orange', label: 'Alert',   text: '#ffffff', range: '115.6 - 204.4 mm' },
  red:    { color: '#dc2626', name: 'Red',    label: 'Warning', text: '#ffffff', range: '>= 204.5 mm' },
}
export const LEVEL_ORDER = ['red', 'orange', 'yellow', 'green']

// IMD 24-hour rainfall thresholds (mm)
export const THRESHOLDS = [
  { value: 64.5, label: 'Heavy 64.5', color: '#ca8a04' },
  { value: 115.6, label: 'Very heavy 115.6', color: '#ea580c' },
  { value: 204.5, label: 'Extremely heavy 204.5', color: '#dc2626' },
]

export const STATES = ['Kerala', 'Tamil Nadu', 'Maharashtra', 'Assam']

// Format an ISO date/time nicely, e.g. "23 Oct 2026, 08:30"
export function formatDateTime(iso) {
  return new Date(iso).toLocaleString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false,
  })
}
export function formatDate(iso) {
  return new Date(iso).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
}
