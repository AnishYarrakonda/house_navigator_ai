// App shell. The full-bleed map IS the home screen on every side (not a tab).
// An overlay role toggle switches the role-based panel slot. Wrapped in
// RoleProvider + MapProvider + i18n. Lanes replace the stub components behind
// MapView / CrisisPanel / VolunteerPanel / CoordinatorPanel — App.tsx itself
// should not need editing again.

import { useTranslation } from "react-i18next";
import { MapProvider, MapView } from "./map";
import { RoleProvider, ROLES, useRole } from "./lib/useRole";
import CrisisPanel from "./features/crisis/CrisisPanel";
import VolunteerPanel from "./features/volunteer/VolunteerPanel";
import CoordinatorPanel from "./features/coordinator/CoordinatorPanel";
import type { Role } from "./types";

function RoleToggle() {
  const { role, setRole } = useRole();
  const { t } = useTranslation();
  return (
    <div
      className="pointer-events-auto flex gap-1 rounded-full bg-waypoint-surface/90 p-1 shadow-lg backdrop-blur"
      role="group"
      aria-label="role"
    >
      {ROLES.map((r: Role) => (
        <button
          key={r}
          type="button"
          onClick={() => setRole(r)}
          aria-pressed={role === r}
          className={
            "min-h-[36px] rounded-full px-3 py-1 text-xs font-medium transition " +
            (role === r
              ? "bg-waypoint-accent text-waypoint-bg"
              : "text-white/70 hover:text-white")
          }
        >
          {t(`roles.${r}`)}
        </button>
      ))}
    </div>
  );
}

function RolePanel() {
  const { role } = useRole();
  switch (role) {
    case "crisis":
      return <CrisisPanel />;
    case "volunteer":
      return <VolunteerPanel />;
    case "coordinator":
      return <CoordinatorPanel />;
  }
}

export default function App() {
  return (
    <RoleProvider>
      <MapProvider>
        <div className="relative h-dvh w-screen overflow-hidden bg-waypoint-bg">
          {/* Map is the home screen on both sides */}
          <MapView />

          {/* Overlay UI */}
          <div className="pointer-events-none absolute inset-0 flex flex-col">
            <header className="flex items-start justify-end p-3">
              <RoleToggle />
            </header>
            <div className="mt-auto flex justify-center p-3">
              <div className="pointer-events-auto w-full max-w-md">
                <RolePanel />
              </div>
            </div>
          </div>
        </div>
      </MapProvider>
    </RoleProvider>
  );
}
