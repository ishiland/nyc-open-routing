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
