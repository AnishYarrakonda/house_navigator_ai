// Crisis matching — proves the *tonight* loop's core rule: only places that can
// serve the need AND have open capacity surface, nearest (from the FUZZED cell)
// first. This is the M1 placeholder the Triage Agent later reasons on top of.

import { describe, expect, it } from "vitest";
import { toGeocell } from "../../lib/geocell";
import type { ResourceNode } from "../../types";
import { capacityTone, matchNodes, walkingMinutes } from "./matching";

const node = (over: Partial<ResourceNode>): ResourceNode => ({
  id: "n",
  name: "n",
  type: "bed",
  lat: 37.78,
  lng: -122.41,
  capacity_total: 100,
  capacity_open: 10,
  ...over,
});

describe("matchNodes", () => {
  const cell = toGeocell(37.78, -122.41);

  it("excludes nodes of the wrong type", () => {
    const nodes = [
      node({ id: "bed", type: "bed" }),
      node({ id: "food", type: "food" }),
    ];
    const ids = matchNodes("food", cell, nodes).map((m) => m.node.id);
    expect(ids).toEqual(["food"]);
  });

  it("excludes full nodes (capacity_open === 0)", () => {
    const nodes = [
      node({ id: "full", capacity_open: 0 }),
      node({ id: "open", capacity_open: 5 }),
    ];
    const ids = matchNodes("bed", cell, nodes).map((m) => m.node.id);
    expect(ids).toEqual(["open"]);
  });

  it("includes both hygiene and water for a hygiene need", () => {
    const nodes = [
      node({ id: "shower", type: "hygiene" }),
      node({ id: "water", type: "water" }),
      node({ id: "bed", type: "bed" }),
    ];
    const ids = matchNodes("hygiene", cell, nodes).map((m) => m.node.id).sort();
    expect(ids).toEqual(["shower", "water"]);
  });

  it("ranks nearer nodes first", () => {
    const nodes = [
      node({ id: "far", lat: 37.9, lng: -122.5 }),
      node({ id: "near", lat: 37.781, lng: -122.411 }),
    ];
    const ids = matchNodes("bed", cell, nodes).map((m) => m.node.id);
    expect(ids[0]).toBe("near");
  });
});

describe("capacityTone", () => {
  it("is full at zero, filling when scarce, open otherwise", () => {
    expect(capacityTone(node({ capacity_open: 0 }))).toBe("full");
    expect(capacityTone(node({ capacity_total: 100, capacity_open: 5 }))).toBe(
      "filling",
    );
    expect(capacityTone(node({ capacity_total: 100, capacity_open: 50 }))).toBe(
      "open",
    );
  });
});

describe("walkingMinutes", () => {
  it("converts metres to a rough walk", () => {
    expect(walkingMinutes(0)).toBe(0);
    expect(walkingMinutes(800)).toBe(10);
  });
});
