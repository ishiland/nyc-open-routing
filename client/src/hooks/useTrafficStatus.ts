import { useContext, useEffect, useRef } from "react"
import { TrafficLayerContext } from "../contexts/TrafficLayerContext"
import debug from "../utils/debug"

const POLL_INTERVAL_MS = 30_000 // 30 seconds

export function useTrafficStatus() {
  const { showTrafficLayer, setLastRefresh, setEdgeCount } =
    useContext(TrafficLayerContext)
  const intervalRef = useRef<ReturnType<typeof setInterval>>()

  useEffect(() => {
    if (!showTrafficLayer) {
      clearInterval(intervalRef.current)
      return
    }

    const fetchStatus = async () => {
      try {
        const res = await fetch("/api/traffic/status")
        if (!res.ok) return
        const data = await res.json()
        if (data.last_refresh) setLastRefresh(data.last_refresh)
        if (typeof data.edge_count === "number") setEdgeCount(data.edge_count)
      } catch (err) {
        debug.error("[useTrafficStatus] Poll error:", err)
      }
    }

    // Fetch immediately, then poll
    fetchStatus()
    intervalRef.current = setInterval(fetchStatus, POLL_INTERVAL_MS)

    return () => clearInterval(intervalRef.current)
  }, [showTrafficLayer, setLastRefresh, setEdgeCount])
}
