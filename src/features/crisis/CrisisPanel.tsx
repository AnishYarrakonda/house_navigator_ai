// The no-login crisis side. The map is already the home screen behind this
// panel (App shell); this panel is the *tonight* loop:
//   one giant "I need help" → pick a need → add your words → matching places
//   light up on the map + a beacon pulses → pick one → route + arrival card.
// No account, no password (privacy #6). All copy is i18n (en/es); icon-only
// controls carry aria-labels; tap targets ≥44px (accessibility.md). The map is
// driven only through useMapController() — never edited here.

import { useTranslation } from "react-i18next";
import { BigButton, Card, IconButton } from "../../components/kit";
import { BackIcon, HelpIcon } from "./icons";
import LanguageToggle from "./LanguageToggle";
import NeedTiles from "./NeedTiles";
import WordsStep from "./WordsStep";
import ResultsList from "./ResultsList";
import ArrivalCard from "./ArrivalCard";
import { useCrisisFlow } from "./useCrisisFlow";

export default function CrisisPanel() {
  const { t } = useTranslation();
  const flow = useCrisisFlow();

  return (
    <Card className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-2">
        {flow.step === "home" ? (
          <span className="text-sm font-semibold text-white/70">
            {t("app.title")}
          </span>
        ) : (
          <IconButton
            icon={<BackIcon size={22} />}
            label={t("crisis.back")}
            onClick={flow.back}
          />
        )}
        <LanguageToggle />
      </div>

      {flow.step === "home" ? (
        <div className="flex flex-col gap-3 pb-1">
          <BigButton
            icon={<HelpIcon size={28} />}
            onClick={flow.start}
            className="py-6 text-xl"
          >
            {t("crisis.needHelp")}
          </BigButton>
          <p className="text-center text-sm text-white/60">
            {t("crisis.home.subtitle")}
          </p>
        </div>
      ) : null}

      {flow.step === "needs" ? (
        <div className="flex flex-col gap-3">
          <h2 className="text-lg font-semibold text-white">
            {t("crisis.needs.prompt")}
          </h2>
          <NeedTiles onChoose={flow.chooseNeed} />
        </div>
      ) : null}

      {flow.step === "words" ? (
        <WordsStep
          words={flow.words}
          onWordsChange={flow.setWords}
          onContinue={() => void flow.submitNeed()}
          submitting={flow.submitting}
          hiccup={flow.hiccup}
        />
      ) : null}

      {flow.step === "results" ? (
        <div className="flex flex-col gap-3">
          <h2 className="text-lg font-semibold text-white">
            {t("crisis.results.title")}
          </h2>
          <ResultsList ranked={flow.ranked} onChoose={flow.chooseNode} />
        </div>
      ) : null}

      {flow.step === "arrival" && flow.selectedNode ? (
        <>
          <ArrivalCard node={flow.selectedNode} onDone={flow.reset} />
          <BigButton variant="secondary" onClick={flow.reset}>
            {t("crisis.startOver")}
          </BigButton>
        </>
      ) : null}
    </Card>
  );
}
