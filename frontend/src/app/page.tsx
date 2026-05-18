"use client";

import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const { login, user } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (user) router.replace("/dashboard/goals");
  }, [user, router]);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      await login(email, password);
      router.push("/dashboard/goals");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sign in failed");
    } finally {
      setSubmitting(false);
    }
  };

  if (user) return null;

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-3 size-8 rounded-sm bg-primary" />
          <h1 className="text-2xl font-extrabold tracking-tight">Atomberg Goal Portal</h1>
          <p className="mt-1 text-sm text-muted-foreground">Sign in with your work account</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 rounded-xl border border-border bg-card p-6 shadow-sm">
          {error && (
            <p className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm font-medium text-destructive">
              {error}
            </p>
          )}

          <Field label="Email">
            <input
              type="email"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              autoComplete="email"
              className="w-full rounded border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/30"
              placeholder="admin@company.com"
            />
          </Field>

          <Field label="Password">
            <input
              type="password"
              required
              minLength={6}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete="current-password"
              className="w-full rounded border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/30"
              placeholder="password123"
            />
          </Field>

          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-md bg-primary px-4 py-2 text-[12px] font-bold uppercase tracking-wider text-primary-foreground transition disabled:opacity-50"
          >
            {submitting ? "Signing in..." : "Sign in"}
          </button>
        </form>

        <div className="mt-4 rounded-xl border border-dashed border-border p-4 text-xs text-muted-foreground">
          <p className="font-bold uppercase tracking-wider text-foreground">Demo accounts</p>
          <p className="mt-2 font-mono">admin@company.com</p>
          <p className="font-mono">manager@company.com</p>
          <p className="font-mono">demo1@company.com (up to demo5)</p>
          <p className="mt-2">
            Password: <code className="font-mono text-foreground">password123</code>
          </p>
        </div>

        <p className="mt-4 text-center text-xs text-muted-foreground">
          Need access?{" "}
          <Link href="/onboarding" className="font-bold text-foreground hover:text-primary">
            Onboard here
          </Link>
        </p>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="font-mono text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
        {label}
      </span>
      <div className="mt-1">{children}</div>
    </label>
  );
}
