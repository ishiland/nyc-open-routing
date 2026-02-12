/**
 * Responsive utility functions
 * Helper functions for responsive design calculations
 */

import { BOTTOM_SHEET_SNAP_POINTS } from "./constants"

/**
 * Calculate bottom sheet height based on snap point and viewport height
 *
 * @param snapPoint - Snap point value (0.0 to 1.0)
 * @param viewportHeight - Window inner height in pixels
 * @returns Height in pixels
 */
export const calculateBottomSheetHeight = (
  snapPoint: number,
  viewportHeight: number,
): number => {
  return Math.floor(viewportHeight * snapPoint)
}

/**
 * Get the nearest snap point for a given height
 *
 * @param height - Current height in pixels
 * @param viewportHeight - Window inner height in pixels
 * @returns Nearest snap point (0.0 to 1.0)
 */
export const getNearestSnapPoint = (
  height: number,
  viewportHeight: number,
): number => {
  const ratio = height / viewportHeight

  // Find closest snap point
  let nearest = BOTTOM_SHEET_SNAP_POINTS[0]
  let minDiff = Math.abs(ratio - nearest)

  for (const snapPoint of BOTTOM_SHEET_SNAP_POINTS) {
    const diff = Math.abs(ratio - snapPoint)
    if (diff < minDiff) {
      minDiff = diff
      nearest = snapPoint
    }
  }

  return nearest
}

/**
 * Calculate if a swipe gesture should trigger snap point change
 *
 * @param deltaY - Vertical distance swiped (positive = down, negative = up)
 * @param velocity - Swipe velocity in px/ms
 * @param threshold - Minimum distance to trigger (pixels)
 * @returns Direction to snap ('up' | 'down' | null)
 */
export const calculateSwipeDirection = (
  deltaY: number,
  velocity: number,
  threshold: number = 50,
): "up" | "down" | null => {
  // Fast swipe (high velocity) triggers even with small distance
  const velocityThreshold = 0.5 // px/ms

  if (Math.abs(deltaY) < threshold && Math.abs(velocity) < velocityThreshold) {
    return null
  }

  return deltaY > 0 ? "down" : "up"
}

/**
 * Get index of next snap point in direction
 *
 * @param currentSnapPoint - Current snap point value
 * @param direction - Direction to move ('up' | 'down')
 * @returns Next snap point value or current if at boundary
 */
export const getNextSnapPoint = (
  currentSnapPoint: number,
  direction: "up" | "down",
): number => {
  const currentIndex = BOTTOM_SHEET_SNAP_POINTS.indexOf(currentSnapPoint)

  if (currentIndex === -1) {
    // If not at a snap point, find nearest
    return getNearestSnapPoint(currentSnapPoint, 1) // Normalized
  }

  if (direction === "up") {
    // Expand (increase snap point)
    const nextIndex = Math.min(
      currentIndex + 1,
      BOTTOM_SHEET_SNAP_POINTS.length - 1,
    )
    return BOTTOM_SHEET_SNAP_POINTS[nextIndex]
  } else {
    // Collapse (decrease snap point)
    const nextIndex = Math.max(currentIndex - 1, 0)
    return BOTTOM_SHEET_SNAP_POINTS[nextIndex]
  }
}

/**
 * Calculate viewport dimensions accounting for browser chrome
 *
 * @returns Object with width and height in pixels
 */
export const getViewportDimensions = () => {
  return {
    width: window.innerWidth,
    height: window.innerHeight,
  }
}

/**
 * Check if device is likely mobile based on viewport and touch support
 *
 * @returns Boolean indicating mobile device
 */
export const isMobileDevice = (): boolean => {
  const { width } = getViewportDimensions()
  const hasTouch =
    typeof window !== "undefined" &&
    ("ontouchstart" in window || navigator.maxTouchPoints > 0)

  return width < 600 || (width < 905 && hasTouch)
}

/**
 * Calculate touch target size for accessibility
 * Ensures minimum 44x44px touch targets (WCAG 2.1 Level AAA)
 *
 * @param size - Desired size in pixels
 * @param minimum - Minimum accessible size (default 44px)
 * @returns Size that meets accessibility standards
 */
export const ensureMinTouchTarget = (
  size: number,
  minimum: number = 44,
): number => {
  return Math.max(size, minimum)
}
