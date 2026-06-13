// "Own words" step — the person can add a short note in their own words
// ("me and my dog, nowhere safe tonight"). Optional and gentle: the hint steers
// away from legal name / precise address (privacy.md), there's a Skip, and the
// note is captured on the Need so the Triage Agent can reason over it later (M2).

import { useTranslation } from "react-i18next";
import { BigButton } from "../../components/kit";

interface WordsStepProps {
  words: string;
  onWordsChange: (value: string) => void;
  onContinue: () => void;
  submitting: boolean;
  hiccup: boolean;
}

export default function WordsStep({
  words,
  onWordsChange,
  onContinue,
  submitting,
  hiccup,
}: WordsStepProps) {
  const { t } = useTranslation();
  return (
    <div className="flex flex-col gap-3">
      <div>
        <label
          htmlFor="crisis-words"
          className="text-lg font-semibold text-white"
        >
          {t("crisis.words.prompt")}
        </label>
        <p className="mt-1 text-sm text-white/60">{t("crisis.words.hint")}</p>
      </div>

      <textarea
        id="crisis-words"
        value={words}
        onChange={(e) => onWordsChange(e.target.value)}
        rows={3}
        placeholder={t("crisis.words.placeholder")}
        className={
          "w-full resize-none rounded-2xl bg-white/10 p-3 text-base text-white " +
          "placeholder:text-white/40 focus-visible:outline-none focus-visible:ring-4 " +
          "focus-visible:ring-waypoint-accent/60"
        }
      />

      {hiccup ? (
        <p className="text-sm text-white/70" role="status">
          {t("crisis.words.retry")}
        </p>
      ) : null}

      <BigButton onClick={onContinue} disabled={submitting}>
        {submitting ? t("crisis.words.finding") : t("crisis.words.continue")}
      </BigButton>
    </div>
  );
}
