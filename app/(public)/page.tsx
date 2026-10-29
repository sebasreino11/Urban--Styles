import type { Metadata } from "next";
import { headers } from "next/headers";
import Link from "next/link";
import { MapPin, Phone } from "lucide-react";
import { BookingTicket, Monogram } from "@/components/booking/booking-ticket";
import { Logo, ScissorsRule } from "@/components/brand";
import { getPublicCatalog, resolveShop } from "@/lib/domain/shop";
import type { BusinessHours } from "@/lib/domain/types";
import { formatCOP, formatDuration, formatHour, localDate, weekdayOf, WEEKDAYS } from "@/lib/format";
import { cn } from "@/lib/utils";

async function getShop() {
  const h = await headers();
  return resolveShop(h.get("x-forwarded-host") ?? h.get("host"));
}

export async function generateMetadata(): Promise<Metadata> {
  const shop = await getShop();
  return {
    title: { absolute: `${shop.name} · Reserva tu cita` },
    description: shop.tagline ?? `Reserva en línea en ${shop.name}.`,
  };
}

/** Lunes primero, como se lee un horario en Colombia. */
const WEEK_ORDER = [1, 2, 3, 4, 5, 6, 0];

function hoursFor(hours: BusinessHours[], weekday: number) {
  return hours.filter((h) => h.weekday === weekday);
}

function rangeLabel(ranges: BusinessHours[]) {
  return ranges.map((r) => `${formatHour(r.opens_at)} – ${formatHour(r.closes_at)}`).join(", ");
}

