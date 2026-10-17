"use client";

import { useState, useTransition } from "react";
import { saveShopProfile } from "@/app/(staff)/actions";
import { buttonClass, Field, inputClass } from "./ui";

interface ShopRow {
  name: string;
  tagline: string | null;
  about: string | null;
  phone: string | null;
  whatsapp: string | null;
  email: string | null;
  address: string | null;
  city: string | null;
  maps_url: string | null;
  instagram_url: string | null;
  slot_interval_min: number;
  booking_horizon_days: number;
  min_notice_min: number;
  cancel_notice_min: number;
}

export function ShopProfileForm({ shop }: { shop: ShopRow }) {
  const [form, setForm] = useState({
    name: shop.name,
    tagline: shop.tagline ?? "",
    about: shop.about ?? "",
    phone: shop.phone ?? "",
    whatsapp: shop.whatsapp ?? "",
    email: shop.email ?? "",
    address: shop.address ?? "",
    city: shop.city ?? "",
    mapsUrl: shop.maps_url ?? "",
    instagramUrl: shop.instagram_url ?? "",
    slotIntervalMin: String(shop.slot_interval_min),
    bookingHorizonDays: String(shop.booking_horizon_days),
    minNoticeMin: String(shop.min_notice_min),
    cancelNoticeMin: String(shop.cancel_notice_min),
  });
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();

  const bind = (key: keyof typeof form) => ({
    value: form[key],
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
      setForm((f) => ({ ...f, [key]: e.target.value })),
  });

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          const r = await saveShopProfile(form);
          setMessage(r.ok ? { ok: true, text: "Cambios guardados. Ya se ven en la página pública." } : { ok: false, text: r.message });
        });
      }}
      className="grid gap-8"
    >
      <section className="grid gap-4">
        <h2 className="font-display text-2xl font-extrabold uppercase text-primary">Página pública</h2>
        <Field label="Nombre"><input className={inputClass} {...bind("name")} required /></Field>
        <Field label="Frase corta" hint="Aparece debajo del nombre."><input className={inputClass} {...bind("tagline")} maxLength={140} /></Field>
        <Field label="Sobre la barbería"><textarea className={`${inputClass} h-32 py-2`} {...bind("about")} maxLength={1200} /></Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Dirección"><input className={inputClass} {...bind("address")} /></Field>
          <Field label="Ciudad"><input className={inputClass} {...bind("city")} /></Field>
          <Field label="Teléfono"><input className={inputClass} {...bind("phone")} /></Field>
          <Field label="WhatsApp"><input className={inputClass} {...bind("whatsapp")} placeholder="+57 300 000 0000" /></Field>
          <Field label="Correo"><input type="email" className={inputClass} {...bind("email")} /></Field>
          <Field label="Instagram (URL)"><input className={inputClass} {...bind("instagramUrl")} /></Field>
        </div>
        <Field label="Enlace de Google Maps"><input className={inputClass} {...bind("mapsUrl")} /></Field>
      </section>

      <section className="grid gap-4">
        <h2 className="font-display text-2xl font-extrabold uppercase text-primary">Reglas de reserva</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Intervalo entre horarios" hint="Cada cuánto se ofrece un horario.">
            <select className={inputClass} {...bind("slotIntervalMin")}>
              {[10, 15, 20, 30, 45, 60].map((m) => <option key={m} value={m}>{m} minutos</option>)}
            </select>
          </Field>
          <Field label="Reservas con hasta" hint="Días hacia adelante que se pueden reservar.">
            <select className={inputClass} {...bind("bookingHorizonDays")}>
              {[7, 14, 21, 30, 45, 60, 90].map((d) => <option key={d} value={d}>{d} días</option>)}
            </select>
          </Field>
          <Field label="Antelación mínima" hint="Evita reservas a último minuto.">
            <select className={inputClass} {...bind("minNoticeMin")}>
              {[0, 15, 30, 60, 120, 240, 1440].map((m) => <option key={m} value={m}>{m === 0 ? "Sin mínimo" : m < 60 ? `${m} minutos` : `${m / 60} h`}</option>)}
            </select>
          </Field>
          <Field label="Cancelación en línea hasta" hint="Antes de la cita.">
            <select className={inputClass} {...bind("cancelNoticeMin")}>
              {[0, 60, 120, 240, 720, 1440].map((m) => <option key={m} value={m}>{m === 0 ? "Hasta la hora de la cita" : `${m / 60} h antes`}</option>)}
            </select>
          </Field>
        </div>
      </section>

      <div className="flex items-center gap-3">
        <button className={buttonClass.primary} disabled={pending}>{pending ? "Guardando" : "Guardar cambios"}</button>
        {message && <p role="status" className={message.ok ? "text-sm text-success" : "text-sm text-destructive"}>{message.text}</p>}
      </div>
    </form>
  );
}
