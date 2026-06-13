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
