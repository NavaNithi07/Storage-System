import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    host: true,   // Expose on all network interfaces (0.0.0.0) — allows LAN access
    port: 5173,
    // Allow Cloudflare tunnel hostnames (trycloudflare.com) and any other external hosts
    allowedHosts: 'all',
    proxy: {
      // Proxy /api and /health to the local backend so remote visitors
      // (via Cloudflare tunnel) never need to reach localhost:5000 directly.
      '/api': {
        target: 'http://localhost:5000',
        changeOrigin: true,
        secure: false,
      },
      '/health': {
        target: 'http://localhost:5000',
        changeOrigin: true,
        secure: false,
      },
    },
  },
})
