"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { authButton, authInput } from "@/components/auth-shell";
import { createClient } from "@/lib/supabase/client";

/** Se usa al aceptar una invitación y al recuperar la contraseña. */
export function UpdatePasswordForm() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (password.length < 8) return setError("Usa al menos 8 caracteres.");
    setIsLoading(true);
    setError(null);
    const { error } = await createClient().auth.updateUser({ password });
    if (error) {
      setIsLoading(false);
      setError(
        error.message.includes("session")
          ? "El enlace expiró. Pide uno nuevo desde “¿La olvidaste?”."
          : "No pudimos guardar la contraseña. Prueba con otra.",
      );
      return;
    }
    router.push("/agenda");
    router.refresh();
  };

  return (
    <form onSubmit={submit} className="grid gap-4">
      <label className="grid gap-1.5">
        <span className="text-sm font-medium">Contraseña nueva</span>
        <input type="password" autoComplete="new-password" required minLength={8} className={authInput} value={password} onChange={(e) => setPassword(e.target.value)} />
        <span className="text-xs text-muted-foreground">Mínimo 8 caracteres.</span>
      </label>
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      <button type="submit" className={authButton} disabled={isLoading}>
        {isLoading ? "Guardando" : "Guardar y entrar"}
      </button>
    </form>
  );
}
