// Small display formatters for the volunteer navigation UI.

/** Meters → a short imperial-ish distance string ("450 ft", "1.2 mi"). */
export function formatDistance(meters: number): string {
  const miles = meters / 1609.34;
  if (miles < 0.1) {
    const feet = Math.round(meters * 3.281);
    return `${feet} ft`;
  }
  return `${miles.toFixed(1)} mi`;
}

/** Seconds → a short duration string ("3 min", "1 hr 5 min"). */
export function formatDuration(seconds: number): string {
  const mins = Math.max(1, Math.round(seconds / 60));
  if (mins < 60) return `${mins} min`;
  const hrs = Math.floor(mins / 60);
  const rem = mins % 60;
  return rem ? `${hrs} hr ${rem} min` : `${hrs} hr`;
}

/** A clock-time ETA `minutes` from now, e.g. "4:35 PM". */
export function formatEta(seconds: number): string {
  const eta = new Date(Date.now() + seconds * 1000);
  return eta.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}
