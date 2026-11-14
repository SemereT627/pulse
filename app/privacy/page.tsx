import type { Metadata } from "next";
import Link from "next/link";
import { Logo } from "@/components/logo";

export const metadata: Metadata = { title: "Privacy" };

// Public (see proxy.ts). Keep in step with what auth.ts requests and db/schema.ts stores.
export default function PrivacyPage() {
  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-12 sm:py-16">
      <Link href="/" aria-label="Pulse">
        <Logo />
      </Link>
      <h1 className="mt-10 font-display text-3xl font-semibold tracking-[-0.03em]">Privacy</h1>
      <p className="mt-2 text-sm text-muted">What Pulse can see, what it keeps, and how to remove it.</p>

      <div className="mt-10 space-y-8 text-[15px] leading-relaxed [&_h2]:font-display [&_h2]:text-lg [&_h2]:font-semibold [&_li]:mt-1.5 [&_ul]:mt-2 [&_ul]:list-disc [&_ul]:pl-5">
        <section>
          <h2>GitHub access</h2>
          <p className="mt-2">
            Pulse uses the Pulse Weekly GitHub app, which has read-only access to code, pull requests and issues, and only
            in the accounts and organizations where you install it. It looks up your commits, pull requests, reviews and
            issues, and never changes anything. You can remove the app or limit it to some repos at any time in GitHub →
            Settings → Applications. People who signed in before Pulse used this app granted GitHub&apos;s broader{" "}
            <code className="font-mono text-sm">repo</code> scope; signing in again moves them to the read-only app.
          </p>
        </section>

        <section>
          <h2>What Pulse stores</h2>
          <ul>
            <li>Your GitHub id, username, name and avatar.</li>
            <li>Your GitHub sign-in token, and a personal access token if you add one. Both are encrypted (AES-256-GCM).</li>
            <li>AI provider keys you add, encrypted the same way. Only their last four characters are ever shown.</li>
            <li>
              The repos you can see, and for the ones you track, each week&apos;s activity: commit messages, pull request
              titles and descriptions, reviews and issues.
            </li>
            <li>Your weekly reports, summaries and settings.</li>
          </ul>
          <p className="mt-3">
            Data is kept in a Postgres database (Neon, Frankfurt) and the app runs on Vercel, which keeps standard request
            logs. There are no ads and no analytics.
          </p>
        </section>

        <section>
          <h2>Who else sees it</h2>
          <ul>
            <li>GitHub, which Pulse asks for your activity.</li>
            <li>
              The AI provider you pick, and only when a summary is written: Pulse sends that week&apos;s activity with your
              own key.
            </li>
          </ul>
          <p className="mt-3">Nobody else. Other Pulse users can never see your data.</p>
        </section>

        <section>
          <h2>Removing your data</h2>
          <p className="mt-2">
            Settings → Delete account removes everything Pulse stores about you, straight away. To also revoke Pulse&apos;s
            access on GitHub, go to{" "}
            <a
              href="https://github.com/settings/applications"
              className="underline underline-offset-4 hover:text-accent"
              target="_blank"
              rel="noreferrer"
            >
              GitHub → Settings → Applications
            </a>
            .
          </p>
        </section>

        <section>
          <h2>Questions</h2>
          <p className="mt-2">
            Open an issue on{" "}
            <a
              href="https://github.com/SemereT627/pulse/issues"
              className="underline underline-offset-4 hover:text-accent"
              target="_blank"
              rel="noreferrer"
            >
              github.com/SemereT627/pulse
            </a>
            .
          </p>
        </section>
      </div>
    </main>
  );
}
