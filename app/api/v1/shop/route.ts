import { NextResponse, type NextRequest } from "next/server";
import { apiError } from "@/lib/api";
import { getPublicCatalog, resolveShop } from "@/lib/domain/shop";

/** GET /api/v1/shop — perfil público, servicios, barberos y horario. */
export async function GET(request: NextRequest) {
  try {
    const shop = await resolveShop(request.headers.get("host"));
    const catalog = await getPublicCatalog(shop.id);
    return NextResponse.json({ shop, ...catalog });
  } catch (e) {
    return apiError(e);
  }
}
