# Environments

One codebase, one Supabase project. Background: `Architecture.md`, decision G.

While there are no real players, preview deploys and production share the **same Supabase project**. A second (staging) project is added only once real players are in and a risky change needs a safe place to test.

| | Local | Preview | Production |
| --- | --- | --- | --- |
| Store | In-memory (no Supabase vars) | The Supabase project | The Supabase project |
| Telegram bot | None (`DEV_AUTH=1`) | Optional test bot pointed at the branch URL | Production bot |
| Deploys from | `npm run dev` | Vercel Preview (every branch) | `main` |
| Env vars | `.env.local` | Vercel → Preview | Vercel → Production |
| Feature flags | `FLAGS=a,b` | `feature_flags` table (shared) | `feature_flags` table (shared) |
| Sentry | Off (no DSN) | On, environment `preview` | On, environment `production` |

Every variable is listed in `.env.example`.

## Rules for sharing one database

- **Migrations only add.** New tables, new nullable or defaulted columns, new indexes, new functions. Never drop, rename or change the meaning of anything the code on `main` still uses. A removal waits until the code that used it has been on `main` for one release, then ships as its own migration.
- **Flags are shared.** Turning a flag on affects previews and production together. While there are no real players that's fine; afterwards, test with `FLAGS` locally first.
- **Back up before data scripts.** Before a backfill or any script that rewrites rows, take a backup (Supabase → Database → Backups, or export the tables).
- **Wipe test data at launch.** Before the Rug City launch, clear test players, rooms, results and events (see `docs/phase-1/11-launch.md`).

## Region

Put the Vercel functions in the same region as the Supabase database. Every API call makes several database round trips, so a cross-region hop is paid many times per request. In Vercel → Project → Settings → Functions → Function Region, pick the region matching Supabase (e.g. Supabase `eu-central-1` Frankfurt ↔ Vercel `fra1`).

## Local

```bash
cp .env.example .env.local   # DEV_AUTH=1 is all you need
npm run dev
```

- No Supabase vars: the in-memory store. Data is lost on restart.
- `DEV_AUTH=1`: play in a normal browser as fake users (`/?dev=1&name=Ana`). Ignored in production builds.
- `FLAGS=solo,daily` forces those flags on. Every other flag is off.
- With the Supabase vars set, local dev uses the shared project. That's fine for now; keep `DEV_AUTH` test users on ids that can't be real Telegram ids (e.g. 1–999).

## Preview

Every pushed branch gets a Preview deploy on the shared database.

**One-time setup**

1. **Vercel → Settings → Environment Variables:** tick **Preview** on `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `ANTHROPIC_API_KEY` and `ADMIN_TELEGRAM_IDS` (same values as Production). Leave `DEV_AUTH` and `FLAGS` unset.
2. **Optional test bot,** to play a branch inside Telegram: create a bot in @BotFather, register its Mini App with `/newapp` pointing at the branch URL (`<project>-git-<branch>-<team>.vercel.app`), and set its `TELEGRAM_BOT_TOKEN`, `NEXT_PUBLIC_BOT_USERNAME`, `NEXT_PUBLIC_APP_SHORT_NAME`, `TELEGRAM_WEBHOOK_SECRET` and `APP_URL` for Preview only. Without a test bot, check branches locally and merge to try them in the production bot.

**Checking a branch:** apply its new migration (below), push the branch, wait for the Preview deploy, open it through the test bot. Turn on the slice's flag in `feature_flags`.

## Production

- Deploys from `main`. `main` only takes green PRs (CI: typecheck, lint, tests, build).
- Vercel → Environment Variables → Production holds the production values. `DEV_AUTH` and `DEV_MIN_PLAYERS` are ignored there anyway.

## Migrations

Files in `supabase/migrations/`, numbered `000N_<name>.sql`, applied in order, never edited after merge. Each is written to be safe to run twice (`create … if not exists`) and, under the rules above, only adds.

Apply a slice's migration when you start testing its branch (it only adds, so the code on `main` keeps working). Either:

- **SQL editor:** Supabase dashboard → SQL Editor → paste the file → Run.
- **Supabase CLI:** `supabase link --project-ref <ref>` then `supabase db push`.

Applied so far: `0001`, `0002`. **Pending: `0003_events_flags.sql`.** Update this line when you apply one.

## Feature flags

New player-facing features ship off and are checked with `flag('<name>')` (`lib/flags.ts`). The list of flags is in `docs/phase-1/DEFAULTS.md`. A missing row means off. Each server instance caches the table for 30 s, so a change takes up to 30 s to apply.

```sql
-- Turn a flag on
insert into feature_flags (name, enabled, note, updated_at)
values ('solo', true, 'testing slice 3', now())
on conflict (name) do update set enabled = excluded.enabled, note = excluded.note, updated_at = now();

-- Turn it off
update feature_flags set enabled = false, updated_at = now() where name = 'solo';
```

Locally, `FLAGS=solo,daily` in `.env.local` forces flags on without a database.

## Events and errors

- **Events:** `track()` (`lib/analytics.ts`) writes rows to the `events` table after the response is sent. Check them with `select * from events order by at desc limit 20;`.
- **Errors:** Sentry, when `SENTRY_DSN` / `NEXT_PUBLIC_SENTRY_DSN` are set. Server errors from API routes carry `player` and `room` tags. Source maps upload during the Vercel build only if `SENTRY_AUTH_TOKEN`, `SENTRY_ORG` and `SENTRY_PROJECT` are set there (optional).
