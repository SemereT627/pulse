import { Suspense } from "react";
import { signIn } from "@/auth";

export default function SignInPage({ searchParams }: PageProps<"/signin">) {
  return (
    <main className="flex flex-1 items-center justify-center px-4">
      <div className="w-full max-w-sm space-y-8">
        <div className="space-y-2">
          <p className="font-mono text-xs uppercase tracking-[0.2em] text-muted">pulse</p>
          <h1 className="text-2xl font-semibold tracking-tight">Weekly GitHub report</h1>
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
            className="w-full rounded-md bg-foreground px-4 py-2.5 text-sm font-medium text-background transition-opacity hover:opacity-90"
          >
            Sign in with GitHub
          </button>
        </form>
      </div>
    </main>
  );
}

async function SignInError({ searchParams }: Pick<PageProps<"/signin">, "searchParams">) {
  const { error } = await searchParams;
  if (!error) return null;

  return (
    <p className="rounded-md border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger">
      {error === "AccessDenied" ? "This GitHub account isn't on the allowlist." : "Sign-in failed. Try again."}
    </p>
  );
}
