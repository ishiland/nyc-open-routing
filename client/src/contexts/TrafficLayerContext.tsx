import React, { createContext, useState, ReactNode, useCallback, useMemo } from "react"

export interface TrafficLayerContextType {
  showTrafficLayer: boolean
  trafficGeoJson: GeoJSON.FeatureCollection | null
  lastRefresh: string | null
  edgeCount: number
  isLoading: boolean
  setShowTrafficLayer: (show: boolean) => void
  setTrafficGeoJson: (data: GeoJSON.FeatureCollection | null) => void
  setLastRefresh: (ts: string | null) => void
  setEdgeCount: (count: number) => void
  setIsLoading: (loading: boolean) => void
}

export const TrafficLayerContext = createContext<TrafficLayerContextType>({
  showTrafficLayer: false,
  trafficGeoJson: null,
  lastRefresh: null,
  edgeCount: 0,
  isLoading: false,
  setShowTrafficLayer: () => {},
  setTrafficGeoJson: () => {},
  setLastRefresh: () => {},
  setEdgeCount: () => {},
  setIsLoading: () => {},
})

interface TrafficLayerContextProviderProps {
  children: ReactNode
}

export function TrafficLayerContextProvider({
  children,
}: TrafficLayerContextProviderProps) {
  const [showTrafficLayer, setShowTrafficLayerState] = useState(false)
  const [trafficGeoJson, setTrafficGeoJsonState] =
    useState<GeoJSON.FeatureCollection | null>(null)
  const [lastRefresh, setLastRefreshState] = useState<string | null>(null)
  const [edgeCount, setEdgeCountState] = useState(0)
  const [isLoading, setIsLoadingState] = useState(false)

  const setShowTrafficLayer = useCallback((show: boolean) => {
    setShowTrafficLayerState(show)
    // Clear traffic data when toggling off
    if (!show) {
      setTrafficGeoJsonState(null)
    }
  }, [])

  const setTrafficGeoJson = useCallback(
    (data: GeoJSON.FeatureCollection | null) => {
      setTrafficGeoJsonState(data)
    },
    [],
  )

  const setLastRefresh = useCallback((ts: string | null) => {
    setLastRefreshState(ts)
  }, [])

  const setEdgeCount = useCallback((count: number) => {
    setEdgeCountState(count)
  }, [])

  const setIsLoading = useCallback((loading: boolean) => {
    setIsLoadingState(loading)
  }, [])

  const value = useMemo(
    () => ({
      showTrafficLayer,
      trafficGeoJson,
      lastRefresh,
      edgeCount,
      isLoading,
      setShowTrafficLayer,
      setTrafficGeoJson,
      setLastRefresh,
      setEdgeCount,
      setIsLoading,
    }),
    [
      showTrafficLayer,
      trafficGeoJson,
      lastRefresh,
      edgeCount,
      isLoading,
      setShowTrafficLayer,
      setTrafficGeoJson,
      setLastRefresh,
      setEdgeCount,
      setIsLoading,
    ],
  )

  return (
    <TrafficLayerContext.Provider value={value}>
      {children}
    </TrafficLayerContext.Provider>
  )
}
