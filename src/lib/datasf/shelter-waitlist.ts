import type { ShelterWaitlistEntry, ShelterWaitlistRaw } from './types';
import { datasfAppToken } from './env';

const BASE_URL = 'https://data.sfgov.org/resource/w4sk-nq57.json';

// Try these field names in order until one has a value
const DATE_FIELD_CANDIDATES = ['date', 'report_date', 'entry_date', 'week_of', 'as_of_date'];
const COUNT_FIELD_CANDIDATES = ['count', 'total', 'waitlist_total', 'current_waitlist', 'num_on_waitlist'];

function resolveField(
  row: ShelterWaitlistRaw,
  candidates: string[],
): string | undefined {
  for (const key of candidates) {
    if (row[key] !== undefined && row[key] !== '') return row[key];
  }
  return undefined;
}

export async function fetchShelterWaitlist(): Promise<ShelterWaitlistEntry[]> {
  const appToken = datasfAppToken();

  const params = new URLSearchParams({
    $limit: '30',
    $order: 'date DESC',
  });

  if (appToken) {
    params.set('$$app_token', appToken);
  }

  const url = `${BASE_URL}?${params.toString()}`;
  const res = await fetch(url, {
    headers: { Accept: 'application/json' },
    // Waitlist is published nightly; revalidate every 6 h
    next: { revalidate: 21600 },
  } as RequestInit);

  if (!res.ok) {
    throw new Error(
      `HSH Shelter Waitlist fetch failed: ${res.status} ${res.statusText} — ${url}`,
    );
  }

  const raw: ShelterWaitlistRaw[] = await res.json();

  return raw
    .map((row): ShelterWaitlistEntry | null => {
      const dateStr = resolveField(row, DATE_FIELD_CANDIDATES);
      const countStr = resolveField(row, COUNT_FIELD_CANDIDATES);

      if (!dateStr || !countStr) return null;

      const count = parseInt(countStr, 10);
      if (Number.isNaN(count)) return null;

      return { date: dateStr, count };
    })
    .filter((entry): entry is ShelterWaitlistEntry => entry !== null);
}
