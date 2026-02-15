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
      "/api": {
        target: "http://api:5000",
        changeOrigin: true,
      },
    },
  },
  esbuild: {
    target: "esnext", // Prevent transpilation during dev server
  },
  optimizeDeps: {
    esbuildOptions: {
      target: "esnext", // Prevent transpilation during dependency pre-bundling (fixes __publicField error)
    },
  },
  build: {
    target: "esnext", // Prevent transpilation of modern class fields (fixes __publicField error with MapLibre GL v5)
    rollupOptions: {
      output: {
        manualChunks: {
          "vendor-react": ["react", "react-dom"],
          "vendor-mui": ["@mui/material", "@mui/icons-material", "@mui/system"],
          "vendor-map": ["maplibre-gl", "@turf/helpers", "turf-extent"],
        },
      },
    },
    chunkSizeWarningLimit: 600, // Increase threshold to suppress warnings
  },
  test: {
    globals: true,
    environment: "jsdom",
    setupFiles: ["./src/setupTests.ts"],
    mockReset: true,
    coverage: {
      reporter: ["text", "json", "html"],
      exclude: [
        "node_modules/",
        "src/setupTests.ts",
        "src/testUtils/",
        "**/*.d.ts",
      ],
    },
  },
})
