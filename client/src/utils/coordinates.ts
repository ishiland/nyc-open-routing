import { COORDINATE_EPSILON } from "./constants"
import { IMapFeature } from "../types/interfaces"

/**
 * Coordinate comparison utilities
 */

/**
 * Compare two coordinate arrays for equality
 * Uses epsilon comparison for floating point precision
 * @param a First coordinate array [longitude, latitude]
 * @param b Second coordinate array [longitude, latitude]
 * @param epsilon Precision threshold (default: 0.000001, approximately 0.1 meters)
 * @returns true if coordinates are equal within epsilon precision
 */
export const coordinatesEqual = (
  a: number[],
  b: number[],
  epsilon: number = COORDINATE_EPSILON,
): boolean => {
  if (a.length !== b.length) return false
  return a.every((val, i) => Math.abs(val - b[i]) < epsilon)
}

/**
 * Check if two address features are different based on label and coordinates
 * @param currentAddress Current address feature (can be null)
 * @param newAddress New address feature to compare
 * @param newLabel Label from the new address
 * @returns true if addresses are different, false if they are the same
 */
export const areAddressesDifferent = (
  currentAddress: IMapFeature | null,
  newAddress: IMapFeature,
  newLabel: string,
): boolean => {
  // If no current address, they're different
  if (!currentAddress) {
    return true
  }

  // If both are Point geometries, compare both label and coordinates
  if (
    currentAddress.geometry.type === "Point" &&
    newAddress.geometry.type === "Point"
  ) {
    return (
      currentAddress.properties?.label !== newLabel ||
      !coordinatesEqual(
        currentAddress.geometry.coordinates,
        newAddress.geometry.coordinates,
      )
    )
  }

  // Fallback to label comparison if not both are points
  return currentAddress.properties?.label !== newLabel
}
