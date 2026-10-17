import "server-only";
import { env } from "@/lib/env";

/**
 * Verifica el token de Cloudflare Turnstile (anti-bots, gratuito).
 * Si TURNSTILE_SECRET_KEY no está configurada (desarrollo local), se omite.
 */
export async function verifyTurnstile(token: string | null | undefined, ip?: string | null) {
  const secret = env.turnstileSecret();
  if (!secret) return true;
  if (!token) return false;

  const body = new FormData();
  body.append("secret", secret);
  body.append("response", token);
  if (ip) body.append("remoteip", ip);

  const res = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
    method: "POST",
    body,
  });
  if (!res.ok) return false;
  const data = (await res.json()) as { success: boolean };
  return data.success;
}
