/**
 * Punto de entrada del Worker en Cloudflare. Envuelve el handler que genera
 * OpenNext (.open-next/worker.js) y añade el Cron Trigger de keep-alive:
 * Supabase Free pausa el proyecto tras 7 días sin actividad; una consulta
 * cada 12 h lo evita (configurado en wrangler.jsonc › triggers.crons).
 */
// @ts-ignore — archivo generado por `opennextjs-cloudflare build` (no existe antes del build)
import { default as handler } from "./.open-next/worker.js";

interface Env {
  NEXT_PUBLIC_SUPABASE_URL: string;
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: string;
}

export default {
  fetch: handler.fetch,

  async scheduled(_event: unknown, env: Env, ctx: { waitUntil(p: Promise<unknown>): void }) {
    ctx.waitUntil(
      fetch(`${env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/barbershops?select=id&limit=1`, {
        headers: { apikey: env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY },
      }).then((r) => console.log(`keep-alive Supabase: ${r.status}`)),
    );
  },
};
