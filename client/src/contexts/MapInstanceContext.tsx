import React, {
  createContext,
  useState,
  useCallback,
  ReactNode,
  useMemo,
} from "react"
import maplibregl from "maplibre-gl"

/**
 * Lightweight context for managing the MapLibre GL map instance
 * This context has a single, focused responsibility: managing the map instance
 */
interface MapInstanceContextType {
  map: maplibregl.Map | null
  setMap: (map: maplibregl.Map) => void
}

export const MapInstanceContext = createContext<MapInstanceContextType>({
  map: null,
  setMap: () => {},
})

interface MapInstanceProviderProps {
  children: ReactNode
}

export const MapInstanceProvider: React.FC<MapInstanceProviderProps> = ({
  children,
}) => {
  const [map, setMapState] = useState<maplibregl.Map | null>(null)

  const setMap = useCallback((mapInstance: maplibregl.Map) => {
    setMapState(mapInstance)
  }, [])

  const value = useMemo(
    () => ({
      map,
      setMap,
    }),
    [map, setMap],
  )

  return (
    <MapInstanceContext.Provider value={value}>
      {children}
    </MapInstanceContext.Provider>
  )
}
