import { defineConfig } from "vitest/config"
import react from "@vitejs/plugin-react"

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    open: false,
    host: "0.0.0.0",
    port: 3000,
    proxy: {
      '/api': {
        target: 'http://api:5000',
        changeOrigin: true,
      }
    },
  },
  test: {
    globals: true,
    environment: "jsdom",
    setupFiles: "src/setupTests",
    mockReset: true,
  },
})
