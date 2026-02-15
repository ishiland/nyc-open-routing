import { MODE_COLORS } from "./theme"

// Enhanced marker styling with better visibility
export const addressPointPaint = {
  "circle-stroke-width": 4,
  "circle-stroke-color": "#ffffff",
  "circle-radius": 14,
  "circle-blur": 0,
  "circle-opacity": 0.95,
}

// Modern green for start marker
export const startPointColor = "#22c55e"

// Modern red for end marker
export const endPointColor = "#ef4444"

// Blue for waypoint markers (distinct from start green and end red)
export const waypointPointColor = "#3b82f6"

// Traffic color scale based on traffic engineering standards
// Maps traffic_factor values to colors:
// 1.0 = Free flow (green)
// 1.2-1.5 = Light congestion (yellow)
// 1.5-1.8 = Moderate congestion (orange)
// 1.8-2.5 = Heavy congestion (red)
// >2.5 = Severe congestion (dark red)
export const trafficColorScale = {
  freeFlow: "#22c55e",      // Green
  light: "#facc15",         // Yellow
  moderate: "#f97316",      // Orange
  heavy: "#ef4444",         // Red
  severe: "#991b1b",        // Dark red
}

// Mode-specific route paint styles
// Returns different line styles and colors based on travel mode
export const getModeRoutePaint = (mode: "drive" | "bike" | "walk") => {
  const baseStyle = {
    "line-width": [
      "interpolate",
      ["linear"],
      ["zoom"],
      12, 3,   // At zoom 12, width = 3px
      16, 6,   // At zoom 16, width = 6px
    ] as any,
    "line-opacity": 0.9,
  }

  switch (mode) {
    case "walk":
      return {
        ...baseStyle,
        "line-color": MODE_COLORS.walk,  // Dark orange for walking
        "line-dasharray": [2, 2] as any,  // Dotted pattern
      }
    case "bike":
      return {
        ...baseStyle,
        "line-color": MODE_COLORS.bike,  // Dark green for biking
        "line-dasharray": [4, 2] as any,  // Dashed pattern
      }
    case "drive":
    default:
      return {
        ...baseStyle,
        "line-color": MODE_COLORS.drive,  // MTA Blue for driving
        "line-dasharray": null,  // Explicitly reset to solid line (removes dashed pattern)
      }
  }
}

// Route halo/glow effect for better visibility against complex base maps
// This should be rendered BENEATH the main route layer
export const routeHaloPaint = {
  "line-width": [
    "interpolate",
    ["linear"],
    ["zoom"],
    12, 7,   // At zoom 12, width = 7px (wider than route)
    16, 10,  // At zoom 16, width = 10px
  ] as any,
  "line-color": "#ffffff",
  "line-opacity": 0.7,
  "line-blur": 1.5,  // Creates soft glow effect
}

// Isochrone band colors: green (5min) → yellow (10min) → orange (15min) → red (20min)
export const ISOCHRONE_BAND_COLORS = ["#22c55e", "#facc15", "#f97316", "#ef4444"]

export const getIsochroneFillPaint = () => ({
  "fill-color": [
    "match",
    ["get", "band_index"],
    1, "#22c55e",
    2, "#facc15",
    3, "#f97316",
    4, "#ef4444",
    "#94a3b8",
  ] as any,
  "fill-opacity": 0.25,
})

export const getIsochroneEdgePaint = () => ({
  "line-color": [
    "match",
    ["get", "band_index"],
    1, "#22c55e",
    2, "#facc15",
    3, "#f97316",
    4, "#ef4444",
    "#94a3b8",
  ] as any,
  "line-width": [
    "interpolate",
    ["linear"],
    ["zoom"],
    10, 1,
    13, 2,
    16, 4,
  ] as any,
  "line-opacity": 0.85,
})

export const getIsochroneOutlinePaint = () => ({
  "line-color": [
    "match",
    ["get", "band_index"],
    1, "#22c55e",
    2, "#facc15",
    3, "#f97316",
    4, "#ef4444",
    "#94a3b8",
  ] as any,
  "line-width": 2,
  "line-opacity": 0.7,
})

// Traffic color stops for legend display
export const TRAFFIC_COLOR_STOPS = [
  { factor: 1.0, color: trafficColorScale.freeFlow, label: "Free Flow" },
  { factor: 1.2, color: trafficColorScale.light, label: "Light" },
  { factor: 1.5, color: trafficColorScale.moderate, label: "Moderate" },
  { factor: 1.8, color: trafficColorScale.heavy, label: "Heavy" },
  { factor: 2.5, color: trafficColorScale.severe, label: "Severe" },
] as const

// Traffic layer paint for map overlay (thinner lines, lower opacity than route paint)
export const getTrafficLayerPaint = () => ({
  "line-width": [
    "interpolate",
    ["linear"],
    ["zoom"],
    10, 1,
    13, 2,
    16, 4,
  ] as any,
  "line-color": [
    "interpolate",
    ["linear"],
    ["get", "traffic_factor"],
    1.0, trafficColorScale.freeFlow,
    1.2, trafficColorScale.light,
    1.5, trafficColorScale.moderate,
    1.8, trafficColorScale.heavy,
    2.5, trafficColorScale.severe,
  ] as any,
  "line-opacity": 0.7,
})

// Traffic-aware route paint using MapLibre GL expressions
// Uses interpolate to smoothly transition between colors based on traffic_factor
export const getTrafficRoutePaint = () => ({
  // Zoom-responsive line width (thinner at low zoom, thicker at high zoom)
  "line-width": [
    "interpolate",
    ["linear"],
    ["zoom"],
    12, 3,   // At zoom 12, width = 3px
    16, 6,   // At zoom 16, width = 6px
  ] as any,
  // Color based on traffic_factor property
  "line-color": [
    "interpolate",
    ["linear"],
    ["get", "traffic_factor"],
    1.0, trafficColorScale.freeFlow,
    1.2, trafficColorScale.light,
    1.5, trafficColorScale.moderate,
    1.8, trafficColorScale.heavy,
    2.5, trafficColorScale.severe,
  ] as any,
  "line-opacity": 0.9,
  "line-dasharray": null,  // Reset dashed pattern from bike/walk modes
})
