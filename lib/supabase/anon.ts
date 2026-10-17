import "server-only";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { env } from "@/lib/env";

/**
 * Cliente anónimo sin cookies para lecturas públicas desde el servidor
 * (catálogo, disponibilidad). Sujeto a RLS como cualquier visitante.
 */
export function createAnonClient() {
  return createSupabaseClient(env.supabaseUrl(), env.supabasePublishableKey(), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
