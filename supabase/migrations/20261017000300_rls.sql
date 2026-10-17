-- =============================================================================
-- Row Level Security
--
-- Regla general: RLS activo en TODAS las tablas, sin acceso por defecto.
-- Cada política abre exactamente lo necesario. Roles de Postgres:
--   anon          → visitante del portal público (sin sesión)
--   authenticated → staff con sesión (barbero y/o admin, según memberships)
--   service_role  → servidor (Workers) con la secret key; ignora RLS y solo
--                   se usa para operaciones públicas ya validadas (reservar,
--                   cancelar por token) y para enviar notificaciones.
-- Cualquier cambio aquí debe reflejarse en README › Políticas RLS.
-- =============================================================================

alter table public.barbershops       enable row level security;
alter table public.business_hours    enable row level security;
alter table public.memberships       enable row level security;
alter table public.barbers           enable row level security;
alter table public.barber_private    enable row level security;
alter table public.services          enable row level security;
alter table public.barber_services   enable row level security;
alter table public.barber_schedules  enable row level security;
alter table public.customers         enable row level security;
alter table public.appointments      enable row level security;
alter table public.time_off_requests enable row level security;
alter table public.notification_log  enable row level security;

-- ---------------------------------------------------------------------------
-- barbershops
-- ---------------------------------------------------------------------------
create policy "barbershops: lectura pública"
  on public.barbershops for select to anon, authenticated
  using (true);

create policy "barbershops: admin edita su barbería"
  on public.barbershops for update to authenticated
  using (public.is_admin(id)) with check (public.is_admin(id));

-- ---------------------------------------------------------------------------
-- business_hours
-- ---------------------------------------------------------------------------
create policy "business_hours: lectura pública"
  on public.business_hours for select to anon, authenticated
  using (true);

create policy "business_hours: admin gestiona"
  on public.business_hours for all to authenticated
  using (public.is_admin(barbershop_id)) with check (public.is_admin(barbershop_id));

-- ---------------------------------------------------------------------------
-- memberships
-- ---------------------------------------------------------------------------
create policy "memberships: cada usuario ve la suya; admin ve las de su barbería"
  on public.memberships for select to authenticated
  using (user_id = (select auth.uid()) or public.is_admin(barbershop_id));

create policy "memberships: admin gestiona"
  on public.memberships for all to authenticated
  using (public.is_admin(barbershop_id)) with check (public.is_admin(barbershop_id));

-- ---------------------------------------------------------------------------
-- barbers
-- ---------------------------------------------------------------------------
create policy "barbers: público ve barberos activos"
  on public.barbers for select to anon
  using (active);

create policy "barbers: staff ve todos los de su barbería"
  on public.barbers for select to authenticated
  using (active or public.has_role(barbershop_id));

create policy "barbers: admin gestiona"
  on public.barbers for all to authenticated
  using (public.is_admin(barbershop_id)) with check (public.is_admin(barbershop_id));

-- ---------------------------------------------------------------------------
-- barber_private (URL de Hook.Notifier) — nunca visible al público
-- ---------------------------------------------------------------------------
create policy "barber_private: el barbero gestiona la suya; admin todas"
  on public.barber_private for all to authenticated
  using (barber_id in (select public.my_barber_ids()) or public.is_admin(barbershop_id))
  with check (barber_id in (select public.my_barber_ids()) or public.is_admin(barbershop_id));

-- ---------------------------------------------------------------------------
-- services
-- ---------------------------------------------------------------------------
create policy "services: público ve servicios activos"
  on public.services for select to anon
  using (active);

create policy "services: staff ve todos los de su barbería"
  on public.services for select to authenticated
  using (active or public.has_role(barbershop_id));

create policy "services: admin gestiona"
  on public.services for all to authenticated
  using (public.is_admin(barbershop_id)) with check (public.is_admin(barbershop_id));

-- ---------------------------------------------------------------------------
-- barber_services
-- ---------------------------------------------------------------------------
create policy "barber_services: lectura pública"
  on public.barber_services for select to anon, authenticated
  using (true);

