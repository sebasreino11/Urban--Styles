import Link from "next/link";
import type { AppointmentStatus, TimeOffStatus } from "@/lib/domain/types";
import { cn } from "@/lib/utils";

/** Piezas visuales compartidas del portal de staff (sin estado). */

export function PageHeader({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="font-display text-4xl font-black uppercase leading-none text-primary sm:text-5xl">{title}</h1>
        {description && <p className="mt-2 max-w-prose text-muted-foreground">{description}</p>}
      </div>
      {children}
    </div>
  );
}

export function Tabs({ items, current }: { items: { href: string; label: string; key: string }[]; current: string }) {
  return (
    <div className="inline-flex rounded-md border border-border bg-card p-0.5 text-sm" role="tablist">
      {items.map((t) => (
        <Link
          key={t.key}
          href={t.href}
          role="tab"
          aria-selected={t.key === current}
          className={cn(
            "rounded px-3 py-1.5 font-medium",
            t.key === current ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground",
          )}
        >
          {t.label}
        </Link>
      ))}
    </div>
  );
}

const APPT_STATUS: Record<AppointmentStatus, { label: string; className: string }> = {
  pending: { label: "Pendiente", className: "bg-warning/10 text-warning" },
  confirmed: { label: "Confirmada", className: "bg-primary/10 text-primary" },
  completed: { label: "Atendida", className: "bg-success/10 text-success" },
  cancelled: { label: "Cancelada", className: "bg-muted text-muted-foreground line-through" },
  no_show: { label: "No vino", className: "bg-accent/10 text-accent" },
};

export function AppointmentStatusBadge({ status }: { status: AppointmentStatus }) {
  const s = APPT_STATUS[status];
  return <span className={cn("rounded px-2 py-0.5 text-xs font-semibold", s.className)}>{s.label}</span>;
}

const TIME_OFF_STATUS: Record<TimeOffStatus, { label: string; className: string }> = {
  pending: { label: "Pendiente", className: "bg-warning/10 text-warning" },
  approved: { label: "Aprobada", className: "bg-success/10 text-success" },
  rejected: { label: "Rechazada", className: "bg-accent/10 text-accent" },
};

export function TimeOffStatusBadge({ status }: { status: TimeOffStatus }) {
  const s = TIME_OFF_STATUS[status];
  return <span className={cn("rounded px-2 py-0.5 text-xs font-semibold", s.className)}>{s.label}</span>;
}

export function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="border-l-2 border-primary/20 pl-4">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="font-display text-4xl font-extrabold tabular-nums text-primary">{value}</p>
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

export function EmptyState({ title, children }: { title: string; children?: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-dashed border-border px-6 py-10 text-center">
      <p className="font-medium">{title}</p>
      {children && <div className="mt-2 text-sm text-muted-foreground">{children}</div>}
    </div>
  );
}

export const inputClass =
  "h-10 w-full rounded-md border border-input bg-card px-3 text-sm outline-none transition-colors focus:border-primary focus:ring-1 focus:ring-primary disabled:opacity-60";

export const buttonClass = {
  primary:
    "inline-flex h-10 items-center justify-center gap-2 rounded-md bg-primary px-4 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50",
  secondary:
    "inline-flex h-10 items-center justify-center gap-2 rounded-md border border-border bg-card px-4 text-sm font-medium transition-colors hover:bg-muted disabled:opacity-50",
  danger:
    "inline-flex h-10 items-center justify-center gap-2 rounded-md bg-accent px-4 text-sm font-semibold text-accent-foreground transition-colors hover:bg-accent/90 disabled:opacity-50",
  small:
    "inline-flex h-8 items-center justify-center gap-1.5 rounded-md border border-border bg-card px-2.5 text-xs font-medium transition-colors hover:bg-muted disabled:opacity-50",
};

export function Field({
  label,
  hint,
  error,
  children,
  className,
}: {
  label: string;
  hint?: string;
  error?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <label className={cn("grid gap-1.5", className)}>
      <span className="text-sm font-medium">{label}</span>
      {children}
      {error ? (
        <span className="text-sm text-destructive">{error}</span>
      ) : (
        hint && <span className="text-xs text-muted-foreground">{hint}</span>
      )}
    </label>
  );
}
