// CrewReasoningPanel — the live "AI crew" reasoning shown while the match step
// runs. Three agents (Scout → Analyst → Presenter) each carry a status dot
// (pending → active → done), a one-line blurb, and their streamed reasoning. An
// animated arrow lights when a handoff fires ("Scout → Analyst").
//
// Trauma-informed (.claude/rules/accessibility.md): the PRIMARY visible copy is
// calm and reassuring ("Looking for safe places near you…"). The verbose agent
// reasoning is tucked behind a large, opt-in "See how we're deciding" toggle so
// it never dominates a crisis screen. No red/error styling. Tap targets ≥44px.
// All user-facing strings come through i18n; agent titles/blurbs that arrive
// from the stream are short machine narration kept inside the secondary detail.

import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Icon } from "../../components/kit";
import {
  AGENT_ORDER,
  type AgentId,
  type AgentState,
  type Handoff,
} from "./useCrewStream";

interface CrewReasoningPanelProps {
  agents: Record<AgentId, AgentState>;
  handoff: Handoff | null;
}

const AGENT_ICON: Record<AgentId, string> = {
  scout: "travel_explore",
  analyst: "insights",
  presenter: "auto_awesome",
};

export default function CrewReasoningPanel({
  agents,
  handoff,
}: CrewReasoningPanelProps) {
  const { t } = useTranslation();
  const [showDetail, setShowDetail] = useState(true);

  return (
    <div className="flex flex-col items-center gap-6 py-6" role="status" aria-live="polite">
      {/* Calm, primary reassurance — the only thing that must read in a glance. */}
      <div className="flex flex-col items-center gap-4">
        <div className="relative flex h-16 w-16 items-center justify-center">
          <span className="absolute inline-flex h-16 w-16 animate-ping rounded-full bg-wp-acc/30" />
          <span className="absolute inline-flex h-11 w-11 animate-pulse rounded-full bg-wp-acc/20" />
          <span className="relative flex h-12 w-12 items-center justify-center rounded-full bg-wp-acc text-white shadow-[0_8px_28px_rgba(47,109,246,0.4)]">
            <Icon name="explore" size={24} fill />
          </span>
        </div>
        <p className="text-center text-base font-semibold text-wp-tx">
          {t("crisis.crew.reassure")}
        </p>
      </div>

      {/* Secondary, opt-in: the live crew reasoning. Large tap target. */}
      <div className="w-full">
        <button
          type="button"
          onClick={() => setShowDetail((v) => !v)}
          aria-expanded={showDetail}
          className={
            "flex min-h-[44px] w-full items-center justify-center gap-2 rounded-[12px] " +
            "border border-wp-line2 bg-wp-surf2 px-4 py-2.5 text-sm font-medium text-wp-txd " +
            "transition hover:text-wp-tx focus-visible:outline-none focus-visible:ring-2 " +
            "focus-visible:ring-wp-acc/60"
          }
        >
          <Icon name="neurology" size={18} className="text-wp-acc2" />
          {showDetail ? t("crisis.crew.hideDetail") : t("crisis.crew.showDetail")}
          <Icon name={showDetail ? "expand_less" : "expand_more"} size={18} />
        </button>

        {showDetail ? (
          <ol className="mt-3 flex flex-col gap-0">
            {AGENT_ORDER.map((id, i) => {
              const a = agents[id];
              const isLast = i === AGENT_ORDER.length - 1;
              const handoffActive =
                !!handoff && handoff.from === id && handoff.to === AGENT_ORDER[i + 1];
              return (
                <li key={id} className="flex flex-col">
                  <AgentRow agent={a} icon={AGENT_ICON[id]} />
                  {!isLast ? (
                    <HandoffArrow
                      active={handoffActive}
                      done={a.status === "done"}
                      summary={handoffActive ? handoff?.summary : undefined}
                    />
                  ) : null}
                </li>
              );
            })}
          </ol>
        ) : null}
      </div>
    </div>
  );
}

function AgentRow({ agent, icon }: { agent: AgentState; icon: string }) {
  const { t } = useTranslation();
  const status = agent.status;
  const localizedTitle = t(`crisis.crew.agent.${agent.id}.title`, {
    defaultValue: agent.title,
  });

  return (
    <div
      className={
        "flex gap-3 rounded-[12px] border p-3 transition " +
        (status === "active"
          ? "border-[rgba(47,109,246,0.4)] bg-[rgba(47,109,246,0.06)]"
          : "border-wp-line bg-wp-surf2")
      }
    >
      <div className="flex flex-col items-center gap-1 pt-0.5">
        <span
          className={
            "flex h-8 w-8 items-center justify-center rounded-full " +
            (status === "done"
              ? "bg-[rgba(76,195,138,0.16)] text-[#7ad6a6]"
              : status === "active"
                ? "bg-wp-acc text-white"
                : "bg-wp-surf text-wp-txf")
          }
        >
          <Icon name={status === "done" ? "check" : icon} size={18} fill={status === "active"} />
        </span>
      </div>

      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-wp-tx">{localizedTitle}</span>
          <StatusDot status={status} />
        </div>
        {agent.blurb ? (
          <span className="text-[13px] text-wp-txd">{agent.blurb}</span>
        ) : null}
        {agent.text ? (
          <p className="whitespace-pre-wrap break-words text-[12px] leading-snug text-wp-txf">
            {agent.text}
            {status === "active" ? (
              <span className="ml-0.5 inline-block h-3 w-[2px] animate-pulse bg-wp-acc align-middle" />
            ) : null}
          </p>
        ) : null}
      </div>
    </div>
  );
}

function StatusDot({ status }: { status: AgentState["status"] }) {
  const { t } = useTranslation();
  const label = t(`crisis.crew.status.${status}`);
  const cls =
    status === "done"
      ? "bg-[#4cc38a]"
      : status === "active"
        ? "bg-wp-acc animate-pulse"
        : "bg-wp-line2";
  return (
    <span className="inline-flex items-center gap-1">
      <span className={`h-2 w-2 rounded-full ${cls}`} aria-hidden="true" />
      <span className="text-[10px] font-medium uppercase tracking-wide text-wp-txf">
        {label}
      </span>
    </span>
  );
}

function HandoffArrow({
  active,
  done,
  summary,
}: {
  active: boolean;
  done: boolean;
  summary?: string;
}) {
  // Lit when the handoff fires; stays soft-on once the upstream agent is done.
  const lit = active || done;
  return (
    <div className="flex items-center gap-2 py-1.5 pl-3.5">
      <Icon
        name="south"
        size={16}
        className={
          (active
            ? "text-wp-acc animate-pulse"
            : lit
              ? "text-wp-acc2"
              : "text-wp-line2") + " transition-colors"
        }
      />
      {active && summary ? (
        <span className="text-[11px] text-wp-txd">{summary}</span>
      ) : null}
    </div>
  );
}
