import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/** Rutas que exigen sesión. El portal público y /cita/* no la necesitan. */
const PROTECTED_PREFIXES = ["/agenda", "/admin"];

/**
 * Refresca la sesión de Supabase (cookies) en cada request de staff y
 * redirige al login si no hay usuario. Es solo una comodidad de UX: la
 * autorización real la hacen los layouts de servidor y, sobre todo, RLS.
 */
export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  // No pongas código entre createServerClient y getClaims(): getClaims()
  // es lo que rota el token; si se omite, las sesiones expiran al azar.
  const { data } = await supabase.auth.getClaims();
  const user = data?.claims;

  const path = request.nextUrl.pathname;
  if (!user && PROTECTED_PREFIXES.some((p) => path === p || path.startsWith(`${p}/`))) {
    const url = request.nextUrl.clone();
    url.pathname = "/auth/login";
    url.searchParams.set("next", path);
    return NextResponse.redirect(url);
  }

  // Devuelve siempre supabaseResponse: lleva las cookies de sesión renovadas.
  return supabaseResponse;
}
