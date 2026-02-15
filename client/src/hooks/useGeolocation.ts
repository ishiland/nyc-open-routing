import { useState, useCallback } from "react"

export interface GeolocationPosition {
  latitude: number
  longitude: number
}

export interface GeolocationResult {
  position: GeolocationPosition | null
  error: string | null
  loading: boolean
}

/**
 * Hook to get user's current location using browser Geolocation API
 * Returns position, error state, and a function to trigger location fetch
 */
export const useGeolocation = () => {
  const [result, setResult] = useState<GeolocationResult>({
    position: null,
    error: null,
    loading: false,
  })

  const getCurrentPosition = useCallback((): Promise<GeolocationPosition> => {
    return new Promise((resolve, reject) => {
      // Check if geolocation is supported
      if (!navigator.geolocation) {
        reject(new Error("Geolocation is not supported by your browser"))
        return
      }

      setResult({ position: null, error: null, loading: true })

      navigator.geolocation.getCurrentPosition(
        position => {
          const pos = {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
          }
          setResult({ position: pos, error: null, loading: false })
          resolve(pos)
        },
        error => {
          let errorMessage: string

          switch (error.code) {
            case error.PERMISSION_DENIED:
              errorMessage =
                "Location access denied. Please enable location permissions in your browser."
              break
            case error.POSITION_UNAVAILABLE:
              errorMessage =
                "Location information unavailable. Please try again."
              break
            case error.TIMEOUT:
              errorMessage = "Location request timed out. Please try again."
              break
            default:
              errorMessage = "An error occurred while retrieving your location."
          }

          setResult({ position: null, error: errorMessage, loading: false })
          reject(new Error(errorMessage))
        },
        {
          enableHighAccuracy: true,
          timeout: 10000, // 10 seconds
          maximumAge: 300000, // 5 minutes cache
        },
      )
    })
  }, [])

  return {
    ...result,
    getCurrentPosition,
  }
}
