// Debounced address autocomplete for the volunteer navigation flow. Queries our
// ORS geocode proxy (/api/geocode) and returns a picked { label, lat, lng }.
// Waypoint-native (kit + design tokens) — not a copy of Pharos's component.

import { useEffect, useId, useRef, useState } from "react";
import { Icon } from "../../components/kit";

export interface GeoPlace {
  label: string;
  lat: number;
  lng: number;
}

interface AddressSearchProps {
  placeholder: string;
  /** The currently chosen place label, shown when collapsed. */
  value: GeoPlace | null;
  onPick: (place: GeoPlace) => void;
  ariaLabel: string;
}

export default function AddressSearch({
  placeholder,
  value,
  onPick,
  ariaLabel,
}: AddressSearchProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<GeoPlace[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const listId = useId();
  const boxRef = useRef<HTMLDivElement>(null);

  // Debounced fetch (≈300ms, min 3 chars).
  useEffect(() => {
    const q = query.trim();
    if (q.length < 3) {
      setResults([]);
      return;
    }
    let active = true;
    setLoading(true);
    const handle = setTimeout(async () => {
      try {
        const res = await fetch("/api/geocode", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ text: q }),
        });
        if (!res.ok) throw new Error(`geocode ${res.status}`);
        const data = (await res.json()) as { results?: GeoPlace[] };
        if (active) {
          setResults(data.results ?? []);
          setOpen(true);
        }
      } catch {
        if (active) setResults([]);
      } finally {
        if (active) setLoading(false);
      }
    }, 300);
    return () => {
      active = false;
      clearTimeout(handle);
    };
  }, [query]);

  // Close the dropdown on outside click.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  const pick = (place: GeoPlace) => {
    onPick(place);
    setQuery("");
    setResults([]);
    setOpen(false);
  };

  return (
    <div ref={boxRef} className="relative" data-no-drag>
      <div className="relative">
        <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-wp-txf">
          <Icon name="search" size={18} />
        </span>
        <input
          type="text"
          role="combobox"
          aria-expanded={open}
          aria-controls={listId}
          aria-label={ariaLabel}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => results.length > 0 && setOpen(true)}
          placeholder={value ? value.label : placeholder}
          className="min-h-[44px] w-full rounded-[12px] border border-wp-line bg-wp-surf py-2.5 pl-10 pr-9 text-[14px] text-wp-tx placeholder:text-wp-txf focus-visible:border-wp-acc focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-wp-acc/40"
        />
        {loading && (
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-wp-txf">
            <Icon name="progress_activity" size={18} />
          </span>
        )}
      </div>

      {open && results.length > 0 && (
        <ul
          id={listId}
          role="listbox"
          className="absolute z-20 mt-1 max-h-60 w-full overflow-auto rounded-[12px] border border-wp-line2 bg-wp-surf2 py-1 shadow-lg"
        >
          {results.map((r) => (
            <li key={`${r.lat},${r.lng}-${r.label}`} role="option" aria-selected={false}>
              <button
                type="button"
                onClick={() => pick(r)}
                className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-[13px] text-wp-tx hover:bg-wp-surf3"
              >
                <Icon name="location_on" size={16} className="shrink-0 text-wp-acc2" />
                <span className="min-w-0 flex-1 truncate">{r.label}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
