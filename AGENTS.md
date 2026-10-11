<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Rug City

- **Direction (decided 2026-10-11):** Rug City has pivoted to `Rug City — Game Direction.md`: a story-led detective adventure. Chapter 1, The Refund (solo), is specified in `Rug City — The Refund Brief.md`.
- **Current task:** test The Refund. It was merged on 2026-10-12 (PR #14). The phone-layout check at 390 px is done and Endrit checked it inside Telegram (PR #17, 2026-10-12). Next: run observed solo playtests (brief section 11). Revise the case's evidence, clarity and interactions from what players do before adding features. Don't start chapter 2, co-op or a campaign system until Endrit asks.
- **Code state:** The Refund is built on the foundation (Telegram auth, store, flags, analytics, noir UI) behind the `refund_prototype` flag, which is currently **on** in the shared table, so it shows in production too. `docs/architecture.md` describes it and where later chapters, campaign progress and co-op plug in; its section 8 records the decisions made beyond the brief. Case content lives in `lib/investigation/cases/refund.ts`: authored, keep it exact, and add a new version instead of editing one that runs use. The earlier crew game was removed on 2026-10-11; old screens are in git history at commit `930b94d`, don't restore them.
- **Coding rules:** `docs/CONVENTIONS.md`. Environments (one shared Supabase project, preview deploys): `docs/ops/environments.md`.
- **Archive:** `docs/archive/` holds the old concept, Game Design v2, Phase 1 Plan and slice briefs. Use them to understand legacy code, not as requirements.
