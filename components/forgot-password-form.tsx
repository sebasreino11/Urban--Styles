"use client";

import Link from "next/link";
import { useState } from "react";
import { authButton, authInput } from "@/components/auth-shell";
import { createClient } from "@/lib/supabase/client";

export function ForgotPasswordForm() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);
    // Esta URL debe estar en Supabase › Auth › URL Configuration › Redirect URLs.
    const { error } = await createClient().auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/confirm?next=/auth/update-password`,
    });
    setIsLoading(false);
    if (error) setError("No pudimos enviar el correo. Intenta de nuevo en unos minutos.");
    else setSuccess(true);
  };

  if (success) {
    return (
      <p className="text-muted-foreground">
        Si <span className="font-medium text-foreground">{email}</span> tiene una cuenta, te llegará un correo con el
        enlace para crear una contraseña nueva.
      </p>
    );
  }

  return (
    <form onSubmit={submit} className="grid gap-4">
      <label className="grid gap-1.5">
        <span className="text-sm font-medium">Correo</span>
        <input type="email" autoComplete="email" required className={authInput} value={email} onChange={(e) => setEmail(e.target.value)} />
      </label>
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      <button type="submit" className={authButton} disabled={isLoading}>
        {isLoading ? "Enviando" : "Enviar enlace"}
      </button>
      <Link href="/auth/login" className="text-sm text-muted-foreground underline-offset-4 hover:underline">
        Volver a iniciar sesión
      </Link>
    </form>
  );
}
