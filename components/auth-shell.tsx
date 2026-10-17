import Link from "next/link";

/** Marco común de las pantallas de acceso del equipo. */
export function AuthShell({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="flex min-h-svh flex-col">
      <div className="barber-stripe h-1.5" aria-hidden />
      <div className="flex flex-1 items-center justify-center px-4 py-12">
        <div className="w-full max-w-sm">
          <Link href="/" className="text-sm text-muted-foreground hover:text-foreground">
            Volver a la página de reservas
          </Link>
          <h1 className="mb-6 mt-3 font-display text-5xl font-black uppercase leading-none text-primary">{title}</h1>
          {children}
        </div>
      </div>
    </div>
  );
}

export const authInput =
  "h-11 w-full rounded-md border border-input bg-card px-3 text-base outline-none focus:border-primary focus:ring-1 focus:ring-primary";
export const authButton =
  "h-11 w-full rounded-md bg-primary font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50";
