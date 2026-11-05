# Multi-user rollout: what Semere needs to do

This PR opens Pulse to any developer. Anyone can sign in with GitHub, and Pulse reads their activity with their own sign-in token. Each user has their own repos, settings and reports, and adds their own AI key. Your existing data moves to the `semere-wazza` account.

**Merging deploys to production.** The deployed app expects the new database schema, so do steps 1–4 before you merge. The site is down from step 3 until the deploy in step 5 finishes, which takes a few minutes.

Tested locally on a copy of the schema with production-shaped data: the migration, sign-in, repo sync, AI summaries (Gemini), the cron, and a database test that checks two users can't read or change each other's data.

## Before you start

You need:
- The production **direct** (non-pooled) `DATABASE_URL` from Neon. Copy the connection string and remove `-pooler` from the host if it's there.
- Your current `GITHUB_PAT` (from Vercel env or your password manager).
- `psql` / `pg_dump` (Homebrew `libpq`) and this branch checked out with `pnpm install` done.

To keep secrets out of your shell history, enter them with `read -rs`:

```bash
read -rs PROD_URL      # paste the production direct DATABASE_URL, press Enter
read -rs GITHUB_PAT    # paste your current PAT, press Enter
```

## 1. Back up the production database

```bash
pg_dump "$PROD_URL" --no-owner --no-privileges --format=custom -f pulse-backup-$(date +%F).dump
```

Keep the file until everything works (see Rollback).

## 2. Add `ENCRYPTION_KEY` to Vercel

It encrypts users' GitHub tokens and AI keys in the database.

```bash
openssl rand -base64 32
```

Vercel → project `pulse` → Settings → Environment Variables → add `ENCRYPTION_KEY` with that value, for **Production** (and Preview if you use previews). Then keep it in your shell for step 4:

```bash
read -rs ENCRYPTION_KEY   # paste the same value
```

Never change this value later. Every stored token and key would become unreadable, so every user would have to sign in again and re-enter their AI keys.

## 3. Run the migration

```bash
DATABASE_URL="$PROD_URL" pnpm db:migrate
```

This adds the `users` and `ai_keys` tables, creates your `semere-wazza` user, and assigns every existing row (settings, repos, cached data, reports) to it.

Check:

```bash
psql "$PROD_URL" -c "select id, login from users" -c "select user_id, timezone, report_day from settings"
```

You should see one user, `semere-wazza`, and your settings row with `Africa/Addis_Ababa` and report day `5`.

## 4. Copy your PAT into your account

From now on Pulse reads GitHub with your sign-in token. Copying your current PAT keeps the OmniFleet repos visible even if the OmniFleet org hasn't approved the Pulse OAuth app.

```bash
ENC=$(ENCRYPTION_KEY="$ENCRYPTION_KEY" GITHUB_PAT="$GITHUB_PAT" node --no-warnings --input-type=module \
  -e 'const { encrypt } = await import("./lib/crypto.ts"); process.stdout.write(encrypt(process.env.GITHUB_PAT))')
psql "$PROD_URL" -c "update users set pat = '$ENC' where login = 'semere-wazza'"
```

You should see `UPDATE 1`. You can remove the PAT later in Settings → GitHub.

## 5. Merge the PR

Vercel deploys `main` automatically. Wait until the deploy is ready.

## 6. Sign in and finish setup

1. Open pulse.semere.app. Your old session is no longer valid, so sign in again **as `semere-wazza`**. GitHub asks you to approve repo access; accept.
2. Check that Overview and Reports show your past weeks.
3. Settings → AI summary: pick Groq and paste your Groq key. AI keys no longer come from env vars.
4. Settings → GitHub should say "Personal access token".

## 7. Clean up Vercel env vars

Once everything works, delete these, since nothing reads them anymore: `GITHUB_PAT`, `ALLOWED_USERS`, `REPORT_NAME`, `GITHUB_MODELS_TOKEN`, and every `*_API_KEY` (Groq, Gemini, OpenRouter, Mistral, Cerebras, DeepSeek, OpenAI, Anthropic).

## Good to know

- **Anyone can sign in now.** There is no allowlist. Each user only ever sees their own data.
- **Company repos:** orgs that restrict third-party apps must approve the Pulse OAuth app before members' sign-in tokens can see org repos. Until then, a user can add a PAT under Settings → GitHub; it must belong to the account they signed in with.
- **`SemereT627`** signing in creates a separate user with its own reports. To count its commits in `semere-wazza`'s reports, add it under Settings → What counts, as before.
- **Cron** still runs daily at 12:00 UTC and generates last week's report for every user whose report day it is. To regenerate a week by hand, the URL now needs the user: `?week=YYYY-MM-DD&user=<login>`.
- **Preview deployments** of this PR use the old schema if they point at the production database, so they will error until the migration has run. They don't change anything.

## Rollback

If something goes wrong after step 3:

1. Revert the merge on `main` (or don't merge yet).
2. Restore the backup:

```bash
pg_restore --clean --if-exists --no-owner --no-privileges -d "$PROD_URL" pulse-backup-YYYY-MM-DD.dump
psql "$PROD_URL" -c "drop table if exists ai_keys, users cascade"
```
