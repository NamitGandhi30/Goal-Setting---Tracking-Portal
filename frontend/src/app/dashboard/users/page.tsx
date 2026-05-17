"use client";

import { useCallback, useEffect, useState } from "react";
import { Search, UserPlus, Shield, Building2, Users, X } from "lucide-react";
import { toast } from "sonner";
import { users as usersApi } from "@/lib/api";
import type { User, UserRole, UserCreatePayload, UserUpdatePayload } from "@/lib/types";
import { cn } from "@/lib/utils";

const ROLES: UserRole[] = ["employee", "manager", "admin"];

export default function UsersPage() {
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [search, setSearch] = useState("");
  const [filterRole, setFilterRole] = useState<UserRole | "all">("all");
  const [filterDept, setFilterDept] = useState("");
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [teamName, setTeamName] = useState("");
  const [teamManagerId, setTeamManagerId] = useState("");
  const [teamMemberIds, setTeamMemberIds] = useState<string[]>([]);

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

  const departments = [...new Set(allUsers.map((u) => u.department).filter(Boolean))] as string[];
  const managers = allUsers.filter((u) => u.role === "manager" || u.role === "admin");

  const filtered = allUsers.filter((user) => {
    if (filterRole !== "all" && user.role !== filterRole) return false;
    if (filterDept && user.department !== filterDept) return false;
    if (search) {
      const q = search.toLowerCase();
      return (
        user.name.toLowerCase().includes(q) ||
        user.email.toLowerCase().includes(q) ||
        user.employee_id.toLowerCase().includes(q)
      );
    }
    return true;
  });

  const handleUpdate = async (userId: string, data: UserUpdatePayload) => {
    try {
      await usersApi.update(userId, data);
      toast.success("User updated");
      setEditingUser(null);
      await loadUsers();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not update user");
    }
  };

  const handleCreate = async (data: UserCreatePayload) => {
    try {
      await usersApi.create(data);
      toast.success("User created");
      setShowCreateModal(false);
      await loadUsers();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not create user");
    }
  };

  const handleCreateTeam = async () => {
    if (!teamName.trim()) return toast.error("Team name is required");
    if (!teamManagerId) return toast.error("Select a team manager");
    if (teamMemberIds.length === 0) return toast.error("Select at least one employee");
    try {
      const result = await usersApi.bulkAssignment({
        department: teamName.trim(),
        manager_id: teamManagerId,
        member_user_ids: teamMemberIds,
      });
      toast.success(`${result.updated_count} team members assigned`);
      setTeamName("");
      setTeamManagerId("");
      setTeamMemberIds([]);
      await loadUsers();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not assign team");
    }
  };

  const toggleTeamMember = (userId: string) => {
    setTeamMemberIds((current) =>
      current.includes(userId) ? current.filter((id) => id !== userId) : [...current, userId],
    );
  };

  const stats = {
    total: allUsers.length,
    active: allUsers.filter((u) => u.is_active).length,
    employees: allUsers.filter((u) => u.role === "employee").length,
    managers: allUsers.filter((u) => u.role === "manager").length,
    admins: allUsers.filter((u) => u.role === "admin").length,
    depts: departments.length,
  };

  return (
    <div className="mx-auto max-w-7xl px-6 py-10">
      <header className="animate-in-up mb-8">
        <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
          Admin / HR
        </span>
        <h1 className="mt-2 text-4xl font-extrabold tracking-tight">Admin Console</h1>
        <p className="mt-2 max-w-[55ch] text-muted-foreground">
          Manage users, roles, teams, departments, and organizational hierarchy.
        </p>
      </header>

      {/* ── Stats Overview ───────────────────────────────── */}
      <div className="mb-8 grid gap-3 sm:grid-cols-3 md:grid-cols-6">
        <StatCard icon={Users} label="Total" value={stats.total} />
        <StatCard icon={Shield} label="Active" value={stats.active} accent="text-emerald-600" />
        <StatCard label="Employees" value={stats.employees} />
        <StatCard label="Managers" value={stats.managers} accent="text-blue-600" />
        <StatCard label="Admins" value={stats.admins} accent="text-violet-600" />
        <StatCard icon={Building2} label="Departments" value={stats.depts} />
      </div>

      <section className="mb-8 grid gap-6 lg:grid-cols-12">
        <div className="rounded-xl border border-border bg-card p-5 shadow-sm lg:col-span-5">
          <h2 className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-muted-foreground">
            <Building2 className="size-4" />
            Create Team
          </h2>
          <div className="mt-4 grid gap-4">
            <Field label="Team / Department Name">
              <input
                className="field"
                placeholder="e.g. Product Engineering"
                value={teamName}
                onChange={(event) => setTeamName(event.target.value)}
              />
            </Field>
            <Field label="Team Manager">
              <select className="field" value={teamManagerId} onChange={(event) => setTeamManagerId(event.target.value)}>
                <option value="">Select manager</option>
                {managers.map((manager) => (
                  <option key={manager.id} value={manager.id}>{manager.name} ({manager.employee_id})</option>
                ))}
              </select>
            </Field>
            <button
              type="button"
              onClick={handleCreateTeam}
              className="rounded-md bg-foreground px-4 py-2 text-xs font-bold uppercase tracking-wider text-background hover:bg-primary"
            >
              Assign Team Manager + Members
            </button>
          </div>
        </div>

        <div className="rounded-xl border border-border bg-card p-5 shadow-sm lg:col-span-7">
          <div className="mb-4 flex items-center justify-between gap-3">
            <h2 className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
              Team Members
            </h2>
            <span className="rounded-full bg-secondary px-2.5 py-0.5 text-[10px] font-bold text-muted-foreground ring-1 ring-border">
              {teamMemberIds.length} selected
            </span>
          </div>
          <div className="grid max-h-64 gap-2 overflow-auto pr-1 md:grid-cols-2">
            {allUsers
              .filter((person) => person.role !== "admin" && person.id !== teamManagerId)
              .map((person) => {
                const selected = teamMemberIds.includes(person.id);
                return (
                  <button
                    key={person.id}
                    type="button"
                    onClick={() => toggleTeamMember(person.id)}
                    className={cn(
                      "rounded-lg border p-3 text-left text-sm transition-colors",
                      selected ? "border-primary bg-primary/5 ring-1 ring-primary/20" : "border-border hover:bg-secondary/50",
                    )}
                  >
                    <p className="font-bold">{person.name}</p>
                    <p className="mt-1 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                      {person.employee_id} / {person.department || "No department"}
                    </p>
                  </button>
                );
              })}
          </div>
        </div>
      </section>

      {/* ── Toolbar ──────────────────────────────────────── */}
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-2.5 size-4 text-muted-foreground" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name, email, or employee ID..."
            className="w-full rounded-md border border-border bg-background py-2 pl-10 pr-3 text-sm outline-none focus:ring-2 focus:ring-primary/20"
          />
        </div>
        <select
          value={filterRole}
          onChange={(e) => setFilterRole(e.target.value as UserRole | "all")}
          className="rounded-md border border-border bg-background px-3 py-2 text-sm"
        >
          <option value="all">All roles</option>
          {ROLES.map((r) => (
            <option key={r} value={r}>{r}</option>
          ))}
        </select>
        <select
          value={filterDept}
          onChange={(e) => setFilterDept(e.target.value)}
          className="rounded-md border border-border bg-background px-3 py-2 text-sm"
        >
          <option value="">All departments</option>
          {departments.map((d) => (
            <option key={d} value={d}>{d}</option>
          ))}
        </select>
        <button
          type="button"
          onClick={() => setShowCreateModal(true)}
          className="flex items-center gap-2 rounded-md bg-foreground px-4 py-2 text-xs font-bold uppercase tracking-wider text-background hover:bg-primary"
        >
          <UserPlus className="size-4" />
          New User
        </button>
      </div>

      {/* ── User Table ───────────────────────────────────── */}
      <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
        <table className="w-full">
          <thead>
            <tr className="border-b border-border bg-secondary/50">
              <Th>Employee</Th>
              <Th>Employee ID</Th>
              <Th>Email</Th>
              <Th>Department</Th>
              <Th>Manager</Th>
              <Th>Role</Th>
              <Th>Status</Th>
              <Th className="w-20">Actions</Th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border text-sm">
            {filtered.map((person) => (
              <tr key={person.id} className="group transition-colors hover:bg-secondary/40">
                <td className="px-6 py-4">
                  <div className="flex items-center gap-3">
                    <div className="grid size-8 shrink-0 place-items-center rounded-full bg-foreground text-[10px] font-bold text-background">
                      {initials(person.name)}
                    </div>
                    <span className="font-bold">{person.name}</span>
                  </div>
                </td>
                <td className="px-6 py-4 font-mono text-[11px] text-muted-foreground">{person.employee_id}</td>
                <td className="px-6 py-4 text-muted-foreground">{person.email}</td>
                <td className="px-6 py-4">{person.department || "-"}</td>
                <td className="px-6 py-4 text-[11px] text-muted-foreground">
                  {person.manager_id
                    ? allUsers.find((u) => u.id === person.manager_id)?.name ?? "—"
                    : "—"}
                </td>
                <td className="px-6 py-4">
                  <RoleBadge role={person.role} />
                </td>
                <td className="px-6 py-4">
                  <span className={person.is_active ? activeBadge : inactiveBadge}>
                    {person.is_active ? "Active" : "Inactive"}
                  </span>
                </td>
                <td className="px-6 py-4">
                  <button
                    type="button"
                    onClick={() => setEditingUser(person)}
                    className="rounded border border-border px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground opacity-0 transition-opacity hover:bg-secondary hover:text-foreground group-hover:opacity-100"
                  >
                    Edit
                  </button>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={8} className="px-6 py-12 text-center text-sm text-muted-foreground">
                  No users found matching your criteria.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* ── Edit User Modal ──────────────────────────────── */}
      {editingUser && (
        <EditUserModal
          user={editingUser}
          managers={managers}
          departments={departments}
          onSave={handleUpdate}
          onClose={() => setEditingUser(null)}
        />
      )}

      {/* ── Create User Modal ────────────────────────────── */}
      {showCreateModal && (
        <CreateUserModal
          managers={managers}
          departments={departments}
          onSave={handleCreate}
          onClose={() => setShowCreateModal(false)}
        />
      )}
    </div>
  );
}

/* ── Modals ──────────────────────────────────────────────── */

function EditUserModal({
  user,
  managers,
  departments,
  onSave,
  onClose,
}: {
  user: User;
  managers: User[];
  departments: string[];
  onSave: (userId: string, data: UserUpdatePayload) => Promise<void>;
  onClose: () => void;
}) {
  const [role, setRole] = useState<UserRole>(user.role);
  const [department, setDepartment] = useState(user.department ?? "");
  const [managerId, setManagerId] = useState(user.manager_id ?? "");
  const [isActive, setIsActive] = useState(user.is_active);
  const [newDept, setNewDept] = useState("");

  const submit = () => {
    const data: UserUpdatePayload = {};
    if (role !== user.role) data.role = role;
    if ((department || null) !== user.department) data.department = department || null;
    if ((managerId || null) !== user.manager_id) data.manager_id = managerId || null;
    if (isActive !== user.is_active) data.is_active = isActive;
    void onSave(user.id, data);
  };

  return (
    <div className="fixed inset-0 z-[60] grid place-items-center bg-black/50 p-4" onClick={onClose}>
      <div className="w-full max-w-lg rounded-xl border border-border bg-card p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-extrabold tracking-tight">Edit User</h3>
            <p className="text-sm text-muted-foreground">{user.name} ({user.employee_id})</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-md p-1 text-muted-foreground hover:bg-secondary">
            <X className="size-5" />
          </button>
        </div>

        <div className="mt-5 grid gap-4">
          <Field label="Role">
            <select className="field" value={role} onChange={(e) => setRole(e.target.value as UserRole)}>
              {ROLES.map((r) => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>
          </Field>

          <Field label="Department">
            <div className="flex gap-2">
              <select
                className="field flex-1"
                value={department}
                onChange={(e) => setDepartment(e.target.value)}
              >
                <option value="">No department</option>
                {departments.map((d) => (
                  <option key={d} value={d}>{d}</option>
                ))}
                {newDept && !departments.includes(newDept) && (
                  <option value={newDept}>{newDept} (new)</option>
                )}
              </select>
              <input
                type="text"
                placeholder="New dept..."
                value={newDept}
                onChange={(e) => {
                  setNewDept(e.target.value);
                  if (e.target.value) setDepartment(e.target.value);
                }}
                className="field w-32"
              />
            </div>
          </Field>

          <Field label="Manager">
            <select className="field" value={managerId} onChange={(e) => setManagerId(e.target.value)}>
              <option value="">No manager</option>
              {managers
                .filter((m) => m.id !== user.id)
                .map((m) => (
                  <option key={m.id} value={m.id}>{m.name} ({m.employee_id})</option>
                ))}
            </select>
          </Field>

          <Field label="Status">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setIsActive(true)}
                className={cn(
                  "rounded-md border px-4 py-2 text-xs font-bold uppercase",
                  isActive ? "border-emerald-300 bg-emerald-50 text-emerald-700" : "border-border",
                )}
              >
                Active
              </button>
              <button
                type="button"
                onClick={() => setIsActive(false)}
                className={cn(
                  "rounded-md border px-4 py-2 text-xs font-bold uppercase",
                  !isActive ? "border-rose-300 bg-rose-50 text-rose-700" : "border-border",
                )}
              >
                Inactive
              </button>
            </div>
          </Field>
        </div>

        <div className="mt-6 flex justify-end gap-2">
          <button type="button" className="rounded-md border border-border px-4 py-2 text-xs font-bold uppercase tracking-wider" onClick={onClose}>
            Cancel
          </button>
          <button type="button" className="rounded-md bg-primary px-4 py-2 text-xs font-bold uppercase tracking-wider text-primary-foreground" onClick={submit}>
            Save Changes
          </button>
        </div>
      </div>
    </div>
  );
}

function CreateUserModal({
  managers,
  departments,
  onSave,
  onClose,
}: {
  managers: User[];
  departments: string[];
  onSave: (data: UserCreatePayload) => Promise<void>;
  onClose: () => void;
}) {
  const [form, setForm] = useState<UserCreatePayload>({
    employee_id: "",
    name: "",
    email: "",
    role: "employee",
    manager_id: null,
    department: null,
    password: "password123",
  });
  const [newDept, setNewDept] = useState("");
  const [error, setError] = useState("");

  const submit = () => {
    setError("");
    if (!form.employee_id.trim()) return setError("Employee ID is required");
    if (!form.name.trim()) return setError("Name is required");
    if (!form.email.trim()) return setError("Email is required");
    void onSave({ ...form, department: form.department || null, manager_id: form.manager_id || null });
  };

  return (
    <div className="fixed inset-0 z-[60] grid place-items-center bg-black/50 p-4" onClick={onClose}>
      <div className="w-full max-w-lg rounded-xl border border-border bg-card p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-extrabold tracking-tight">Create New User</h3>
          <button type="button" onClick={onClose} className="rounded-md p-1 text-muted-foreground hover:bg-secondary">
            <X className="size-5" />
          </button>
        </div>

        {error && <p className="mt-4 rounded border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">{error}</p>}

        <div className="mt-5 grid gap-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Employee ID">
              <input className="field" placeholder="EMP006" value={form.employee_id} onChange={(e) => setForm({ ...form, employee_id: e.target.value })} />
            </Field>
            <Field label="Name">
              <input className="field" placeholder="Full name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </Field>
          </div>
          <Field label="Email">
            <input className="field" type="email" placeholder="user@company.com" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          </Field>
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Role">
              <select className="field" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value as UserRole })}>
                {ROLES.map((r) => (
                  <option key={r} value={r}>{r}</option>
                ))}
              </select>
            </Field>
            <Field label="Department">
              <div className="flex gap-2">
                <select
                  className="field flex-1"
                  value={form.department ?? ""}
                  onChange={(e) => setForm({ ...form, department: e.target.value || null })}
                >
                  <option value="">None</option>
                  {departments.map((d) => (
                    <option key={d} value={d}>{d}</option>
                  ))}
                  {newDept && !departments.includes(newDept) && (
                    <option value={newDept}>{newDept}</option>
                  )}
                </select>
                <input
                  type="text"
                  placeholder="New..."
                  value={newDept}
                  onChange={(e) => {
                    setNewDept(e.target.value);
                    if (e.target.value) setForm({ ...form, department: e.target.value });
                  }}
                  className="field w-20"
                />
              </div>
            </Field>
          </div>
          <Field label="Manager">
            <select
              className="field"
              value={form.manager_id ?? ""}
              onChange={(e) => setForm({ ...form, manager_id: e.target.value || null })}
            >
              <option value="">No manager</option>
              {managers.map((m) => (
                <option key={m.id} value={m.id}>{m.name} ({m.employee_id})</option>
              ))}
            </select>
          </Field>
          <Field label="Password">
            <input className="field" type="text" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
          </Field>
        </div>

        <div className="mt-6 flex justify-end gap-2">
          <button type="button" className="rounded-md border border-border px-4 py-2 text-xs font-bold uppercase tracking-wider" onClick={onClose}>
            Cancel
          </button>
          <button type="button" className="rounded-md bg-primary px-4 py-2 text-xs font-bold uppercase tracking-wider text-primary-foreground" onClick={submit}>
            Create User
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── Helpers ─────────────────────────────────────────────── */

function StatCard({ icon: Icon, label, value, accent }: { icon?: typeof Users; label: string; value: number; accent?: string }) {
  return (
    <div className="rounded-lg border border-border bg-card p-3">
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{label}</span>
        {Icon && <Icon className="size-3.5 text-muted-foreground" />}
      </div>
      <p className={cn("mt-1 font-mono text-2xl font-bold", accent)}>{value}</p>
    </div>
  );
}

const activeBadge = "inline-flex rounded border border-emerald-200 bg-emerald-50 px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-emerald-700";
const inactiveBadge = "inline-flex rounded border border-rose-200 bg-rose-50 px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-rose-700";

function Th({ children, className }: { children: React.ReactNode; className?: string }) {
  return <th className={cn("px-6 py-3 text-left text-[10px] font-bold uppercase tracking-widest text-muted-foreground", className)}>{children}</th>;
}

function RoleBadge({ role }: { role: string }) {
  const className =
    role === "admin"
      ? "border-violet-200 bg-violet-50 text-violet-700"
      : role === "manager"
        ? "border-blue-200 bg-blue-50 text-blue-700"
        : "border-amber-200 bg-amber-50 text-amber-700";
  return (
    <span className={`inline-flex rounded border px-2 py-1 text-[10px] font-bold uppercase tracking-wider ${className}`}>
      {role}
    </span>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="font-mono text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{label}</span>
      <div className="mt-1 [&_.field]:w-full [&_.field]:rounded [&_.field]:border [&_.field]:border-border [&_.field]:bg-background [&_.field]:px-3 [&_.field]:py-2 [&_.field]:text-sm [&_.field]:outline-none [&_.field]:focus:ring-2 [&_.field]:focus:ring-primary/30">
        {children}
      </div>
    </label>
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
