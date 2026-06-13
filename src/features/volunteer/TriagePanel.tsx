// Triage recommendation, rendered as a recommend→confirm step. We show the
// ranked options AND the written rationale, never a bare list — and a human
// (this co-pilot) must Confirm before anything touches the person
// (ai-agents.md: HITL on anyone vulnerable; every recommendation is explainable;
// low confidence escalates instead of guessing).

import { useTranslation } from "react-i18next";
import type { TriageRecommendation } from "./triage";
import { Button, Icon, RecommendedChip } from "../../components/kit";

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
    <div className="rounded-[14px] border border-wp-line bg-wp-surf p-4">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-[15px] font-semibold text-wp-tx">
          {t("volunteer.triage.title")}
        </h3>
        <RecommendedChip label={t("volunteer.triage.recommendedBadge")} />
      </div>

      {/* The rationale — plain language, always shown alongside the options. */}
      <p className="mt-2 text-[13px] leading-relaxed text-wp-txd">
        <span className="font-semibold text-wp-tx">
          {t("volunteer.triage.rationaleLabel")}:{" "}
        </span>
        {rec.rationale}
      </p>

      {escalated ? (
        <p className="mt-3 rounded-[11px] border border-[rgba(216,182,92,0.32)] bg-[rgba(216,182,92,0.12)] px-3 py-2 text-xs leading-relaxed text-[#e0c878]">
          {t("volunteer.triage.escalated")}
        </p>
      ) : (
        <ul className="mt-3 flex flex-col gap-[9px]">
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
                  "flex items-center gap-3 rounded-[11px] border p-3 " +
                  (i === 0
                    ? "border-[rgba(47,109,246,0.35)] bg-[rgba(47,109,246,0.05)]"
                    : "border-wp-line bg-wp-surf2")
                }
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-wp-tx">
                    {opt.node.name}
                  </p>
                  <p className="mt-0.5 font-mono text-[11px] text-wp-txf">
                    {opt.miles.toFixed(1)} mi · {room}
                  </p>
                </div>
                {isConfirmed ? (
                  <span className="flex shrink-0 items-center gap-1.5 text-[13px] font-semibold text-[#7ad6a6]">
                    <Icon name="check_circle" size={17} />
                    {t("volunteer.triage.held")}
                  </span>
                ) : (
                  <Button
                    variant="confirm"
                    onClick={() => onConfirm(opt.node.id)}
                    disabled={confirmedNodeId !== null}
                    aria-pressed={isConfirmed}
                    className="min-h-[44px] shrink-0"
                  >
                    {t("volunteer.triage.confirm")}
                  </Button>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {confirmedNodeId ? (
        <p className="mt-3 flex items-center gap-1.5 text-[13px] font-medium text-[#7ad6a6]">
          <Icon name="check_circle" size={17} />
          {t("volunteer.triage.confirmedNote")}
        </p>
      ) : (
        !escalated && (
          <p className="mt-3 text-[11px] leading-relaxed text-wp-txf">
            {t("volunteer.triage.hint")}
          </p>
        )
      )}
    </div>
  );
}
