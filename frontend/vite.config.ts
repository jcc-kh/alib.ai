import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  // When the real FastAPI backend exists, /api will be proxied to it.
  server: { port: 5173, proxy: { '/api': 'http://localhost:8000' } },
})
