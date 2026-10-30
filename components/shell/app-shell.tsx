"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { CloseIcon, MenuIcon } from "@/components/icons";
import { Logo } from "@/components/logo";
import { NAV, navItemFor } from "./nav";

type Props = {
  /** Server-rendered: tracked repos, API budget, schedule. */
  sidebarFooter: React.ReactNode;
  /** Server-rendered: week picker and user menu. */
  topbarActions: React.ReactNode;
  children: React.ReactNode;
};

export function AppShell({ sidebarFooter, topbarActions, children }: Props) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const close = () => setOpen(false);

  const sidebar = (
    <div className="flex h-full flex-col">
      <div className="flex h-14 items-center px-5">
        <Link href="/" onClick={close} aria-label="Pulse overview">
          <Logo />
        </Link>
      </div>
      <nav aria-label="Sections" className="flex-1 px-3 py-4">
        <Suspense fallback={<NavLinks week={null} onNavigate={close} />}>
          <NavLinksWithWeek onNavigate={close} />
        </Suspense>
      </nav>
      <div className="border-t border-border p-4">{sidebarFooter}</div>
    </div>
  );

  return (
    <div className="flex min-h-dvh flex-1">
      <aside className="sticky top-0 hidden h-dvh w-60 shrink-0 border-r border-border bg-surface lg:block">{sidebar}</aside>

      <AnimatePresence>
        {open && (
          <div className="fixed inset-0 z-40 lg:hidden">
            <motion.button
              type="button"
              aria-label="Close menu"
              onClick={close}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/50"
            />
            <motion.aside
              initial={{ x: "-100%" }}
              animate={{ x: 0 }}
              exit={{ x: "-100%" }}
              transition={{ type: "tween", duration: 0.22, ease: "easeOut" }}
              className="absolute inset-y-0 left-0 w-72 max-w-[85vw] border-r border-border bg-surface"
            >
              <button
                type="button"
                onClick={close}
                aria-label="Close menu"
                className="absolute right-3 top-3 flex size-9 items-center justify-center rounded-lg text-muted hover:bg-surface-2 hover:text-foreground"
              >
                <CloseIcon />
              </button>
              {sidebar}
            </motion.aside>
          </div>
        )}
      </AnimatePresence>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-border bg-background/85 px-4 backdrop-blur sm:px-6 lg:px-8">
          <button
            type="button"
            onClick={() => setOpen(true)}
            aria-label="Open menu"
            className="-ml-1.5 flex size-9 items-center justify-center rounded-lg text-muted hover:bg-surface hover:text-foreground lg:hidden"
          >
            <MenuIcon />
          </button>
          <p className="truncate text-sm font-medium">{navItemFor(pathname)?.label ?? "Pulse"}</p>
          <div className="ml-auto flex items-center gap-2">{topbarActions}</div>
        </header>
        {/* Same side padding as the header, left-aligned, so page content lines up with the section title. */}
        <main className="w-full max-w-[96rem] flex-1 px-4 pb-16 pt-6 sm:px-6 sm:pt-8 lg:px-8">{children}</main>
      </div>
    </div>
  );
}

function NavLinksWithWeek({ onNavigate }: { onNavigate: () => void }) {
  return <NavLinks week={useSearchParams().get("week")} onNavigate={onNavigate} />;
}

function NavLinks({ week, onNavigate }: { week: string | null; onNavigate: () => void }) {
  const active = navItemFor(usePathname());

  return (
    <ul className="space-y-0.5">
      {NAV.map((item) => {
        const isActive = item === active;
        const href = item.weekScoped && week ? `${item.href}?week=${week}` : item.href;
        return (
          <li key={item.href}>
            <Link
              href={href}
              onClick={onNavigate}
              aria-current={isActive ? "page" : undefined}
              className={`relative flex h-9 items-center gap-3 rounded-lg px-3 text-sm transition-colors ${
                isActive ? "bg-surface-2 font-medium text-foreground" : "text-muted hover:bg-surface-2/60 hover:text-foreground"
              }`}
            >
              {isActive && <span className="absolute inset-y-2 left-0 w-0.5 rounded-full bg-accent" />}
              <item.icon />
              {item.label}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
