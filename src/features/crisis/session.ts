// Device-only identity for the crisis side. NO account, NO email/password
// (privacy invariant #6): we mint a random per-device id, persist it in
// localStorage, and use it as the need's person_id. It is a session token, not
// a login — nothing about the person's real identity is captured.

const KEY = "waypoint.crisis.person";

export function getDevicePersonId(): string {
  if (typeof window === "undefined") return "person-anon";
  let id = window.localStorage.getItem(KEY);
  if (!id) {
    const rand =
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : Math.random().toString(36).slice(2, 12);
    id = `person-${rand}`;
    window.localStorage.setItem(KEY, id);
  }
  return id;
}
