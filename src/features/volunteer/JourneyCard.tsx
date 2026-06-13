// A journey the co-pilot is walking alongside: the "path home" steps grow here.
//
// Privacy: the journey-so-far is shown ONLY while sharing is on. The frozen data
// contract doesn't expose `person.consent_share_journey` directly, so this lane
// models consent in the co-pilot view and honors IMMEDIATE revocation (privacy
// invariant #4): toggling it off hides every shared step at once. In `live`
// mode (Lane 4) this binds to the real consent flag via Realtime. No identity
// is ever shown — only the steps the person chose to share.

import { useState } from "react";
import { useTranslation } from "react-i18next";
import { db } from "../../lib/data";
import type { Journey } from "../../types";
import { useWaypoints } from "./useWaypoints";

interface JourneyCardProps {
  journey: Journey;
  consentShared: boolean;
  onToggleConsent: (journeyId: string, shared: boolean) => void;
  isOpen: boolean;
  onOpen: (journeyId: string) => void;
}

const STATUS_DOT: Record<string, string> = {
  complete: "bg-emerald-400",
  current: "bg-waypoint-accent animate-pulse",
  upcoming: "bg-white/25",
};

export default function JourneyCard({
  journey,
  consentShared,
  onToggleConsent,
  isOpen,
  onOpen,
}: JourneyCardProps) {
  const { t } = useTranslation();
  const waypoints = useWaypoints(journey.id);
  const [adding, setAdding] = useState(false);
  const [label, setLabel] = useState("");

  const current = waypoints.find((w) => w.status === "current");

  const markDone = async () => {
    if (current) await db.completeWaypoint(current.id);
  };

  const addStep = async () => {
    const text = label.trim();
    if (!text) return;
    setLabel("");
    setAdding(false);
    await db.addWaypoint({ journey_id: journey.id, label: text });
  };

  return (
    <div className="rounded-xl bg-waypoint-bg/60 p-3 ring-1 ring-white/10">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold">{t("volunteer.journeys.pathHome")}</h3>
        <button
          type="button"
          onClick={() => onToggleConsent(journey.id, !consentShared)}
          className="rounded-full px-2 py-1 text-[11px] text-white/60 ring-1 ring-white/15 hover:text-white"
        >
          {consentShared
            ? t("volunteer.journeys.revoke")
            : t("volunteer.journeys.restore")}
        </button>
      </div>

      {consentShared ? (
        <>
          <p className="mt-1 text-[11px] text-emerald-300/80">
            {t("volunteer.journeys.sharedOn")}
          </p>
          <ol className="mt-2 space-y-1.5">
            {waypoints.map((w) => (
              <li key={w.id} className="flex items-center gap-2 text-xs">
                <span
                  className={
                    "h-2.5 w-2.5 shrink-0 rounded-full " +
                    (STATUS_DOT[w.status] ?? "bg-white/25")
                  }
                  aria-hidden="true"
                />
                <span
                  className={
                    w.status === "complete"
                      ? "text-white/55 line-through"
                      : w.status === "current"
                        ? "font-medium text-white"
                        : "text-white/70"
                  }
                >
                  {w.label}
                </span>
              </li>
            ))}
          </ol>

          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={markDone}
              disabled={!current}
              className="min-h-[44px] rounded-lg bg-emerald-500/90 px-3 py-2 text-xs font-semibold text-waypoint-bg disabled:opacity-40"
            >
              {t("volunteer.journeys.markNext")}
            </button>
            <button
              type="button"
              onClick={() => setAdding((v) => !v)}
              className="min-h-[44px] rounded-lg bg-white/10 px-3 py-2 text-xs font-semibold text-white hover:bg-white/15"
            >
              {t("volunteer.journeys.addStep")}
            </button>
            {!isOpen && (
              <button
                type="button"
                onClick={() => onOpen(journey.id)}
                className="min-h-[44px] rounded-lg bg-white/10 px-3 py-2 text-xs font-semibold text-white hover:bg-white/15"
              >
                {t("volunteer.journeys.open")}
              </button>
            )}
          </div>

          {adding && (
            <form
              className="mt-2 flex gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                void addStep();
              }}
            >
              <input
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                placeholder={t("volunteer.journeys.addStepPrompt")}
                aria-label={t("volunteer.journeys.addStepPrompt")}
                className="min-h-[44px] flex-1 rounded-lg bg-white/5 px-3 text-sm text-white placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-waypoint-accent"
              />
              <button
                type="submit"
                disabled={!label.trim()}
                className="min-h-[44px] rounded-lg bg-waypoint-accent px-3 text-sm font-semibold text-waypoint-bg disabled:opacity-40"
              >
                {t("volunteer.journeys.addStep")}
              </button>
            </form>
          )}
        </>
      ) : (
        <p className="mt-2 rounded-lg bg-white/5 px-3 py-2 text-xs text-white/60">
          {t("volunteer.journeys.revoked")}
        </p>
      )}
    </div>
  );
}