create policy "barber_services: admin gestiona"
  on public.barber_services for all to authenticated
  using (public.is_admin(barbershop_id)) with check (public.is_admin(barbershop_id));

-- ---------------------------------------------------------------------------
-- barber_schedules (el público no la necesita: los horarios libres salen de
-- get_available_slots)
-- ---------------------------------------------------------------------------
create policy "barber_schedules: staff de la barbería lee"
  on public.barber_schedules for select to authenticated
  using (public.has_role(barbershop_id));

create policy "barber_schedules: admin gestiona"
  on public.barber_schedules for all to authenticated
  using (public.is_admin(barbershop_id)) with check (public.is_admin(barbershop_id));

-- ---------------------------------------------------------------------------
-- customers — un barbero solo ve clientes con los que tiene citas
-- ---------------------------------------------------------------------------
create policy "customers: admin ve todos; barbero solo los de sus citas"
  on public.customers for select to authenticated
  using (
    public.is_admin(barbershop_id)
    or exists (
      select 1 from public.appointments a
      where a.customer_id = customers.id
        and a.barber_id in (select public.my_barber_ids())
    )
  );

create policy "customers: admin corrige datos"
  on public.customers for update to authenticated
  using (public.is_admin(barbershop_id)) with check (public.is_admin(barbershop_id));

-- ---------------------------------------------------------------------------
-- appointments — AISLAMIENTO: un barbero nunca ve citas de otro barbero.
-- No hay política INSERT: las citas solo se crean con book_appointment().
-- ---------------------------------------------------------------------------
create policy "appointments: admin ve todas; barbero solo las suyas"
  on public.appointments for select to authenticated
  using (
    public.is_admin(barbershop_id)
    or barber_id in (select public.my_barber_ids())
  );

create policy "appointments: admin o barbero dueño de la cita cambian su estado"
  on public.appointments for update to authenticated
  using (
    public.is_admin(barbershop_id)
    or barber_id in (select public.my_barber_ids())
  )
  with check (
    public.is_admin(barbershop_id)
    or barber_id in (select public.my_barber_ids())
  );

-- Además de RLS, el staff solo puede tocar estas columnas. Horario, barbero,
-- cliente y precio son inmutables desde el cliente de Supabase.
revoke insert, update, delete on public.appointments from anon, authenticated;
grant update (status, cancel_reason, staff_note) on public.appointments to authenticated;

-- ---------------------------------------------------------------------------
-- time_off_requests — el barbero SOLICITA; solo el admin APRUEBA.
-- El trigger time_off_enforce_status (ver functions) fuerza status='pending'
-- en inserciones de no-admins.
-- ---------------------------------------------------------------------------
create policy "time_off: admin ve todas; barbero las suyas"
  on public.time_off_requests for select to authenticated
  using (
    public.is_admin(barbershop_id)
    or barber_id in (select public.my_barber_ids())
  );

create policy "time_off: barbero solicita para sí mismo; admin para cualquiera"
  on public.time_off_requests for insert to authenticated
  with check (
    public.is_admin(barbershop_id)
    or barber_id in (select public.my_barber_ids())
  );

create policy "time_off: solo admin revisa"
  on public.time_off_requests for update to authenticated
  using (public.is_admin(barbershop_id)) with check (public.is_admin(barbershop_id));

create policy "time_off: barbero retira su solicitud pendiente; admin borra"
  on public.time_off_requests for delete to authenticated
  using (
    public.is_admin(barbershop_id)
    or (status = 'pending' and barber_id in (select public.my_barber_ids()))
  );

-- ---------------------------------------------------------------------------
-- notification_log — solo lectura para admin; escribe el servidor
-- ---------------------------------------------------------------------------
create policy "notification_log: admin lee"
  on public.notification_log for select to authenticated
  using (public.is_admin(barbershop_id));

revoke insert, update, delete on public.notification_log from anon, authenticated;
revoke insert, update, delete on public.customers from anon;
