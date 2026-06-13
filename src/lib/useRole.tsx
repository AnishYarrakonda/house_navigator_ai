// Role toggle — NO auth (hackathon scope cut; see prompts/README.md). The
// crisis side is genuinely no-login. Role is read from ?role= on first load,
// defaults to "crisis", and persists to localStorage. No passwords, no Supabase
// auth here.

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { Role } from "../types";

const STORAGE_KEY = "waypoint.role";
const ROLES: Role[] = ["crisis", "volunteer", "coordinator"];

function isRole(v: string | null): v is Role {
  return v !== null && (ROLES as string[]).includes(v);
}

function initialRole(): Role {
  if (typeof window === "undefined") return "crisis";
  const fromQuery = new URLSearchParams(window.location.search).get("role");
  if (isRole(fromQuery)) return fromQuery;
  const stored = window.localStorage.getItem(STORAGE_KEY);
  if (isRole(stored)) return stored;
  return "crisis";
}

interface RoleContextValue {
  role: Role;
  setRole: (role: Role) => void;
}

const RoleContext = createContext<RoleContextValue | null>(null);

export function RoleProvider({ children }: { children: ReactNode }) {
  const [role, setRoleState] = useState<Role>(initialRole);

  const setRole = useCallback((next: Role) => {
    setRoleState(next);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(STORAGE_KEY, next);
    }
  }, []);

  const value = useMemo(() => ({ role, setRole }), [role, setRole]);
  return <RoleContext.Provider value={value}>{children}</RoleContext.Provider>;
}

export function useRole(): RoleContextValue {
  const ctx = useContext(RoleContext);
  if (!ctx) throw new Error("useRole must be used within a RoleProvider");
  return ctx;
}

export { ROLES };
