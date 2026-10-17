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
      className="rounded-md border border-border px-3 py-1.5 text-sm font-medium hover:bg-muted"
    >
      Cerrar sesión
    </button>
  );
}
