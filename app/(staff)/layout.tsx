import type { Metadata } from "next";
import Link from "next/link";
import { Logo } from "@/components/brand";
import { LogoutButton } from "@/components/logout-button";
import { StaffNav } from "@/components/staff/staff-nav";
import { requireStaff } from "@/lib/domain/staff";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { robots: { index: false, follow: false } };

export default async function StaffLayout({ children }: { children: React.ReactNode }) {
  const ctx = await requireStaff();

  let pendingRequests = 0;
  if (ctx.isAdmin) {
    const supabase = await createClient();
    const { count } = await supabase
      .from("time_off_requests")
      .select("id", { count: "exact", head: true })
      .eq("barbershop_id", ctx.shop.id)
      .eq("status", "pending");
    pendingRequests = count ?? 0;
  }

  return (
    <div className="min-h-svh bg-background">
      <header className="border-b border-border bg-card">
        <div className="border-b border-gold/70 bg-gradient-to-b from-[hsl(30_17%_19%)] to-primary text-primary-foreground">
          <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
            <Link href={ctx.isBarber ? "/agenda" : "/admin"} className="flex min-w-0 items-center gap-2.5">
              <Logo size={40} className="ring-1 ring-gold/70" />
              <span className="truncate font-display text-xl font-extrabold uppercase tracking-wide">{ctx.shop.name}</span>
            </Link>
            <div className="flex items-center gap-3 text-sm">
              <span className="hidden text-primary-foreground/70 sm:inline">{ctx.barberName ?? ctx.email}</span>
              <LogoutButton />
            </div>
          </div>
        </div>
        <StaffNav isAdmin={ctx.isAdmin} isBarber={ctx.isBarber} pendingRequests={pendingRequests} />
      </header>
      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6">{children}</main>
    </div>
  );
}
