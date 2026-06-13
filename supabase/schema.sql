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
  notes          text,
  volunteer_id   text,                          -- set when a volunteer posts the listing
  address        text                           -- human-readable address the listing geocoded from
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
