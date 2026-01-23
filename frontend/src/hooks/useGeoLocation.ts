// useGeoLocation hook for GPS capture
import { useState, useEffect, useCallback } from 'react'
import { useForemanMobileStore } from '@/stores/foremanMobileStore'

interface GeoLocationOptions {
  enableHighAccuracy?: boolean
  timeout?: number
  maximumAge?: number
}

interface GeoLocationState {
  latitude: number | null
  longitude: number | null
  accuracy: number | null
  error: string | null
  loading: boolean
}

const defaultOptions: GeoLocationOptions = {
  enableHighAccuracy: true,
  timeout: 10000,
  maximumAge: 60000, // 1 minute cache
}

export function useGeoLocation(options: GeoLocationOptions = {}) {
  const [state, setState] = useState<GeoLocationState>({
    latitude: null,
    longitude: null,
    accuracy: null,
    error: null,
    loading: false,
  })

  const { setCurrentLocation, setGpsError } = useForemanMobileStore()
  const mergedOptions = { ...defaultOptions, ...options }

  const getCurrentPosition = useCallback(() => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      const error = 'Geolocation is not supported by this browser'
      setState((s) => ({ ...s, error, loading: false }))
      setGpsError(error)
      return
    }

    setState((s) => ({ ...s, loading: true, error: null }))

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude, accuracy } = position.coords
        setState({
          latitude,
          longitude,
          accuracy,
          error: null,
          loading: false,
        })
        setCurrentLocation({ lat: latitude, lng: longitude })
        setGpsError(null)
      },
      (error) => {
        let errorMessage = 'Failed to get location'
        switch (error.code) {
          case error.PERMISSION_DENIED:
            errorMessage = 'Location permission denied'
            break
          case error.POSITION_UNAVAILABLE:
            errorMessage = 'Location unavailable'
            break
          case error.TIMEOUT:
            errorMessage = 'Location request timed out'
            break
        }
        setState((s) => ({ ...s, error: errorMessage, loading: false }))
        setGpsError(errorMessage)
      },
      mergedOptions
    )
  }, [mergedOptions.enableHighAccuracy, mergedOptions.timeout, mergedOptions.maximumAge, setCurrentLocation, setGpsError])

  // Get position on mount
  useEffect(() => {
    getCurrentPosition()
  }, []) // Only run once on mount

  return {
    ...state,
    refresh: getCurrentPosition,
    isSupported: typeof navigator !== 'undefined' && 'geolocation' in navigator,
  }
}
