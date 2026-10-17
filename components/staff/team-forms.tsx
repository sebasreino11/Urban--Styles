"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  createBarberProfile,
  inviteStaff,
  linkBarberAccount,
  saveBarberProfile,
  updateMemberRoles,
} from "@/app/(staff)/actions";
import type { Service } from "@/lib/domain/types";
import { buttonClass, Field, inputClass } from "./ui";

type Msg = { ok: boolean; text: string } | null;

function Status({ msg }: { msg: Msg }) {
  if (!msg) return null;
  return <p role="status" className={msg.ok ? "text-sm text-success" : "text-sm text-destructive"}>{msg.text}</p>;
}

export function InviteStaffForm() {
  const [email, setEmail] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [isBarber, setIsBarber] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [msg, setMsg] = useState<Msg>(null);
  const [pending, start] = useTransition();

  return (
    <form
      className="grid gap-4 rounded-lg border border-border bg-card p-5"
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          const r = await inviteStaff({ email, displayName, isBarber, isAdmin });
          if (r.ok) {
            setMsg({ ok: true, text: `Invitación enviada a ${email}. Debe abrir el correo para crear su contraseña.` });
            setEmail("");
            setDisplayName("");
          } else setMsg({ ok: false, text: r.message });
        });
      }}
    >
      <h2 className="font-display text-2xl font-extrabold uppercase text-primary">Invitar al equipo</h2>
      <Field label="Nombre"><input className={inputClass} value={displayName} onChange={(e) => setDisplayName(e.target.value)} required /></Field>
      <Field label="Correo"><input type="email" className={inputClass} value={email} onChange={(e) => setEmail(e.target.value)} required /></Field>
      <fieldset className="grid gap-2 text-sm">
        <legend className="mb-1 font-medium">Roles</legend>
        <label className="flex items-center gap-2"><input type="checkbox" className="size-4" checked={isBarber} onChange={(e) => setIsBarber(e.target.checked)} /> Barbero: atiende citas</label>
        <label className="flex items-center gap-2"><input type="checkbox" className="size-4" checked={isAdmin} onChange={(e) => setIsAdmin(e.target.checked)} /> Administrador: control total</label>
      </fieldset>
      <button className={buttonClass.primary} disabled={pending}>{pending ? "Enviando" : "Enviar invitación"}</button>
      <Status msg={msg} />
    </form>
  );
}

export function CreateBarberProfile() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [msg, setMsg] = useState<Msg>(null);
  const [pending, start] = useTransition();
  return (
    <form
      className="grid gap-3 rounded-lg border border-dashed border-border p-5"
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          const r = await createBarberProfile(name);
          if (r.ok) router.push(`/admin/barberos/${r.data.id}`);
          else setMsg({ ok: false, text: r.message });
        });
      }}
    >
      <p className="text-sm">
        <span className="font-medium">Barbero sin cuenta.</span>{" "}
        <span className="text-muted-foreground">Recibe reservas, pero no entra al sistema. Puedes invitarlo después.</span>
      </p>
      <div className="flex gap-2">
        <input className={inputClass} value={name} onChange={(e) => setName(e.target.value)} placeholder="Nombre" required minLength={2} />
        <button className={buttonClass.secondary} disabled={pending}>Crear</button>
      </div>
      <Status msg={msg} />
    </form>
  );
}

