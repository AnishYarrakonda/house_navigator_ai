// App shell. The full-bleed map IS the home screen on every side (not a tab).
// A top-right SegmentedControl switches role; the panel slot is placed per role
// — crisis is a bottom-center sheet, co-pilot/coordinator dock to the right (and
// collapse to a near-full-height sheet on small screens). Wrapped in
// RoleProvider + MapProvider + ToastProvider + i18n.

import { useTranslation } from "react-i18next";
import { MapBoundary, MapProvider, MapView } from "./map";
import { RoleProvider, ROLES, useRole } from "./lib/useRole";
import { SegmentedControl, ToastProvider } from "./components/kit";
import type { SegmentItem } from "./components/kit";
import CrisisPanel from "./features/crisis/CrisisPanel";
import VolunteerPanel from "./features/volunteer/VolunteerPanel";
import type { Role } from "./types";

function RoleSwitcher() {
  const { role, setRole } = useRole();
  const { t } = useTranslation();
  const items: SegmentItem<Role>[] = ROLES.map((r: Role) => ({
    value: r,
    label: t(`roles.${r}`),
  }));
  return (
    <SegmentedControl
      items={items}
      value={role}
      onChange={setRole}
      ariaLabel={t("app.roleSwitcher", { defaultValue: "Choose a view" })}
      className="backdrop-blur-[18px]"
    />
  );
}

function RolePanel() {
  const { role } = useRole();
  switch (role) {
    case "crisis":
      return <CrisisPanel />;
    case "volunteer":
      return <VolunteerPanel />;
  }
}

function PanelSlot() {
  const { role } = useRole();

  // Crisis: bottom-center sheet (no-login, one-handed, thumb-reachable).
  if (role === "crisis") {
    return (
      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 flex justify-center p-3 sm:p-4">
        <div className="pointer-events-auto w-full max-w-[520px]">
          <RolePanel />
        </div>
      </div>
    );
  }

  // Co-pilot / coordinator: right-docked panel on desktop; on small screens it
  // fills the area under the role switcher as a sheet.
  return (
    <div className="pointer-events-auto absolute bottom-3 left-3 right-3 top-[60px] z-10 sm:bottom-4 sm:left-auto sm:right-4 sm:w-[384px]">
      <RolePanel />
    </div>
  );
}

export default function App() {
  return (
    <RoleProvider>
      <MapProvider>
        <ToastProvider>
          <div className="relative h-dvh w-screen overflow-hidden bg-wp-bg">
            {/* Map is the home screen on every side. A failure here (no WebGL,
                basemap unreachable) must not blank the panels. */}
            <MapBoundary>
              <MapView />
            </MapBoundary>

            {/* Overlay UI */}
            <div className="pointer-events-none absolute inset-0">
              <div className="pointer-events-auto absolute right-3 top-3 z-20 sm:right-4 sm:top-4">
                <RoleSwitcher />
              </div>
              <PanelSlot />
            </div>
          </div>
        </ToastProvider>
      </MapProvider>
    </RoleProvider>
  );
}
