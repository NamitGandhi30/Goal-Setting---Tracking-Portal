"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, BadgeCheck, BriefcaseBusiness, CheckCircle2, Loader2, UserRoundPlus } from "lucide-react";
import { toast } from "sonner";
import { auth } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";

export default function OnboardingPage() {
  const router = useRouter();
  const { login, user } = useAuth();
  const [employeeId, setEmployeeId] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [department, setDepartment] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (user) router.replace("/dashboard/goals");
  }, [router, user]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");

    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    setSubmitting(true);
    try {
      await auth.register({
        employee_id: employeeId.trim(),
        name: name.trim(),
        email: email.trim(),
        department: department.trim() || null,
        password,
      });
      await login(email.trim(), password);
      toast.success("Welcome aboard. Your goal workspace is ready.");
      router.push("/dashboard/goals");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not complete onboarding");
    } finally {
      setSubmitting(false);
    }
  };

  if (user) return null;

  return (
    <main className="min-h-screen bg-[linear-gradient(135deg,#fff7ed_0%,#fafafa_42%,#eef6ff_100%)] px-4 py-8 text-foreground">
      <div className="mx-auto grid min-h-[calc(100vh-4rem)] w-full max-w-6xl items-center gap-8 lg:grid-cols-[0.9fr_1.1fr]">
        <section className="order-2 lg:order-1">
          <Link href="/" className="inline-flex items-center gap-2 text-sm font-bold text-muted-foreground hover:text-foreground">
            <ArrowLeft className="size-4" aria-hidden="true" />
            Back to sign in
          </Link>

          <div className="mt-8 max-w-xl">
            <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-orange-200 bg-white/70 px-3 py-1 text-[11px] font-bold uppercase tracking-widest text-orange-700 shadow-sm">
              <BadgeCheck className="size-3.5" aria-hidden="true" />
              Employee onboarding
            </div>
            <h1 className="text-4xl font-black tracking-tight sm:text-5xl">
              Start with a clean goal sheet.
            </h1>
            <p className="mt-4 max-w-[54ch] text-base leading-7 text-muted-foreground">
              Create your employee account, land directly in the active cycle, and begin drafting goals with your manager alignment in view.
            </p>
          </div>

          <div className="mt-8 grid max-w-xl gap-3 sm:grid-cols-3">
            <Signal label="Account" value="Active" />
            <Signal label="Role" value="Employee" />
            <Signal label="Next" value="Goals" />
          </div>
        </section>

        <section className="order-1 rounded-lg border border-white/70 bg-white/85 p-5 shadow-2xl shadow-orange-950/10 backdrop-blur lg:order-2 sm:p-7">
          <div className="mb-6 flex items-start justify-between gap-4">
            <div>
              <div className="grid size-11 place-items-center rounded-md bg-foreground text-background">
                <UserRoundPlus className="size-5" aria-hidden="true" />
              </div>
              <h2 className="mt-4 text-2xl font-black tracking-tight">Create your account</h2>
              <p className="mt-1 text-sm text-muted-foreground">Use your official employee details.</p>
            </div>
            <div className="hidden rounded-md border border-border bg-background px-3 py-2 text-right sm:block">
              <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Portal</p>
              <p className="text-sm font-black">Atomberg Goals</p>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="grid gap-4">
            {error && (
              <p className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm font-medium text-destructive">
                {error}
              </p>
            )}

            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Employee ID">
                <input className="field" required value={employeeId} onChange={(event) => setEmployeeId(event.target.value)} placeholder="EMP006" />
              </Field>
              <Field label="Full name">
                <input className="field" required value={name} onChange={(event) => setName(event.target.value)} placeholder="Asha Mehta" />
              </Field>
            </div>

            <Field label="Work email">
              <input className="field" required type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="asha@company.com" />
            </Field>

            <Field label="Department">
              <div className="relative">
                <BriefcaseBusiness className="pointer-events-none absolute left-3 top-2.5 size-4 text-muted-foreground" aria-hidden="true" />
                <input className="field pl-9" value={department} onChange={(event) => setDepartment(event.target.value)} placeholder="Engineering" />
              </div>
            </Field>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Password">
                <input className="field" required minLength={6} type="password" value={password} onChange={(event) => setPassword(event.target.value)} />
              </Field>
              <Field label="Confirm password">
                <input className="field" required minLength={6} type="password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} />
              </Field>
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="mt-2 inline-flex items-center justify-center gap-2 rounded-md bg-foreground px-4 py-3 text-xs font-black uppercase tracking-wider text-background transition hover:bg-primary disabled:opacity-50"
            >
              {submitting ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : <CheckCircle2 className="size-4" aria-hidden="true" />}
              {submitting ? "Creating account" : "Complete onboarding"}
            </button>
          </form>

          <p className="mt-5 text-center text-xs text-muted-foreground">
            Already onboarded?{" "}
            <Link href="/" className="font-bold text-foreground hover:text-primary">
              Sign in
            </Link>
          </p>
        </section>
      </div>
    </main>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="font-mono text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{label}</span>
      <div className="mt-1 [&_.field]:w-full [&_.field]:rounded-md [&_.field]:border [&_.field]:border-border [&_.field]:bg-background [&_.field]:px-3 [&_.field]:py-2.5 [&_.field]:text-sm [&_.field]:outline-none [&_.field]:transition [&_.field]:focus:border-foreground [&_.field]:focus:ring-2 [&_.field]:focus:ring-primary/20">
        {children}
      </div>
    </label>
  );
}

function Signal({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-white/70 bg-white/70 p-3 shadow-sm">
      <p className="font-mono text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{label}</p>
      <p className="mt-1 text-sm font-black">{value}</p>
    </div>
  );
}
