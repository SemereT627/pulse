import Link from "next/link";
import { signOut } from "@/auth";

export function Nav() {
  return (
    <header className="mx-auto flex w-full max-w-4xl items-center justify-between px-4 py-6">
      <Link href="/" className="font-mono text-xs uppercase tracking-[0.2em] text-muted hover:text-foreground">
        pulse
      </Link>
      <nav className="flex items-center gap-5 text-sm text-muted">
        <Link href="/" className="hover:text-foreground">
          Report
        </Link>
        <Link href="/sources" className="hover:text-foreground">
          Sources
        </Link>
        <form
          action={async () => {
            "use server";
            await signOut({ redirectTo: "/signin" });
          }}
        >
          <button type="submit" className="hover:text-foreground">
            Sign out
          </button>
        </form>
      </nav>
    </header>
  );
}
