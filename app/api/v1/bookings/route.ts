import { after, NextResponse, type NextRequest } from "next/server";
import { apiError, requireIntegrationKey } from "@/lib/api";
import { createBooking } from "@/lib/domain/booking";
import { notifyBookingCreated } from "@/lib/domain/notifications";
import { resolveShop } from "@/lib/domain/shop";
import { bookingInputSchema } from "@/lib/validation/booking";

/**
 * POST /api/v1/bookings — crea una cita desde una integración.
 * Header: Authorization: Bearer <INTEGRATION_API_KEY>
 * Body:   { serviceId, barberId|null, startsAt (ISO), name, email, phone?, source? }
 * Misma lógica y mismas reglas que el formulario web.
 */
export async function POST(request: NextRequest) {
  try {
    requireIntegrationKey(request);
    const body = (await request.json()) as Record<string, unknown>;
    const input = bookingInputSchema.parse(body);
    const source = body.source === "whatsapp" ? "whatsapp" : "api";

    const shop = await resolveShop(request.headers.get("host"));
    const booking = await createBooking(shop.id, input, source);
    after(() => notifyBookingCreated(booking));

    const { cancel_token, ...rest } = booking;
    return NextResponse.json(
      { booking: rest, manageUrl: `${request.nextUrl.origin}/cita/${cancel_token}` },
      { status: 201 },
    );
  } catch (e) {
    return apiError(e);
  }
}
