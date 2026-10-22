"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { cancelBooking } from "@/app/(public)/actions";

export function CancelButton({ token }: { token: string }) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  if (!confirming) {
    return (
      <button
        type="button"
        onClick={() => setConfirming(true)}
        className="text-sm font-medium text-destructive underline underline-offset-4"
      >
        Cancelar esta cita
      </button>
    );
  }

  return (
    <div className="grid gap-3">
      <p className="text-sm">El horario quedará libre para otra persona. ¿Cancelar la cita?</p>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={pending}
          onClick={() =>
            start(async () => {
              const r = await cancelBooking(token);
              if (r.ok) router.refresh();
              else setError(r.message);
            })
          }
          className="h-10 rounded-lg bg-destructive px-4 text-sm font-semibold text-destructive-foreground shadow-soft disabled:opacity-50"
        >
          {pending ? "Cancelando" : "Sí, cancelar la cita"}
        </button>
        <button
          type="button"
          onClick={() => setConfirming(false)}
          className="h-10 rounded-lg border border-input px-4 text-sm font-medium transition-colors hover:bg-secondary"
        >
          Conservar la cita
        </button>
      </div>
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
    </div>
  );
}
