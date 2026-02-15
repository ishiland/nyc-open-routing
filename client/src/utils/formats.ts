import { FEET_PER_MILE, DISTANCE_THRESHOLD_FEET } from "./constants"

interface Route {
  properties: {
    travel_time: number
    distance: number
  }
}

export const formatDistance = (feet: number): string => {
  let distance = ""
  if (feet > DISTANCE_THRESHOLD_FEET) {
    distance = `${(feet / FEET_PER_MILE).toFixed(1)} mi`
  } else {
    distance = `${Math.floor(feet)} ft`
  }
  return distance
}

export const formatTotalRouteTime = (routes: Route[]): string => {
  let time = ""
  const minutes = routes
    .map(x => x.properties.travel_time)
    .reduce((a, c) => a + c)
  if (minutes > 60) {
    const quotient = Math.floor(minutes / 60)
    const remainder = Math.floor(minutes % 60)
    time = `${quotient} hr ${remainder} min`
  } else {
    time = `${Math.floor(minutes)} min`
  }
  return time
}

export const formatTotalRouteDistance = (routes: Route[]): string => {
  const feet = routes.map(x => x.properties.distance).reduce((a, c) => a + c)
  return formatDistance(feet)
}

/**
 * Calculates and formats the arrival time based on route duration
 * @param routes - Array of route features
 * @returns Formatted arrival time string (e.g., "Arrive 3:45 PM")
 */
export const formatArrivalTime = (routes: Route[]): string => {
  const totalMinutes = routes
    .map(x => x.properties.travel_time)
    .reduce((a, c) => a + c, 0)

  const now = new Date()
  const arrivalTime = new Date(now.getTime() + totalMinutes * 60000) // Add minutes in milliseconds

  // Format time as "h:mm AM/PM"
  let hours = arrivalTime.getHours()
  const minutes = arrivalTime.getMinutes()
  const ampm = hours >= 12 ? "PM" : "AM"

  hours = hours % 12
  hours = hours || 12 // Convert 0 to 12

  const formattedMinutes = minutes < 10 ? `0${minutes}` : minutes
  return `Arrive ${hours}:${formattedMinutes} ${ampm}`
}
