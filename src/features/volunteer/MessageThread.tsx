// Private co-pilot ↔ person thread. Opens only after accept. No identity is
// shown here — messages carry a sender_role, never a legal name.

import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { db } from "../../lib/data";
import { useMessages } from "../../lib/data/hooks";

interface MessageThreadProps {
  journeyId: string;
}

export default function MessageThread({ journeyId }: MessageThreadProps) {
  const { t } = useTranslation();
  const { data: messages } = useMessages(journeyId);
  const [draft, setDraft] = useState("");
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [messages.length]);

  const send = async () => {
    const body = draft.trim();
    if (!body) return;
    setDraft("");
    await db.sendMessage({
      journey_id: journeyId,
      sender_role: "volunteer",
      body,
    });
  };

  return (
    <div className="rounded-xl bg-waypoint-bg/60 p-3 ring-1 ring-white/10">
      <h3 className="text-sm font-semibold">{t("volunteer.thread.title")}</h3>
      <div className="mt-2 max-h-44 space-y-2 overflow-y-auto pr-1">
        {messages.map((m) => {
          const mine = m.sender_role === "volunteer";
          const system = m.sender_role === "system";
          return (
            <div
              key={m.id}
              className={"flex " + (mine ? "justify-end" : "justify-start")}
            >
              <p
                className={
                  "max-w-[80%] rounded-2xl px-3 py-1.5 text-xs leading-snug " +
                  (system
                    ? "bg-white/5 text-white/60 italic"
                    : mine
                      ? "bg-waypoint-accent text-waypoint-bg"
                      : "bg-white/10 text-white")
                }
              >
                {m.body}
              </p>
            </div>
          );
        })}
        <div ref={endRef} />
      </div>
      <form
        className="mt-2 flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          void send();
        }}
      >
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder={t("volunteer.thread.placeholder")}
          aria-label={t("volunteer.thread.placeholder")}
          className="min-h-[44px] flex-1 rounded-lg bg-white/5 px-3 text-sm text-white placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-waypoint-accent"
        />
        <button
          type="submit"
          className="min-h-[44px] rounded-lg bg-waypoint-accent px-4 text-sm font-semibold text-waypoint-bg disabled:opacity-40"
          disabled={!draft.trim()}
        >
          {t("volunteer.thread.send")}
        </button>
      </form>
    </div>
  );
}
