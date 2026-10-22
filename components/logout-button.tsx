"use client";

import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export function LogoutButton() {
  const router = useRouter();

  const logout = async () => {
    await createClient().auth.signOut();
    router.push("/auth/login");
    router.refresh();
  };

  return (
    <button
      type="button"
      onClick={logout}
      className="rounded-md border border-primary-foreground/30 px-3 py-1.5 text-sm font-medium transition-colors hover:border-gold-light hover:text-gold-light"
    >
      Cerrar sesión
    </button>
  );
}
