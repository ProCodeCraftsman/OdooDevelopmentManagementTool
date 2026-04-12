import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

const useHmr = process.env.VITE_USE_HMR === 'true'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: useHmr
    ? {
        host: '0.0.0.0',
        port: 5173,
        strictPort: false,
        watch: {
          usePolling: true,
          interval: 100,
        },
        hmr: {
          host: '0.0.0.0',
          port: 5173,
        },
        allowedHosts: ['all'],
      }
    : undefined,
})