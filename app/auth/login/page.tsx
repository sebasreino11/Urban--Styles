import type { Metadata } from "next";
import { Suspense } from "react";
import { AuthShell } from "@/components/auth-shell";
import { LoginForm } from "@/components/login-form";

export const metadata: Metadata = { title: "Acceso del equipo" };

export default function Page() {
  return (
    <AuthShell title="Acceso del equipo">
      <Suspense>
        <LoginForm />
      </Suspense>
    </AuthShell>
  );
}
