-- Waypoint one-shot setup: schema + seed. Paste into Supabase SQL editor,
-- or run: psql "$DB_URL" -f supabase/setup.sql
-- Generated from schema.sql + seed.sql — edit those, not this file.

-- Waypoint Postgres schema — the §5 shared blackboard.
-- The UI (all three frontend lanes) and the runtime agents read/write these
-- tables; Supabase Realtime fans every change onto the map.
--
-- Apply (local dev): psql "$DATABASE_URL" -f supabase/schema.sql -f supabase/seed.sql
--   or, if you scaffold the Supabase CLI: drop this into supabase/migrations/
--   and `npx supabase db reset` (re-applies schema + seed.sql).
--
-- Idempotent: drops and recreates everything, so it's safe to re-run.
--
-- ── Privacy invariants honored here (see .claude/rules/privacy.md) ───────────
--   #1 No live tracking:  there is NO column anywhere for a person's real
--      coordinates. A person's place on the map is the resource they head to.
--   #2 Geofuzzing:        need.fuzzed_geocell is a ~250m grid cell, fuzzed on
--      capture (lib/geocell.ts). No precise point is ever stored.
--   #5 Beacons expire:    need.expires_at defaults to +6h; expiry is enforced
--      server-side (the data layer never surfaces an expired beacon as open).
--   #4 Consent:           journey/person consent_share_journey defaults FALSE.
--   #6 No account barrier: person uses device_session_token, not email/password.
--
-- ── RLS: intentionally SKIPPED for the hackathon ────────────────────────────
-- Row-Level Security is NOT enabled below. This is a deliberate scope cut for
-- the demo, NOT the production posture.
--
-- PRODUCTION STORY (what ships with RLS on; see .claude/rules/privacy.md):
--   * Default deny on every table.
--   * person/need/journey/message: a person reads/writes only their own rows,
--     matched via their device_session_token (anonymous auth on the crisis side).
--   * volunteer view: sees a need's `type` + `fuzzed_geocell` + distance only —
--     never identity or precise location — until mutual accept; sees a journey
--     only when consent_share_journey = true.
--   * coordinators read only the DERIVED, k-anonymized heatmap aggregates,
--     never base rows.
--   * resource_node is public-readable.
-- With RLS off, the anon key has full table access — fine for a local demo,
-- unacceptable in production. Do not ship this file as-is.

-- Extensions ----------------------------------------------------------------
create extension if not exists pgcrypto;  -- gen_random_uuid()

-- Drop in FK-safe order ------------------------------------------------------
drop table if exists message cascade;
drop table if exists waypoint cascade;
drop table if exists need cascade;
drop table if exists journey cascade;
drop table if exists foresight_alert cascade;
drop table if exists resource_node cascade;
drop table if exists volunteer cascade;
drop table if exists person cascade;

