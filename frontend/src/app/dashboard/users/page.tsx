"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { users as usersApi } from "@/lib/api";
import type { User } from "@/lib/types";

export default function UsersPage() {
  const [allUsers, setAllUsers] = useState<User[]>([]);

  const loadUsers = useCallback(async () => {
    try {
      setAllUsers(await usersApi.list());
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not load users");
    }
  }, []);

  useEffect(() => {
    const task = window.setTimeout(() => void loadUsers(), 0);
    return () => window.clearTimeout(task);
  }, [loadUsers]);

  return (
    <div className="mx-auto max-w-7xl px-6 py-10">
      <header className="animate-in-up mb-10">
        <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
          Admin / HR
        </span>
        <h1 className="mt-2 text-4xl font-extrabold tracking-tight">Admin Console</h1>
        <p className="mt-2 max-w-[55ch] text-muted-foreground">
          Review user access, roles, managers, and active status across the portal.
        </p>
      </header>

      <div className="mb-4 flex items-center gap-3">
        <h2 className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
          Users
        </h2>
        <span className="rounded-full bg-secondary px-2.5 py-0.5 text-[10px] font-bold text-muted-foreground ring-1 ring-border">
          {allUsers.length}
        </span>
      </div>

      <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
        <table className="w-full">
          <thead>
            <tr className="border-b border-border bg-secondary/50">
              <Th>Employee</Th>
              <Th>Employee ID</Th>
              <Th>Email</Th>
              <Th>Department</Th>
              <Th>Role</Th>
              <Th>Status</Th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border text-sm">
            {allUsers.map((person) => (
              <tr key={person.id}>
                <td className="px-6 py-4">
                  <div className="flex items-center gap-3">
                    <div className="grid size-8 place-items-center rounded-full bg-foreground text-[10px] font-bold text-background">
                      {initials(person.name)}
                    </div>
                    <span className="font-bold">{person.name}</span>
                  </div>
                </td>
                <td className="px-6 py-4 font-mono text-[11px] text-muted-foreground">{person.employee_id}</td>
                <td className="px-6 py-4 text-muted-foreground">{person.email}</td>
                <td className="px-6 py-4">{person.department || "-"}</td>
                <td className="px-6 py-4">
                  <RoleBadge role={person.role} />
                </td>
                <td className="px-6 py-4">
                  <span className={person.is_active ? activeBadge : inactiveBadge}>
                    {person.is_active ? "Active" : "Inactive"}
                  </span>
                </td>
              </tr>
            ))}
            {allUsers.length === 0 && (
              <tr>
                <td colSpan={6} className="px-6 py-12 text-center text-sm text-muted-foreground">
                  No users found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

const activeBadge = "inline-flex rounded border border-emerald-200 bg-emerald-50 px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-emerald-700";
const inactiveBadge = "inline-flex rounded border border-rose-200 bg-rose-50 px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-rose-700";

function Th({ children }: { children: React.ReactNode }) {
  return <th className="px-6 py-3 text-left text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{children}</th>;
}

function RoleBadge({ role }: { role: string }) {
  const className =
    role === "admin"
      ? "border-zinc-200 bg-zinc-100 text-zinc-700"
      : role === "manager"
        ? "border-blue-200 bg-blue-50 text-blue-700"
        : "border-amber-200 bg-amber-50 text-amber-700";
  return (
    <span className={`inline-flex rounded border px-2 py-1 text-[10px] font-bold uppercase tracking-wider ${className}`}>
      {role}
    </span>
  );
}

function initials(name: string) {
  return name
    .split(" ")
    .map((part) => part[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}
