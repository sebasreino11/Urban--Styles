import { formatCOP, formatDate, formatTime } from "@/lib/format";

/**
 * Plantillas de correo en HTML plano (sin dependencias: el bundle del Worker
 * tiene un límite de 3 MiB en el plan gratuito). Tablas + estilos inline
 * para que se vean bien en Gmail, Outlook y móviles.
 */

const esc = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

interface ConfirmationData {
  shopName: string;
  shopAddress: string | null;
  shopPhone: string | null;
  customerName: string;
  serviceName: string;
  barberName: string;
  startsAt: string;
  timezone: string;
  priceCop: number;
  manageUrl: string;
  cancelNoticeMin: number;
}

function row(label: string, value: string) {
  return `<tr>
    <td style="padding:10px 0;border-bottom:1px solid #CDD3CC;color:#5E6B64;font-size:13px;">${label}</td>
    <td style="padding:10px 0;border-bottom:1px solid #CDD3CC;color:#1E2422;font-size:15px;text-align:right">${value}</td>
  </tr>`;
}

export function bookingConfirmationEmail(d: ConfirmationData) {
  const date = formatDate(d.startsAt, d.timezone);
  const time = formatTime(d.startsAt, d.timezone);
  const notice =
    d.cancelNoticeMin >= 60 ? `${Math.round(d.cancelNoticeMin / 60)} h` : `${d.cancelNoticeMin} min`;
  const firstName = d.customerName.split(" ")[0];

  const subject = `Tu cita en ${d.shopName}: ${date}, ${time}`;
  const html = `<!doctype html>
<html lang="es"><body style="margin:0;background:#EEF0EB;font-family:Georgia,'Times New Roman',serif">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#EEF0EB;padding:32px 12px">
<tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#FAFBF8;border:1px solid #CDD3CC">
  <tr><td style="padding:28px 32px 8px;color:#9B2335;font-size:13px;font-weight:bold;font-family:Arial,sans-serif">${esc(d.shopName)}</td></tr>
  <tr><td style="padding:0 32px 8px;color:#16392E;font-size:28px;line-height:1.2">Te esperamos, ${esc(firstName)}.</td></tr>
  <tr><td style="padding:0 32px 20px;color:#3B4541;font-size:15px;line-height:1.6;font-family:Arial,sans-serif">Tu cita quedó confirmada. Aquí está el resumen:</td></tr>
  <tr><td style="padding:0 32px">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="font-family:Arial,sans-serif">
      ${row("Servicio", esc(d.serviceName))}
      ${row("Barbero", esc(d.barberName))}
      ${row("Fecha", esc(date))}
      ${row("Hora", esc(time))}
      ${row("Valor", esc(formatCOP(d.priceCop)))}
      ${d.shopAddress ? row("Dirección", esc(d.shopAddress)) : ""}
    </table>
  </td></tr>
  <tr><td style="padding:28px 32px 8px;font-family:Arial,sans-serif">
    <a href="${esc(d.manageUrl)}" style="display:inline-block;background:#16392E;color:#EEF0EB;text-decoration:none;padding:12px 22px;font-size:14px;font-weight:bold;letter-spacing:.04em">Ver, reprogramar o cancelar mi cita</a>
  </td></tr>
  <tr><td style="padding:8px 32px 28px;color:#5E6B64;font-size:12px;line-height:1.6;font-family:Arial,sans-serif">
    Puedes reprogramar o cancelar en línea hasta ${notice} antes.${d.shopPhone ? ` Para cambios de último momento llama al ${esc(d.shopPhone)}.` : ""}
  </td></tr>
</table>
</td></tr></table>
</body></html>`;

  const text = [
    `Te esperamos, ${firstName}. Tu cita en ${d.shopName} quedó confirmada.`,
    ``,
    `Servicio: ${d.serviceName}`,
    `Barbero: ${d.barberName}`,
    `Fecha: ${date}`,
    `Hora: ${time}`,
    `Valor: ${formatCOP(d.priceCop)}`,
    ...(d.shopAddress ? [`Dirección: ${d.shopAddress}`] : []),
    ``,
    `Ver, reprogramar o cancelar: ${d.manageUrl}`,
  ].join("\n");

  return { subject, html, text };
}

interface RescheduledData extends ConfirmationData {
  previousStartsAt: string;
}

export function bookingRescheduledEmail(d: RescheduledData) {
  const date = formatDate(d.startsAt, d.timezone);
  const time = formatTime(d.startsAt, d.timezone);
  const before = `${formatDate(d.previousStartsAt, d.timezone)}, ${formatTime(d.previousStartsAt, d.timezone)}`;
  const notice =
    d.cancelNoticeMin >= 60 ? `${Math.round(d.cancelNoticeMin / 60)} h` : `${d.cancelNoticeMin} min`;
  const firstName = d.customerName.split(" ")[0];

  const subject = `Cita reprogramada en ${d.shopName}: ${date}, ${time}`;
  const html = `<!doctype html>
<html lang="es"><body style="margin:0;background:#EEF0EB;font-family:Georgia,'Times New Roman',serif">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#EEF0EB;padding:32px 12px">
<tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#FAFBF8;border:1px solid #CDD3CC">
  <tr><td style="padding:28px 32px 8px;color:#9B2335;font-size:13px;font-weight:bold;font-family:Arial,sans-serif">${esc(d.shopName)}</td></tr>
  <tr><td style="padding:0 32px 8px;color:#16392E;font-size:28px;line-height:1.2">Cambiamos tu cita, ${esc(firstName)}.</td></tr>
  <tr><td style="padding:0 32px 20px;color:#3B4541;font-size:15px;line-height:1.6;font-family:Arial,sans-serif">Tu cita quedó reprogramada. Este es el nuevo horario:</td></tr>
  <tr><td style="padding:0 32px">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="font-family:Arial,sans-serif">
      ${row("Antes", esc(before))}
      ${row("Servicio", esc(d.serviceName))}
      ${row("Barbero", esc(d.barberName))}
      ${row("Fecha", esc(date))}
      ${row("Hora", esc(time))}
      ${row("Valor", esc(formatCOP(d.priceCop)))}
      ${d.shopAddress ? row("Dirección", esc(d.shopAddress)) : ""}
    </table>
  </td></tr>
  <tr><td style="padding:28px 32px 8px;font-family:Arial,sans-serif">
    <a href="${esc(d.manageUrl)}" style="display:inline-block;background:#16392E;color:#EEF0EB;text-decoration:none;padding:12px 22px;font-size:14px;font-weight:bold;letter-spacing:.04em">Ver, reprogramar o cancelar mi cita</a>
  </td></tr>
  <tr><td style="padding:8px 32px 28px;color:#5E6B64;font-size:12px;line-height:1.6;font-family:Arial,sans-serif">
    Puedes reprogramar o cancelar en línea hasta ${notice} antes.${d.shopPhone ? ` Para cambios de último momento llama al ${esc(d.shopPhone)}.` : ""}
  </td></tr>
</table>
</td></tr></table>
</body></html>`;

  const text = [
    `Cambiamos tu cita, ${firstName}. Tu cita en ${d.shopName} quedó reprogramada.`,
    ``,
    `Antes: ${before}`,
    `Servicio: ${d.serviceName}`,
    `Barbero: ${d.barberName}`,
    `Fecha: ${date}`,
    `Hora: ${time}`,
    `Valor: ${formatCOP(d.priceCop)}`,
    ...(d.shopAddress ? [`Dirección: ${d.shopAddress}`] : []),
    ``,
    `Ver, reprogramar o cancelar: ${d.manageUrl}`,
  ].join("\n");

  return { subject, html, text };
}
