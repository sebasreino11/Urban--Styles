import "server-only";

/**
 * Acceso tipado a variables de entorno del servidor. En Cloudflare Workers
 * OpenNext copia los bindings/secretos a process.env en cada request.
 * Lista completa y origen de cada una: README › Variables de entorno.
 */
function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Falta la variable de entorno ${name}`);
  return value;
}

export const env = {
  supabaseUrl: () => required("NEXT_PUBLIC_SUPABASE_URL"),
  supabasePublishableKey: () => required("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY"),
  supabaseSecretKey: () => required("SUPABASE_SECRET_KEY"),
  siteUrl: () => (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(/\/+$/, ""),
  defaultShopSlug: () => process.env.DEFAULT_SHOP_SLUG ?? "urban-styles",
  resendApiKey: () => process.env.RESEND_API_KEY,
  emailFrom: () => process.env.EMAIL_FROM ?? "Urban Styles <onboarding@resend.dev>",
  turnstileSecret: () => process.env.TURNSTILE_SECRET_KEY,
  cronSecret: () => process.env.CRON_SECRET,
};
