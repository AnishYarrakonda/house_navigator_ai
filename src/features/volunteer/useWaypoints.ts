// Per-journey waypoint reader. There's no `useWaypoints` in the frozen hooks
// surface, so this lane composes one from the consumable `db`: fetch once, then
// re-fetch whenever the journeys topic fires (addWaypoint/completeWaypoint fire
// it). Keeps the "path home grows" view live in mock mode.

import { useEffect, useState } from "react";
import { db } from "../../lib/data";
import type { Waypoint } from "../../types";

export function useWaypoints(journeyId: string | null): Waypoint[] {
  const [waypoints, setWaypoints] = useState<Waypoint[]>([]);

  useEffect(() => {
    if (!journeyId) {
      setWaypoints([]);
      return;
    }
    let active = true;
    const load = () =>
      db.getWaypoints(journeyId).then((wps) => active && setWaypoints(wps));
    load();
    const unsub = db.subscribeJourneys(() => load());
    return () => {
      active = false;
      unsub();
    };
  }, [journeyId]);

  return waypoints;
}
