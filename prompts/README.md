# Waypoint — Parallel Build Prompts (7–8 hr hackathon, 2 people)

Five prompts: **one foundation** (run first, by one person) + **four parallel lanes** that never touch the same files. Paste each into its own Claude Code session.

## The golden rule (why nothing conflicts)

- **Foundation owns every shared file** — types, the data-layer interface + mock, `geocell`, `redaction`, the App shell + role toggle, and the MapController interface. It runs **first** and merges to `main`.
- **Each lane owns a disjoint set of folders** and is a **pure consumer** of the shared files. A lane **never edits a file outside its owned folders.** That's the whole conflict-avoidance strategy.
- Every UI lane builds against `VITE_DATA_MODE=mock`, so **no lane is blocked on the database.** Lane 4 fills in the real backend behind the same interface.

## Timeline

| Time | Who | What |
|---|---|---|
| 0:00–0:40 | Person A | Run `00-foundation.md` → push to `main`. Person B simultaneously: create the Supabase project + get the Anthropic key (see Setup below). |
| 0:40 | Both | `git pull`. Each person opens **2 worktrees** off updated `main`. |
| 0:40–6:30 | A: Lanes 1+4 · B: Lanes 2+3 | 4 prompts running at once, each in its own worktree/branch. Open PRs / merge to `main` as lanes finish. |
| 6:30–8:00 | Both | Flip `VITE_DATA_MODE=live`, integration test, run the demo script in `.claude/plans/M5-polish.md`. |

> 4 prompts running at once = 2 people × 2 worktrees each. Suggested split: **A = Lane 1 (map) + Lane 4 (backend/agents)**, **B = Lane 2 (crisis) + Lane 3 (volunteer/coordinator)**. Swap by interest.

## One-time external setup (do during the foundation step)

1. **Supabase** (free): create a project → Project Settings → API → copy **Project URL** and **anon public key**. After the foundation lands the schema, paste `supabase/schema.sql` + `supabase/seed.sql` into the SQL editor and run them. Database → Replication → enable Realtime for `need`, `resource_node`, `journey`, `waypoint`, `message`.
2. **Anthropic API key**: from the console. This is **server-side only**.
3. **`.env`** at repo root (the foundation creates `.env.example` — copy it):
   ```
   VITE_DATA_MODE=mock                 # flip to "live" once Lane 4 + Supabase are ready
   VITE_SUPABASE_URL=https://xxxx.supabase.co
   VITE_SUPABASE_ANON_KEY=eyJ...
   ANTHROPIC_API_KEY=sk-ant-...        # NEVER prefixed with VITE_ (would leak to browser)
   ```
4. **DataSF / NWS**: no keys needed. The foundation pre-fetches SF nodes into the seed, so the demo never depends on a live call. (Live fetch in the Resource agent is an optional bonus.)
5. **Running it**: `npm run dev` runs the Vite app (works fully in `mock` mode). The agents live in `/api/*` — run them with `vercel dev` (recommended) or the local dev server Lane 4 sets up. Deploy with `vercel` if you want a shareable URL.

## Hackathon scope cuts (deliberate — say these to judges as competence)

- **No auth.** Role toggle (`Crisis / Volunteer / Coordinator`), also `?role=` URL param. Crisis side is genuinely no-login. "Production: real volunteer login + Supabase anonymous sessions for crisis."
- **No RLS.** The privacy guarantees that matter are enforced in code and visible in the demo: **geofuzzing** (`lib/geocell`), **k-anonymity** (heatmap derivation), **no PII to the model** (`lib/redaction`), **human-in-the-loop**. "Production: RLS + the redaction layer enforce this at the database."
- **`capacity_open` is simulated** — SF has no public per-bed feed (see `.claude/rules/data-sources.md`). Real shelter *locations* + real *demand* (311) are used.
- **Agents prioritized:** **Triage** is the showcase, build it well. **Foresight** is a strong second (pure aggregate, no PII story). **Resource** can run once to seed, then is "scheduled in production." **Navigator** can be a lighter recommend-next-waypoint call. Don't try to make all four production-grade in 8 hrs.

## Each lane prompt tells its session to:

1. Read `.claude/plans/BIG_PICTURE.md` + its referenced `.claude/rules/*`.
2. Create its own git worktree + branch.
3. Work **only** inside its owned folders; import shared contracts, never edit them.
4. Build against `mock` data; verify with `npm run lint && npm run typecheck`.
5. Open a PR / merge to `main` when its done-criteria pass.

Files: `00-foundation.md`, `01-map-engine.md`, `02-crisis-side.md`, `03-volunteer-coordinator.md`, `04-backend-agents.md`.
