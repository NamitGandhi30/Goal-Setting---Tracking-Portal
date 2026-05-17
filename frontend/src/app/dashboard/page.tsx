"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";

export default function DashboardPage() {
  const { user } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (user?.role === "manager") router.replace("/dashboard/approvals");
    else if (user?.role === "admin") router.replace("/dashboard/users");
    else router.replace("/dashboard/goals");
  }, [router, user]);

  return (
    <div className="flex min-h-[calc(100vh-3.5rem)] items-center justify-center text-sm text-muted-foreground">
      Loading dashboard...
    </div>
  );
}
