import type { Metadata } from "next";
import Link from "next/link";
import { AuthShell } from "@/components/auth-shell";

export const metadata: Metadata = { title: "Enlace no válido" };

export default function Page() {
  return (
    <AuthShell title="Enlace no válido">
      <p className="text-muted-foreground">
        El enlace expiró o ya se usó. Los enlaces de invitación y de recuperación sirven una sola vez.
      </p>
      <Link href="/auth/forgot-password" className="mt-6 inline-block font-medium text-primary underline underline-offset-4">
        Pedir un enlace nuevo
      </Link>
    </AuthShell>
  );
}
