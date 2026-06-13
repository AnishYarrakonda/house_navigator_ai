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
import { Button, Icon } from "../../components/kit";

interface JourneyCardProps {
  journey: Journey;
  consentShared: boolean;
  onToggleConsent: (journeyId: string, shared: boolean) => void;
  isOpen: boolean;
  onOpen: (journeyId: string) => void;
}

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
    <div className="rounded-[14px] border border-wp-line bg-wp-surf p-4">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h3 className="text-[15px] font-semibold text-wp-tx">
            {t("volunteer.journeys.pathHome")}
          </h3>
          {consentShared && (
            <p className="mt-0.5 text-xs text-wp-open">
              {t("volunteer.journeys.sharedOn")}
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={() => onToggleConsent(journey.id, !consentShared)}
          className="shrink-0 rounded-full border border-wp-line px-3 py-1.5 text-xs font-semibold text-wp-txd transition hover:text-wp-tx focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-wp-acc/60"
        >
          {consentShared
            ? t("volunteer.journeys.revoke")
            : t("volunteer.journeys.restore")}
        </button>
      </div>

      {consentShared ? (
        <>
          <ol className="mt-3 flex flex-col">
            {waypoints.map((w, i) => {
              const done = w.status === "complete";
              const active = w.status === "current";
              const notLast = i < waypoints.length - 1;
              return (
                <li key={w.id} className="flex items-start gap-3 py-[7px]">
                  <span
                    className="flex w-3.5 flex-none flex-col items-center"
                    aria-hidden="true"
                  >
                    <span
                      className={
                        "mt-[3px] flex-none rounded-full " +
                        (done
                          ? "h-2.5 w-2.5 bg-wp-open"
                          : active
                            ? "h-[13px] w-[13px] bg-wp-acc shadow-[0_0_10px_rgba(47,109,246,0.5)] ring-[3px] ring-[rgba(47,109,246,0.3)]"
                            : "h-2.5 w-2.5 border-2 border-wp-txf")
                      }
                    />
                    {notLast && (
                      <span className="mt-[3px] h-5 w-px bg-wp-line" />
                    )}
                  </span>
                  <span
                    className={
                      "text-sm leading-tight " +
                      (done
                        ? "text-wp-txf line-through"
                        : active
                          ? "font-semibold text-wp-tx"
                          : "text-wp-txd")
                    }
                  >
                    {w.label}
                  </span>
                </li>
              );
            })}
          </ol>

          <div className="mt-3 flex flex-wrap gap-2">
            <Button
              variant="confirm"
              icon={<Icon name="check" size={15} />}
              onClick={markDone}
              disabled={!current}
              className="min-h-[44px]"
            >
              {t("volunteer.journeys.markNext")}
            </Button>
            <Button
              variant="secondary"
              onClick={() => setAdding((v) => !v)}
              className="min-h-[44px]"
            >
              {t("volunteer.journeys.addStep")}
            </Button>
            {!isOpen && (
              <Button
                variant="ghost"
                onClick={() => onOpen(journey.id)}
                className="min-h-[44px]"
              >
                {t("volunteer.journeys.open")}
              </Button>
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
                className="min-h-[44px] flex-1 rounded-[9px] border border-wp-line2 bg-wp-surf2 px-3.5 text-sm text-wp-tx placeholder:text-wp-txf focus:outline-none focus:ring-2 focus:ring-wp-acc/60"
              />
              <Button
                variant="primary"
                type="submit"
                disabled={!label.trim()}
                className="min-h-[44px]"
              >
                {t("volunteer.journeys.addStep")}
              </Button>
            </form>
          )}
        </>
      ) : (
        <p className="mt-3 rounded-[11px] border border-wp-line bg-wp-surf2 px-3 py-2.5 text-xs leading-relaxed text-wp-txd">
          {t("volunteer.journeys.revoked")}
        </p>
      )}
    </div>
  );
}
