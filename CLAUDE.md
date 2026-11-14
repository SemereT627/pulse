@AGENTS.md

# Pulse

Weekly GitHub report for any developer: sign in with GitHub, get your own commits/PRs/reviews per week and a first-person update for your manager. Built by Semere (repo `SemereT627/pulse`, Semere's account in the app is `semere-wazza`), deployed on Vercel at pulse.semere.app. Each user sees only their own activity (no team stats). It replaced the CLI script in `~/Documents/dev/work/omnifleet/weekly-report/weekly-report.py`. Design: `docs/superpowers/specs/2026-11-05-multi-user-design.md` (gitignored, local only).

## Decisions (agreed, don't relitigate)

- Multi-user (since 2026-11-05), open sign-up. Sign-in and data access go through the GitHub App "Pulse Weekly" (since 2026-11-15; org `pulse-weekly`, app id 5762616, client `Iv23liCz2StJMzSKcnag`): read-only Contents, Metadata, Pull requests, Issues; user tokens don't expire; it only sees repos where it's installed (`GITHUB_APP_INSTALL_URL` in `lib/github/app.ts`; its Setup URL is `/repositories/manage`, which syncs on `?setup_action=`). The old OAuth app ("Pulse", `repo` scope) was retired 2026-11-15. The sign-in token is stored encrypted in `users.oauth_token`. Optional per-user PAT (`users.pat`, Settings → GitHub) overrides it; it must belong to the signed-in account (checked by GitHub user id). A 401 sets `users.token_invalid` (banner; cron skips). Users can delete their account (cascade).
- Every data table has `user_id` (FK, on delete cascade); every query and server action filters by the session user (`currentUser()` in pages, `requireUser()` in actions, both return the `users` row). Never trust an id from the client without `userId` in the `where`.
- Secrets at rest: AES-256-GCM, `lib/crypto.ts`, key `ENCRYPTION_KEY` (env, 32 bytes base64; same value local and Vercel; changing it breaks every stored token/key). The UI shows only `•••• last4`.
- Week = 7 days from `settings.weekStartDay` 00:00 in `settings.timezone`; both editable per user (new users: UTC, Monday). Semere's row: Africa/Addis_Ababa, Friday.
- Cron runs daily 12:00 UTC and, for each user with a usable token, cron on and tracked repos, acts on their `reportDay`, reporting the last finished week. The 12:00 run fans out: it calls itself with `?user=<login>` (10 at a time, via `VERCEL_PROJECT_PRODUCTION_URL` since `*.vercel.app` is behind Deployment Protection), so each user gets their own 300s run. It keeps an existing narrative. `?user=<login>` runs one user's scheduled check; `?week=YYYY-MM-DD&user=<login>` regenerates one user's week.
- Commits count on the default branch plus per-repo extra branches (Semere's repos use `dev`; new users default to none), deduped by sha; merge commits are dropped. OmniFleet work lands on `dev`, so this matters.
- PRs are searched by `updated:` (not `created:`) so PRs opened earlier but merged this week count.
- AI narrative: each user brings their own key (Settings → AI summary; table `ai_keys`, encrypted; no env keys). Provider picked in Settings (`settings.aiProvider`): Anthropic (`@anthropic-ai/sdk`, default `claude-opus-5-5`, effort `medium`, `fallbacks: "default"`), or OpenAI / Gemini / GitHub Models / Groq / OpenRouter / Mistral / Cerebras / DeepSeek through one OpenAI-compatible fetch client (`lib/ai/providers.ts`; adding one = a table entry plus the enum in `db/schema.ts`, no migration since the column is plain text). Busy responses (429/5xx) retry twice. Ready = `settings.aiEnabled` + the user's key for the chosen provider (`aiReady(settings, keys)`). Tone, length, extra instructions and "use last week" are settings.
- Settings also cover what counts (drop dev→default "promotion" PRs, extra commit-author logins, default extra branches for new repos), report author (default: GitHub profile name) + Markdown sections, report day, timezone and week start. Theme is per device (localStorage `pulse-theme`, applied by an inline script in `app/layout.tsx`).
- Neon Postgres in Frankfurt (pooled URL); Vercel functions pinned to `fra1` in `vercel.json`.

## Stack and layout

Next.js 16 (App Router, **Cache Components on**, `proxy.ts` instead of middleware), Tailwind v4, Framer Motion, Auth.js v5 beta, Drizzle + `@neondatabase/serverless`, `@octokit/graphql`, Vitest. pnpm.

- `auth.ts`, `proxy.ts`: sign-in gate; everything except `/api/auth`, `/api/cron`, `/signin`, `/privacy` requires a session. `/privacy` describes what's stored and shared; keep it in step with `auth.ts` scopes and `db/schema.ts`. Server actions re-check with `requireUser()` (`lib/session.ts`).
- `db/schema.ts`: `users` (GitHub id, encrypted tokens), `ai_keys` (per user + provider), `settings` and `rate_limit` (one row per user), `sources` (repos per user + `included` + `extraBranches`), `snapshots` (raw GitHub data per user and week; key `repo:<id>` or `user`), `reports` (one row per user and week).
- `lib/github/`: `client.ts` (`gh(user, query, vars)` uses the user's token, records their rate limit, flags 401s), `repos.ts` (repo discovery/sync), `activity.ts` (batched commit/release queries, PR/issue search, reviews via contributionsCollection).
- `lib/report/`: pure `week.ts`, `aggregate.ts`, `markdown.ts` (unit-tested); `load.ts` (snapshot cache: in-progress week refetches after 15 min, branch-config change refetches that repo); `generate.ts` (writes `reports` rows).
- `lib/report/collaborators.ts`: pure; people from my PRs' reviewers + authors of PRs I reviewed (Contributors page). `UserSnapshot.v` (`USER_SNAPSHOT_VERSION`) forces a refetch of cached user snapshots when fields are added.
- Summaries are editable on Reports (`saveSummaryAction`); hand edits mark `narrativeModel` with " · edited" or "Written by you" (`lib/report/edited.ts`), and Rewrite asks before replacing them. The cron never overwrites an existing summary.
- Period summaries (`/reports/periods`, Reports → Summaries): month/quarter/year totals summed from saved `reports` rows, and an on-demand AI summary (`writePeriodSummaryAction`, prompts in `lib/ai/summary.ts`, periods in `lib/report/periods.ts`). Not stored; the user edits and copies it. A week counts toward the period it starts in.
- `lib/report/selected.ts`: `selectedWeek(searchParams)` resolves `?week=YYYY-MM-DD` (snapped, future → current); every week-scoped page uses it.
- `lib/ai/summary.ts`: pure prompt builders (tested); `narrative.ts`: calls the provider; `providers.ts`: provider table, `complete()`, `listModels()` (Settings "Test" button).
- UI: dashboard shell in `app/(app)/layout.tsx` + `components/shell/` (sidebar, top bar with week picker and user menu, mobile drawer). Sections: `/` Overview, `/reports` (report + archive), `/repositories` (activity) and `/repositories/manage` (tracked repos), `/contributors`, `/settings` (cron/AI toggles, connection status). Selected week lives in `?week=`; sidebar links carry it. Old `/week/:week` and `/sources` redirect in `next.config.ts`.
- Brand (from the logo canvas https://claude.ai/artifact/Xvn25eiwCSsVJHjH9P9XSR): 7-bar mark (`components/logo.tsx`), 3-bar favicon (`app/icon.svg`), ink `#0E100F` + lime `#C6F36B` (light: `#F6F7F3` + `#3B7D10`), Space Grotesk display, JetBrains Mono data.
- `app/api/cron/weekly/route.ts`: `Authorization: Bearer $CRON_SECRET`; `?week=YYYY-MM-DD&user=<login>` regenerates one user's week.

## Conventions and gotchas

- With Cache Components, anything reading the session, `params`, `searchParams`, or the DB must sit inside `<Suspense>`; otherwise the build fails.
- Read `node_modules/next/dist/docs/` before using Next APIs; this Next version differs from older training data.
- `auth()` uses crypto, so call `await connection()` before it in server components, or prerendering errors.
- Lint flags `Date.now()` during render; read `new Date()` once instead.
- `.env.local` holds secrets and contains an unquoted URL with `&`, so don't `source` it in a shell; load it with dotenv.
- `.smoke/` (gitignored, lint-ignored) holds local smoke scripts: `vitest run -c .smoke/vitest.config.mts` runs fetchers against real GitHub/Neon with `server-only` stubbed.
- Repo moved 2026-10-31 from `semere-wazza/pulse` (deleted) to `SemereT627/pulse`; `origin` is SSH (`git@github.com:SemereT627/pulse.git`), which logs in as SemereT627. The data PAT still belongs to `semere-wazza`, so reports are unaffected.
- Commit and push to `main` after a change is verified. Commit messages: one line only, no description, no trailer (no co-author line).

## Commands

`pnpm dev` · `pnpm test` · `pnpm lint` · `pnpm build` · `pnpm db:generate` / `pnpm db:migrate` (reads `.env.local`)

## Status (2026-11-14)

Live at https://pulse.semere.app (Vercel project `pulse`, scope `semere-talegngetas-projects`, Hobby; DNS on Cloudflare). Pushes to `main` on `SemereT627/pulse` deploy production. 4 users as of 2026-11-14. Done: multi-user with per-user tokens, settings and AI keys; dashboard sections; editable summaries; Markdown export; per-user cron fan-out (verified on production 2026-11-14); privacy page.

Ops notes:
- Production env vars: `AUTH_SECRET`, `AUTH_GITHUB_ID`, `AUTH_GITHUB_SECRET`, `DATABASE_URL`, `CRON_SECRET`, `ENCRYPTION_KEY`. Nothing else is read.
- The GitHub App "Pulse Weekly" (org `pulse-weekly`, owner SemereT627) serves local and production with both callback URLs. The old OAuth app "Pulse" was deleted 2026-11-15; users who signed in with it must sign in again.
- Semere's AI provider is Groq (`openai/gpt-oss-120b`, ~3s per summary), key saved in their Settings; Gemini also saved. Earlier keys leaked in chat on 2026-10-31; Groq rotated 2026-11-12, the rest (Gemini, OpenRouter, OpenAI, Anthropic, DeepSeek, GitHub Models token) still to rotate on the providers' sites.
- `GITHUB_PAT` in `.env.local` is semere-wazza's PAT (expires 2027-10-30); the app uses the encrypted copy in `users.pat`.
- Vercel Hobby keeps runtime logs for 1 hour, so check cron results by calling it (`Authorization: Bearer $CRON_SECRET`), not by reading old logs.
- Locally, `next start` (production build) needs `AUTH_TRUST_HOST=true`, or Auth.js rejects every session (UntrustedHost); `next dev` and Vercel trust the host already.
- The dev machine is often on a flaky phone hotspot (GitHub/Neon timeouts, `models.github.ai` intercepted); prefer testing on production.
- `.smoke/` scripts predate multi-user (they assume env AI keys and a single user) and need updating before use.
- Email (Resend) is paused by choice: the user copies the summary/Markdown from Reports. Don't build it unless asked.

Shipped 2026-11-14/15: period summaries, read-only GitHub App sign-in. Later: test that two users can't see each other's data (on a Neon branch), snapshot retention, failure alerts, landing page.
