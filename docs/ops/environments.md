# Environments

One codebase, one Supabase project. Background (archived): `docs/archive/Architecture.md`, decision G.

While there are no real players, preview deploys and production share the **same Supabase project**. A second (staging) project is added only once real players are in and a risky change needs a safe place to test.

| | Local | Preview | Production |
| --- | --- | --- | --- |
| Store | In-memory (no Supabase vars) | The Supabase project | The Supabase project |
| Telegram bot | None (`DEV_AUTH=1`) | `@WhoRuggedBot`'s second Mini App, `t.me/WhoRuggedBot/preview` | `@WhoRuggedBot`, `t.me/WhoRuggedBot/Play` |
| Deploys from | `npm run dev` | Vercel Preview (every branch) | `main` |
| Env vars | `.env.local` | Vercel → Preview | Vercel → Production |
| Feature flags | `FLAGS=a,b` | `feature_flags` table (shared) | `feature_flags` table (shared) |
| Sentry | Off (no DSN) | On, environment `preview` | On, environment `production` |

Every variable is listed in `.env.example`.

## Rules for sharing one database

- **Migrations only add.** New tables, new nullable or defaulted columns, new indexes, new functions. Never drop, rename or change the meaning of anything the code on `main` still uses. A removal waits until the code that used it has been on `main` for one release, then ships as its own migration.
- **Flags are shared.** Turning a flag on affects previews and production together. While there are no real players that's fine; afterwards, test with `FLAGS` locally first.
- **Back up before data scripts.** Before a backfill or any script that rewrites rows, take a backup (Supabase → Database → Backups, or export the tables).
- **Wipe test data at launch.** Before the first public launch, clear test players, rooms, results, runs and events.

## Region

Put the Vercel functions in the same region as the Supabase database. Every API call makes several database round trips, so a cross-region hop is paid many times per request. In Vercel → Project → Settings → Functions → Function Region, pick the region matching Supabase (e.g. Supabase `eu-central-1` Frankfurt ↔ Vercel `fra1`).

## Local

```bash
cp .env.example .env.local   # DEV_AUTH=1 is all you need
npm run dev
```

- No Supabase vars: the in-memory store. Data is lost on restart.
- `DEV_AUTH=1`: play in a normal browser as fake users (`/?dev=1&name=Ana`). Ignored in production builds.
- `FLAGS=refund_prototype` forces that flag on. Every other flag is off.
- With the Supabase vars set, local dev uses the shared project. That's fine for now; keep `DEV_AUTH` test users on ids that can't be real Telegram ids (e.g. 1–999).

## Preview

Every pushed branch gets a Preview deploy on the shared database.

**How previews open in Telegram**

The production bot has two Mini Apps. `Play` opens production; `preview` opens the fixed address `who-rugged-preview.vercel.app`, which `npm run preview:point` moves to whichever branch is under test. It's the same bot, so its token validates Telegram logins on previews too.

- **Vercel → Environment Variables → Preview** (set 2026-10-11): `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `ANTHROPIC_API_KEY`, `ADMIN_TELEGRAM_IDS`, `TELEGRAM_BOT_TOKEN` and `NEXT_PUBLIC_BOT_USERNAME` (same values as Production), and `NEXT_PUBLIC_APP_SHORT_NAME=preview` so invite links made in a preview open the preview. Leave `DEV_AUTH` and `FLAGS` unset. Preview has no `APP_URL` or webhook secret: the bot's webhook stays on production.
- **Deployment Protection is off** (Vercel → Settings → Deployment Protection, turned off 2026-10-11). Telegram Web and Desktop run Mini Apps in an iframe, where the browser drops Vercel's protection cookie, so a protected preview never gets past "Opening case files…". The game's own auth still guards every API call (signed Telegram init data; `DEV_AUTH` is ignored on deployed builds).
- **@BotFather** → `/newapp` on `@WhoRuggedBot`, short name `preview`, URL `https://who-rugged-preview.vercel.app/` (created 2026-10-11; its URL still carries an old `x-vercel-protection-bypass` query, which is now harmless). It never needs changing.

**Checking a branch:**
1. Apply its new migration (below) and push the branch.
2. When Vercel's Preview deploy is ready: `npm run preview:point -- <branch>` (defaults to the current branch).
3. Turn on the feature's flag in `feature_flags`.
4. Open `t.me/WhoRuggedBot/preview` in Telegram and play it.

**Careful:** previews run as the real bot on the shared database, so anything a preview writes is real data.

## Production

- Deploys from `main`. `main` only takes green PRs (CI: typecheck, lint, tests, build).
- Vercel → Environment Variables → Production holds the production values. `DEV_AUTH` and `DEV_MIN_PLAYERS` are ignored there anyway.

## Migrations

Files in `supabase/migrations/`, numbered `000N_<name>.sql`, applied in order, never edited after merge. Each is written to be safe to run twice (`create … if not exists`) and, under the rules above, only adds.

Apply a branch's migration when you start testing it (it only adds, so the code on `main` keeps working). Either:

- **SQL editor:** Supabase dashboard → SQL Editor → paste the file → Run.
- **Supabase CLI:** `supabase link --project-ref <ref>` then `supabase db push`.

Applied so far: `0001`–`0010` (checked 2026-10-12). `0010_drop_crew_game` removed the crew game's tables and old `players` columns; the database now holds only what the code uses: `players`, `events`, `feature_flags` and `investigation_runs`. Update this line when you apply one.

## Feature flags

New player-facing features ship off and are checked with `flag('<name>')` (`lib/flags.ts`). The list of flags is the `FlagName` type in `lib/flags.ts`. A missing row means off. Each server instance caches the table for 30 s, so a change takes up to 30 s to apply.

```sql
-- Turn a flag on
insert into feature_flags (name, enabled, note, updated_at)
values ('refund_prototype', true, 'testing The Refund', now())
on conflict (name) do update set enabled = excluded.enabled, note = excluded.note, updated_at = now();

-- Turn it off
update feature_flags set enabled = false, updated_at = now() where name = 'refund_prototype';
```

Locally, `FLAGS=refund_prototype` in `.env.local` forces flags on without a database.

## Events and errors

- **Events:** `track()` (`lib/analytics.ts`) writes rows to the `events` table after the response is sent. Check them with `select * from events order by at desc limit 20;`.
- **Errors:** Sentry, when `SENTRY_DSN` / `NEXT_PUBLIC_SENTRY_DSN` are set. Server errors from API routes carry `player` and `room` tags. Source maps upload during the Vercel build only if `SENTRY_AUTH_TOKEN`, `SENTRY_ORG` and `SENTRY_PROJECT` are set there (optional).
