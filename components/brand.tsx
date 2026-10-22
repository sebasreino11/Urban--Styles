import { Scissors } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Medallón del logo. PNG plano (sin optimizador de imágenes): `logo-160` para
 * tamaños de cabecera, `logo` (512 px) para usos grandes.
 */
export function Logo({ size, alt = "", className }: { size: number; alt?: string; className?: string }) {
  const src = size <= 80 ? "/brand/logo-160.png" : "/brand/logo.png";
  return (
    // eslint-disable-next-line @next/next/no-img-element -- sin optimizador de imágenes (costo cero)
    <img src={src} alt={alt} width={size} height={size} className={cn("shrink-0 rounded-full", className)} />
  );
}

/** El ornamento "—✂—" del pie del logo, usado como divisor bajo los títulos. */
export function ScissorsRule({ className }: { className?: string }) {
  return (
    <div className={cn("flex items-center gap-3 text-gold-ink", className)} aria-hidden>
      <span className="h-px w-10 bg-current" />
      <Scissors className="size-4 -rotate-90" strokeWidth={1.75} />
      <span className="h-px w-10 bg-current" />
    </div>
  );
}
