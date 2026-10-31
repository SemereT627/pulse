@AGENTS.md

# Pulse

Personal weekly GitHub report for Semere (reports on GitHub login `semere-wazza`; the repo lives at `SemereT627/pulse`), deployed on Vercel at pulse.semere.app. It reports only on Semere's own activity (not team stats), and its main output is a first-person weekly update for their manager. It replaces the CLI script in `~/Documents/dev/work/omnifleet/weekly-report/weekly-report.py`.

## Decisions (agreed, don't relitigate)

- Single user. GitHub OAuth is only a sign-in gate (`ALLOWED_USERS`); all GitHub data comes from one classic PAT (`GITHUB_PAT`, scopes `repo`, `read:org`, `read:user`), in the UI and in cron. No OAuth token is stored.
- Week = Fri 00:00 → Thu 23:59 in `Africa/Addis_Ababa` (settings row: `timezone`, `weekStartDay` = 5). Read-only in the UI.
- Cron runs daily 12:00 UTC (15:00 Addis) and acts only on `settings.reportDay` (default Friday), reporting the last finished week. It keeps an existing narrative (the user may have written one by hand).
- Commits count on the default branch plus per-repo extra branches (default `dev`), deduped by sha; merge commits are dropped. OmniFleet work lands on `dev`, so this matters.
- PRs are searched by `updated:` (not `created:`) so PRs opened earlier but merged this week count.
- AI narrative: provider picked in Settings (`settings.aiProvider`): Anthropic (`@anthropic-ai/sdk`, default `claude-opus-5-5`, effort `medium`, `fallbacks: "default"`), or OpenAI / Gemini / GitHub Models / Groq / OpenRouter / Mistral / Cerebras / DeepSeek through one OpenAI-compatible fetch client (`lib/ai/providers.ts`; adding one = a table entry plus the enum in `db/schema.ts`, no migration since the column is plain text). Keys only in env (`<PROVIDER>_API_KEY`; GitHub Models uses `GITHUB_MODELS_TOKEN` falling back to `GITHUB_PAT`), never in the DB. Busy responses (429/5xx) retry twice. Ready = `settings.aiEnabled` + key for the chosen provider (`aiReady`). `AI_ENABLED` env is no longer used. Tone, length, extra instructions and "use last week" are settings.
- Settings also cover what counts (drop dev→default "promotion" PRs, extra commit-author logins, default extra branches for new repos), report author + Markdown sections, report day. Theme is per device (localStorage `pulse-theme`, applied by an inline script in `app/layout.tsx`).
- Neon Postgres in Frankfurt (pooled URL); Vercel functions pinned to `fra1` in `vercel.json`.

## Stack and layout

Next.js 16 (App Router, **Cache Components on**, `proxy.ts` instead of middleware), Tailwind v4, Framer Motion, Auth.js v5 beta, Drizzle + `@neondatabase/serverless`, `@octokit/graphql`, Vitest. pnpm.

