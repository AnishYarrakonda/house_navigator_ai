// Smoke + behavior test for the volunteer "post & manage listings" panel.
// Renders the real panel against the mock data layer and asserts that typing a
// description and posting creates a listing that shows up under "Your listings".
// In jsdom there's no /api/listing, so the panel's client-side fallback parser
// runs — which is exactly the mock-first path we want to verify.

import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, expect, it } from "vitest";
import "../../i18n";
import { MapProvider } from "../../map";
import { db } from "../../lib/data";
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
  await act(async () => {
    await new Promise((r) => setTimeout(r, 0));
  });
}

it("renders the post-a-listing form", async () => {
  await mount();
  const textarea = container.querySelector("textarea");
  expect(textarea).not.toBeNull();
  const text = container.textContent ?? "";
  expect(text).toContain("Post listing");
  expect(text).toContain("Your listings");
});

it("posting a description creates a listing that appears in 'Your listings'", async () => {
  await mount();

  const textarea = container.querySelector("textarea") as HTMLTextAreaElement;
  // Drive a real React onChange.
  await act(async () => {
    const setter = Object.getOwnPropertyDescriptor(
      window.HTMLTextAreaElement.prototype,
      "value",
    )?.set;
    setter?.call(textarea, "Two spare beds near the Mission, dog-friendly");
    textarea.dispatchEvent(new Event("input", { bubbles: true }));
  });

  const submitBtn = [...container.querySelectorAll("button")].find((b) =>
    b.textContent?.includes("Post listing"),
  ) as HTMLButtonElement;
  expect(submitBtn).toBeTruthy();

  await act(async () => {
    submitBtn.click();
    // Let the async parse + createNode + subscription re-render settle.
    await new Promise((r) => setTimeout(r, 0));
  });

  // The new node is owned by the demo volunteer and shows under "Your listings".
  const nodes = await db.getNodes();
  const mine = nodes.filter((n) => n.volunteer_id === "vol-amara");
  expect(mine.length).toBeGreaterThanOrEqual(1);

  const text = container.textContent ?? "";
  expect(text).toContain("Mission");
});
