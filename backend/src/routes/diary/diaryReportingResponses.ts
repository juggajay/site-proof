const WEATHER_UNAVAILABLE_MESSAGE = 'Weather auto-population unavailable. Enter weather manually.';

export type WeatherLocation = {
  latitude: number;
  longitude: number;
  fromProjectState: boolean;
};

export type DailyWeatherData = {
  time?: string[];
  weather_code?: number[];
  temperature_2m_min?: number[];
  temperature_2m_max?: number[];
  precipitation_sum?: number[];
};

export type DiaryDelayResponseItem = {
  diaryDate: Date | string;
  delayType: string;
  durationHours: number | null;
};

export function buildWeatherUnavailableResponse(date: string, location: WeatherLocation) {
  return {
    date,
    weatherConditions: null,
    temperatureMin: null,
    temperatureMax: null,
    rainfallMm: null,
    source: null,
    unavailable: true,
    message: WEATHER_UNAVAILABLE_MESSAGE,
    location,
  };
}

export function buildWeatherResponse(
  dailyWeather: DailyWeatherData,
  weatherCondition: string,
  location: WeatherLocation,
) {
  return {
    date: dailyWeather.time?.[0],
    weatherConditions: weatherCondition,
    temperatureMin: dailyWeather.temperature_2m_min?.[0],
    temperatureMax: dailyWeather.temperature_2m_max?.[0],
    rainfallMm: dailyWeather.precipitation_sum?.[0] || 0,
    source: 'Open-Meteo',
    unavailable: false,
    location,
  };
}

export function buildDiaryDelaysResponse<TDelay extends DiaryDelayResponseItem>(delays: TDelay[]) {
  const summaryByType: Record<string, { count: number; totalHours: number }> = {};
  for (const delay of delays) {
    if (!summaryByType[delay.delayType]) {
      summaryByType[delay.delayType] = { count: 0, totalHours: 0 };
    }
    summaryByType[delay.delayType].count++;
    summaryByType[delay.delayType].totalHours += delay.durationHours || 0;
  }

  const totalDelays = delays.length;
  const totalHours = delays.reduce((sum, delay) => sum + (delay.durationHours || 0), 0);

  return {
    delays: delays.sort(
      (a, b) => new Date(b.diaryDate).getTime() - new Date(a.diaryDate).getTime(),
    ),
    summary: {
      totalDelays,
      totalHours,
      byType: summaryByType,
    },
  };
}

export function buildDiaryTimelineResponse<TTimelineItem>(timeline: TTimelineItem[]) {
  return { timeline };
}
