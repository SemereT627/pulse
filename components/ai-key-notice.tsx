import Link from "next/link";

/** Shown wherever a summary could be written but the user hasn't given Pulse an AI key. */
export function AiKeyNotice({ provider, hint, linkToSettings = true }: { provider: string; hint: string; linkToSettings?: boolean }) {
  return (
    <div className="rounded-lg border border-accent/40 bg-accent/10 px-3.5 py-3 text-sm">
      <p className="font-medium">Add your AI API key</p>
      <p className="mt-1 text-muted">
        Pulse doesn&apos;t include an AI key: summaries run on your own, billed to your account. Get a {provider} key at{" "}
        {hint}, or pick another provider.
      </p>
      {linkToSettings && (
        <Link href="/settings#ai" className="mt-2 inline-block font-medium text-accent hover:underline">
          Add key in Settings →
        </Link>
      )}
    </div>
  );
}
