import type { Metadata } from "next";
import Link from "next/link";
import { AuthShell } from "@/components/auth-shell";

export const metadata: Metadata = { title: "Enlace no válido" };

export default async function Page({ searchParams }: { searchParams: Promise<{ reason?: string }> }) {
  const { reason } = await searchParams;
  return (
    <AuthShell title="Enlace no válido">
      <p className="text-muted-foreground">
        {reason === "missing_token"
          ? "El enlace está incompleto. Ábrelo completo desde el correo o pide uno nuevo."
          : "El enlace expiró o ya se usó. Si lo abres en otro navegador o dispositivo del que lo pediste, también puede fallar. Los enlaces de invitación y de recuperación sirven una sola vez."}
      </p>
      <Link href="/auth/forgot-password" className="mt-6 inline-block font-medium text-primary underline underline-offset-4">
        Pedir un enlace nuevo
      </Link>
    </AuthShell>
  );
}
