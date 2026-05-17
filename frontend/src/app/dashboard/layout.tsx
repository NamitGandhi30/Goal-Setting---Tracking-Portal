"use client";

import { useEffect, type ReactNode } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { cn } from "@/lib/utils";

const ROLE_HOME: Record<string, string> = {
  employee: "/dashboard/goals",
  manager: "/dashboard/approvals",
  admin: "/dashboard/users",
};

const NAV_ITEMS = [
  { href: "/dashboard/goals", label: "My Goals", roles: ["employee", "manager", "admin"] },
  { href: "/dashboard/approvals", label: "Approvals", roles: ["manager", "admin"] },
  { href: "/dashboard/shared-goals", label: "Shared Goals", roles: ["manager", "admin"] },
  { href: "/dashboard/cycles", label: "Cycles", roles: ["admin"] },
  { href: "/dashboard/users", label: "Admin Console", roles: ["admin"] },
];

export default function DashboardLayout({ children }: { children: ReactNode }) {
  const { user, loading, logout } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!loading && !user) router.replace("/");
  }, [loading, router, user]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background text-sm text-muted-foreground">
        Loading...
      </div>
    );
  }

  if (!user) return null;

  const nav = NAV_ITEMS.filter((item) => item.roles.includes(user.role));
  const initials = user.name
    .split(" ")
    .map((part) => part[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <div className="min-h-screen bg-background text-foreground">
      <nav className="sticky top-0 z-50 border-b border-border bg-background/85 backdrop-blur-md">
        <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-6">
          <div className="flex items-center gap-6">
            <Link href={ROLE_HOME[user.role] ?? "/dashboard/goals"} className="flex items-center gap-2">
              <div className="size-6 rounded-sm bg-primary" />
              <span className="text-lg font-extrabold uppercase tracking-tight">Atomberg</span>
            </Link>
            <div className="h-4 w-px bg-border" />
            <span className="rounded-md bg-foreground px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-background">
              {user.role}
            </span>
            <div className="hidden items-center gap-4 pl-2 md:flex">
              {nav.map((item) => {
                const active = pathname === item.href || pathname.startsWith(item.href + "/");
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      "text-[11px] font-bold uppercase tracking-wider transition-colors",
                      active ? "text-foreground" : "text-muted-foreground hover:text-foreground",
                    )}
                  >
                    {item.label}
                  </Link>
                );
              })}
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="hidden flex-col items-end sm:flex">
              <span className="font-mono text-[10px] font-medium uppercase text-muted-foreground">
                Current cycle
              </span>
              <span className="text-[11px] font-bold">{user.name}</span>
            </div>
            <div className="grid size-8 place-items-center rounded-full bg-foreground text-[10px] font-bold text-background">
              {initials}
            </div>
            <button
              type="button"
              onClick={() => {
                logout();
                router.push("/");
              }}
              className="rounded-md border border-border px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider hover:bg-secondary"
            >
              Sign out
            </button>
          </div>
        </div>
      </nav>
      {children}
    </div>
  );
}
