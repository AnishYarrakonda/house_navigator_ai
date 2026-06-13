-- Disable Row-Level Security on the demo tables so the anon key can read/write
-- (the documented demo posture; see schema.sql header for the production story).
-- Small + truncation-proof: paste this whole thing into the Supabase SQL editor.
alter table person          disable row level security;
alter table volunteer       disable row level security;
alter table resource_node   disable row level security;
alter table journey         disable row level security;
alter table need            disable row level security;
alter table waypoint        disable row level security;
alter table message         disable row level security;
alter table foresight_alert disable row level security;
