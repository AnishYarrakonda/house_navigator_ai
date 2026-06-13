// The no-login "Find help" side. The map is already the home screen behind this
// panel (App shell); this panel is the tonight loop:
//   one giant "I need help" → describe it in your own words + set where you are
//   → the crew matches places (a brief reassuring wait) → three picks (Closest /
//   Best fit / Best overall) → pick one → the way there is drawn on the map.
// No account, no password (privacy #6). All copy is i18n; icon-only controls
// carry aria-labels; tap targets ≥44px (accessibility.md). The map is driven
// only through useMapController() — never edited here.
//
// Styled as the bottom-sheet glass card from Navigation Map/screens/CrisisHome.

import { useTranslation } from "react-i18next";
import { BigButton, Card, Icon, IconButton } from "../../components/kit";
import { useNodes } from "../../lib/data/hooks";
import LocationStep from "./LocationStep";
import MatchingLoader from "./MatchingLoader";
import MatchResults from "./MatchResults";
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
  const { data: nodes } = useNodes();

  return (
    <Card className="flex max-h-[82dvh] flex-col gap-4 overflow-y-auto">
      <div className="flex items-center justify-between gap-2">
        {flow.step === "home" || flow.step === "matching" ? (
          <LogoMark />
        ) : (
          <IconButton
            icon={<Icon name="arrow_back" size={22} />}
            label={t("crisis.back")}
            onClick={flow.back}
          />
        )}
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

      {flow.step === "describe" ? (
        <div className="flex flex-col gap-4">
          <div>
            <label
              htmlFor="crisis-words"
              className="text-lg font-semibold text-wp-tx"
            >
              {t("crisis.describe.prompt")}
            </label>
            <p className="mt-1 text-sm text-wp-txd">{t("crisis.describe.hint")}</p>
          </div>

          <textarea
            id="crisis-words"
            value={flow.words}
            onChange={(e) => flow.setWords(e.target.value)}
            rows={3}
            placeholder={t("crisis.describe.placeholder")}
            className={
              "w-full resize-none rounded-[12px] border border-wp-line2 bg-wp-surf2 p-3 text-base " +
              "text-wp-tx placeholder:text-wp-txf focus-visible:outline-none focus-visible:ring-2 " +
              "focus-visible:ring-wp-acc/60"
            }
          />

          <LocationStep
            locationStatus={flow.locationStatus}
            locationSource={flow.locationSource}
            picking={flow.picking}
            geocoding={flow.geocoding}
            addressNotFound={flow.addressNotFound}
            hasLocation={flow.hasLocation}
            requestDeviceLocation={flow.requestDeviceLocation}
            pickOnMap={flow.pickOnMap}
            cancelPick={flow.cancelPick}
            searchAddress={flow.searchAddress}
          />

          {flow.hiccup ? (
            <p className="text-sm text-wp-txd" role="status">
              {t("crisis.describe.retry")}
            </p>
          ) : null}

          <BigButton
            onClick={() => void flow.submit()}
            disabled={!flow.hasLocation || flow.submitting}
          >
            {t("crisis.describe.submit")}
          </BigButton>
        </div>
      ) : null}

      {flow.step === "matching" ? <MatchingLoader /> : null}

      {flow.step === "results" && flow.matches ? (
        <div className="flex flex-col gap-3">
          <h2 className="text-lg font-semibold text-wp-tx">
            {t("crisis.results.title")}
          </h2>
          <MatchResults
            matches={flow.matches}
            nodes={nodes}
            onChoose={(kind, pick) => void flow.choosePick(kind, pick)}
          />
        </div>
      ) : null}

      {flow.step === "routed" && flow.selectedNode ? (
        <div className="flex flex-col gap-4">
          <div className="flex flex-col items-center gap-3 py-2 text-center">
            <span className="flex h-12 w-12 items-center justify-center rounded-full bg-[rgba(76,195,138,0.14)] text-[#7ad6a6]">
              <Icon name="check_circle" size={28} fill />
            </span>
            <div className="flex flex-col gap-1">
              <h2 className="text-lg font-semibold text-wp-tx">
                {t("crisis.routed.title")}
              </h2>
              <p className="text-sm text-wp-txd">
                {t("crisis.routed.subtitle", { name: flow.selectedNode.name })}
              </p>
            </div>
          </div>
          <BigButton variant="secondary" onClick={flow.reset}>
            {t("crisis.startOver")}
          </BigButton>
        </div>
      ) : null}
    </Card>
  );
}
