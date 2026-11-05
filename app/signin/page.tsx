import { Suspense } from "react";
import { signIn } from "@/auth";
import { Logo } from "@/components/logo";

export default function SignInPage({ searchParams }: PageProps<"/signin">) {
  return (
    <main className="flex flex-1 items-center justify-center px-4">
      <div className="w-full max-w-sm space-y-8">
        <div className="space-y-2">
          <Logo className="[&_svg]:size-9 [&>span]:text-3xl" />
          <h1 className="pt-4 font-display text-2xl font-semibold tracking-tight">Weekly GitHub report</h1>
          <p className="text-sm text-muted">Your commits, PRs and reviews each week, and an update for your manager.</p>
        </div>

        <Suspense>
          <SignInError searchParams={searchParams} />
        </Suspense>

        <form
          action={async () => {
            "use server";
            await signIn("github", { redirectTo: "/" });
          }}
        >
          <button
            type="submit"
            className="w-full rounded-lg bg-accent px-4 py-2.5 text-sm font-medium text-accent-foreground transition-opacity hover:opacity-90"
          >
            Sign in with GitHub
          </button>
        </form>

        <p className="text-xs text-muted">
          Pulse asks GitHub for read access to your repos to count your work. Company repos may need your
          organization to approve Pulse, or a personal access token in Settings.
        </p>
      </div>
    </main>
  );
}

async function SignInError({ searchParams }: Pick<PageProps<"/signin">, "searchParams">) {
  const { error } = await searchParams;
  if (!error) return null;

  return (
    <p className="rounded-md border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger">
      {error === "AccessDenied" ? "GitHub sign-in was cancelled." : "Sign-in failed. Try again."}
    </p>
  );
}
