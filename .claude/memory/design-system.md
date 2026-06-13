---
name: design-system
description: Waypoint's visual design system (cobalt × deep-teal dark) and where the source of truth lives
metadata:
  type: reference
---

The **Navigation Map** design system is Waypoint's visual source of truth, living in `Navigation Map/` at the repo root: `README.md` (overview), `tokens/tokens.css` (all `--wp-*` custom properties + a Tailwind mirror), `components/*.dc.html` (8 inline-styled component mockups), and `screens/*.dc.html` (CrisisHome / Copilot / Coordinator). The `.dc.html` files are mockups to translate into React + Tailwind — not shipped code.

It is **dark-first cobalt × deep-teal**, replacing the original warm-amber theme (`#1a1410`/`#f4a259`). Key tokens: bg `--wp-bg` `#08090a`; surfaces `--wp-surf/surf2/surf3`; **primary action** cobalt `--wp-acc` `#2f6df6`; **live data & routes** deep teal `--wp-teal` `#0e9594`; capacity **open** `#4cc38a` ● / **filling** `#d8b65c` ◆ / **full** `#e36a7d` (color + shape + label, never color alone — a dignity a11y invariant, see [[dignity-invariants]]). Fonts: DM Serif Display (display), Hanken Grotesk (UI/body), Space Mono (data/labels), Material Symbols Rounded (icons).

As of 2026-06-13 a presentation-only revamp is migrating the app to this system: foundation landed (`index.html` fonts + `theme-color` `#08090a`, `src/tokens.css`, Tailwind `wp-*` colors); in flight are the `src/components/kit/` components, the map visual layer (`src/map/{style,visuals,engine}.ts`, `map.css` — pins must be an icon badge + capacity pill, not full-width bars), the three role panels, the `App` shell layout, loading skeletons, and i18n. Out of scope: flows, `lib/data/*`, matching/triage logic, agents, and the frozen `MapController` interface (`src/map/types.ts`). See [[project-overview]] and `.claude/rules/map.md`.