- `auth.ts`, `proxy.ts`: sign-in gate; everything except `/api/auth`, `/api/cron`, `/signin` requires a session. Server actions re-check with `requireUser()` (`lib/session.ts`).
- `db/schema.ts`: `settings` and `rate_limit` (single row, id 1), `sources` (repos + `included` + `extraBranches`), `snapshots` (raw GitHub data per week; key `repo:<id>` or `user`), `reports` (one row per week: stats, markdown, narrative).
- `lib/github/`: `client.ts` (`gh()` wrapper records rate limit after each call), `repos.ts` (repo discovery/sync), `activity.ts` (batched commit/release queries, PR/issue search, reviews via contributionsCollection).
- `lib/report/`: pure `week.ts`, `aggregate.ts`, `markdown.ts` (unit-tested); `load.ts` (snapshot cache: in-progress week refetches after 15 min, branch-config change refetches that repo); `generate.ts` (writes `reports` rows).
- `lib/report/collaborators.ts`: pure; people from my PRs' reviewers + authors of PRs I reviewed (Contributors page). `UserSnapshot.v` (`USER_SNAPSHOT_VERSION`) forces a refetch of cached user snapshots when fields are added.
- Summaries are editable on Reports (`saveSummaryAction`); hand edits mark `narrativeModel` with " · edited" or "Written by you" (`lib/report/edited.ts`), and Rewrite asks before replacing them. The cron never overwrites an existing summary.
- `lib/report/selected.ts`: `selectedWeek(searchParams)` resolves `?week=YYYY-MM-DD` (snapped, future → current); every week-scoped page uses it.
- `lib/ai/summary.ts`: pure prompt builders (tested); `narrative.ts`: calls the provider; `providers.ts`: provider table, `complete()`, `listModels()` (Settings "Test" button).
- UI: dashboard shell in `app/(app)/layout.tsx` + `components/shell/` (sidebar, top bar with week picker and user menu, mobile drawer). Sections: `/` Overview, `/reports` (report + archive), `/repositories` (activity) and `/repositories/manage` (tracked repos), `/contributors`, `/settings` (cron/AI toggles, connection status). Selected week lives in `?week=`; sidebar links carry it. Old `/week/:week` and `/sources` redirect in `next.config.ts`.
- Brand (from the logo canvas https://claude.ai/artifact/Xvn25eiwCSsVJHjH9P9XSR): 7-bar mark (`components/logo.tsx`), 3-bar favicon (`app/icon.svg`), ink `#0E100F` + lime `#C6F36B` (light: `#F6F7F3` + `#3B7D10`), Space Grotesk display, JetBrains Mono data.
- `app/api/cron/weekly/route.ts`: `Authorization: Bearer $CRON_SECRET`; `?week=YYYY-MM-DD` regenerates a given week.

## Conventions and gotchas

- With Cache Components, anything reading the session, `params`, `searchParams`, or the DB must sit inside `<Suspense>`; otherwise the build fails.
- Read `node_modules/next/dist/docs/` before using Next APIs; this Next version differs from older training data.
- `auth()` uses crypto, so call `await connection()` before it in server components, or prerendering errors.
- Lint flags `Date.now()` during render; read `new Date()` once instead.
- `.env.local` holds secrets and contains an unquoted URL with `&`, so don't `source` it in a shell; load it with dotenv.
- `.smoke/` (gitignored, lint-ignored) holds local smoke scripts: `vitest run -c .smoke/vitest.config.mts` runs fetchers against real GitHub/Neon with `server-only` stubbed.
- Repo moved 2026-10-31 from `semere-wazza/pulse` (deleted) to `SemereT627/pulse`; `origin` is SSH (`git@github.com:SemereT627/pulse.git`), which logs in as SemereT627. The data PAT still belongs to `semere-wazza`, so reports are unaffected.
- Commit and push to `main` after a change is verified, with the Claude co-author line.

## Commands

`pnpm dev` · `pnpm test` · `pnpm lint` · `pnpm build` · `pnpm db:generate` / `pnpm db:migrate` (reads `.env.local`)

## Status (2026-10-30)

Done and pushed: sign-in, sources page, fetching + cache, aggregation, multi-section dashboard (sidebar, Overview/Reports/Repositories/Contributors/Settings), Markdown export, cron, multi-provider AI summary, configurable settings. 26 tests.

Next:
- AI provider is Groq (`openai/gpt-oss-120b`, ~3s per summary; verified live 2026-10-31 on last week's data). Also keyed (local + Vercel), checked 2026-10-31: Gemini works (`gemini-3.8-flash` often 503s under load), OpenRouter works; Anthropic, OpenAI and DeepSeek keys are valid but those accounts have no credit; GitHub Models untested (intercepted on the dev network). Keys in `.env.local` and Vercel. The dev machine is often on a flaky phone hotspot (GitHub/Neon timeouts, `models.github.ai` intercepted), so prefer testing on production. Smoke: `SMOKE_PROVIDER=groq pnpm vitest run -c .smoke/vitest.config.mts .smoke/ai.test.ts`.
- Deployed (2026-10-31) to Vercel project `pulse` (scope `semere-talegngetas-projects`, Hobby), https://pulse-pied-theta.vercel.app. Cron `0 12 * * *` registered. Git-connected to `SemereT627/pulse`: pushes to `main` deploy to production automatically.
- `pulse.semere.app` added to the project; DNS is on Cloudflare (record via Vercel's Domain Connect link, or CNAME like the other subdomains). Then `vercel domains verify pulse.semere.app`.
- One GitHub OAuth app serves local and production (it has both redirect URIs); its credentials are in Vercel.
- `GITHUB_PAT` renewed; expires 2027-10-30.
- Email (Resend) is paused by choice: the user copies the summary/Markdown from Reports. Don't build it unless asked.
- To count `SemereT627` commits, add it under Settings → What counts.
