"use client";

import { useState, useTransition } from "react";
import { updateAppointmentStatus } from "@/app/(staff)/actions";
import type { AppointmentStatus } from "@/lib/domain/types";
import { buttonClass, inputClass } from "./ui";

/** Cerrar una cita (atendida / no vino) o cancelarla con motivo. */
export function AppointmentActions({
  id,
  status,
  started,
}: {
  id: string;
  status: AppointmentStatus;
  started: boolean;
}) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [cancelling, setCancelling] = useState(false);
  const [reason, setReason] = useState("");

  const act = (next: "completed" | "no_show" | "cancelled") =>
    start(async () => {
      setError(null);
      const r = await updateAppointmentStatus({ id, status: next, reason });
      if (!r.ok) setError(r.message);
      else setCancelling(false);
    });

  const canClose = started && (status === "confirmed" || status === "pending");
  const canFix = status === "completed" || status === "no_show";
  const canCancel = !started && (status === "confirmed" || status === "pending");
  if (!canClose && !canFix && !canCancel) return null;

  if (cancelling) {
    return (
      <div className="grid gap-2 sm:w-64">
        <input
          className={inputClass}
          placeholder="Motivo (lo verá el admin)"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          autoFocus
        />
        <div className="flex gap-2">
          <button className={buttonClass.small} onClick={() => setCancelling(false)} disabled={pending}>
            Conservar
          </button>
          <button
            className={`${buttonClass.small} border-destructive text-destructive`}
            onClick={() => act("cancelled")}
            disabled={pending}
          >
            Cancelar cita
          </button>
        </div>
        {error && <p className="text-xs text-destructive">{error}</p>}
      </div>
    );
  }

  return (
    <div className="flex flex-wrap gap-2 sm:justify-end">
      {canClose && (
        <>
          <button className={buttonClass.small} onClick={() => act("completed")} disabled={pending}>
            Atendida
          </button>
          <button className={buttonClass.small} onClick={() => act("no_show")} disabled={pending}>
            No vino
          </button>
        </>
      )}
      {canFix && (
        <button
          className={buttonClass.small}
          onClick={() => act(status === "completed" ? "no_show" : "completed")}
          disabled={pending}
        >
          {status === "completed" ? "Marcar como no vino" : "Marcar como atendida"}
        </button>
      )}
      {canCancel && (
        <button className={buttonClass.small} onClick={() => setCancelling(true)} disabled={pending}>
          Cancelar
        </button>
      )}
      {error && <p className="w-full text-xs text-destructive sm:text-right">{error}</p>}
    </div>
  );
}
