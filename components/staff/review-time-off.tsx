"use client";

import { useState, useTransition } from "react";
import { reviewTimeOff } from "@/app/(staff)/actions";
import { buttonClass, inputClass } from "./ui";

export function ReviewTimeOff({ id }: { id: string }) {
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const review = (approve: boolean) =>
    start(async () => {
      const r = await reviewTimeOff({ id, approve, note });
      if (!r.ok) setError(r.message);
    });

  return (
    <div className="grid content-start gap-2">
      <input
        className={inputClass}
        placeholder="Nota para el barbero (opcional)"
        value={note}
        onChange={(e) => setNote(e.target.value)}
      />
      <div className="grid grid-cols-2 gap-2">
        <button className={buttonClass.secondary} disabled={pending} onClick={() => review(false)}>
          Rechazar
        </button>
        <button className={buttonClass.primary} disabled={pending} onClick={() => review(true)}>
          Aprobar
        </button>
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}
