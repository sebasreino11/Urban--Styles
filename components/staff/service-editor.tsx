"use client";

import { useState, useTransition } from "react";
import { saveService } from "@/app/(staff)/actions";
import type { Service } from "@/lib/domain/types";
import { formatCOP, formatDuration } from "@/lib/format";
import { cn } from "@/lib/utils";
import { buttonClass, Field, inputClass } from "./ui";

/** Fila editable de servicio. Sin `service` es el formulario de "nuevo servicio". */
export function ServiceEditor({ service, nextSortOrder = 0 }: { service?: Service; nextSortOrder?: number }) {
  const isNew = !service;
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(service?.name ?? "");
  const [description, setDescription] = useState(service?.description ?? "");
  const [duration, setDuration] = useState(String(service?.duration_min ?? 30));
  const [price, setPrice] = useState(String(service?.price_cop ?? ""));
  const [active, setActive] = useState(service?.active ?? true);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const save = (overrides?: { active?: boolean }) =>
    start(async () => {
      setError(null);
      const r = await saveService({
        id: service?.id,
        name,
        description,
        durationMin: Number(duration),
        priceCop: Number(price.replace(/\D/g, "")),
        active: overrides?.active ?? active,
        sortOrder: service?.sort_order ?? nextSortOrder,
      });
      if (!r.ok) return setError(r.message);
      if (overrides?.active !== undefined) setActive(overrides.active);
      setEditing(false);
      if (isNew) {
        setName("");
        setDescription("");
        setPrice("");
      }
    });

  if (!editing) {
    return isNew ? (
      <button className={cn(buttonClass.secondary, "justify-self-start")} onClick={() => setEditing(true)}>
        Agregar servicio
      </button>
    ) : (
      <div className={cn("flex flex-wrap items-center gap-4 rounded-lg border border-border bg-card px-4 py-3", !active && "opacity-60")}>
        <div className="min-w-0 flex-1">
          <p className="font-semibold">
            {service.name} {!active && <span className="ml-1 text-xs font-normal text-muted-foreground">Oculto</span>}
          </p>
          {service.description && <p className="truncate text-sm text-muted-foreground">{service.description}</p>}
        </div>
        <p className="w-20 text-sm tabular-nums text-muted-foreground">{formatDuration(service.duration_min)}</p>
        <p className="w-24 text-right font-semibold tabular-nums">{formatCOP(service.price_cop)}</p>
        <div className="flex gap-2">
          <button className={buttonClass.small} onClick={() => setEditing(true)}>Editar</button>
          <button className={buttonClass.small} disabled={pending} onClick={() => save({ active: !active })}>
            {active ? "Ocultar" : "Mostrar"}
          </button>
        </div>
        {error && <p className="w-full text-sm text-destructive">{error}</p>}
      </div>
    );
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        save();
      }}
      className="grid gap-4 rounded-lg border border-primary/40 bg-card p-4 sm:grid-cols-[2fr_1fr_1fr]"
    >
      <Field label="Nombre">
        <input className={inputClass} value={name} onChange={(e) => setName(e.target.value)} required minLength={2} autoFocus />
      </Field>
      <Field label="Duración (min)">
        <input className={inputClass} type="number" min={5} max={480} step={5} value={duration} onChange={(e) => setDuration(e.target.value)} required />
      </Field>
      <Field label="Precio (COP)">
        <input className={inputClass} inputMode="numeric" value={price} onChange={(e) => setPrice(e.target.value)} required placeholder="30000" />
      </Field>
      <Field label="Descripción corta" className="sm:col-span-3">
        <input className={inputClass} value={description} onChange={(e) => setDescription(e.target.value)} maxLength={200} />
      </Field>
      <div className="flex flex-wrap items-center gap-2 sm:col-span-3">
        <button className={buttonClass.primary} disabled={pending}>{isNew ? "Crear servicio" : "Guardar cambios"}</button>
        <button type="button" className={buttonClass.secondary} onClick={() => setEditing(false)}>Descartar</button>
        {error && <p className="text-sm text-destructive">{error}</p>}
      </div>
    </form>
  );
}
