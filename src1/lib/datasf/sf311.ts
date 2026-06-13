import type { SF311Report } from './types';

const BASE_URL = 'https://data.sfgov.org/resource/vw6y-z8j6.json';

interface FetchSF311Options {
  limit?: number;
  offset?: number;
}

export async function fetchSF311Encampments(
  options: FetchSF311Options = {},
): Promise<SF311Report[]> {
  const { limit = 100, offset = 0 } = options;

  const appToken = process.env.DATASF_APP_TOKEN;

  const params = new URLSearchParams({
    $where: "service_name='Encampment'",
    $limit: String(limit),
    $offset: String(offset),
    $order: 'requested_datetime DESC',
  });

  if (appToken) {
    params.set('$$app_token', appToken);
  }

  const url = `${BASE_URL}?${params.toString()}`;
  const res = await fetch(url, {
    headers: { Accept: 'application/json' },
    // Next.js 14 fetch cache — revalidate every 6 h (data is a nightly dump)
    next: { revalidate: 21600 },
  } as RequestInit);

  if (!res.ok) {
    throw new Error(
      `SF 311 fetch failed: ${res.status} ${res.statusText} — ${url}`,
    );
  }

  const raw: unknown[] = await res.json();

  return raw.map((row) => {
    const r = row as Record<string, string>;
    return {
      lat: r['lat'] ?? '',
      long: r['long'] ?? '',
      requested_datetime: r['requested_datetime'] ?? '',
      analysis_neighborhood: r['analysis_neighborhood'] ?? '',
      status_description: r['status_description'] ?? '',
    } satisfies SF311Report;
  });
}
