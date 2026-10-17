-- =============================================================================
-- Lógica de negocio en la base de datos (fuente única de verdad).
--
-- El portal web, la API /api/v1 y el futuro bot de WhatsApp llaman estas
-- mismas funciones vía lib/domain/*. Documentadas en README › Reglas de negocio.
--
-- Errores de negocio: `raise exception '<CODIGO>' using errcode = 'P0001'`.
-- lib/domain/errors.ts traduce cada código a un mensaje para el usuario.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Estados de una cita: transiciones válidas y sellos de cancelación.
--   pending   → confirmed | cancelled
--   confirmed → completed | cancelled | no_show
--   completed ↔ no_show   (corrección del staff)
--   cancelled → (final)
-- ---------------------------------------------------------------------------
create function public.appointments_guard_status()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.status is not distinct from old.status then
    return new;
  end if;

  if not (
       (old.status = 'pending'   and new.status in ('confirmed', 'cancelled'))
    or (old.status = 'confirmed' and new.status in ('completed', 'cancelled', 'no_show'))
    or (old.status = 'completed' and new.status = 'no_show')
    or (old.status = 'no_show'   and new.status = 'completed')
  ) then
    raise exception 'INVALID_TRANSITION' using
      errcode = 'P0001',
      detail = format('%s → %s', old.status, new.status);
  end if;

  if new.status in ('completed', 'no_show') and old.starts_at > now() then
    raise exception 'APPOINTMENT_NOT_STARTED' using errcode = 'P0001';
  end if;

  if new.status = 'cancelled' then
    new.cancelled_at := now();
    new.cancelled_by := coalesce(new.cancelled_by, 'staff');
  end if;

  return new;
end;
$$;

create trigger appointments_guard_status
  before update of status on public.appointments
  for each row execute function public.appointments_guard_status();

-- ---------------------------------------------------------------------------
-- Indisponibilidad: un barbero solo puede SOLICITAR. Si quien crea la
-- solicitud es admin de la barbería (p. ej. el dueño que también corta), se
-- aprueba automáticamente dejando constancia de quién la aprobó.
-- ---------------------------------------------------------------------------
create function public.time_off_enforce_status()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
begin
  if tg_op = 'INSERT' then
    -- Sin usuario (servidor/seed): se respeta lo que venga.
    if v_uid is null then
      return new;
    end if;

    new.requested_by := v_uid;
    if public.is_admin(new.barbershop_id) then
      new.status      := 'approved';
      new.reviewed_by := v_uid;
      new.reviewed_at := now();
      new.review_note := coalesce(new.review_note, 'Aprobada automáticamente (administrador)');
    else
      new.status      := 'pending';
      new.reviewed_by := null;
      new.reviewed_at := null;
      new.review_note := null;
    end if;
    return new;
  end if;

  -- UPDATE (solo admins llegan aquí por RLS): no se puede reasignar.
  new.barbershop_id := old.barbershop_id;
  new.barber_id     := old.barber_id;
  new.requested_by  := old.requested_by;
  if new.status is distinct from old.status then
    new.reviewed_by := v_uid;
    new.reviewed_at := now();
  end if;
  return new;
end;
$$;

create trigger time_off_enforce_status
  before insert or update on public.time_off_requests
  for each row execute function public.time_off_enforce_status();

-- ---------------------------------------------------------------------------
-- DISPONIBILIDAD
--
-- Devuelve los inicios reservables de un servicio en una fecha local de la
-- barbería. Un slot es válido para un barbero si:
--   1. cae dentro de (horario comercial ∩ horario laboral del barbero),
--   2. el servicio completo cabe antes del cierre de esa franja,
--   3. respeta la antelación mínima y el horizonte de reserva,
--   4. no se solapa con citas activas (pending/confirmed) del barbero,
--   5. no se solapa con indisponibilidad APROBADA del barbero,
--   6. el barbero está activo y realiza ese servicio.
-- Con p_barber = null ("cualquier barbero") agrupa: barber_ids lista a los
-- barberos libres en ese horario.
-- SECURITY DEFINER porque el público no puede leer citas ni bloqueos; solo
-- expone horas y ids de barberos (que ya son públicos).
-- ---------------------------------------------------------------------------
create function public.get_available_slots(
  p_shop    uuid,
  p_service uuid,
  p_date    date,
  p_barber  uuid default null
)
returns table (slot_start timestamptz, slot_end timestamptz, barber_ids uuid[])
language sql
stable
security definer
set search_path = ''
as $$
  with shop as (
    select s.timezone,
           s.slot_interval_min,
           s.booking_horizon_days,
           s.min_notice_min,
           (now() at time zone s.timezone)::date as today
    from public.barbershops s
    where s.id = p_shop
  ),
  svc as (
    select v.duration_min
    from public.services v
    where v.id = p_service and v.barbershop_id = p_shop and v.active
  ),
  candidates as (
    select b.id as barber_id
    from public.barbers b
    join public.barber_services bs on bs.barber_id = b.id and bs.service_id = p_service
    where b.barbershop_id = p_shop
      and b.active
      and (p_barber is null or b.id = p_barber)
  ),
  windows as (
    select c.barber_id,
           (p_date + greatest(bh.opens_at, sc.starts_at)) at time zone shop.timezone as w_start,
           (p_date + least(bh.closes_at, sc.ends_at))     at time zone shop.timezone as w_end
    from candidates c
    cross join shop
    join public.barber_schedules sc
      on sc.barber_id = c.barber_id and sc.weekday = extract(dow from p_date)
    join public.business_hours bh
      on bh.barbershop_id = p_shop and bh.weekday = extract(dow from p_date)
    where greatest(bh.opens_at, sc.starts_at) < least(bh.closes_at, sc.ends_at)
      and p_date between shop.today and shop.today + shop.booking_horizon_days
  ),
  slots as (
    select w.barber_id,
           g.t as s_start,
           g.t + make_interval(mins => svc.duration_min) as s_end
    from windows w
    cross join svc
    cross join shop
    cross join lateral generate_series(
      w.w_start,
      w.w_end - make_interval(mins => svc.duration_min),
      make_interval(mins => shop.slot_interval_min)
    ) as g(t)
  )
  select s.s_start, s.s_end, array_agg(s.barber_id order by s.barber_id)
  from slots s
  cross join shop
  where s.s_start >= now() + make_interval(mins => shop.min_notice_min)
    and not exists (
      select 1 from public.appointments a
      where a.barber_id = s.barber_id
        and a.status in ('pending', 'confirmed')
        and tstzrange(a.starts_at, a.ends_at, '[)') && tstzrange(s.s_start, s.s_end, '[)')
    )
    and not exists (
      select 1 from public.time_off_requests t
      where t.barber_id = s.barber_id
        and t.status = 'approved'
        and tstzrange(t.starts_at, t.ends_at, '[)') && tstzrange(s.s_start, s.s_end, '[)')
    )
  group by s.s_start, s.s_end
  order by s.s_start;
$$;

-- Días con al menos un horario libre en [p_from, p_to] (para el calendario).
-- Reutiliza get_available_slots: misma regla, sin duplicar lógica.
create function public.get_available_days(
  p_shop    uuid,
  p_service uuid,
  p_from    date,
  p_to      date,
  p_barber  uuid default null
)
returns table (day date, slot_count int)
language sql
stable
security definer
set search_path = ''
as $$
  select d::date, count(*)::int
  from generate_series(p_from, least(p_to, p_from + 62), interval '1 day') as d
  cross join lateral public.get_available_slots(p_shop, p_service, d::date, p_barber)
  group by d
  order by d;
$$;

-- ---------------------------------------------------------------------------
-- RESERVA
--
-- 1. Revalida el horario con get_available_slots (nunca se confía en el
--    cliente).
-- 2. Upsert del cliente por (barbería, email).
-- 3. Si es "cualquier barbero", prueba a los libres empezando por el que
--    tiene menos citas ese día.
-- 4. La constraint appointments_no_overlap resuelve carreras: si otra
--    transacción ganó, se prueba el siguiente barbero o se responde
--    SLOT_TAKEN.
-- Devuelve el token de cancelación en claro UNA sola vez; en la BD solo se
-- guarda su hash SHA-256.
-- Ejecutable por service_role (servidor) y por staff autenticado de la
-- barbería (citas tomadas por teléfono). Nunca por anon.
-- ---------------------------------------------------------------------------
create function public.book_appointment(
  p_shop           uuid,
  p_service        uuid,
  p_starts_at      timestamptz,
  p_customer_name  text,
  p_customer_email text,
  p_barber         uuid default null,
  p_customer_phone text default null,
  p_source         public.booking_source default 'web'
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_shop       public.barbershops%rowtype;
  v_service    public.services%rowtype;
  v_local_date date;
  v_candidates uuid[];
  v_barber     uuid;
  v_customer   uuid;
  v_token      text;
  v_appt       public.appointments%rowtype;
  v_booked     boolean := false;
begin
  if (select auth.uid()) is not null and not public.has_role(p_shop) then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;

  select * into v_shop from public.barbershops where id = p_shop;
  if not found then
    raise exception 'SHOP_NOT_FOUND' using errcode = 'P0001';
  end if;

  select * into v_service
  from public.services
  where id = p_service and barbershop_id = p_shop and active;
  if not found then
    raise exception 'SERVICE_NOT_FOUND' using errcode = 'P0001';
  end if;

  v_local_date := (p_starts_at at time zone v_shop.timezone)::date;

  select s.barber_ids into v_candidates
  from public.get_available_slots(p_shop, p_service, v_local_date, p_barber) s
  where s.slot_start = p_starts_at;

  if v_candidates is null then
    raise exception 'SLOT_UNAVAILABLE' using errcode = 'P0001';
  end if;

  insert into public.customers as c (barbershop_id, name, email, phone)
  values (p_shop, trim(p_customer_name), lower(trim(p_customer_email)), nullif(trim(p_customer_phone), ''))
  on conflict (barbershop_id, email) do update
    set name  = excluded.name,
        phone = coalesce(excluded.phone, c.phone)
  returning c.id into v_customer;

  v_token := replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', '');

  for v_barber in
    select c.id
    from unnest(v_candidates) as c(id)
    order by (
      select count(*) from public.appointments a
      where a.barber_id = c.id
        and a.status in ('pending', 'confirmed')
        and (a.starts_at at time zone v_shop.timezone)::date = v_local_date
    ), c.id
  loop
    begin
      insert into public.appointments (
        barbershop_id, barber_id, service_id, customer_id,
        starts_at, ends_at, status, service_name, price_cop, source, cancel_token_hash
      ) values (
        p_shop, v_barber, v_service.id, v_customer,
        p_starts_at, p_starts_at + make_interval(mins => v_service.duration_min),
        'confirmed', v_service.name, v_service.price_cop, p_source,
        encode(sha256(convert_to(v_token, 'UTF8')), 'hex')
      )
      returning * into v_appt;
      v_booked := true;
      exit;
    exception when exclusion_violation then
      -- Otra reserva concurrente tomó a este barbero: probar el siguiente.
      null;
    end;
  end loop;

  if not v_booked then
    raise exception 'SLOT_TAKEN' using errcode = 'P0001';
  end if;

  return jsonb_build_object(
    'appointment_id', v_appt.id,
    'barbershop_id',  v_shop.id,
    'shop_name',      v_shop.name,
    'timezone',       v_shop.timezone,
    'barber_id',      v_appt.barber_id,
    'barber_name',    (select display_name from public.barbers where id = v_appt.barber_id),
    'service_name',   v_appt.service_name,
    'price_cop',      v_appt.price_cop,
    'starts_at',      v_appt.starts_at,
    'ends_at',        v_appt.ends_at,
    'customer_name',  trim(p_customer_name),
    'customer_email', lower(trim(p_customer_email)),
    'cancel_token',   v_token
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- Consulta y cancelación por token (link del correo; cliente sin cuenta).
-- ---------------------------------------------------------------------------
create function public.get_appointment_by_token(p_token text)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'appointment_id', a.id,
    'status',         a.status,
    'starts_at',      a.starts_at,
    'ends_at',        a.ends_at,
    'service_name',   a.service_name,
    'price_cop',      a.price_cop,
    'barber_name',    b.display_name,
    'customer_name',  c.name,
    'shop_name',      s.name,
    'shop_slug',      s.slug,
    'shop_phone',     s.phone,
    'shop_address',   s.address,
    'timezone',       s.timezone,
    'can_cancel',     a.status in ('pending', 'confirmed')
                      and a.starts_at - now() >= make_interval(mins => s.cancel_notice_min),
    'cancel_notice_min', s.cancel_notice_min
  )
  from public.appointments a
  join public.barbers b      on b.id = a.barber_id
  join public.customers c    on c.id = a.customer_id
  join public.barbershops s  on s.id = a.barbershop_id
  where a.cancel_token_hash = encode(sha256(convert_to(p_token, 'UTF8')), 'hex');
$$;

create function public.cancel_appointment_by_token(p_token text)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_appt   public.appointments%rowtype;
  v_notice int;
begin
  select a.* into v_appt
  from public.appointments a
  where a.cancel_token_hash = encode(sha256(convert_to(p_token, 'UTF8')), 'hex')
  for update;

  if not found then
    raise exception 'APPOINTMENT_NOT_FOUND' using errcode = 'P0001';
  end if;
  if v_appt.status not in ('pending', 'confirmed') then
    raise exception 'NOT_CANCELLABLE' using errcode = 'P0001';
  end if;

  select cancel_notice_min into v_notice from public.barbershops where id = v_appt.barbershop_id;
  if v_appt.starts_at - now() < make_interval(mins => v_notice) then
    raise exception 'TOO_LATE_TO_CANCEL' using errcode = 'P0001';
  end if;

  update public.appointments
  set status = 'cancelled',
      cancelled_by = 'customer',
      cancel_reason = 'Cancelada por el cliente'
  where id = v_appt.id;

  return public.get_appointment_by_token(p_token);
end;
$$;

-- ---------------------------------------------------------------------------
-- Citas que chocan con una solicitud de indisponibilidad (para que el admin
-- decida con información). SECURITY INVOKER: RLS aplica normalmente.
-- ---------------------------------------------------------------------------
create function public.time_off_conflicts(p_request uuid)
returns setof public.appointments
language sql
stable
set search_path = ''
as $$
  select a.*
  from public.time_off_requests t
  join public.appointments a
    on a.barber_id = t.barber_id
   and a.status in ('pending', 'confirmed')
   and tstzrange(a.starts_at, a.ends_at, '[)') && tstzrange(t.starts_at, t.ends_at, '[)')
  where t.id = p_request
  order by a.starts_at;
$$;

-- ---------------------------------------------------------------------------
-- Reemplazo atómico del horario semanal (comercial si p_barber es null, o el
-- de un barbero). p_ranges: [{"weekday":1,"start":"09:00","end":"18:00"}, …]
-- SECURITY INVOKER: RLS exige admin; la constraint de exclusión rechaza
-- franjas solapadas y toda la operación se revierte.
-- ---------------------------------------------------------------------------
create function public.replace_weekly_hours(p_shop uuid, p_barber uuid, p_ranges jsonb)
returns void
language plpgsql
set search_path = ''
as $$
begin
  if not public.is_admin(p_shop) then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;

  if p_barber is null then
    delete from public.business_hours where barbershop_id = p_shop;
    insert into public.business_hours (barbershop_id, weekday, opens_at, closes_at)
    select p_shop, (r->>'weekday')::smallint, (r->>'start')::time, (r->>'end')::time
    from jsonb_array_elements(p_ranges) r;
  else
    delete from public.barber_schedules where barbershop_id = p_shop and barber_id = p_barber;
    insert into public.barber_schedules (barbershop_id, barber_id, weekday, starts_at, ends_at)
    select p_shop, p_barber, (r->>'weekday')::smallint, (r->>'start')::time, (r->>'end')::time
    from jsonb_array_elements(p_ranges) r;
  end if;
exception
  when exclusion_violation or check_violation then
    raise exception 'OVERLAPPING_HOURS' using errcode = 'P0001';
end;
$$;

-- ---------------------------------------------------------------------------
-- INSIGHTS del negocio (solo admin). Rango [p_from, p_to).
-- ---------------------------------------------------------------------------
create function public.shop_insights(p_shop uuid, p_from timestamptz, p_to timestamptz)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_tz     text;
  v_result jsonb;
begin
  if not public.is_admin(p_shop) then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;

  select timezone into v_tz from public.barbershops where id = p_shop;

  with appts as (
    select a.*
    from public.appointments a
    where a.barbershop_id = p_shop
      and a.starts_at >= p_from
      and a.starts_at <  p_to
  ),
  totals as (
    select
      count(*)                                              as total,
      count(*) filter (where status = 'completed')          as completed,
      count(*) filter (where status = 'cancelled')          as cancelled,
      count(*) filter (where status = 'no_show')            as no_show,
      count(*) filter (where status in ('pending', 'confirmed')) as upcoming,
      count(*) filter (where status in ('pending', 'confirmed') and ends_at < now()) as overdue,
      coalesce(sum(price_cop) filter (where status = 'completed'), 0) as revenue_cop,
      coalesce(sum(price_cop) filter (where status in ('pending', 'confirmed')), 0) as expected_cop
    from appts
  )
  select jsonb_build_object(
    'total',        t.total,
    'completed',    t.completed,
    'cancelled',    t.cancelled,
    'no_show',      t.no_show,
    'upcoming',     t.upcoming,
    'overdue',      t.overdue,
    'revenue_cop',  t.revenue_cop,
    'expected_cop', t.expected_cop,
    'cancellation_rate', case when t.total = 0 then 0 else round(t.cancelled::numeric / t.total, 4) end,
    'no_show_rate', case when t.completed + t.no_show = 0 then 0
                         else round(t.no_show::numeric / (t.completed + t.no_show), 4) end,
    'top_services', coalesce((
      select jsonb_agg(x order by x.count desc, x.name)
      from (
        select service_name as name, count(*) as count,
               coalesce(sum(price_cop) filter (where status = 'completed'), 0) as revenue_cop
        from appts
        where status <> 'cancelled'
        group by service_name
        order by count(*) desc
        limit 6
      ) x
    ), '[]'::jsonb),
    'by_barber', coalesce((
      select jsonb_agg(x order by x.completed desc, x.name)
      from (
        select b.id, b.display_name as name,
               count(*) filter (where a.status = 'completed') as completed,
               count(*) filter (where a.status <> 'cancelled') as booked,
               coalesce(sum(a.price_cop) filter (where a.status = 'completed'), 0) as revenue_cop
        from appts a
        join public.barbers b on b.id = a.barber_id
        group by b.id, b.display_name
      ) x
    ), '[]'::jsonb),
    'daily', coalesce((
      select jsonb_agg(x order by x.day)
      from (
        select (starts_at at time zone v_tz)::date as day,
               count(*) filter (where status <> 'cancelled') as booked,
               count(*) filter (where status = 'cancelled') as cancelled
        from appts
        group by 1
      ) x
    ), '[]'::jsonb)
  )
  into v_result
  from totals t;

  return v_result;
end;
$$;

-- ---------------------------------------------------------------------------
-- Permisos de ejecución. Supabase concede EXECUTE a anon/authenticated por
-- defecto en funciones nuevas; aquí se restringe explícitamente.
-- ---------------------------------------------------------------------------
revoke all on function public.get_available_slots(uuid, uuid, date, uuid) from public, anon, authenticated;
grant execute on function public.get_available_slots(uuid, uuid, date, uuid) to anon, authenticated, service_role;

revoke all on function public.get_available_days(uuid, uuid, date, date, uuid) from public, anon, authenticated;
grant execute on function public.get_available_days(uuid, uuid, date, date, uuid) to anon, authenticated, service_role;

revoke all on function public.book_appointment(uuid, uuid, timestamptz, text, text, uuid, text, public.booking_source) from public, anon, authenticated;
grant execute on function public.book_appointment(uuid, uuid, timestamptz, text, text, uuid, text, public.booking_source) to authenticated, service_role;

revoke all on function public.get_appointment_by_token(text) from public, anon, authenticated;
grant execute on function public.get_appointment_by_token(text) to service_role;

revoke all on function public.cancel_appointment_by_token(text) from public, anon, authenticated;
grant execute on function public.cancel_appointment_by_token(text) to service_role;

revoke all on function public.time_off_conflicts(uuid) from public, anon;
grant execute on function public.time_off_conflicts(uuid) to authenticated;

revoke all on function public.replace_weekly_hours(uuid, uuid, jsonb) from public, anon;
grant execute on function public.replace_weekly_hours(uuid, uuid, jsonb) to authenticated;

revoke all on function public.shop_insights(uuid, timestamptz, timestamptz) from public, anon;
grant execute on function public.shop_insights(uuid, timestamptz, timestamptz) to authenticated;

-- Funciones de trigger: nadie las invoca directamente.
revoke all on function public.appointments_guard_status() from public, anon, authenticated;
revoke all on function public.time_off_enforce_status() from public, anon, authenticated;
revoke all on function public.ensure_admin_remains() from public, anon, authenticated;
revoke all on function public.set_updated_at() from public, anon, authenticated;
