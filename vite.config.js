import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  // Base path for GitHub Pages or sub-path hosting. Override via VITE_BASE_PATH
  base: process.env.VITE_BASE_PATH || '/onlyui/',
  plugins: [vue()],
  server: {
    port: 5173,
    host: true
  }
})