export default async function ShopPage({
  searchParams,
}: {
  searchParams: Promise<{ servicio?: string }>;
}) {
  const [shop, { servicio }] = await Promise.all([getShop(), searchParams]);
  const { services, barbers, hours } = await getPublicCatalog(shop.id);

  const today = weekdayOf(localDate(new Date(), shop.timezone));
  const todayRanges = hoursFor(hours, today);
  const [first, ...rest] = shop.name.split(" ");
  const nameRest = rest.join(" ");

  return (
    <div className="min-h-svh">
      {/* Banda de carbón con filete dorado; la sombra la despega del crema. */}
      <header className="relative z-10 border-b border-gold/70 bg-gradient-to-b from-[hsl(30_17%_19%)] to-primary text-primary-foreground shadow-[0_14px_32px_-14px_hsl(var(--primary)/0.6)]">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3 sm:px-6 sm:py-4">
          <Link href="/" className="flex min-w-0 items-center gap-3">
            <Logo size={72} className="size-14 ring-1 ring-gold/70 sm:size-[72px]" />
            <span className="truncate font-display text-xl font-extrabold uppercase tracking-wide sm:text-2xl">{shop.name}</span>
          </Link>
          <nav className="flex items-center gap-6 text-sm">
            <a href="#precios" className="hidden text-primary-foreground/80 hover:text-gold-light sm:inline">Precios</a>
            <a href="#equipo" className="hidden text-primary-foreground/80 hover:text-gold-light sm:inline">Equipo</a>
            <a href="#visitanos" className="hidden text-primary-foreground/80 hover:text-gold-light sm:inline">Cómo llegar</a>
            <a href="#reservar" className="rounded-lg bg-gold px-4 py-2 font-semibold text-primary transition-colors hover:bg-gold-light">
              Reservar
            </a>
          </nav>
        </div>
      </header>

      <main>
        {/* Hero: nombre de la casa + tiquete de turno, con el medallón como marca de agua.
            overflow-x-clip (no hidden) para no romper el sticky del tiquete. */}
        <div className="relative overflow-x-clip">
          {/* eslint-disable-next-line @next/next/no-img-element -- decorativa, sin optimizador */}
          <img
            src="/brand/logo.png"
            alt=""
            aria-hidden
            className="pointer-events-none absolute -right-48 top-6 w-[34rem] max-w-none select-none opacity-[0.06] mix-blend-multiply grayscale lg:left-[calc(50%-14rem)] lg:right-auto lg:top-10 lg:w-[40rem] lg:opacity-[0.09]"
          />
          <section className="relative mx-auto grid max-w-6xl gap-10 px-4 pb-16 pt-8 sm:px-6 lg:grid-cols-[1.15fr_0.85fr] lg:gap-14 lg:pb-24 lg:pt-14">
            <div className="flex flex-col">
              <h1 className="font-display font-black uppercase leading-[0.82] text-primary">
                <span className="block text-[clamp(5rem,19vw,11.5rem)]">{first}</span>
                {nameRest && <span className="block text-[clamp(5rem,19vw,11.5rem)]">{nameRest}</span>}
              </h1>
              <ScissorsRule className="mt-7" />
              {shop.tagline && <p className="mt-6 max-w-md text-xl leading-snug">{shop.tagline}</p>}

              <dl className="mt-8 grid max-w-md gap-3 text-sm">
                <div className="flex gap-3">
                  <dt className="sr-only">Hoy</dt>
                  <span className={cn("mt-1.5 size-2 shrink-0 rounded-full", todayRanges.length ? "bg-success" : "bg-destructive")} aria-hidden />
                  <dd>
                    {todayRanges.length ? (
                      <>Hoy abrimos <span className="font-medium">{rangeLabel(todayRanges)}</span></>
                    ) : (
                      "Hoy no abrimos. Puedes reservar para otro día."
                    )}
                  </dd>
                </div>
                {shop.address && (
                  <div className="flex gap-3">
                    <dt className="sr-only">Dirección</dt>
                    <MapPin className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
                    <dd>{shop.address}{shop.city && `, ${shop.city}`}</dd>
                  </div>
                )}
              </dl>
            </div>

            <div className="lg:sticky lg:top-6 lg:self-start">
              <BookingTicket
                key={servicio ?? "none"}
                services={services}
                barbers={barbers}
                timezone={shop.timezone}
                horizonDays={shop.booking_horizon_days}
                initialServiceId={servicio}
              />
            </div>
          </section>
        </div>

        {/* Tablero de precios */}
        <section id="precios" className="scroll-mt-4 bg-primary text-primary-foreground">
          <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 lg:py-24">
            <div className="grid gap-10 lg:grid-cols-[0.8fr_1.2fr]">
              <div>
                <h2 className="font-display text-6xl font-black uppercase leading-none text-gold-light">Precios</h2>
                <ScissorsRule className="mt-5 text-gold" />
                <p className="mt-5 max-w-xs text-primary-foreground/75">
                  Precios en pesos colombianos. Elige un servicio para ver los horarios disponibles.
                </p>
              </div>
              <ul className="grid min-w-0 gap-1">
                {services.map((s) => (
                  <li key={s.id}>
                    <Link
                      href={`/?servicio=${s.id}#reservar`}
                      className="group -mx-3 block rounded-lg px-3 py-3 transition-colors hover:bg-primary-foreground/[0.06]"
                    >
                      <div className="flex items-baseline gap-3">
                        <span className="min-w-0 font-display text-2xl font-extrabold uppercase tracking-wide [overflow-wrap:anywhere] sm:text-3xl">{s.name}</span>
                        <span className="leader h-4 min-w-6 flex-1" aria-hidden />
                        <span className="shrink-0 whitespace-nowrap font-display text-2xl font-extrabold tabular-nums text-gold-light sm:text-3xl">{formatCOP(s.price_cop)}</span>
                      </div>
                      <p className="mt-0.5 text-sm text-primary-foreground/70">
                        {formatDuration(s.duration_min)}
                        {s.description && <> — {s.description}</>}
                      </p>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        {/* Equipo */}
        <section id="equipo" className="mx-auto max-w-6xl scroll-mt-4 px-4 py-16 sm:px-6 lg:py-24">
          <h2 className="font-display text-5xl font-black uppercase leading-none text-primary">Quién te atiende</h2>
          <ScissorsRule className="mt-5" />
          <ul className="mt-10 grid gap-x-10 gap-y-8 sm:grid-cols-2 lg:grid-cols-3">
            {barbers.map((b) => (
              <li key={b.id} className="flex gap-4">
                {b.photo_url ? (
                  // eslint-disable-next-line @next/next/no-img-element -- URLs externas arbitrarias; sin optimizador de imágenes (costo cero)
                  <img src={b.photo_url} alt="" className="size-16 shrink-0 rounded-full object-cover ring-2 ring-gold ring-offset-2 ring-offset-background" />
                ) : (
                  <Monogram name={b.display_name} className="size-16 text-2xl" />
                )}
                <div>
                  <p className="font-display text-2xl font-extrabold uppercase tracking-wide">{b.display_name}</p>
                  {b.bio && <p className="mt-1 text-muted-foreground">{b.bio}</p>}
                </div>
              </li>
            ))}
          </ul>
        </section>

        {/* Nosotros + visita */}
        <section id="visitanos" className="scroll-mt-4 border-t border-border">
          <div className="mx-auto grid max-w-6xl gap-12 px-4 py-16 sm:px-6 lg:grid-cols-2 lg:py-24">
            <div>
              <h2 className="font-display text-5xl font-black uppercase leading-none text-primary">La casa</h2>
              <ScissorsRule className="mt-5" />
              {shop.about && <p className="mt-6 max-w-prose text-lg leading-relaxed">{shop.about}</p>}
              <div className="mt-8 grid gap-2 text-sm">
                {shop.address && (
                  <p className="flex items-center gap-2">
                    <MapPin className="size-4 text-muted-foreground" aria-hidden />
                    {shop.maps_url ? (
                      <a href={shop.maps_url} target="_blank" rel="noreferrer" className="underline underline-offset-4">
                        {shop.address}{shop.city && `, ${shop.city}`}
                      </a>
                    ) : (
                      shop.address
                    )}
                  </p>
                )}
                {shop.phone && (
                  <p className="flex items-center gap-2">
                    <Phone className="size-4 text-muted-foreground" aria-hidden />
                    <a href={`tel:${shop.phone.replace(/\s/g, "")}`} className="underline underline-offset-4">{shop.phone}</a>
                  </p>
                )}
                {shop.whatsapp && (
                  <p>
                    <a
                      href={`https://wa.me/${shop.whatsapp.replace(/\D/g, "")}`}
                      target="_blank"
                      rel="noreferrer"
                      className="underline underline-offset-4"
                    >
                      Escríbenos por WhatsApp
                    </a>
                  </p>
                )}
                {shop.instagram_url && (
                  <p>
                    <a href={shop.instagram_url} target="_blank" rel="noreferrer" className="underline underline-offset-4">
                      Instagram
                    </a>
                  </p>
                )}
              </div>
            </div>

            <div>
              <h3 className="font-display text-3xl font-extrabold uppercase text-primary">Horario</h3>
              <table className="mt-4 w-full max-w-md text-left">
                <tbody>
                  {WEEK_ORDER.map((d) => {
                    const ranges = hoursFor(hours, d);
                    return (
                      <tr key={d} className={cn("border-b border-border", d === today && "font-semibold")}>
                        <th scope="row" className="py-2.5 pr-4 font-[inherit]">
                          {WEEKDAYS[d]}
                          {d === today && <span className="ml-2 text-xs font-medium text-gold-ink">hoy</span>}
                        </th>
                        <td className="py-2.5 text-right tabular-nums">
                          {ranges.length ? rangeLabel(ranges) : <span className="text-muted-foreground">Cerrado</span>}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      </main>

      <footer className="relative overflow-hidden border-t-4 border-gold bg-primary text-primary-foreground">
        {/* eslint-disable-next-line @next/next/no-img-element -- decorativa, sin optimizador */}
        <img
          src="/brand/logo-gold.png"
          alt=""
          aria-hidden
          className="pointer-events-none absolute -right-28 -top-20 w-[26rem] max-w-none select-none opacity-[0.09] sm:right-0"
        />
        <div className="relative mx-auto grid max-w-6xl gap-6 px-4 py-12 sm:grid-cols-[auto_1fr_auto] sm:items-center sm:gap-8 sm:px-6">
          <Logo size={112} className="size-24 sm:size-28" />
          <div>
            <p className="font-display text-2xl font-extrabold uppercase tracking-wide text-gold-light">{shop.name}</p>
            {shop.address && (
              <p className="mt-1 text-sm text-primary-foreground/70">
                {shop.address}{shop.city && `, ${shop.city}`}
              </p>
            )}
          </div>
          <div className="grid gap-1 text-sm text-primary-foreground/70 sm:text-right">
            <p>© {new Date().getFullYear()} {shop.name}</p>
            <Link href="/auth/login" className="underline-offset-4 hover:text-gold-light hover:underline">
              Acceso para el equipo
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
