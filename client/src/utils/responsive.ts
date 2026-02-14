/**
 * Responsive utility functions for bottom sheet behavior
 */

import { BOTTOM_SHEET_SNAP_POINTS } from "./constants"

/**
 * Get the nearest snap point for a given height
 *
 * @param height - Current height in pixels
 * @param viewportHeight - Window inner height in pixels
 * @returns Nearest snap point (0.0 to 1.0)
 */
const getNearestSnapPoint = (
  height: number,
  viewportHeight: number,
): number => {
  const ratio = height / viewportHeight

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
    return getNearestSnapPoint(currentSnapPoint, 1)
  }

  if (direction === "up") {
    const nextIndex = Math.min(
      currentIndex + 1,
      BOTTOM_SHEET_SNAP_POINTS.length - 1,
    )
    return BOTTOM_SHEET_SNAP_POINTS[nextIndex]
  } else {
    const nextIndex = Math.max(currentIndex - 1, 0)
    return BOTTOM_SHEET_SNAP_POINTS[nextIndex]
  }
}
