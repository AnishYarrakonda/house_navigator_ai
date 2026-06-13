import type { NWSForecastPeriod, SFWeather } from './types';

const NWS_POINTS_URL = 'https://api.weather.gov/points/37.7749,-122.4194';
const USER_AGENT = 'Waypoint Hackathon';

const RAIN_KEYWORDS = [
  'rain',
  'drizzle',
  'shower',
  'precipitation',
  'thunderstorm',
  'storm',
  'sleet',
];

interface NWSPointsResponse {
  properties: {
    forecast: string;
    forecastHourly: string;
  };
}

interface NWSForecastResponse {
  properties: {
    periods: NWSForecastPeriod[];
  };
}

export async function fetchSFWeather(): Promise<SFWeather> {
  // Step 1 — resolve the forecast URL for the SF grid point
  const pointsRes = await fetch(NWS_POINTS_URL, {
    headers: {
      'User-Agent': USER_AGENT,
      Accept: 'application/geo+json',
    },
  });

  if (!pointsRes.ok) {
    throw new Error(
      `NWS points request failed: ${pointsRes.status} ${pointsRes.statusText}`,
    );
  }

  const pointsData: NWSPointsResponse = await pointsRes.json();
  const forecastUrl = pointsData.properties.forecast;

  // Step 2 — fetch the 7-day forecast periods
  const forecastRes = await fetch(forecastUrl, {
    headers: {
      'User-Agent': USER_AGENT,
      Accept: 'application/geo+json',
    },
  });

  if (!forecastRes.ok) {
    throw new Error(
      `NWS forecast request failed: ${forecastRes.status} ${forecastRes.statusText}`,
    );
  }

  const forecastData: NWSForecastResponse = await forecastRes.json();
  const periods = forecastData.properties.periods;

  if (periods.length === 0) {
    throw new Error('NWS forecast returned no periods');
  }

  // Prefer the first overnight period so we get tonight's conditions;
  // fall back to the first period available if no night period found yet.
  const tonight =
    periods.find((p) => !p.isDaytime && p.name.toLowerCase().includes('night')) ??
    periods.find((p) => !p.isDaytime) ??
    periods[0];

  // Normalize to °F for the cold threshold
  const tempF =
    tonight.temperatureUnit === 'F'
      ? tonight.temperature
      : tonight.temperature * (9 / 5) + 32;

  const forecastLower = tonight.shortForecast.toLowerCase();
  const rain = RAIN_KEYWORDS.some((kw) => forecastLower.includes(kw));

  return {
    periodName: tonight.name,
    temperature: tonight.temperature,
    temperatureUnit: tonight.temperatureUnit,
    shortForecast: tonight.shortForecast,
    cold: tempF < 50,
    rain,
  };
}
