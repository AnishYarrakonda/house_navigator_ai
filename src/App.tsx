// App shell. The full-bleed map IS the home screen on both sides (not a tab).
// A single top-left ModeToggle flips between the two sides — "I need help"
// (person) and "Volunteer". Each side's input lives in a LEFT-DOCKED DRAGGABLE
// panel so it never covers the map center (where your current location flies
// to). Wrapped in RoleProvider + MapProvider + ToastProvider + i18n.

import { useTranslation } from "react-i18next";
import { MapBoundary, MapProvider, MapView } from "./map";
import { RoleProvider, useRole } from "./lib/useRole";
import { DraggablePanel, Icon, ModeToggle, ToastProvider } from "./components/kit";
import type { ModeOption } from "./components/kit";
import CrisisPanel from "./features/crisis/CrisisPanel";
import VolunteerPanel from "./features/volunteer/VolunteerPanel";
import type { Role } from "./types";

function ModeSwitcher() {
  const { role, setRole } = useRole();
  const { t } = useTranslation();
  const options: [ModeOption<Role>, ModeOption<Role>] = [
    {
      value: "crisis",
      label: t("roles.crisis"),
      icon: <Icon name="waving_hand" size={16} fill />,
    },
    {
      value: "volunteer",
      label: t("roles.volunteer"),
      icon: <Icon name="volunteer_activism" size={16} fill />,
    },
  ];
  return (
    <ModeToggle
      options={options}
      value={role}
      onChange={setRole}
      ariaLabel={t("app.roleSwitcher", { defaultValue: "Switch mode" })}
    />
  );
}

function PanelSlot() {
  const { role } = useRole();
  const { t } = useTranslation();

  // The two modes are mirror images: same left-docked, draggable chrome, swapped
  // body. Mounting only the active one keeps each side a clean, separate space.
  if (role === "crisis") {
    return (
      <DraggablePanel
        storageKey="crisis"
        title={t("roles.crisis")}
        icon={<Icon name="waving_hand" size={18} fill />}
      >
        <CrisisPanel />
      </DraggablePanel>
    );
  }
  return (
    <DraggablePanel
      storageKey="volunteer"
      title={t("roles.volunteer")}
      icon={<Icon name="volunteer_activism" size={18} fill />}
    >
      <VolunteerPanel />
    </DraggablePanel>
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
              <div className="pointer-events-auto absolute left-3 top-3 z-30">
                <ModeSwitcher />
              </div>
              <PanelSlot />
            </div>
          </div>
        </ToastProvider>
      </MapProvider>
    </RoleProvider>
  );
}
