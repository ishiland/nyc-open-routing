/**
 * Application-wide constants
 * Centralized location for all magic numbers and configuration values
 */

// =======================
// Unit Conversions
// =======================
export const FEET_PER_MILE = 5280
export const DISTANCE_THRESHOLD_FEET = 1000

// =======================
// Coordinate Precision
// =======================
/** Epsilon for coordinate comparison (~0.1 meters precision) */
export const COORDINATE_EPSILON = 0.000001

// =======================
// NYC Default Map Settings
// =======================
export const NYC_DEFAULT_CENTER: [number, number] = [-73.978159, 40.759975]
export const NYC_DEFAULT_ZOOM = 10
export const NYC_BOUNDS_PADDING = 50

// =======================
// Search Configuration
// =======================
export const SEARCH_MIN_LENGTH = 3
export const SEARCH_DEBOUNCE_DELAY_MS = 300
export const SEARCH_BLUR_DELAY_MS = 200
export const SEARCH_READONLY_DELAY_MS = 100
export const SEARCH_CACHE_TTL_MS = 3600000 // 1 hour
export const SEARCH_CACHE_MAX_SIZE = 100

// =======================
// Map Loading
// =======================
export const MAP_STYLE_LOAD_TIMEOUT_MS = 30000 // 30 seconds
export const MAP_RESIZE_DELAY_MS = 100

// =======================
// UI Dimensions
// =======================
export const SIDEBAR_WIDTH_PX = 400
export const SIDEBAR_WIDTH_TABLET_PX = 340
export const SIDEBAR_COLLAPSED_WIDTH_PX = 56
export const DROPDOWN_Z_INDEX = 1210
export const BOTTOM_SHEET_Z_INDEX = 1200
export const MAP_CONTROLS_Z_INDEX = 1050

// =======================
// Touch & Mobile
// =======================
export const BOTTOM_SHEET_SNAP_POINTS = [0.4, 0.6, 0.9] // 40%, 60%, 90% of viewport height
export const BOTTOM_SHEET_DRAG_HANDLE_HEIGHT_PX = 36

// =======================
// Accessibility
// =======================
/** Length for random autocomplete attribute strings */
export const RANDOM_STRING_LENGTH = 15

