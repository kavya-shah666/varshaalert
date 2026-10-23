// vite.config.js - settings for the React development server and build.
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    // PWA = the website can be "installed" on a phone like an app
    VitePWA({
      registerType: 'autoUpdate',
      devOptions: { enabled: true },            // also works with "npm run dev"
      includeAssets: ['favicon.svg'],
      manifest: {
        name: 'VarshaAlert - Heavy Rainfall Early Warning',
        short_name: 'VarshaAlert',
        description: 'Heavy rainfall and flood alerts for citizens (SIH26071, MoES)',
        theme_color: '#0f172a',
        background_color: '#0f172a',
        display: 'standalone',
        start_url: '/citizen',                   // installed app opens the citizen view
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' },
        ],
      },
      workbox: {
        navigateFallbackDenylist: [/^\/api/],
        runtimeCaching: [
          // API data: try the network first, use the saved copy when offline
          { urlPattern: /\/api\//, handler: 'NetworkFirst',
            options: { cacheName: 'api', networkTimeoutSeconds: 3 } },
          // Map tiles: keep them once downloaded
          { urlPattern: /tile\.openstreetmap\.org/, handler: 'CacheFirst',
            options: { cacheName: 'map-tiles', expiration: { maxEntries: 2000 } } },
        ],
      },
    }),
  ],
  server: {
    host: true,   // allow phones on the same Wi-Fi to open the app
    port: 5173,
    // Every request to /api is forwarded to the FastAPI backend
    proxy: { '/api': 'http://localhost:8000' },
  },
})
