"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronDownIcon, LogoutIcon, SettingsIcon } from "@/components/icons";

type Props = { name: string | null; login: string; image: string | null; signOut: () => Promise<void> };

export function UserMenu({ name, login, image, signOut }: Props) {
  const [open, setOpen] = useState(false);
  const item = "flex h-9 w-full items-center gap-2.5 rounded-md px-2.5 text-sm text-muted hover:bg-surface-2 hover:text-foreground";

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label="Account menu"
        className="flex h-9 items-center gap-1.5 rounded-lg pl-1 pr-1.5 text-muted transition-colors hover:bg-surface hover:text-foreground"
      >
        <Avatar login={login} image={image} />
        <ChevronDownIcon className="hidden size-4 sm:block" />
      </button>

      <AnimatePresence>
        {open && (
          <>
            <button type="button" aria-label="Close account menu" className="fixed inset-0 z-40 cursor-default" onClick={() => setOpen(false)} />
            <motion.div
              role="menu"
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.12 }}
              className="absolute right-0 top-11 z-50 w-60 rounded-xl border border-border bg-surface p-1.5 shadow-xl shadow-black/20"
            >
              <div className="flex items-center gap-3 px-2.5 py-2">
                <Avatar login={login} image={image} />
                <div className="min-w-0">
                  {name && <p className="truncate text-sm font-medium">{name}</p>}
                  <p className="truncate font-mono text-xs text-muted">@{login}</p>
                </div>
              </div>
              <div className="my-1 h-px bg-border" />
              <Link href="/settings" role="menuitem" className={item} onClick={() => setOpen(false)}>
                <SettingsIcon /> Settings
              </Link>
              <form action={signOut}>
                <button type="submit" role="menuitem" className={item}>
                  <LogoutIcon /> Sign out
                </button>
              </form>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}

function Avatar({ login, image }: { login: string; image: string | null }) {
  return image ? (
    <Image src={image} alt="" width={28} height={28} className="size-7 rounded-full border border-border" />
  ) : (
    <span className="flex size-7 items-center justify-center rounded-full bg-surface-2 font-mono text-xs uppercase">
      {login.slice(0, 1)}
    </span>
  );
}
