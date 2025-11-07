import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': {
        target: 'https://caiwu-backend.bingyizhou6u.workers.dev',
        changeOrigin: true
      }
    }
  },
  build: {
    outDir: 'dist'
  }
})


