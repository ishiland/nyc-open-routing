import { useContext, useEffect } from "react"
import { TrafficLayerContext } from "../contexts/TrafficLayerContext"
import { MapInstanceContext } from "../contexts/MapInstanceContext"
import { getTrafficLayerPaint } from "../utils/style"
import { removeMapLayerAndSource, enforceLayerOrder } from "../utils/mapHelpers"

const SOURCE_ID = "trafficSource"
const LAYER_ID = "trafficLayer"
const SOURCE_LAYER = "traffic"

export function useTrafficLayer() {
  const { map } = useContext(MapInstanceContext)
  const { showTrafficLayer } = useContext(TrafficLayerContext)

  useEffect(() => {
    if (!map) return

    if (showTrafficLayer) {
      if (!map.getSource(SOURCE_ID)) {
        map.addSource(SOURCE_ID, {
          type: "vector",
          tiles: [
            `${window.location.origin}/api/traffic/tiles/{z}/{x}/{y}.pbf`,
          ],
          minzoom: 8,
          maxzoom: 18,
        })
      }
      if (!map.getLayer(LAYER_ID)) {
        map.addLayer({
          id: LAYER_ID,
          type: "line",
          source: SOURCE_ID,
          "source-layer": SOURCE_LAYER,
          paint: getTrafficLayerPaint(),
        })
        enforceLayerOrder(map)
      }
    } else {
      removeMapLayerAndSource(map, LAYER_ID, SOURCE_ID)
    }
  }, [map, showTrafficLayer])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (map) removeMapLayerAndSource(map, LAYER_ID, SOURCE_ID)
    }
  }, [map])
}
