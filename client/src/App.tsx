// App.tsx
import React, { Suspense, lazy } from "react"
import { ErrorBoundary } from "react-error-boundary"
import MessageContextProvider from "./contexts/MessageContext"
import { RoutingContextProvider } from "./contexts/RoutingContext"
import { MapInstanceProvider } from "./contexts/MapInstanceContext"
import { ErrorFallback } from "./components/shared/ErrorFallback"
import { SkipLink } from "./components/shared/SkipLink"
import { LoadingSpinner } from "./components/shared/LoadingSpinner"

// Lazy load heavy components
const Sidebar = lazy(() => import("./components/Sidebar"))
const MapLibreGLMap = lazy(() => import("./components/MapLibreGLMap"))

const App: React.FC = () => {
  return (
    <ErrorBoundary
      FallbackComponent={ErrorFallback}
      onReset={() => {
        // Reload the page on reset
        window.location.href = "/"
      }}
    >
      <SkipLink />
      <div
        style={{
          height: "100vh",
          overflow: "hidden",
          display: "flex",
        }}
      >
        <MessageContextProvider>
          <RoutingContextProvider>
            <MapInstanceProvider>
              <Suspense
                fallback={<LoadingSpinner message="Loading application..." />}
              >
                <aside aria-label="Route controls" style={{ flexShrink: 0 }}>
                  <Sidebar />
                </aside>
                <main
                  id="main-content"
                  role="main"
                  aria-label="Interactive map"
                  style={{ flex: 1, overflow: "hidden" }}
                >
                  <MapLibreGLMap />
                </main>
              </Suspense>
            </MapInstanceProvider>
          </RoutingContextProvider>
        </MessageContextProvider>
      </div>
    </ErrorBoundary>
  )
}

export default App