-- person --------------------------------------------------------------------
-- A person in crisis. NO real-location field (invariant #1). No email/password
-- (invariant #6) — identity is a device-session token only.
create table person (
  id                    text primary key default gen_random_uuid()::text,
  display_alias         text not null,
  preferred_language    text not null default 'en' check (preferred_language in ('en', 'es')),
  consent_share_journey boolean not null default false,   -- invariant #4: defaults off
  device_session_token  text,
  created_at            timestamptz not null default now()
);

-- volunteer -----------------------------------------------------------------
create table volunteer (
  id      text primary key default gen_random_uuid()::text,
  name    text not null,
  skills  text[] not null default '{}',
  active  boolean not null default true
);

-- resource_node -------------------------------------------------------------
-- Public, real SF locations (data-sources.md). capacity_open is SIMULATED for
-- the demo — SF publishes no public real-time per-bed feed; in production this
-- single field comes from an HSH/ONE System integration. Do not fake a live API.
create table resource_node (
  id             text primary key default gen_random_uuid()::text,
  name           text not null,
  type           text not null check (type in ('bed', 'food', 'hygiene', 'water', 'medical', 'charging-wifi')),
  lat            double precision not null,
  lng            double precision not null,
  capacity_total integer not null default 0,
  capacity_open  integer not null default 0,   -- SIMULATED (see note above)
  hours          text,
  notes          text
);

-- journey -------------------------------------------------------------------
-- The path home. copilot_id is the volunteer walking it with the person.
create table journey (
  id         text primary key default gen_random_uuid()::text,
  person_id  text references person(id) on delete cascade,
  copilot_id text references volunteer(id) on delete set null,
  status     text not null default 'active' check (status in ('active', 'paused', 'complete')),
  created_at timestamptz not null default now()
);

-- need ----------------------------------------------------------------------
-- A beacon. fuzzed_geocell is a ~250m cell (invariant #2). Beacons expire
-- (invariant #5). The Triage agent's recommendation + rationale + confidence
-- are persisted here as the explainability audit trail (ai-agents.md); the
-- human decision (volunteer_id on claim) is the rest of that trail.
create table need (
  id             text primary key default gen_random_uuid()::text,
  person_id      text references person(id) on delete cascade,
  type           text not null check (type in ('bed', 'food', 'hygiene', 'medical', 'talk')),
  words          text,                                   -- the person's own words → Triage
  fuzzed_geocell text not null,                          -- ~250m cell, never a precise point
  status         text not null default 'open' check (status in ('open', 'matched', 'met', 'expired')),
  created_at     timestamptz not null default now(),
  expires_at     timestamptz not null default (now() + interval '6 hours'),
  volunteer_id   text references volunteer(id) on delete set null,  -- HITL: who claimed it

  -- Triage audit trail (written by /api/triage; Triage RECOMMENDS only).
  triage_status         text check (triage_status in ('pending', 'recommended', 'queued')),
  triage_recommendation jsonb,    -- ranked options [{node_id, score, why}], machine-readable
  triage_rationale      text,     -- plain-language rationale shown to the human co-pilot
  triage_confidence     numeric   -- 0..1; low confidence → triage_status = 'queued' (human queue)
);

-- waypoint ------------------------------------------------------------------
-- A step on a journey. node_id ties the step to a real place (and the map).
create table waypoint (
  id         text primary key default gen_random_uuid()::text,
  journey_id text references journey(id) on delete cascade,
  node_id    text references resource_node(id) on delete set null,
  label      text not null,
  "order"    integer not null default 0,
  status     text not null default 'upcoming' check (status in ('upcoming', 'current', 'complete')),
  date       timestamptz
);

-- message -------------------------------------------------------------------
-- The co-pilot thread for a journey.
create table message (
  id          text primary key default gen_random_uuid()::text,
  journey_id  text references journey(id) on delete cascade,
  sender_role text not null check (sender_role in ('person', 'volunteer', 'system')),
  body        text not null,
  created_at  timestamptz not null default now()
);

-- foresight_alert -----------------------------------------------------------
-- Pre-positioning / overflow alerts posted by the Foresight agent. Aggregate
-- only — an `area` (district), never a person.
create table foresight_alert (
  id         text primary key default gen_random_uuid()::text,
  area       text not null,
  rationale  text not null,
  severity   text not null check (severity in ('watch', 'warning')),
  created_at timestamptz not null default now()
);

-- RLS: explicitly OFF for the demo ------------------------------------------
-- Hosted Supabase enables RLS by default on new public tables, which would make
-- the anon key see nothing and write nothing. The documented demo posture is
-- RLS OFF (the production story with policies is in the header comment above), so
-- we disable it explicitly here. Do NOT ship this as-is.
alter table person          disable row level security;
alter table volunteer       disable row level security;
alter table resource_node   disable row level security;
alter table journey         disable row level security;
alter table need            disable row level security;
alter table waypoint        disable row level security;
alter table message         disable row level security;
alter table foresight_alert disable row level security;

-- Indexes helpful for the live queries --------------------------------------
create index if not exists need_status_idx        on need (status);
create index if not exists need_expires_idx        on need (expires_at);
create index if not exists waypoint_journey_idx     on waypoint (journey_id, "order");
create index if not exists message_journey_idx      on message (journey_id, created_at);

-- Realtime publication ------------------------------------------------------
-- Supabase fans changes to these tables onto the map (the live demo wow, M2).
-- `supabase_realtime` is created by the Supabase platform; create it if running
-- against bare Postgres so this file applies cleanly either way.
do $$
begin
  if not exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    create publication supabase_realtime;
  end if;
end $$;

alter publication supabase_realtime add table resource_node;
alter publication supabase_realtime add table need;
alter publication supabase_realtime add table journey;
alter publication supabase_realtime add table waypoint;
alter publication supabase_realtime add table message;
alter publication supabase_realtime add table foresight_alert;

-- REPLICA IDENTITY FULL so UPDATE/DELETE events carry the full row over
-- Realtime (the data layer refetches on any change, but this keeps payloads
-- complete for any consumer that reads them directly).
alter table resource_node   replica identity full;
alter table need            replica identity full;
alter table journey         replica identity full;
alter table waypoint        replica identity full;
alter table message         replica identity full;
alter table foresight_alert replica identity full;

-- ============================== SEED ==============================

-- Waypoint seed data — mirrors src/lib/data/seed.ts so VITE_DATA_MODE=live is a
-- drop-in replacement for the in-memory mock (same ids, same shapes), and the
-- map is alive and believable the instant it loads.
--
-- Locations are REAL SF resource nodes (data-sources.md: Pit Stops mr6h-cr3u,
-- public bathrooms/water sxtt-wsyn, plus shelters/food/clinics). capacity_open
-- is SIMULATED — SF has no public real-time per-bed feed; in production that one
-- field comes from an HSH/ONE System integration. Everything else is real.
--
-- Re-runnable: truncates then re-inserts. (db reset re-applies schema + this.)

truncate message, waypoint, need, journey, foresight_alert, resource_node, volunteer, person restart identity cascade;

-- person --------------------------------------------------------------------
-- Scripted people. NO real location is ever stored — only a fuzzed cell on the
-- need. The crisis copy steers away from legal names; aliases are all the model
-- and volunteers ever see.
insert into person (id, display_alias, preferred_language, consent_share_journey, device_session_token) values
  ('person-jules', 'Jules', 'en', false, 'seed-token-jules'),
  ('person-sam',   'Sam',   'es', false, 'seed-token-sam'),
  ('person-maria', 'Maria', 'es', true,  'seed-token-maria'),
  ('person-theo',  'Theo',  'en', true,  'seed-token-theo'),
  ('person-rosa',  'Rosa',  'es', true,  'seed-token-rosa');

-- volunteer -----------------------------------------------------------------
insert into volunteer (id, name, skills, active) values
  ('vol-amara', 'Amara', '{housing,spanish}', true),
  ('vol-dev',   'Dev',   '{benefits,medical}', true),
  ('vol-lin',   'Lin',   '{outreach}', false);

-- resource_node -------------------------------------------------------------
-- ~12 real-ish SF nodes spanning bed / food / hygiene / water / medical / charging.
-- capacity_open values are SIMULATED for the demo.
insert into resource_node (id, name, type, lat, lng, capacity_total, capacity_open, hours, notes) values
  ('node-msc-south',        'MSC South Shelter',                  'bed',          37.7765, -122.4053, 340, 12,  '24/7 intake',                      'Large shelter near 5th & Bryant. Mats and beds.'),
  ('node-next-door',        'Next Door Shelter',                  'bed',          37.7836, -122.4146, 334, 4,   'Reservation-based',                'Polk St. Pet-friendly kennels available.'),
  ('node-sanctuary',        'Sanctuary SF',                       'bed',          37.7785, -122.4096, 200, 0,   'Evening intake',                   '8th St. Currently full — check back after 6pm.'),
  ('node-glide',            'GLIDE Daily Free Meals',             'food',         37.7831, -122.4126, 600, 420, 'Breakfast 8a, Lunch 12p, Dinner 4p','Ellis St. No questions asked.'),
  ('node-stanthony',        'St. Anthony''s Dining Room',         'food',         37.7826, -122.4124, 500, 310, 'Lunch 11:30a–1:30p daily',         'Golden Gate Ave. Hot lunch.'),
  ('node-foodbank-pantry',  'SF-Marin Food Bank Pantry',          'food',         37.7479, -122.4053, 300, 180, 'Wed & Sat 10a–1p',                 'Free groceries. Bring a bag.'),
  ('node-pitstop-16th',     'Pit Stop — 16th & Mission',          'hygiene',      37.7649, -122.4197, 4,   3,   '9a–7p',                            'Staffed toilets, sink, needle disposal.'),
  ('node-pitstop-civic',    'Pit Stop — Civic Center',            'hygiene',      37.7796, -122.4156, 4,   2,   '7a–9p',                            'UN Plaza. Toilets + handwashing.'),
  ('node-lava-mae',         'Mobile Showers (Bayview)',           'hygiene',      37.7299, -122.3892, 6,   5,   'Tue/Thu 9a–12p',                   'Hot showers + towels.'),
  ('node-water-dolores',    'Public Water — Dolores Park',        'water',        37.7596, -122.4269, 999, 999, 'Daylight',                         'Refill stations near the playground.'),
  ('node-clinic-tom-waddell','Tom Waddell Urban Health Clinic',   'medical',      37.7818, -122.4136, 80,  22,  'Mon–Fri 8a–5p',                    'Walk-in care. Wound care, meds, mental health.'),
  ('node-library-main',     'SF Main Library — Charging & Wi-Fi', 'charging-wifi',37.7786, -122.4156, 120, 64,  'Mon–Sat 10a–6p',                   'Outlets, free Wi-Fi, social worker on Tue.');

-- journey -------------------------------------------------------------------
insert into journey (id, person_id, copilot_id, status) values
  ('journey-maria', 'person-maria', 'vol-amara', 'active'),
  ('journey-theo',  'person-theo',  'vol-dev',   'active'),
  ('journey-rosa',  'person-rosa',  'vol-amara', 'active');

-- need ----------------------------------------------------------------------
-- Two open beacons. fuzzed_geocell values are the ~250m cells produced by
-- lib/geocell.toGeocell() (GEOCELL_SIZE_DEG = 0.00225) for the Tenderloin and
-- Mission areas — never precise points.
insert into need (id, person_id, type, words, fuzzed_geocell, status, created_at, expires_at) values
  ('need-open-1', 'person-jules', 'bed',  'me and my dog, nowhere safe tonight, can''t be split up', 'g_16792_-54407', 'open', now() - interval '18 minutes', now() + interval '342 minutes'),
  ('need-open-2', 'person-sam',   'food', 'haven''t eaten since yesterday',                          'g_16784_-54409', 'open', now() - interval '48 minutes', now() + interval '312 minutes');

-- waypoint ------------------------------------------------------------------
insert into waypoint (id, journey_id, node_id, label, "order", status, date) values
  -- Maria — reached out → safe tonight (done) → ID next (current) → benefits (upcoming)
  ('wp-maria-1', 'journey-maria', null,             'Reached out',                      0, 'complete', now() - interval '72 hours'),
  ('wp-maria-2', 'journey-maria', 'node-next-door', 'Safe tonight — Next Door Shelter', 1, 'complete', now() - interval '48 hours'),
  ('wp-maria-3', 'journey-maria', null,             'Replace ID at DMV',                2, 'current',  now() + interval '24 hours'),
  ('wp-maria-4', 'journey-maria', null,             'CalFresh / benefits',              3, 'upcoming', null),
  -- Theo
  ('wp-theo-1',  'journey-theo',  null,             'Reached out',                      0, 'complete', now() - interval '20 hours'),
  ('wp-theo-2',  'journey-theo',  'node-msc-south', 'Safe tonight — MSC South',         1, 'current',  now() - interval '2 hours'),
  ('wp-theo-3',  'journey-theo',  null,             'Coordinated Entry assessment',     2, 'upcoming', null),
  -- Rosa
  ('wp-rosa-1',  'journey-rosa',  null,             'Reached out',                      0, 'complete', now() - interval '120 hours'),
  ('wp-rosa-2',  'journey-rosa',  'node-sanctuary', 'Safe tonight — Sanctuary SF',      1, 'complete', now() - interval '96 hours'),
  ('wp-rosa-3',  'journey-rosa',  null,             'Got CalFresh',                     2, 'complete', now() - interval '24 hours'),
  ('wp-rosa-4',  'journey-rosa',  null,             'Housing assessment scheduled',     3, 'current',  now() + interval '48 hours');

-- message -------------------------------------------------------------------
insert into message (id, journey_id, sender_role, body, created_at) values
  ('msg-maria-1', 'journey-maria', 'volunteer', 'Hi Maria — I''m Amara, I''ll walk this with you. There''s a bed held at Next Door tonight.', now() - interval '2910 minutes'),
  ('msg-maria-2', 'journey-maria', 'person',    'thank you. what do i bring?',                                                                   now() - interval '2892 minutes'),
  ('msg-maria-3', 'journey-maria', 'volunteer', 'Just yourself. Intake is open now — they''re expecting you.',                                    now() - interval '2880 minutes');

-- foresight_alert -----------------------------------------------------------
insert into foresight_alert (id, area, rationale, severity, created_at) values
  ('alert-tenderloin', 'Tenderloin',
   'Cold front tonight (low 42°F, rain), shelter waitlist up 18% this week, and 311 homeless-concern reports clustering near Ellis & Jones. Recommend pre-positioning 30 overflow mats.',
   'warning', now() - interval '1 hour');
