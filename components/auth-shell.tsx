import Link from "next/link";
import { Logo } from "@/components/brand";

/** Marco común de las pantallas de acceso del equipo. */
export function AuthShell({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="flex min-h-svh flex-col">
      <div className="flex flex-1 items-center justify-center px-4 py-12">
        <div className="w-full max-w-sm overflow-hidden rounded-xl bg-card p-6 shadow-lift ring-2 ring-gold sm:p-8">
          <div className="barber-stripe -mx-6 -mt-6 mb-6 h-2 sm:-mx-8 sm:-mt-8" aria-hidden />
          <Link href="/" className="text-sm text-muted-foreground hover:text-foreground">
            Volver a la página de reservas
          </Link>
          <Logo size={72} className="mt-6" />
          <h1 className="mb-6 mt-4 font-display text-5xl font-black uppercase leading-none text-primary">{title}</h1>
          {children}
        </div>
      </div>
    </div>
  );
}

export const authInput =
  "h-11 w-full rounded-lg border border-input bg-card px-3 text-base outline-none focus:border-gold-ink focus:ring-1 focus:ring-gold-ink";
export const authButton =
  "h-11 w-full rounded-lg bg-primary font-semibold text-gold-light shadow-soft hover:bg-primary/90 disabled:opacity-50";
