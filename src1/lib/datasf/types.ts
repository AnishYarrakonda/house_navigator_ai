// ─── SF 311 Encampment Reports ───────────────────────────────────────────────

export interface SF311Report {
  lat: string;
  long: string;
  requested_datetime: string;
  analysis_neighborhood: string;
  status_description: string;
}

// ─── SF Pit Stops ────────────────────────────────────────────────────────────

// Socrata Point type returned in the `location` field
export interface SodaPoint {
  latitude: string;
  longitude: string;
  human_address?: string;
}

export interface SFPitStop {
  name: string;
  address?: string;
  hours?: string;
  neighborhood?: string;
  location?: SodaPoint;
}

// ─── HSH Shelter Waitlist ────────────────────────────────────────────────────

// Field names vary across published versions of this dataset; keep raw + normalized
export interface ShelterWaitlistRaw {
  date?: string;
  report_date?: string;
  entry_date?: string;
  count?: string;
  total?: string;
  waitlist_total?: string;
  [key: string]: string | undefined;
}

export interface ShelterWaitlistEntry {
  date: string;
  count: number;
}

// ─── NWS Weather ─────────────────────────────────────────────────────────────

export interface NWSForecastPeriod {
  name: string;
  temperature: number;
  temperatureUnit: string;
  shortForecast: string;
  detailedForecast: string;
  isDaytime: boolean;
}

export interface SFWeather {
  periodName: string;
  temperature: number;
  temperatureUnit: string;
  shortForecast: string;
  cold: boolean; // true when temperature < 50 °F
  rain: boolean;
}
