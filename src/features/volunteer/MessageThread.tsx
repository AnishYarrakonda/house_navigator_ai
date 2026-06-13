// Private co-pilot ↔ person thread. Opens only after accept. No identity is
// shown here — messages carry a sender_role, never a legal name.

import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { db } from "../../lib/data";
import { useMessages } from "../../lib/data/hooks";
import { Icon, Skeleton } from "../../components/kit";

interface MessageThreadProps {
  journeyId: string;
}

export default function MessageThread({ journeyId }: MessageThreadProps) {
  const { t } = useTranslation();
  const { data: messages, loading } = useMessages(journeyId);
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
    <div className="rounded-[14px] border border-wp-line bg-wp-surf p-4">
      <h3 className="mb-3 text-[15px] font-semibold text-wp-tx">
        {t("volunteer.thread.title")}
      </h3>
      <div className="flex max-h-44 flex-col gap-[9px] overflow-y-auto pr-1">
        {loading ? (
          <>
            <Skeleton className="h-9 w-3/4 self-start rounded-[13px]" />
            <Skeleton className="h-9 w-2/3 self-end rounded-[13px]" />
          </>
        ) : (
          messages.map((m) => {
            const mine = m.sender_role === "volunteer";
            const system = m.sender_role === "system";
            return (
              <p
                key={m.id}
                className={
                  "max-w-[88%] border px-3.5 py-2.5 text-[13px] leading-relaxed " +
                  (mine
                    ? "self-end rounded-[13px_13px_4px_13px] border-[rgba(47,109,246,0.28)] bg-[rgba(47,109,246,0.16)] text-[#dce8ff]"
                    : system
                      ? "self-start rounded-[13px_13px_13px_4px] border-wp-line bg-wp-surf2 italic text-wp-txd"
                      : "self-start rounded-[13px_13px_13px_4px] border-wp-line bg-wp-surf3 text-wp-tx")
                }
              >
                {m.body}
              </p>
            );
          })
        )}
        <div ref={endRef} />
      </div>
      <form
        className="mt-3 flex gap-2.5"
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
          className="min-h-[44px] flex-1 rounded-[9px] border border-wp-line2 bg-wp-surf2 px-3.5 text-sm text-wp-tx placeholder:text-wp-txf focus:outline-none focus:ring-2 focus:ring-wp-acc/60"
        />
        <button
          type="submit"
          aria-label={t("volunteer.thread.send")}
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[9px] bg-wp-acc text-white transition hover:bg-wp-acc2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-wp-acc/60 disabled:cursor-not-allowed disabled:bg-wp-surf3 disabled:text-wp-txf"
          disabled={!draft.trim()}
        >
          <Icon name="send" size={20} />
        </button>
      </form>
    </div>
  );
}
