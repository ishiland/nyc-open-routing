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
export const NYC_SINGLE_POINT_ZOOM = 14
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
// Routing & API
// =======================
export const ROUTE_FETCH_TIMEOUT_MS = 30000 // 30 seconds

// =======================
// UI Dimensions
// =======================
export const SIDEBAR_WIDTH_PX = 330
export const DROPDOWN_Z_INDEX = 101
export const OVERLAY_Z_INDEX = 999

// =======================
// Accessibility
// =======================
/** Length for random autocomplete attribute strings */
export const RANDOM_STRING_LENGTH = 15

// =======================
// Loading Spinner Sizes
// =======================
export const SPINNER_SIZE = {
  SMALL: 16,  // Inline elements
  MEDIUM: 24, // Buttons
  LARGE: 40,  // Full-page loading
} as const