export function BarberProfileForm({
  barber,
  services,
  serviceIds,
}: {
  barber: { id: string; display_name: string; bio: string | null; photo_url: string | null; active: boolean };
  services: Service[];
  serviceIds: string[];
}) {
  const [displayName, setDisplayName] = useState(barber.display_name);
  const [bio, setBio] = useState(barber.bio ?? "");
  const [photoUrl, setPhotoUrl] = useState(barber.photo_url ?? "");
  const [active, setActive] = useState(barber.active);
  const [selected, setSelected] = useState(new Set(serviceIds));
  const [msg, setMsg] = useState<Msg>(null);
  const [pending, start] = useTransition();

  return (
    <form
      className="grid gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          const r = await saveBarberProfile({ id: barber.id, displayName, bio, photoUrl, active, serviceIds: [...selected] });
          setMsg(r.ok ? { ok: true, text: "Perfil guardado." } : { ok: false, text: r.message });
        });
      }}
    >
      <Field label="Nombre visible"><input className={inputClass} value={displayName} onChange={(e) => setDisplayName(e.target.value)} required /></Field>
      <Field label="Descripción corta"><textarea className={`${inputClass} h-20 py-2`} value={bio} onChange={(e) => setBio(e.target.value)} maxLength={300} /></Field>
      <Field label="Foto (URL)" hint="Opcional. Si no hay foto se muestran sus iniciales."><input className={inputClass} value={photoUrl} onChange={(e) => setPhotoUrl(e.target.value)} /></Field>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" className="size-4" checked={active} onChange={(e) => setActive(e.target.checked)} />
        Visible y reservable en la página pública
      </label>
      <fieldset className="grid gap-2 text-sm">
        <legend className="mb-1 font-medium">Servicios que realiza</legend>
        {services.map((s) => (
          <label key={s.id} className="flex items-center gap-2">
            <input
              type="checkbox"
              className="size-4"
              checked={selected.has(s.id)}
              onChange={(e) =>
                setSelected((cur) => {
                  const next = new Set(cur);
                  if (e.target.checked) next.add(s.id);
                  else next.delete(s.id);
                  return next;
                })
              }
            />
            {s.name}
            {!s.active && <span className="text-xs text-muted-foreground">(oculto)</span>}
          </label>
        ))}
      </fieldset>
      <div className="flex items-center gap-3">
        <button className={buttonClass.primary} disabled={pending}>{pending ? "Guardando" : "Guardar perfil"}</button>
        <Status msg={msg} />
      </div>
    </form>
  );
}

export function MemberRolesForm({
  membership,
  isSelf,
}: {
  membership: { id: string; email: string | null; roles: string[]; active: boolean };
  isSelf: boolean;
}) {
  const [isAdmin, setIsAdmin] = useState(membership.roles.includes("admin"));
  const [isBarber, setIsBarber] = useState(membership.roles.includes("barber"));
  const [active, setActive] = useState(membership.active);
  const [msg, setMsg] = useState<Msg>(null);
  const [pending, start] = useTransition();

  return (
    <form
      className="grid gap-3 text-sm"
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          const r = await updateMemberRoles({ membershipId: membership.id, isAdmin, isBarber, active });
          setMsg(r.ok ? { ok: true, text: "Acceso actualizado." } : { ok: false, text: r.message });
        });
      }}
    >
      <p>Cuenta: <span className="font-medium">{membership.email}</span>{isSelf && " (tú)"}</p>
      <label className="flex items-center gap-2"><input type="checkbox" className="size-4" checked={isBarber} onChange={(e) => setIsBarber(e.target.checked)} /> Barbero</label>
      <label className="flex items-center gap-2"><input type="checkbox" className="size-4" checked={isAdmin} onChange={(e) => setIsAdmin(e.target.checked)} /> Administrador</label>
      <label className="flex items-center gap-2"><input type="checkbox" className="size-4" checked={active} onChange={(e) => setActive(e.target.checked)} /> Puede iniciar sesión</label>
      <div className="flex items-center gap-3">
        <button className={buttonClass.secondary} disabled={pending}>Guardar acceso</button>
        <Status msg={msg} />
      </div>
    </form>
  );
}

export function LinkAccountForm({ barberId, accounts }: { barberId: string; accounts: { id: string; email: string | null }[] }) {
  const [membershipId, setMembershipId] = useState(accounts[0]?.id ?? "");
  const [msg, setMsg] = useState<Msg>(null);
  const [pending, start] = useTransition();
  if (!accounts.length) {
    return <p className="text-sm text-muted-foreground">Sin cuenta de acceso. Invítalo desde Equipo y luego vincula la cuenta aquí.</p>;
  }
  return (
    <form
      className="grid gap-3 text-sm"
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          const r = await linkBarberAccount(barberId, membershipId);
          setMsg(r.ok ? { ok: true, text: "Cuenta vinculada." } : { ok: false, text: r.message });
        });
      }}
    >
      <Field label="Vincular a una cuenta invitada">
        <select className={inputClass} value={membershipId} onChange={(e) => setMembershipId(e.target.value)}>
          {accounts.map((a) => <option key={a.id} value={a.id}>{a.email}</option>)}
        </select>
      </Field>
      <div className="flex items-center gap-3">
        <button className={buttonClass.secondary} disabled={pending}>Vincular</button>
        <Status msg={msg} />
      </div>
    </form>
  );
}
