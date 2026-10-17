import type { Metadata } from "next";
import { HookUrlForm } from "@/components/staff/hook-url-form";
import { PageHeader } from "@/components/staff/ui";
import { getOwnHookUrl, requireStaff } from "@/lib/domain/staff";

export const metadata: Metadata = { title: "Avisos al celular" };

export default async function NotificationsPage() {
  const ctx = await requireStaff("barber");
  const hookUrl = await getOwnHookUrl(ctx.barberId!);

  return (
    <>
      <PageHeader
        title="Avisos al celular"
        description="Recibe una notificación en tu teléfono cada vez que un cliente reserve o cancele contigo."
      />
      <div className="grid gap-10 lg:grid-cols-2">
        <ol className="grid list-decimal gap-3 pl-5 text-sm leading-relaxed marker:font-semibold marker:text-primary">
          <li>
            Instala la app <span className="font-medium">Hook.Notifier</span> (Android o iPhone) y crea tu cuenta
            gratuita.
          </li>
          <li>En la app, copia tu URL personal. Se ve así: https://hooknotifier.com/1234567890/palabra-clave</li>
          <li>Pégala aquí abajo, guarda y toca “Enviar prueba”.</li>
        </ol>
        <HookUrlForm initialUrl={hookUrl ?? ""} />
      </div>
    </>
  );
}
