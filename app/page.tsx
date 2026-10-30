import { Suspense } from "react";
import { auth, signOut } from "@/auth";

// Placeholder until the report view lands (step 5): confirms the session works.
export default function Home() {
  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-12">
      <p className="font-mono text-xs uppercase tracking-[0.2em] text-muted">pulse</p>
      <Suspense fallback={<div className="mt-2 h-8 w-64 animate-pulse rounded bg-surface" />}>
        <SignedInAs />
      </Suspense>
      <form
        className="mt-8"
        action={async () => {
          "use server";
          await signOut({ redirectTo: "/signin" });
        }}
      >
        <button type="submit" className="text-sm text-muted underline-offset-4 hover:underline">
          Sign out
        </button>
      </form>
    </main>
  );
}

async function SignedInAs() {
  const session = await auth();
  return (
    <h1 className="mt-2 text-2xl font-semibold tracking-tight">
      Signed in as <span className="font-mono">{session?.user.login}</span>
    </h1>
  );
}
