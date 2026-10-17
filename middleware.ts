import { updateSession } from "@/lib/supabase/proxy";
import { type NextRequest } from "next/server";

/*
 * Se usa `middleware.ts` (runtime Edge) y no `proxy.ts` de Next 16 a
 * propósito: OpenNext para Cloudflare soporta el middleware Edge de forma
 * estable, mientras que el proxy en runtime Node aún es experimental ahí.
 * Next muestra un aviso de deprecación en build; es esperado.
 */
export async function middleware(request: NextRequest) {
  return await updateSession(request);
}

export const config = {
  // Solo rutas de staff y de auth: el portal público no paga el costo de CPU
  // de verificar sesión (importante con el límite de 10 ms del plan Free).
  matcher: ["/agenda/:path*", "/admin/:path*", "/auth/:path*"],
};
