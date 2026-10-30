import { OverviewIcon, PeopleIcon, ReportIcon, RepoIcon, SettingsIcon } from "@/components/icons";

export const NAV = [
  { href: "/", label: "Overview", icon: OverviewIcon, weekScoped: true },
  { href: "/reports", label: "Reports", icon: ReportIcon, weekScoped: true },
  { href: "/repositories", label: "Repositories", icon: RepoIcon, weekScoped: true },
  { href: "/contributors", label: "Contributors", icon: PeopleIcon, weekScoped: true },
  { href: "/settings", label: "Settings", icon: SettingsIcon, weekScoped: false },
] as const;

export function navItemFor(pathname: string) {
  return NAV.find((n) => (n.href === "/" ? pathname === "/" : pathname === n.href || pathname.startsWith(`${n.href}/`)));
}
