// Smoke test for the coordinator view: the Foresight alert renders with its
// plain-language rationale and a pre-position action, and the time scrubber +
// capacity list mount without error against the mock layer.

import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, expect, it } from "vitest";
import "../../i18n";
import { MapProvider } from "../../map";
import CoordinatorPanel from "./CoordinatorPanel";

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
        <CoordinatorPanel />
      </MapProvider>,
    );
  });
  await act(async () => {
    await new Promise((r) => setTimeout(r, 0));
  });
}

it("renders the Foresight alert with rationale + pre-position action", async () => {
  await mount();
  const text = container.textContent ?? "";
  expect(text).toContain("Tenderloin");
  expect(text).toContain("Cold front"); // the rationale
  const preposition = [...container.querySelectorAll("button")].some((b) =>
    b.textContent?.includes("Pre-position resource"),
  );
  expect(preposition).toBe(true);
});

it("shows the capacity list and time scrubber", async () => {
  await mount();
  const text = container.textContent ?? "";
  expect(text).toContain("Capacity");
  expect(text).toContain("Time of day");
  // A live capacity node from seed.
  expect(text).toContain("MSC South Shelter");
});
