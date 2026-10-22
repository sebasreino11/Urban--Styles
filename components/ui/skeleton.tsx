import { cn } from "@/lib/utils";

/** Bloque de carga. Con prefers-reduced-motion queda estático (ver globals.css). */
function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div aria-hidden className={cn("animate-pulse rounded-md bg-muted", className)} {...props} />;
}

/** Contenedor accesible: anuncia la carga una vez y oculta los bloques al lector de pantalla. */
function SkeletonRegion({
  label = "Cargando",
  className,
  children,
}: {
  label?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div role="status" aria-busy className={className}>
      <span className="sr-only">{label}</span>
      {children}
    </div>
  );
}

export { Skeleton, SkeletonRegion };
