<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Rug City

- **Direction (decided 2026-10-11):** Rug City has pivoted to `Rug City — Game Direction.md`: a story-led detective adventure. Chapter 1, The Refund (solo), is specified in `Rug City — The Refund Brief.md`.
- **Current task:** build The Refund. Start from the kickoff prompt in section 12 of the brief. The Refund is chapter 1 of a five-chapter arc with co-op planned: read the Game Direction too (sections 1, 7, 8, 9) so the code leaves room for later chapters without building them now.
- **Code state:** the earlier crew game was removed on 2026-10-11. What remains is the foundation (Telegram auth, store, flags, analytics, noir UI) and a placeholder Home. The Refund goes behind the `refund_prototype` flag. Old screens can be read in git history at commit `930b94d`; don't restore them.
- **Coding rules:** `docs/CONVENTIONS.md`. Environments (one shared Supabase project, preview deploys): `docs/ops/environments.md`.
- **Archive:** `docs/archive/` holds the old concept, Game Design v2, Phase 1 Plan and slice briefs. Use them to understand legacy code, not as requirements.
