// React hooks wrapping `db`. Each fetches once, auto-subscribes for live
// updates, and cleans up on unmount. UI lanes use these instead of calling `db`
// directly. FROZEN for the lanes.

import { useEffect, useState } from "react";
import type {
  ForesightAlert,
  HeatCell,
  Journey,
  Message,
  Need,
  ResourceNode,
} from "../../types";
import { db } from "./index";
import type { HeatmapOptions } from "./types";

export interface AsyncState<T> {
  data: T;
  loading: boolean;
}

export function useNodes(): AsyncState<ResourceNode[]> {
  const [data, setData] = useState<ResourceNode[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    db.getNodes().then((nodes) => {
      if (active) {
        setData(nodes);
        setLoading(false);
      }
    });
    const unsub = db.subscribeNodes((nodes) => active && setData(nodes));
    return () => {
      active = false;
      unsub();
    };
  }, []);

  return { data, loading };
}

export function useNeeds(): AsyncState<Need[]> {
  const [data, setData] = useState<Need[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    db.getNeeds().then((needs) => {
      if (active) {
        setData(needs);
        setLoading(false);
      }
    });
    const unsub = db.subscribeNeeds((needs) => active && setData(needs));
    return () => {
      active = false;
      unsub();
    };
  }, []);

  return { data, loading };
}

export function useJourneys(): AsyncState<Journey[]> {
  const [data, setData] = useState<Journey[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    db.getJourneys().then((journeys) => {
      if (active) {
        setData(journeys);
        setLoading(false);
      }
    });
    const unsub = db.subscribeJourneys(
      (journeys) => active && setData(journeys),
    );
    return () => {
      active = false;
      unsub();
    };
  }, []);

  return { data, loading };
}

export function useMessages(journeyId: string | null): AsyncState<Message[]> {
  const [data, setData] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!journeyId) {
      setData([]);
      setLoading(false);
      return;
    }
    let active = true;
    setLoading(true);
    db.getMessages(journeyId).then((messages) => {
      if (active) {
        setData(messages);
        setLoading(false);
      }
    });
    const unsub = db.subscribeMessages(
      journeyId,
      (messages) => active && setData(messages),
    );
    return () => {
      active = false;
      unsub();
    };
  }, [journeyId]);

  return { data, loading };
}

export function useForesightAlerts(): AsyncState<ForesightAlert[]> {
  const [data, setData] = useState<ForesightAlert[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    db.getForesightAlerts().then((alerts) => {
      if (active) {
        setData(alerts);
        setLoading(false);
      }
    });
    return () => {
      active = false;
    };
  }, []);

  return { data, loading };
}

/** Heatmap cells (already k-anonymized). Re-fetches when options change. */
export function useHeatmap(opts?: HeatmapOptions): AsyncState<HeatCell[]> {
  const [data, setData] = useState<HeatCell[]>([]);
  const [loading, setLoading] = useState(true);
  const hour = opts?.hour;

  useEffect(() => {
    let active = true;
    setLoading(true);
    db.getHeatmapCells({ hour }).then((cells) => {
      if (active) {
        setData(cells);
        setLoading(false);
      }
    });
    return () => {
      active = false;
    };
  }, [hour]);

  return { data, loading };
}
