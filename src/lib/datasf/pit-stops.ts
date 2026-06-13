import type { SFPitStop, SodaPoint } from './types';
import { datasfAppToken } from './env';

const BASE_URL = 'https://data.sfgov.org/resource/mr6h-cr3u.json';

interface FetchPitStopsOptions {
  limit?: number;
}

export async function fetchSFPitStops(
  options: FetchPitStopsOptions = {},
): Promise<SFPitStop[]> {
  const { limit = 500 } = options;

  const appToken = datasfAppToken();

  const params = new URLSearchParams({ $limit: String(limit) });

  if (appToken) {
    params.set('$$app_token', appToken);
  }

  const url = `${BASE_URL}?${params.toString()}`;
  const res = await fetch(url, {
    headers: { Accept: 'application/json' },
    // Pit Stop locations change infrequently; revalidate once per day
    next: { revalidate: 86400 },
  } as RequestInit);

  if (!res.ok) {
    throw new Error(
      `SF Pit Stops fetch failed: ${res.status} ${res.statusText} — ${url}`,
    );
  }

  const raw: unknown[] = await res.json();

  return raw.map((row) => {
    const r = row as Record<string, unknown>;

    // The `location` field from Socrata is a nested object: { latitude, longitude, human_address }
    let location: SodaPoint | undefined;
    if (r['location'] && typeof r['location'] === 'object') {
      const loc = r['location'] as Record<string, string>;
      location = {
        latitude: loc['latitude'] ?? '',
        longitude: loc['longitude'] ?? '',
        human_address: loc['human_address'],
      };
    }

    return {
      name: (r['name'] as string) ?? '',
      address: (r['address'] as string | undefined),
      hours: (r['hours'] as string | undefined),
      neighborhood: (r['neighborhood'] as string | undefined),
      location,
    } satisfies SFPitStop;
  });
}
