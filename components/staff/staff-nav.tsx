"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const BARBER_LINKS = [
  { href: "/agenda", label: "Mi agenda" },
  { href: "/agenda/nueva", label: "Agendar cita" },
  { href: "/agenda/bloqueos", label: "Días libres" },
  { href: "/agenda/notificaciones", label: "Avisos al celular" },
];

const ADMIN_LINKS = [
  { href: "/admin", label: "Resumen" },
  { href: "/admin/citas", label: "Citas" },
  { href: "/admin/solicitudes", label: "Solicitudes" },
  { href: "/admin/barberos", label: "Equipo" },
  { href: "/admin/servicios", label: "Servicios" },
  { href: "/admin/barberia", label: "Barbería" },
];

/**
 * Navegación del staff. Si la cuenta tiene ambos roles (el dueño), muestra
 * un selector Barbero / Administración sin cerrar sesión.
 */
export function StaffNav({
  isAdmin,
  isBarber,
  pendingRequests,
}: {
  isAdmin: boolean;
  isBarber: boolean;
  pendingRequests: number;
}) {
  const pathname = usePathname();
  const inAdmin = pathname.startsWith("/admin");
  const links = inAdmin ? ADMIN_LINKS : BARBER_LINKS;
  const isActive = (href: string) =>
    href === "/agenda" || href === "/admin" ? pathname === href : pathname.startsWith(href);

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-2 px-4 pb-0 sm:flex-row sm:items-end sm:justify-between sm:px-6">
      <nav className="-mb-px flex gap-1 overflow-x-auto" aria-label="Secciones">
        {links.map((l) => (
          <Link
            key={l.href}
            href={l.href}
            aria-current={isActive(l.href) ? "page" : undefined}
            className={cn(
              "flex shrink-0 items-center gap-2 border-b-2 px-3 py-2.5 text-sm font-medium transition-colors",
              isActive(l.href)
                ? "border-accent text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground",
            )}
          >
            {l.label}
            {l.href === "/admin/solicitudes" && pendingRequests > 0 && (
              <span className="rounded-full bg-accent px-1.5 text-xs font-semibold text-accent-foreground">
                {pendingRequests}
              </span>
            )}
          </Link>
        ))}
      </nav>

      {isAdmin && isBarber && (
        <div className="mb-2 inline-flex self-start rounded-md border border-border p-0.5 text-sm sm:self-auto" role="group" aria-label="Vista">
          <Link
            href="/agenda"
            className={cn("rounded px-3 py-1", !inAdmin ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground")}
          >
            Barbero
          </Link>
          <Link
            href="/admin"
            className={cn(
              "flex items-center gap-1.5 rounded px-3 py-1",
              inAdmin ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground",
            )}
          >
            Administración
            {!inAdmin && pendingRequests > 0 && <span className="size-1.5 rounded-full bg-accent" aria-label="Solicitudes pendientes" />}
          </Link>
        </div>
      )}
    </div>
  );
}
