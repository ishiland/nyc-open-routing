// App.tsx
import React, { Suspense, lazy } from "react"
import { ErrorBoundary } from "react-error-boundary"
import MessageContextProvider from "./contexts/MessageContext"
import { RoutingContextProvider } from "./contexts/RoutingContext"
import { IsochroneContextProvider } from "./contexts/IsochroneContext"
import { TrafficLayerContextProvider } from "./contexts/TrafficLayerContext"
import { MapInstanceProvider } from "./contexts/MapInstanceContext"
import { ErrorFallback } from "./components/shared/ErrorFallback"
import { SkipLink } from "./components/shared/SkipLink"
import { LoadingSpinner } from "./components/shared/LoadingSpinner"
import { DismissibleBanner } from "./components/shared/DismissibleBanner"
import { RouteStateManager } from "./components/RouteStateManager"

// Lazy load heavy components
const Sidebar = lazy(() => import("./components/Sidebar"))
const MapLibreGLMap = lazy(() => import("./components/MapLibreGLMap"))
const AdaptiveLayout = lazy(() => import("./components/layouts/AdaptiveLayout"))

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
      <DismissibleBanner />
      <MessageContextProvider>
        <TrafficLayerContextProvider>
          <IsochroneContextProvider>
            <RoutingContextProvider>
              <RouteStateManager>
                <MapInstanceProvider>
                  <Suspense
                    fallback={<LoadingSpinner message="Loading application..." />}
                  >
                    <AdaptiveLayout
                      sidebar={<Sidebar />}
                      map={<MapLibreGLMap />}
                    />
                  </Suspense>
                </MapInstanceProvider>
              </RouteStateManager>
            </RoutingContextProvider>
          </IsochroneContextProvider>
        </TrafficLayerContextProvider>
      </MessageContextProvider>
    </ErrorBoundary>
  )
}

export default App
