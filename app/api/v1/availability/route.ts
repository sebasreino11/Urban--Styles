import { NextResponse, type NextRequest } from "next/server";
import { apiError } from "@/lib/api";
import { getAvailableDays, getAvailableSlots } from "@/lib/domain/booking";
import { resolveShop } from "@/lib/domain/shop";

/**
 * GET /api/v1/availability?serviceId=…&date=YYYY-MM-DD[&barberId=…]
 *   → horarios libres de ese día.
 * GET /api/v1/availability?serviceId=…&from=YYYY-MM-DD&to=YYYY-MM-DD[&barberId=…]
 *   → días con al menos un horario libre.
 */
export async function GET(request: NextRequest) {
  try {
    const p = request.nextUrl.searchParams;
    const shop = await resolveShop(request.headers.get("host"));
    const serviceId = p.get("serviceId") ?? "";
    const barberId = p.get("barberId") || null;

    if (p.get("from") || p.get("to")) {
      const days = await getAvailableDays(shop.id, {
        serviceId,
        barberId,
        from: p.get("from") ?? "",
        to: p.get("to") ?? "",
      });
      return NextResponse.json({ days });
    }

    const slots = await getAvailableSlots(shop.id, { serviceId, barberId, date: p.get("date") ?? "" });
    return NextResponse.json({ timezone: shop.timezone, slots });
  } catch (e) {
    return apiError(e);
  }
}
