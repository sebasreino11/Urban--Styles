"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { authButton, authInput } from "@/components/auth-shell";
import { createClient } from "@/lib/supabase/client";
import { safeNext } from "@/lib/safe-redirect";

export function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(
    params.get("error") === "sin-acceso" ? "Tu cuenta no tiene acceso activo a ninguna barbería. Habla con el administrador." : null,
  );
  const [isLoading, setIsLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);
    const { error } = await createClient().auth.signInWithPassword({ email, password });
    if (error) {
      setError(
        error.message.includes("Invalid login credentials")
          ? "Correo o contraseña incorrectos."
          : "No pudimos iniciar sesión. Intenta de nuevo.",
      );
      setIsLoading(false);
      return;
    }
    router.push(safeNext(params.get("next"), "/agenda"));
    router.refresh();
  };

  return (
    <form onSubmit={handleLogin} className="grid gap-4">
      <label className="grid gap-1.5">
        <span className="text-sm font-medium">Correo</span>
        <input id="email" type="email" autoComplete="email" required className={authInput} value={email} onChange={(e) => setEmail(e.target.value)} />
      </label>
      <label className="grid gap-1.5">
        <span className="flex items-center justify-between text-sm font-medium">
          Contraseña
          <Link href="/auth/forgot-password" className="font-normal text-muted-foreground underline-offset-4 hover:underline">
            ¿La olvidaste?
          </Link>
        </span>
        <input id="password" type="password" autoComplete="current-password" required className={authInput} value={password} onChange={(e) => setPassword(e.target.value)} />
      </label>
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      <button type="submit" className={authButton} disabled={isLoading}>
        {isLoading ? "Entrando" : "Entrar"}
      </button>
      <p className="text-sm text-muted-foreground">
        Las cuentas las crea el administrador de la barbería.
      </p>
    </form>
  );
}
