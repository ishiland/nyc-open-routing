import React, {
  createContext,
  useState,
  ReactNode,
  useCallback,
  useMemo,
} from "react"

export interface TrafficLayerContextType {
  showTrafficLayer: boolean
  lastRefresh: string | null
  edgeCount: number
  setShowTrafficLayer: (show: boolean) => void
  setLastRefresh: (ts: string | null) => void
  setEdgeCount: (count: number) => void
}

export const TrafficLayerContext = createContext<TrafficLayerContextType>({
  showTrafficLayer: false,
  lastRefresh: null,
  edgeCount: 0,
  setShowTrafficLayer: () => {},
  setLastRefresh: () => {},
  setEdgeCount: () => {},
})

interface TrafficLayerContextProviderProps {
  children: ReactNode
}

export function TrafficLayerContextProvider({
  children,
}: TrafficLayerContextProviderProps) {
  const [showTrafficLayer, setShowTrafficLayerState] = useState(false)
  const [lastRefresh, setLastRefreshState] = useState<string | null>(null)
  const [edgeCount, setEdgeCountState] = useState(0)

  const setShowTrafficLayer = useCallback((show: boolean) => {
    setShowTrafficLayerState(show)
  }, [])

  const setLastRefresh = useCallback((ts: string | null) => {
    setLastRefreshState(ts)
  }, [])

  const setEdgeCount = useCallback((count: number) => {
    setEdgeCountState(count)
  }, [])

  const value = useMemo(
    () => ({
      showTrafficLayer,
      lastRefresh,
      edgeCount,
      setShowTrafficLayer,
      setLastRefresh,
      setEdgeCount,
    }),
    [
      showTrafficLayer,
      lastRefresh,
      edgeCount,
      setShowTrafficLayer,
      setLastRefresh,
      setEdgeCount,
    ],
  )

  return (
    <TrafficLayerContext.Provider value={value}>
      {children}
    </TrafficLayerContext.Provider>
  )
}
