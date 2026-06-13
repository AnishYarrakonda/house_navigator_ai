// Smoke + privacy test for the co-pilot side. Mounts the real panel against the
// mock data layer and asserts: open needs render as cards, the accept affordance
// is present, and — critically — NO identity or free-text words leak pre-accept
// (privacy.md: volunteers see type + fuzzed area + distance only).

import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, expect, it } from "vitest";
import "../../i18n";
import { MapProvider } from "../../map";
import VolunteerPanel from "./VolunteerPanel";

// Tell React this is an act() environment so effects flush deterministically.
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT =
  true;

let container: HTMLDivElement;

beforeEach(() => {
  container = document.createElement("div");
  document.body.appendChild(container);
});

afterEach(() => {
  container.remove();
});

async function mount() {
  await act(async () => {
    createRoot(container).render(
      <MapProvider>
        <VolunteerPanel />
      </MapProvider>,
    );
  });
  // Flush the async data loads kicked off in useEffect.
  await act(async () => {
    await new Promise((r) => setTimeout(r, 0));
  });
}

it("shows open needs as cards with an accept affordance", async () => {
  await mount();
  const text = container.textContent ?? "";
  // Two seeded open needs → an accept button each.
  const acceptButtons = [...container.querySelectorAll("button")].filter((b) =>
    b.textContent?.includes("Accept & help"),
  );
  expect(acceptButtons.length).toBeGreaterThanOrEqual(2);
  expect(text).toContain("A few blocks from");
});

it("never leaks identity or the person's free-text words pre-accept", async () => {
  await mount();
  const text = container.textContent ?? "";
  // need-open-1's words must not appear anywhere in the inbound view.
  expect(text).not.toContain("my dog");
  expect(text).not.toContain("nowhere safe tonight");
  // No person id / alias surface either.
  expect(text).not.toContain("person-jules");
});
