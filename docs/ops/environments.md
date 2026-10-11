# Environments

Three environments, one codebase. Background: `Architecture.md`, decision G.

| | Local | Staging | Production |
| --- | --- | --- | --- |
| Store | In-memory (no Supabase vars) | Staging Supabase project | Production Supabase project |
| Telegram bot | None (`DEV_AUTH=1`) | Staging bot | Rug City bot |
| Deploys from | `npm run dev` | Vercel Preview (every branch) | `main` |
| Env vars | `.env.local` | Vercel → Preview | Vercel → Production |
| Feature flags | `FLAGS=a,b` | `feature_flags` table | `feature_flags` table |
| Sentry | Off (no DSN) | On, environment `preview` | On, environment `production` |

Every variable is listed in `.env.example`.

## Region

Put the Vercel functions in the same region as the Supabase database. Every API call makes several database round trips, so a cross-region hop is paid many times per request.

1. Pick the Supabase region when creating the project (it can't be changed later). Use the same region for staging and production.
2. In Vercel → Project → Settings → Functions → Function Region, pick the matching region (e.g. Supabase `eu-central-1` Frankfurt ↔ Vercel `fra1`).

## Local

```bash
cp .env.example .env.local   # DEV_AUTH=1 is all you need
npm run dev
```

- No Supabase vars: the in-memory store. Data is lost on restart.
- `DEV_AUTH=1`: play in a normal browser as fake users (`/?dev=1&name=Ana`). Ignored in production builds.
- `FLAGS=solo,daily` forces those flags on. Every other flag is off.
- Events go to the in-memory store and are dropped on restart.
- To test against a real database locally, point the Supabase vars at the **staging** project, never production.

## Staging

A full copy of production with its own data and bot, so a branch can be played inside Telegram before it merges.

**One-time setup**

1. **Supabase:** create a second project (e.g. `rug-city-staging`) in the production region. Apply every migration (below).
2. **Bot:** create a staging bot in @BotFather and register its Mini App with `/newapp`, pointing at the staging URL.
3. **Vercel → Settings → Environment Variables → Preview:** set the staging values of every variable in `.env.example`: the staging Supabase URL and keys, the staging bot token, username and Mini App short name, `TELEGRAM_WEBHOOK_SECRET`, `ADMIN_TELEGRAM_IDS`, `ANTHROPIC_API_KEY`, `SENTRY_DSN` and `NEXT_PUBLIC_SENTRY_DSN`. Leave `DEV_AUTH` and `FLAGS` unset.
4. **A fixed staging URL:** Preview deploys get a new URL per commit, but a bot needs one URL. Assign a domain to a branch (Vercel → Settings → Domains, e.g. `staging.<domain>` → branch `staging`), or point the Mini App at the branch URL (`<project>-git-<branch>-<team>.vercel.app`) of the branch under test. Set `APP_URL` to it.
5. Register the webhook and commands for the staging bot: put the staging `TELEGRAM_BOT_TOKEN`, `TELEGRAM_WEBHOOK_SECRET` and `APP_URL` in `.env.local` and run `npm run bot:setup`.

**Checking a branch:** push it, wait for the Preview deploy, open the staging bot in Telegram. Turn on the slice's flag in the staging `feature_flags` table.

## Production

- Deploys from `main`. `main` only takes green PRs (CI: typecheck, lint, tests, build).
- Vercel → Environment Variables → Production holds the production values. `DEV_AUTH` and `DEV_MIN_PLAYERS` are ignored there anyway.
- Migrations and flags go to staging first, then production.

## Migrations

Files in `supabase/migrations/`, numbered `000N_<name>.sql`, applied in order, never edited after merge. Each is written to be safe to run twice (`create … if not exists`).

Apply to **staging first**, check the branch there, then apply to production after the PR merges. Either:

- **SQL editor:** Supabase dashboard → SQL Editor → paste the file → Run.
- **Supabase CLI:** `supabase link --project-ref <ref>` then `supabase db push`.

## Feature flags

New player-facing features ship off and are checked with `flag('<name>')` (`lib/flags.ts`). The list of flags is in `docs/phase-1/DEFAULTS.md`. A missing row means off. Each server instance caches the table for 30 s, so a change takes up to 30 s to apply.

```sql
-- Turn a flag on (staging first)
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
