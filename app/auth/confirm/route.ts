import { type EmailOtpType } from "@supabase/supabase-js";
import { redirect } from "next/navigation";
import { NextResponse, type NextRequest } from "next/server";
import { safeNext } from "@/lib/safe-redirect";
import { createClient } from "@/lib/supabase/server";

/**
 * Destino de los enlaces de correo de Supabase Auth (invitación y
 * recuperación). Las plantillas de correo deben apuntar aquí con token_hash:
 *   {{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=invite&next=/auth/update-password
 * Ver README › Configurar Supabase.
 *
 * El GET con token_hash NO consume el token: muestra /auth/continue, y el
 * token se verifica en el POST (botón "Continuar"). Así los escáneres de
 * correo que abren el enlace por adelantado no lo gastan.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type");
  const code = searchParams.get("code");
  const next = safeNext(searchParams.get("next"), "/agenda");

  if (tokenHash && type) {
    const qs = new URLSearchParams({ token_hash: tokenHash, type, next });
    redirect(`/auth/continue?${qs}`);
  }
  // Enlace PKCE por defecto de Supabase (?code=): solo sirve en el mismo
  // navegador que pidió el correo, y un escáner no puede canjearlo.
  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) redirect(next);
    redirect("/auth/error?reason=invalid");
  }
  redirect("/auth/error?reason=missing_token");
}

export async function POST(request: NextRequest) {
  const form = await request.formData();
  const tokenHash = form.get("token_hash");
  const type = form.get("type");
  const next = safeNext(typeof form.get("next") === "string" ? (form.get("next") as string) : null, "/agenda");
  const to = (path: string) => NextResponse.redirect(new URL(path, request.url), 303);

  if (typeof tokenHash !== "string" || typeof type !== "string" || !tokenHash || !type) {
    return to("/auth/error?reason=missing_token");
  }
  const supabase = await createClient();
  const { error } = await supabase.auth.verifyOtp({ type: type as EmailOtpType, token_hash: tokenHash });
  return to(error ? "/auth/error?reason=invalid" : next);
}
