import { Cloud, Sun, CloudRain, CloudLightning, Wind, CloudFog, Loader2 } from 'lucide-react'

interface WeatherData {
  conditions: string
  temperatureMin: string
  temperatureMax: string
  rainfallMm: string
}

interface DiaryWeatherBarProps {
  weather: WeatherData | null
  weatherSource: string | null
  loading: boolean
  onTapEdit: () => void
}

const weatherIcons: Record<string, typeof Cloud> = {
  'Fine': Sun,
  'Partly Cloudy': Cloud,
  'Cloudy': Cloud,
  'Rain': CloudRain,
  'Heavy Rain': CloudRain,
  'Storm': CloudLightning,
  'Wind': Wind,
  'Fog': CloudFog,
}

export function DiaryWeatherBar({ weather, weatherSource: _weatherSource, loading, onTapEdit }: DiaryWeatherBarProps) {
  if (loading) {
    return (
      <div className="flex items-center gap-2 px-4 py-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
        <Loader2 className="h-4 w-4 animate-spin text-blue-500" />
        <span className="text-sm text-blue-600 dark:text-blue-400">Fetching weather...</span>
      </div>
    )
  }

  if (!weather || !weather.conditions) {
    return (
      <button
        onClick={onTapEdit}
        className="w-full flex items-center gap-2 px-4 py-3 bg-amber-50 dark:bg-amber-900/20 rounded-lg touch-manipulation min-h-[44px]"
      >
        <Cloud className="h-4 w-4 text-amber-500" />
        <span className="text-sm text-amber-600 dark:text-amber-400">Tap to add weather</span>
      </button>
    )
  }

  const Icon = weatherIcons[weather.conditions] || Cloud

  return (
    <button
      onClick={onTapEdit}
      className="w-full flex items-center gap-3 px-4 py-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg touch-manipulation min-h-[44px]"
    >
      <Icon className="h-5 w-5 text-blue-500 flex-shrink-0" />
      <div className="flex-1 text-left">
        <span className="text-sm font-medium">
          {weather.conditions}
          {weather.temperatureMin && weather.temperatureMax && (
            <> &middot; {weather.temperatureMin}&deg;&ndash;{weather.temperatureMax}&deg;C</>
          )}
          {weather.rainfallMm && Number(weather.rainfallMm) > 0 && (
            <> &middot; {weather.rainfallMm}mm</>
          )}
        </span>
      </div>
      <span className="text-xs text-blue-400">Edit</span>
    </button>
  )
}
