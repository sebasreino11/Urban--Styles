import type { Metadata } from "next";
import { AuthShell } from "@/components/auth-shell";
import { UpdatePasswordForm } from "@/components/update-password-form";

export const metadata: Metadata = { title: "Crear contraseña" };

export default function Page() {
  return (
    <AuthShell title="Crea tu contraseña">
      <UpdatePasswordForm />
    </AuthShell>
  );
}
