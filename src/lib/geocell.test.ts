// Foundation smoke test — proves the geofuzzing privacy primitive round-trips
// and that nearby precise points collapse to the same ~250m cell (so a person's
// exact location can never be recovered from a stored cell).

import { describe, expect, it } from "vitest";
import { GEOCELL_SIZE_DEG, SF_CENTER } from "../config";
import { geocellCenter, toGeocell } from "./geocell";

describe("geocell", () => {
  it("snaps two nearby points to the same cell", () => {
    // Start from a cell center so a small offset stays inside the same cell,
    // regardless of where SF_CENTER falls relative to the grid boundaries.
    const [lng, lat] = geocellCenter(toGeocell(SF_CENTER.lat, SF_CENTER.lng));
    const nudge = GEOCELL_SIZE_DEG * 0.2;
    const a = toGeocell(lat, lng);
    const b = toGeocell(lat + nudge, lng - nudge);
    expect(b).toBe(a);
  });

  it("resolves a cell to a center within the cell bounds", () => {
    const cell = toGeocell(SF_CENTER.lat, SF_CENTER.lng);
    const [lng, lat] = geocellCenter(cell);
    expect(Math.abs(lat - SF_CENTER.lat)).toBeLessThan(GEOCELL_SIZE_DEG);
    expect(Math.abs(lng - SF_CENTER.lng)).toBeLessThan(GEOCELL_SIZE_DEG);
  });

  it("falls back to SF center for an unknown cell (leaks nothing)", () => {
    const [lng, lat] = geocellCenter("not-a-cell");
    expect(lng).toBe(SF_CENTER.lng);
    expect(lat).toBe(SF_CENTER.lat);
  });
});
