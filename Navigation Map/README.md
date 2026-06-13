# Waypoint Design System

A premium, map-first design system for the Waypoint housing-dignity app.
Dark-first, trauma-informed, WCAG AA, icon-first, EN/ES bilingual.

---

## File structure

```
waypoint-design-system/
├── README.md                         ← you are here
├── tokens/
│   └── tokens.css                    ← all CSS custom properties + Tailwind mirror
├── components/
│   ├── Button.dc.html                ← all variants, states, sizes + live preview
│   ├── SegmentedControl.dc.html      ← role switcher + language toggle
│   ├── CapacityChip.dc.html          ← open / filling / full + map pins
│   ├── NeedTile.dc.html              ← 5 need tiles, bilingual, tap-to-select
│   ├── PlaceCard.dc.html             ← suggested place + why rationale + confirm
│   ├── JourneyCard.dc.html           ← path home timeline, step states, actions
│   ├── ChatThread.dc.html            ← co-pilot thread, 3 message types + input
│   └── Toast.dc.html                 ← 4 toast variants, auto-dismiss, live demo
└── screens/
    ├── CrisisHome.dc.html            ← map + bottom sheet + need tiles + EN/ES
    ├── Copilot.dc.html               ← map + inbound panel + journeys panel
    └── Coordinator.dc.html           ← map + region view + stats + time scrubber
```

The master reference (`Waypoint Design System.dc.html`) in the project root
documents every token, type scale, accent direction, and pairing in one scroll.

---

## Fonts

Add to your HTML `<head>` (or import in your CSS):

```html
<!-- UI + display -->
<link href="https://fonts.googleapis.com/css2?family=DM+Serif+Display:ital@0;1&family=Hanken+Grotesk:wght@400;500;600;700;800&family=Space+Mono:wght@400;700&display=swap" rel="stylesheet">
<!-- Icons -->
<link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Rounded:opsz,wght,FILL,GRAD@24,300,0,0&display=block" rel="stylesheet">
```

| Role | Font | Weights |
|---|---|---|
| Display / headlines | DM Serif Display | 400, 400i |
| UI / body / buttons | Hanken Grotesk | 400 500 600 700 800 |
| Data / labels / mono | Space Mono | 400 700 |
| Icons | Material Symbols Rounded | ligature-based |

---

## Tokens

Import `tokens/tokens.css` once at the root of your app. All tokens are
prefixed `--wp-` to avoid collisions.

Key tokens:

| Token | Value | Use |
|---|---|---|
| `--wp-bg` | `#08090a` | App background / map base |
| `--wp-surf` | `#121316` | Panels & sheets |
| `--wp-surf2` | `#17181c` | Cards on panels |
| `--wp-surf3` | `#1e1f24` | Hover states |
| `--wp-acc` | `#2f6df6` | **Primary action — Cobalt** |
| `--wp-teal` | `#0e9594` | Live data & routes — Deep teal |
| `--wp-open` | `#4cc38a` | Capacity: open |
| `--wp-low` | `#d8b65c` | Capacity: filling |
| `--wp-full` | `#e36a7d` | Capacity: full |
| `--wp-tx` | `#f7f8f8` | Primary text |
| `--wp-txd` | `#9395a1` | Secondary text |
| `--wp-serif` | DM Serif Display | Display / headline font |
| `--wp-ui` | Hanken Grotesk | UI / body font |
| `--wp-mono` | Space Mono | Data / label font |

A Tailwind config mirror is included at the bottom of `tokens.css`.

---

## Accent system

Three accent roles — never let them compete:

| Role | Token | Color |
|---|---|---|
| **Primary action** | `--wp-acc` | `#2f6df6` Cobalt |
| **Live & routes** | `--wp-teal` | `#0e9594` Deep teal |
| **Success / confirm** | `--wp-open` | `#4cc38a` Green |

Signature pairing: **Cobalt × Deep teal** — primary CTA in cobalt, route
lines and live indicators in teal, success / "bed held" in green.

---

## Capacity rule

**Always pair color with a label AND a shape marker** — never color alone.

| State | Color | Shape | Label |
|---|---|---|---|
| Open | `--wp-open` | ● circle | "N open" |
| Filling | `--wp-low` | ◆ rotated square | "N left" |
| Full | `--wp-full` | call icon | "Full — call" |

---

## Button sizing

| Size | Padding | Font | Radius |
|---|---|---|---|
| sm | 7px 12px | 12px | 7px |
| md | 9px 15px | 13px | 9px |
| lg | 13px 22px | 16px | 11px |
| Crisis CTA | 19px full-width | 18-19px | 14px |

All interactive touch targets are minimum **44×44px**.

---

## Privacy invariants (from repo rules)

- **No live GPS tracking** — store the node a person is heading to, never a trail.
- **Geofuzzing** — need beacons snap to a ~250m grid cell.
- **k-anonymity** — never render a heatmap cell with fewer than k=5 signals.
- **No PII to models** — agents see aliases, need types, fuzzed cells only.
- **Human-in-the-loop** — Triage / Navigator recommend; a human confirms.
- **No account barrier on crisis side** — device-session token only.

---

## Trauma-informed copy guidelines

- "I need help" — not "Submit request"
- "Somewhere safe tonight" — not "Emergency shelter intake"
- No urgency-shaming, no countdowns, no red error states as punishment
- Short, warm, concrete: "what to expect when you arrive"
- All user-facing strings through i18n (EN + ES minimum)
