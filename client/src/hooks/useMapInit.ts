// useMapInit.ts

import { useEffect, RefObject, useRef } from "react"
import maplibregl from "maplibre-gl"
import debug from "../utils/debug"
import {
  NYC_DEFAULT_CENTER,
  NYC_DEFAULT_ZOOM,
  MAP_STYLE_LOAD_TIMEOUT_MS,
  MAP_RESIZE_DELAY_MS,
} from "../utils/constants"

const NYC_STYLE_URL = "https://layers-api.planninglabs.nyc/v1/base/style.json"

interface UseMapInitOptions {
  initialCenter?: [number, number]
  initialZoom?: number
  onMapLoad?: () => void
}

/**
 * Custom hook to initialize and manage a MapLibre GL map instance
 */
const useMapInit = (
  containerRef: RefObject<HTMLDivElement>,
  {
    initialCenter = NYC_DEFAULT_CENTER,
    initialZoom = NYC_DEFAULT_ZOOM,
    onMapLoad,
  }: UseMapInitOptions = {},
): maplibregl.Map | null => {
  // Use ref instead of state to avoid re-renders
  const mapRef = useRef<maplibregl.Map | null>(null)
  const styleLoadTimeoutRef = useRef<ReturnType<typeof setTimeout>>()

  useEffect(() => {
    if (!containerRef.current) return

    let mapInstance: maplibregl.Map | null = null

    // Define handlers with refs so we can properly clean them up
    const handleResize = () => {
      if (mapInstance) {
        mapInstance.resize()
      }
    }

    const handleMessage = (e: MessageEvent) => {
      if (e.data === "resize" && mapInstance) {
        debug.log("Resize triggered by parent window")
        mapInstance.resize()
      }
    }

    try {
      debug.log("Initializing map...")

      // Check if container is visible and has dimensions
      const container = containerRef.current
      const containerWidth = container.offsetWidth
      const containerHeight = container.offsetHeight
      debug.log(`Container dimensions: ${containerWidth}x${containerHeight}`)

      if (containerWidth === 0 || containerHeight === 0) {
        debug.warn("Map container has zero width or height!")
      }

      // Check if app is running in an iframe
      const isInIframe = window.self !== window.top
      if (isInIframe) {
        debug.log("Application is running inside an iframe")
      }

      // Initialize the map with a cachebuster for the style URL
      const mapOptions: maplibregl.MapOptions & {
        preserveDrawingBuffer?: boolean
      } = {
        container: containerRef.current,
        style: `${NYC_STYLE_URL}?t=${Date.now()}`,
        center: initialCenter,
        zoom: initialZoom,
        preserveDrawingBuffer: true,
      }

      mapInstance = new maplibregl.Map(mapOptions)
      mapRef.current = mapInstance

      // Add custom transform request handler
      mapInstance.setTransformRequest((url, resourceType) => {
        // Add cachebuster to tile requests
        if (
          (resourceType === "Tile" ||
            resourceType === "Source" ||
            resourceType === "Glyphs" ||
            resourceType === "SpriteJSON" ||
            resourceType === "SpriteImage") &&
          url.includes("planninglabs.nyc")
        ) {
          debug.log(`Requesting resource: ${resourceType} - ${url}`)
          return {
            url: url, // Now relying only on style URL cachebuster
          }
        }
        return { url }
      })

      // Set a timeout to log a warning if style takes too long to load
      styleLoadTimeoutRef.current = setTimeout(() => {
        if (mapInstance) {
          debug.warn(
            `Style load taking longer than expected (${MAP_STYLE_LOAD_TIMEOUT_MS / 1000}s)`,
          )
        }
      }, MAP_STYLE_LOAD_TIMEOUT_MS)

      // Wait for the map to be fully loaded and rendered
      mapInstance.once("idle", () => {
        debug.log("All style layers and tiles are in place")
        if (styleLoadTimeoutRef.current) {
          clearTimeout(styleLoadTimeoutRef.current)
        }

        if (onMapLoad) {
          onMapLoad()
        }

        // Force a resize to ensure the map renders correctly
        setTimeout(() => {
          mapInstance?.resize()
        }, MAP_RESIZE_DELAY_MS)
      })

      // Handle errors
      mapInstance.on("error", e => {
        debug.error("Map error:", e.error)
      })

      // Add window resize handler to ensure the map stays responsive
      window.addEventListener("resize", handleResize)

      // For iframes, listen to parent window messages
      if (isInIframe) {
        window.addEventListener("message", handleMessage)
      }
    } catch (error) {
      debug.error("Error initializing map:", error)
    }

    // Return cleanup function
    return () => {
      // Always clean up timeout
      if (styleLoadTimeoutRef.current) {
        clearTimeout(styleLoadTimeoutRef.current)
      }

      // Clean up event listeners with proper references
      window.removeEventListener("resize", handleResize)

      // Check for iframe state before removing message listener
      if (window.self !== window.top) {
        window.removeEventListener("message", handleMessage)
      }

      // Clean up map instance
      if (mapInstance) {
        mapInstance.remove()
        mapRef.current = null
      }
    }
  }, [containerRef, initialCenter, initialZoom, onMapLoad])

  return mapRef.current
}

export default useMapInit
