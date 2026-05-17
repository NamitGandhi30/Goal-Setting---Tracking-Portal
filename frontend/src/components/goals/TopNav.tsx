"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { toast } from "sonner";
import { useAuth } from "@/context/AuthContext";
import type { Role } from "@/lib/goals/types";
import { CYCLE } from "@/lib/goals/types";
import { cn } from "@/lib/utils";

const ROLE_HOME: Record<Role, string> = {
  Employee: "/dashboard/goals",
  Manager: "/dashboard/approvals",
  Admin: "/dashboard/users",
};

export function TopNav() {
  const { user, logout } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const role = toDisplayRole(user?.role);

  const navLinks: { label: string; to: string; visible: boolean }[] = [
    { label: "My Goals", to: "/dashboard/goals", visible: true },
    { label: "Approvals", to: "/dashboard/approvals", visible: role === "Manager" || role === "Admin" },
    { label: "Analytics", to: "/dashboard", visible: role === "Manager" || role === "Admin" },
    { label: "Admin Console", to: "/dashboard/users", visible: role === "Admin" },
  ];

  const handleSignOut = async () => {
    logout();
    toast.success("Signed out");
    router.push("/");
  };

  const initials = (user?.name ?? "U")
    .split(" ")
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <nav className="sticky top-0 z-50 border-b border-border bg-background/85 backdrop-blur-md">
      <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-6">
        <div className="flex items-center gap-6">
          <Link href={role ? ROLE_HOME[role] : "/dashboard/goals"} className="flex items-center gap-2">
            <div className="size-6 rounded-sm bg-primary" />
            <span className="text-lg font-extrabold uppercase tracking-tighter">Atomberg</span>
          </Link>
          <div className="h-4 w-px bg-border" />
          {role && (
            <span className="rounded-md bg-foreground px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-background">
              {role}
            </span>
          )}

          <div className="hidden items-center gap-4 pl-2 md:flex">
            {navLinks
              .filter((l) => l.visible)
              .map((l) => {
                const active = pathname === l.to || pathname.startsWith(l.to + "/");
                return (
                  <Link
                    key={l.to}
                    href={l.to}
                    className={cn(
                      "text-[11px] font-bold uppercase tracking-wider transition-colors",
                      active ? "text-foreground" : "text-muted-foreground hover:text-foreground",
                    )}
                  >
                    {l.label}
                  </Link>
                );
              })}
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="hidden flex-col items-end sm:flex">
            <span className="font-mono text-[10px] font-medium uppercase text-muted-foreground">
              Cycle {CYCLE}
            </span>
            <span className="text-[11px] font-bold">{user?.name ?? ""}</span>
          </div>
          <div className="grid size-8 place-items-center rounded-full bg-foreground text-[10px] font-bold text-background">
            {initials}
          </div>
          <button
            type="button"
            onClick={handleSignOut}
            className="rounded-md border border-border px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider hover:bg-secondary"
          >
            Sign out
          </button>
        </div>
      </div>
    </nav>
  );
}

function toDisplayRole(role?: string): Role | null {
  if (role === "employee") return "Employee";
  if (role === "manager") return "Manager";
  if (role === "admin") return "Admin";
  return null;
}
