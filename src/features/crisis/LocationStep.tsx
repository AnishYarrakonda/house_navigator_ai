// Location capture — acquires the person's location as a FUZZED ~250m cell
// (privacy.md): one device-GPS attempt, with clear loading + error states and a
// manual fallback that always works — tap your spot on the map, or type a
// city/address. No endless retries: GPS is attempted once and the person
// re-tries only by choice. We never store or show a precise point. This block
// lives inside the "describe" step alongside the free-text box.

import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Button, Icon } from "../../components/kit";
import type { CrisisFlow } from "./useCrisisFlow";

type Props = Pick<
  CrisisFlow,
  | "locationStatus"
  | "locationSource"
  | "picking"
  | "geocoding"
  | "addressNotFound"
  | "hasLocation"
  | "requestDeviceLocation"
  | "pickOnMap"
  | "cancelPick"
  | "searchAddress"
>;

export default function LocationStep(props: Props) {
  const { t } = useTranslation();
  const [address, setAddress] = useState("");

  const failed =
    props.locationStatus === "denied" ||
    props.locationStatus === "unavailable" ||
    props.locationStatus === "timeout";

  return (
    <div className="flex flex-col gap-3">
      <div>
        <h3 className="text-sm font-semibold text-wp-txd">
          {t("crisis.location.title")}
        </h3>
        <p className="mt-0.5 text-xs text-wp-txf">{t("crisis.location.subtitle")}</p>
      </div>

      {/* Locating (single attempt in flight) */}
      {props.locationStatus === "locating" && !props.hasLocation ? (
        <div
          className="flex items-center gap-2.5 rounded-[12px] border border-wp-line2 bg-wp-surf2 p-3 text-sm text-wp-txd"
          role="status"
        >
          <Icon name="my_location" size={20} className="animate-pulse text-wp-acc2" />
          {t("crisis.location.locating")}
        </div>
      ) : null}

      {/* Meaningful error + offer manual fallback (no auto-retry) */}
      {failed && !props.hasLocation ? (
        <div
          className="rounded-[12px] border border-wp-line2 bg-wp-surf2 p-3 text-sm text-wp-txd"
          role="status"
        >
          {t(`crisis.location.error.${props.locationStatus}`)}
        </div>
      ) : null}

      {/* Confirmed location */}
      {props.hasLocation ? (
        <div className="flex items-center gap-2.5 rounded-[12px] border border-[rgba(76,195,138,0.32)] bg-[rgba(76,195,138,0.1)] p-3 text-sm text-[#7ad6a6]">
          <Icon name="check_circle" size={20} fill />
          {props.locationSource === "gps"
            ? t("crisis.location.found")
            : t("crisis.location.foundManual")}
        </div>
      ) : null}

      {/* Manual options — always available so there's never a dead end */}
      <div className="flex flex-col gap-2.5 rounded-[12px] border border-wp-line bg-wp-surf2 p-3">
        <span className="text-xs font-medium text-wp-txf">
          {props.hasLocation
            ? t("crisis.location.changeLabel")
            : t("crisis.location.orManual")}
        </span>

        {props.picking ? (
          <div className="flex items-center justify-between gap-2">
            <span className="flex items-center gap-2 text-sm text-wp-txd">
              <Icon name="touch_app" size={18} className="text-wp-acc2" />
              {t("crisis.location.picking")}
            </span>
            <Button variant="ghost" size="sm" onClick={props.cancelPick}>
              {t("crisis.location.cancel")}
            </Button>
          </div>
        ) : (
          <Button
            variant="secondary"
            onClick={props.pickOnMap}
            icon={<Icon name="touch_app" size={18} />}
            className="w-full"
          >
            {t("crisis.location.pickOnMap")}
          </Button>
        )}

        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (!props.geocoding) void props.searchAddress(address);
          }}
        >
          <input
            type="text"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            placeholder={t("crisis.location.addressPlaceholder")}
            aria-label={t("crisis.location.addressLabel")}
            className="min-w-0 flex-1 rounded-[10px] border border-wp-line2 bg-wp-surf p-2.5 text-sm text-wp-tx placeholder:text-wp-txf focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-wp-acc/60"
          />
          <Button type="submit" variant="secondary" disabled={props.geocoding}>
            {props.geocoding
              ? t("crisis.location.searching")
              : t("crisis.location.search")}
          </Button>
        </form>
        {props.addressNotFound ? (
          <p className="text-xs text-wp-txd" role="status">
            {t("crisis.location.notFound")}
          </p>
        ) : null}

        {failed || props.locationStatus === "ready" ? (
          <Button
            variant="text"
            size="sm"
            onClick={() => void props.requestDeviceLocation()}
            icon={<Icon name="my_location" size={16} />}
            className="self-start"
          >
            {t("crisis.location.useCurrent")}
          </Button>
        ) : null}
      </div>
    </div>
  );
}
