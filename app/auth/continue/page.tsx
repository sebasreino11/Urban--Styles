import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AuthShell, authButton } from "@/components/auth-shell";
import { safeNext } from "@/lib/safe-redirect";

export const metadata: Metadata = { title: "Continuar" };

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ token_hash?: string; type?: string; next?: string }>;
}) {
  const { token_hash, type, next } = await searchParams;
  if (!token_hash || !type) redirect("/auth/error?reason=missing_token");

  return (
    <AuthShell title={type === "invite" ? "Acepta tu invitación" : "Restablece tu contraseña"}>
      <p className="text-muted-foreground">Pulsa continuar para elegir tu contraseña nueva.</p>
      {/* POST: el token se gasta al pulsar, no al abrir la página. */}
      <form method="post" action="/auth/confirm" className="mt-6 grid gap-4">
        <input type="hidden" name="token_hash" value={token_hash} />
        <input type="hidden" name="type" value={type} />
        <input type="hidden" name="next" value={safeNext(next, "/agenda")} />
        <button type="submit" className={authButton}>
          Continuar
        </button>
      </form>
    </AuthShell>
  );
}
