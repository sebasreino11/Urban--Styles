import { NextResponse } from "next/server";
import { createAnonClient } from "@/lib/supabase/anon";

/** GET /api/health — comprueba que el Worker y Supabase respondan. */
export async function GET() {
  const started = Date.now();
  const { error } = await createAnonClient().from("barbershops").select("id").limit(1);
  return NextResponse.json(
    { ok: !error, db: error ? "error" : "ok", ms: Date.now() - started },
    { status: error ? 503 : 200, headers: { "Cache-Control": "no-store" } },
  );
}
