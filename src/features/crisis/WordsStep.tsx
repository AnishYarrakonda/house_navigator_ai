// "Own words" step — the person can add a short note in their own words
// ("me and my dog, nowhere safe tonight"). Optional and gentle: the hint steers
// away from legal name / precise address (privacy.md), there's an implicit skip
// (the field is optional), and the note is captured on the Need so the Triage
// Agent can reason over it later (M2). Continue advances to the location step.

import { useTranslation } from "react-i18next";
import { BigButton } from "../../components/kit";

interface WordsStepProps {
  words: string;
  onWordsChange: (value: string) => void;
  onContinue: () => void;
}

export default function WordsStep({
  words,
  onWordsChange,
  onContinue,
}: WordsStepProps) {
  const { t } = useTranslation();
  return (
    <div className="flex flex-col gap-3">
      <div>
        <label
          htmlFor="crisis-words"
          className="text-lg font-semibold text-wp-tx"
        >
          {t("crisis.words.prompt")}
        </label>
        <p className="mt-1 text-sm text-wp-txd">{t("crisis.words.hint")}</p>
      </div>

      <textarea
        id="crisis-words"
        value={words}
        onChange={(e) => onWordsChange(e.target.value)}
        rows={3}
        placeholder={t("crisis.words.placeholder")}
        className={
          "w-full resize-none rounded-[12px] border border-wp-line2 bg-wp-surf2 p-3 text-base " +
          "text-wp-tx placeholder:text-wp-txf focus-visible:outline-none focus-visible:ring-2 " +
          "focus-visible:ring-wp-acc/60"
        }
      />

      <BigButton onClick={onContinue}>{t("crisis.words.continue")}</BigButton>
    </div>
  );
}
