// Co-pilot side. Two modes off one panel:
//   • Inbound — open need beacons (no identity, fuzzed area only) → Accept (HITL)
//     → Triage recommendation + rationale → Confirm a place (drops live capacity)
//     → private thread.
//   • My journeys — the people this co-pilot is walking alongside; the path home
//     grows as steps are marked (Lane 1 redraws the route from journey data).
//
// Drives the map ONLY through useMapController (privacy: beacons pulse from the
// FUZZED cell, never a point). All copy goes through react-i18next.

import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import "./i18n";
import { db } from "../../lib/data";
import { useNeeds, useNodes, useJourneys } from "../../lib/data/hooks";
import { useMapController } from "../../map";
import type { Need } from "../../types";
import { cellCenter } from "./format";
import { recommendForNeed, shouldEscalate } from "./triage";
import NeedCard from "./NeedCard";
import TriagePanel from "./TriagePanel";
import MessageThread from "./MessageThread";
import JourneyCard from "./JourneyCard";

/** The signed-in co-pilot for the demo (no auth — see lib/useRole). */
const CURRENT_VOLUNTEER = { id: "vol-amara", name: "Amara" } as const;

type Tab = "inbound" | "journeys";

const journeyIdForPerson = (personId: string) => `journey-${personId}`;

export default function VolunteerPanel() {
  const { t } = useTranslation();
  const map = useMapController();
  const { data: needs } = useNeeds();
  const { data: nodes } = useNodes();
  const { data: journeys } = useJourneys();

  const [tab, setTab] = useState<Tab>("inbound");
  const [activeNeed, setActiveNeed] = useState<Need | null>(null);
  const [confirmedNodeId, setConfirmedNodeId] = useState<string | null>(null);
  const [selectedJourneyId, setSelectedJourneyId] = useState<string | null>(null);
  // Consent to view a journey-so-far, modeled per journey in the co-pilot view.
  // Default ON for journeys already assigned to this co-pilot; revocation is
  // immediate (privacy invariant #4).
  const [consent, setConsent] = useState<Record<string, boolean>>({});

  const openNeeds = useMemo(
    () => needs.filter((n) => n.status === "open"),
    [needs],
  );

  const myJourneys = useMemo(
    () => journeys.filter((j) => j.copilot_id === CURRENT_VOLUNTEER.id),
    [journeys],
  );

  const rec = useMemo(
    () =>
      activeNeed
        ? recommendForNeed(
            activeNeed.type,
            activeNeed.fuzzed_geocell,
            nodes,
            activeNeed.words,
          )
        : null,
    [activeNeed, nodes],
  );

  // Pulse open-need beacons from their FUZZED cells while triaging inbound.
  useEffect(() => {
    if (tab !== "inbound") return;
    map.setZoomLayer("street");
    for (const n of openNeeds) map.pulseBeacon(n.fuzzed_geocell);
  }, [tab, openNeeds, map]);

  // Surface the journey/route view when looking at people we're walking with.
  useEffect(() => {
    if (tab === "journeys") map.setZoomLayer("city");
  }, [tab, map]);

  // Highlight the recommended nodes + fly to the (fuzzed) area on accept.
  useEffect(() => {
    if (!activeNeed || !rec) return;
    const { lat, lng } = cellCenter(activeNeed.fuzzed_geocell);
    map.flyTo({ lat, lng, zoom: 14 });
    map.highlightNodes(rec.options.map((o) => o.node.id));
    return () => map.clearHighlights();
  }, [activeNeed, rec, map]);

  const accept = async (need: Need) => {
    await db.claimNeed(need.id, CURRENT_VOLUNTEER.id);
    setActiveNeed(need);
    setConfirmedNodeId(null);
    const jid = journeyIdForPerson(need.person_id);
    setSelectedJourneyId(jid);
    await db.sendMessage({
      journey_id: jid,
      sender_role: "volunteer",
      body: t("volunteer.thread.greeting", { name: CURRENT_VOLUNTEER.name }),
    });
  };

  const confirmResource = async (nodeId: string) => {
    if (!activeNeed) return;
    const node = nodes.find((n) => n.id === nodeId);
    await db.confirmResource(activeNeed.id, nodeId); // decrements capacity_open
    setConfirmedNodeId(nodeId);
    const jid = journeyIdForPerson(activeNeed.person_id);
    if (node) {
      await db.sendMessage({
        journey_id: jid,
        sender_role: "system",
        body: t("volunteer.thread.systemConfirmed", { place: node.name }),
      });
      await db.sendMessage({
        journey_id: jid,
        sender_role: "volunteer",
        body: t("volunteer.thread.reassure"),
      });
      // First step of the path home — a node-anchored waypoint so the route
      // can grow (Lane 1 redraws from journey data).
      await db.addWaypoint({
        journey_id: jid,
        node_id: node.id,
        label: `${t(`volunteer.needType.${activeNeed.type}`)} — ${node.name}`,
      });
      map.highlightNodes([node.id]);
      map.flyTo({ lat: node.lat, lng: node.lng, zoom: 15 });
    }
  };

  const toggleConsent = (journeyId: string, shared: boolean) =>
    setConsent((c) => ({ ...c, [journeyId]: shared }));

  const consentFor = (journeyId: string) => consent[journeyId] ?? true;

  return (
    <div className="flex max-h-[78dvh] flex-col gap-3 overflow-y-auto rounded-2xl bg-waypoint-surface/90 p-4 text-white shadow-xl backdrop-blur">
      {/* Tabs */}
      <div className="flex gap-1 rounded-full bg-waypoint-bg/60 p-1">
        {(["inbound", "journeys"] as Tab[]).map((tk) => (
          <button
            key={tk}
            type="button"
            onClick={() => setTab(tk)}
            aria-pressed={tab === tk}
            className={
              "min-h-[36px] flex-1 rounded-full px-3 py-1 text-xs font-semibold transition " +
              (tab === tk
                ? "bg-waypoint-accent text-waypoint-bg"
                : "text-white/70 hover:text-white")
            }
          >
            {t(`volunteer.tabs.${tk}`)}
          </button>
        ))}
      </div>

      {tab === "inbound" && (
        <>
          {activeNeed ? (
            <>
              {rec && (
                <TriagePanel
                  rec={rec}
                  escalated={shouldEscalate(rec)}
                  confirmedNodeId={confirmedNodeId}
                  onConfirm={confirmResource}
                />
              )}
              {selectedJourneyId && <MessageThread journeyId={selectedJourneyId} />}
              <button
                type="button"
                onClick={() => {
                  setActiveNeed(null);
                  setConfirmedNodeId(null);
                  setSelectedJourneyId(null);
                  map.clearHighlights();
                }}
                className="min-h-[44px] rounded-lg bg-white/10 px-3 py-2 text-xs font-semibold text-white hover:bg-white/15"
              >
                {t("volunteer.inbound.back")}
              </button>
            </>
          ) : (
            <>
              <div>
                <h2 className="text-sm font-semibold">
                  {t("volunteer.inbound.title")}
                </h2>
                <p className="mt-0.5 text-[11px] text-white/50">
                  {t("volunteer.privacyNote")}
                </p>
              </div>
              {openNeeds.length === 0 ? (
                <p className="text-xs text-white/50">
                  {t("volunteer.inbound.empty")}
                </p>
              ) : (
                openNeeds.map((need) => (
                  <NeedCard
                    key={need.id}
                    need={need}
                    nodes={nodes}
                    onAccept={accept}
                  />
                ))
              )}
            </>
          )}
        </>
      )}

      {tab === "journeys" && (
        <>
          <h2 className="text-sm font-semibold">{t("volunteer.journeys.title")}</h2>
          {myJourneys.length === 0 ? (
            <p className="text-xs text-white/50">{t("volunteer.journeys.empty")}</p>
          ) : (
            myJourneys.map((j) => (
              <div key={j.id} className="space-y-2">
                <JourneyCard
                  journey={j}
                  consentShared={consentFor(j.id)}
                  onToggleConsent={toggleConsent}
                  isOpen={selectedJourneyId === j.id}
                  onOpen={setSelectedJourneyId}
                />
                {selectedJourneyId === j.id && <MessageThread journeyId={j.id} />}
              </div>
            ))
          )}
        </>
      )}
    </div>
  );
}
