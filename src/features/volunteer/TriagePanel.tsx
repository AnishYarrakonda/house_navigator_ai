// Triage recommendation, rendered as a recommend→confirm step. We show the
// ranked options AND the written rationale, never a bare list — and a human
// (this co-pilot) must Confirm before anything touches the person
// (ai-agents.md: HITL on anyone vulnerable; every recommendation is explainable;
// low confidence escalates instead of guessing).

import { useTranslation } from "react-i18next";
import type { TriageRecommendation } from "./triage";

interface TriagePanelProps {
  rec: TriageRecommendation;
  escalated: boolean;
  confirmedNodeId: string | null;
  onConfirm: (nodeId: string) => void;
}

export default function TriagePanel({
  rec,
  escalated,
  confirmedNodeId,
  onConfirm,
}: TriagePanelProps) {
  const { t } = useTranslation();

  return (
    <div className="rounded-xl bg-waypoint-bg/60 p-3 ring-1 ring-white/10">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">{t("volunteer.triage.title")}</h3>
        <span className="rounded-full bg-waypoint-accent/20 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-waypoint-accent">
          {t("volunteer.triage.recommendedBadge")}
        </span>
      </div>

      {/* The rationale — plain language, always shown alongside the options. */}
      <p className="mt-2 text-xs leading-relaxed text-white/80">
        <span className="font-semibold text-white/60">
          {t("volunteer.triage.rationaleLabel")}:{" "}
        </span>
        {rec.rationale}
      </p>

      {escalated ? (
        <p className="mt-3 rounded-lg bg-amber-500/10 px-3 py-2 text-xs text-amber-200 ring-1 ring-amber-400/30">
          {t("volunteer.triage.escalated")}
        </p>
      ) : (
        <ul className="mt-3 space-y-2">
          {rec.options.map((opt, i) => {
            const isConfirmed = confirmedNodeId === opt.node.id;
            const room =
              opt.node.capacity_open > 0
                ? t("volunteer.triage.openCount", { open: opt.node.capacity_open })
                : t("volunteer.triage.full");
            return (
              <li
                key={opt.node.id}
                className={
                  "rounded-lg p-2 ring-1 " +
                  (i === 0
                    ? "bg-waypoint-accent/10 ring-waypoint-accent/40"
                    : "bg-white/5 ring-white/10")
                }
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{opt.node.name}</p>
                    <p className="text-[11px] text-white/60">
                      {opt.miles.toFixed(1)} mi · {room}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => onConfirm(opt.node.id)}
                    disabled={confirmedNodeId !== null}
                    aria-pressed={isConfirmed}
                    className={
                      "min-h-[44px] shrink-0 rounded-lg px-3 py-2 text-xs font-semibold transition " +
                      (isConfirmed
                        ? "bg-emerald-500 text-waypoint-bg"
                        : confirmedNodeId !== null
                          ? "bg-white/10 text-white/40"
                          : "bg-waypoint-accent text-waypoint-bg hover:brightness-105")
                    }
                  >
                    {t("volunteer.triage.confirm")}
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {confirmedNodeId ? (
        <p className="mt-3 text-xs text-emerald-300">
          {t("volunteer.triage.confirmedNote")}
        </p>
      ) : (
        !escalated && (
          <p className="mt-3 text-[11px] text-white/40">{t("volunteer.triage.hint")}</p>
        )
      )}
    </div>
  );
}
