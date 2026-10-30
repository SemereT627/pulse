"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/repositories", label: "Activity" },
  { href: "/repositories/manage", label: "Tracked repos" },
];

export function RepoTabs() {
  const pathname = usePathname();
  return (
    <nav aria-label="Repositories" className="flex gap-1 border-b border-border">
      {TABS.map((t) => {
        const active = pathname === t.href;
        return (
          <Link
            key={t.href}
            href={t.href}
            aria-current={active ? "page" : undefined}
            className={`-mb-px border-b-2 px-3 pb-2.5 pt-1 text-sm transition-colors ${
              active ? "border-accent text-foreground" : "border-transparent text-muted hover:text-foreground"
            }`}
          >
            {t.label}
          </Link>
        );
      })}
    </nav>
  );
}
