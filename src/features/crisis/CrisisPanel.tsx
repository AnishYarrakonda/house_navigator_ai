// The no-login crisis side. The map is already the home screen behind this
// panel (App shell); this panel is the *tonight* loop:
//   one giant "I need help" → pick a need → add your words → matching places
//   light up on the map + a beacon pulses → pick one → route + arrival card.
// No account, no password (privacy #6). All copy is i18n (en/es); icon-only
// controls carry aria-labels; tap targets ≥44px (accessibility.md). The map is
// driven only through useMapController() — never edited here.
//
// Styled as the bottom-sheet glass card from Navigation Map/screens/CrisisHome.

import { useTranslation } from "react-i18next";
import { BigButton, Card, Icon, IconButton } from "../../components/kit";
import LanguageToggle from "./LanguageToggle";
import NeedTiles from "./NeedTiles";
import WordsStep from "./WordsStep";
import ResultsList from "./ResultsList";
import ArrivalCard from "./ArrivalCard";
import { useCrisisFlow } from "./useCrisisFlow";

function LogoMark() {
  const { t } = useTranslation();
  return (
    <div className="flex items-center gap-2.5">
      <div className="flex h-[26px] w-[26px] items-center justify-center rounded-[7px] bg-wp-acc">
        <Icon name="explore" size={16} fill className="text-white" />
      </div>
      <span className="font-serif text-[19px] leading-none text-wp-tx">
        {t("app.title")}
      </span>
    </div>
  );
}

export default function CrisisPanel() {
  const { t } = useTranslation();
  const flow = useCrisisFlow();

  return (
    <Card className="flex max-h-[82dvh] flex-col gap-4 overflow-y-auto">
      <div className="flex items-center justify-between gap-2">
        {flow.step === "home" ? (
          <LogoMark />
        ) : (
          <IconButton
            icon={<Icon name="arrow_back" size={22} />}
            label={t("crisis.back")}
            onClick={flow.back}
          />
        )}
        <LanguageToggle />
      </div>

      {flow.step === "home" ? (
        <div className="flex flex-col gap-3 pb-1">
          <BigButton
            icon={<Icon name="waving_hand" size={22} fill />}
            onClick={flow.start}
          >
            {t("crisis.needHelp")}
          </BigButton>
          <p className="text-center text-[13px] text-wp-txf">
            {t("crisis.home.subtitle")}
          </p>
        </div>
      ) : null}

      {flow.step === "needs" ? (
        <div className="flex flex-col gap-3">
          <h2 className="text-sm font-semibold text-wp-txd">
            {t("crisis.needs.prompt")}
          </h2>
          <NeedTiles onChoose={flow.chooseNeed} selected={flow.selectedNeed} />
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
          <h2 className="text-lg font-semibold text-wp-tx">
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
