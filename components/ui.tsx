import Link from "next/link";

export const buttonClass =
  "inline-flex h-9 items-center gap-2 whitespace-nowrap rounded-lg border border-border bg-surface px-3 text-sm text-foreground transition-colors hover:bg-surface-2 disabled:pointer-events-none disabled:opacity-50";

export const primaryButtonClass =
  "inline-flex h-9 items-center gap-2 whitespace-nowrap rounded-lg bg-accent px-3.5 text-sm font-medium text-accent-foreground transition-opacity hover:opacity-90 disabled:pointer-events-none disabled:opacity-50";

export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow?: React.ReactNode;
  title: React.ReactNode;
  description?: React.ReactNode;
  actions?: React.ReactNode;
}) {
  return (
    <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0 space-y-1.5">
        {eyebrow && <p className="font-mono text-xs uppercase tracking-[0.16em] text-muted">{eyebrow}</p>}
        <h1 className="font-display text-3xl font-semibold tracking-[-0.03em]">{title}</h1>
        {description && <p className="max-w-2xl text-sm text-muted">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </header>
  );
}

export function Panel({
  title,
  action,
  children,
  className = "",
}: {
  title?: React.ReactNode;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={`min-w-0 rounded-xl border border-border bg-surface ${className}`}>
      {title && (
        <div className="flex items-center justify-between gap-4 border-b border-border px-4 py-3">
          <h2 className="text-sm font-medium">{title}</h2>
          {action && <div className="text-xs text-muted">{action}</div>}
        </div>
      )}
      <div className="p-4">{children}</div>
    </section>
  );
}

export function PanelLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link href={href} className="font-mono text-xs text-muted transition-colors hover:text-foreground">
      {children} →
    </Link>
  );
}

export function EmptyState({ title, children, action }: { title: string; children?: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-dashed border-border px-6 py-14 text-center">
      <p className="font-display text-lg font-semibold tracking-tight">{title}</p>
      {children && <p className="mx-auto mt-2 max-w-md text-sm text-muted">{children}</p>}
      {action && <div className="mt-6 flex justify-center">{action}</div>}
    </div>
  );
}

export function Skeleton({ className }: { className: string }) {
  return <div className={`animate-pulse rounded-xl bg-surface ${className}`} />;
}

export function LiveDot() {
  return <span className="size-1.5 animate-pulse rounded-full bg-accent" />;
}
