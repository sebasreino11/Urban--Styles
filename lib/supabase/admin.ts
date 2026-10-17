import "server-only";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { env } from "@/lib/env";

/**
 * Cliente con la secret key (rol service_role): IGNORA RLS.
 * Solo para operaciones públicas ya validadas en el servidor (reservar,
 * cancelar por token), leer la URL de push del barbero, registrar
 * notificaciones e invitar usuarios. Nunca importarlo desde un componente
 * cliente (`server-only` lo impide en build).
 */
export function createAdminClient() {
  return createSupabaseClient(env.supabaseUrl(), env.supabaseSecretKey(), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
