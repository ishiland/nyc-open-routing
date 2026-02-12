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

// Static route paint for non-traffic routes (default/fallback)
export const routePaint = {
  "line-width": 5,
  "line-color": "#007cbf",
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
        "line-color": "#22c55e",  // Green for walking
        "line-dasharray": [2, 2] as any,  // Dotted pattern
      }
    case "bike":
      return {
        ...baseStyle,
        "line-color": "#f97316",  // Orange for biking
        "line-dasharray": [4, 2] as any,  // Dashed pattern
      }
    case "drive":
    default:
      return {
        ...baseStyle,
        "line-color": "#007cbf",  // Blue for driving
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
})
