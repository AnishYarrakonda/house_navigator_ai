// MatchingLoader — the brief, reassuring wait while the match crew reads the
// person's words and checks what's open. Cycles through three staged messages
// with a soft cobalt pulse. Trauma-informed: no spinner-of-doom, no countdown,
// no urgency. All copy is i18n. role="status" so screen readers hear progress.

import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Icon } from "../../components/kit";

const STAGE_KEYS = [
  "crisis.matching.stage1",
  "crisis.matching.stage2",
  "crisis.matching.stage3",
] as const;

const STAGE_MS = 1400;

export default function MatchingLoader() {
  const { t } = useTranslation();
  const [stage, setStage] = useState(0);

  useEffect(() => {
    const id = setInterval(() => {
      setStage((s) => (s < STAGE_KEYS.length - 1 ? s + 1 : s));
    }, STAGE_MS);
    return () => clearInterval(id);
  }, []);

  return (
    <div
      className="flex flex-col items-center gap-5 py-8"
      role="status"
      aria-live="polite"
    >
      {/* Soft pulsing beacon */}
      <div className="relative flex h-16 w-16 items-center justify-center">
        <span className="absolute inline-flex h-16 w-16 animate-ping rounded-full bg-wp-acc/30" />
        <span className="absolute inline-flex h-11 w-11 animate-pulse rounded-full bg-wp-acc/20" />
        <span className="relative flex h-12 w-12 items-center justify-center rounded-full bg-wp-acc text-white shadow-[0_8px_28px_rgba(47,109,246,0.4)]">
          <Icon name="explore" size={24} fill />
        </span>
      </div>

      <div className="flex flex-col items-center gap-2">
        <p className="text-center text-base font-semibold text-wp-tx">
          {t(STAGE_KEYS[stage])}
        </p>
        <div className="flex items-center gap-1.5" aria-hidden="true">
          {STAGE_KEYS.map((key, i) => (
            <span
              key={key}
              className={
                "h-1.5 rounded-full transition-all duration-300 " +
                (i <= stage ? "w-6 bg-wp-acc" : "w-1.5 bg-wp-line2")
              }
            />
          ))}
        </div>
      </div>
    </div>
  );
}
