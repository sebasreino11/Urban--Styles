"use client";

import { useState, useTransition } from "react";
import { withdrawTimeOff } from "@/app/(staff)/actions";
import type { TimeOffRequest } from "@/lib/domain/types";
import { formatDateTime } from "@/lib/format";
import { buttonClass, EmptyState, TimeOffStatusBadge } from "./ui";

export function TimeOffList({
  requests,
  timezone,
  canWithdraw = false,
}: {
  requests: TimeOffRequest[];
  timezone: string;
  canWithdraw?: boolean;
}) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  if (!requests.length) return <EmptyState title="No hay solicitudes" />;

  return (
    <ul className="divide-y divide-border border-y border-border">
      {requests.map((r) => (
        <li key={r.id} className="flex flex-col gap-2 py-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <TimeOffStatusBadge status={r.status} />
              {r.barber && <span className="text-sm font-medium">{r.barber.display_name}</span>}
            </div>
            <p className="mt-1 text-sm capitalize">
              {formatDateTime(r.starts_at, timezone)} → {formatDateTime(r.ends_at, timezone)}
            </p>
            <p className="text-sm text-muted-foreground">{r.reason}</p>
            {r.review_note && <p className="mt-1 text-xs text-muted-foreground">Nota del admin: {r.review_note}</p>}
          </div>
          {canWithdraw && r.status === "pending" && (
            <button
              className={buttonClass.small}
              disabled={pending}
              onClick={() =>
                start(async () => {
                  const res = await withdrawTimeOff(r.id);
                  setError(res.ok ? null : res.message);
                })
              }
            >
              Retirar
            </button>
          )}
        </li>
      ))}
      {error && <li className="py-2 text-sm text-destructive">{error}</li>}
    </ul>
  );
}
