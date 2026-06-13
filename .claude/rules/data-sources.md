# Rule: Real San Francisco Data Sources

All public, live, queryable today. **Center the map on San Francisco.** The Resource Agent consumes *location* feeds; the Foresight Agent consumes *demand* feeds. DataSF runs on **Socrata (SODA)** — every dataset has a JSON endpoint at `https://data.sfgov.org/resource/<id>.json`, filterable with `$where` / `$limit` (grab a free app token for rate limits).

## Resource-node locations (the pins)

| Source | Dataset id | → node type |
|---|---|---|
| **Pit Stops** (staffed public toilets, sinks, water, needle disposal) | `mr6h-cr3u` (daily) | hygiene |
| **Public Bathrooms / Public Water Assets** (Rec&Parks, PUC, Public Works) | `sxtt-wsyn` | hygiene + water |
| **HSH shelter & housing inventory** (shelter sites + annual HIC) | via hsh.sfgov.org → Research & Reports → HRS Data | bed/shelter |

## Demand / need signals (heatmap + Foresight)

| Source | Dataset id | Use |
|---|---|---|
| **SF311 Cases** (every case since 2008 w/ lat/long + category, incl. **Encampments**, **Homeless Concerns**) | `vw6y-z8j6` (nightly ~6am) | the real "where is need rising" signal |
| **HSH 90-day Emergency Shelter Waitlist** | `w4sk-nq57` | overflow-prediction input |
| **HUD PIT / HIC counts** (via HSH) | — | biennial/annual baseline context |

## External signal

- **National Weather Service** forecast API — `api.weather.gov`. Cold/rain fronts drive Foresight's overflow calls. **Free, no key.**

## Directories to layer in (confirm endpoints before building)

- **211 / SF Service Guide** (sfserviceguide.org) — official human-services directory: food, legal, medical, benefits.
- **SF-Marin Food Bank** — free-grocery/pantry locations → food nodes.

## The honest constraint (tell judges — reads as competence)

SF does **not** openly publish real-time *per-bed* shelter availability — that lives in the HSH/ONE System (HMIS), not a public feed. So Waypoint uses **real shelter locations + real demand data (311, waitlist)**, while live `capacity_open` numbers are **seeded/simulated for the demo**; in production that single field comes from an HSH/ONE System integration. **State this plainly. Do not fake a live bed API.**

## Seeding

Seed `resource_node` from the location feeds above + 3–4 scripted in-flight journeys + seeded `capacity_open` counts, so the map is alive and believable on load. Keep seed data in Supabase `seed.sql` (re-applied by `npx supabase db reset`). Mark simulated fields clearly in code/comments.
