// App.jsx - decides which page to show for each URL (routing).
import { Routes, Route } from 'react-router-dom'
import Layout from './components/Layout.jsx'
import Dashboard from './pages/Dashboard.jsx'
import Inundation from './pages/Inundation.jsx'
import Replay from './pages/Replay.jsx'
import Alerts from './pages/Alerts.jsx'
import Accuracy from './pages/Accuracy.jsx'
import About from './pages/About.jsx'
import Citizen from './pages/Citizen.jsx'

export default function App() {
  return (
    <Routes>
      {/* Officials' dashboard pages share the sidebar + top bar layout */}
      <Route element={<Layout />}>
        <Route path="/" element={<Dashboard />} />
        <Route path="/inundation" element={<Inundation />} />
        <Route path="/replay" element={<Replay />} />
        <Route path="/alerts" element={<Alerts />} />
        <Route path="/accuracy" element={<Accuracy />} />
        <Route path="/about" element={<About />} />
      </Route>
      {/* Citizen mobile app (PWA) has its own simple layout */}
      <Route path="/citizen" element={<Citizen />} />
    </Routes>
  )
}
