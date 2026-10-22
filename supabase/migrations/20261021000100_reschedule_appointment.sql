-- Reprogramar una cita desde el enlace del correo (cliente sin cuenta).
--
-- 1. get_available_slots / get_available_days aceptan p_exclude_appt para no
--    contar la propia cita como ocupada (permite moverla a un horario cercano
--    o solapado con el actual).
-- 2. get_appointment_by_token expone service_id y barber_id (solo servidor).
-- 3. reschedule_appointment_by_token mueve la MISMA fila: conserva token,
--    estado, barbero y servicio; solo cambia starts_at / ends_at.

-- ---------------------------------------------------------------------------
-- 1. Disponibilidad con exclusión opcional de una cita
-- ---------------------------------------------------------------------------
drop function public.get_available_days(uuid, uuid, date, date, uuid);
drop function public.get_available_slots(uuid, uuid, date, uuid);

create function public.get_available_slots(
  p_shop         uuid,
  p_service      uuid,
  p_date         date,
  p_barber       uuid default null,
  p_exclude_appt uuid default null
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
        and a.id is distinct from p_exclude_appt
        and public.appt_blocked_range(a.starts_at, a.ends_at) && public.appt_blocked_range(s.s_start, s.s_end)
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

create function public.get_available_days(
  p_shop         uuid,
  p_service      uuid,
  p_from         date,
  p_to           date,
  p_barber       uuid default null,
  p_exclude_appt uuid default null
)
returns table (day date, slot_count int)
language sql
stable
security definer
set search_path = ''
as $$
  select d::date, count(*)::int
  from generate_series(p_from, least(p_to, p_from + 62), interval '1 day') as d
  cross join lateral public.get_available_slots(p_shop, p_service, d::date, p_barber, p_exclude_appt)
  group by d
  order by d;
$$;

revoke all on function public.get_available_slots(uuid, uuid, date, uuid, uuid) from public, anon, authenticated;
grant execute on function public.get_available_slots(uuid, uuid, date, uuid, uuid) to anon, authenticated, service_role;

revoke all on function public.get_available_days(uuid, uuid, date, date, uuid, uuid) from public, anon, authenticated;
grant execute on function public.get_available_days(uuid, uuid, date, date, uuid, uuid) to anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 2. get_appointment_by_token: añade service_id y barber_id
-- ---------------------------------------------------------------------------
create or replace function public.get_appointment_by_token(p_token text)
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
    'service_id',     a.service_id,
    'barber_id',      a.barber_id,
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

-- ---------------------------------------------------------------------------
-- 3. Reprogramación por token
--
-- Misma ventana que la cancelación (barbershops.cancel_notice_min). El mismo
-- barbero y servicio; el nuevo horario se revalida con get_available_slots
-- excluyendo la propia cita. La restricción appointments_no_overlap sigue
-- siendo la última defensa ante reservas concurrentes.
-- ---------------------------------------------------------------------------
create function public.reschedule_appointment_by_token(p_token text, p_starts_at timestamptz)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_appt   public.appointments%rowtype;
  v_shop   public.barbershops%rowtype;
  v_start  timestamptz;
  v_end    timestamptz;
  v_old    timestamptz;
begin
  select a.* into v_appt
  from public.appointments a
  where a.cancel_token_hash = encode(sha256(convert_to(p_token, 'UTF8')), 'hex')
  for update;

  if not found then
    raise exception 'APPOINTMENT_NOT_FOUND' using errcode = 'P0001';
  end if;
  if v_appt.status not in ('pending', 'confirmed') or v_appt.service_id is null then
    raise exception 'NOT_RESCHEDULABLE' using errcode = 'P0001';
  end if;

  select * into v_shop from public.barbershops where id = v_appt.barbershop_id;
  if v_appt.starts_at - now() < make_interval(mins => v_shop.cancel_notice_min) then
    raise exception 'TOO_LATE_TO_RESCHEDULE' using errcode = 'P0001';
  end if;
  if p_starts_at = v_appt.starts_at then
    raise exception 'SAME_SLOT' using errcode = 'P0001';
  end if;

  select s.slot_start, s.slot_end into v_start, v_end
  from public.get_available_slots(
    v_appt.barbershop_id,
    v_appt.service_id,
    (p_starts_at at time zone v_shop.timezone)::date,
    v_appt.barber_id,
    v_appt.id
  ) s
  where s.slot_start = p_starts_at;

  if v_start is null then
    raise exception 'SLOT_UNAVAILABLE' using errcode = 'P0001';
  end if;

  v_old := v_appt.starts_at;

  begin
    update public.appointments
    set starts_at = v_start,
        ends_at   = v_end
    where id = v_appt.id;
  exception when exclusion_violation then
    raise exception 'SLOT_TAKEN' using errcode = 'P0001';
  end;

  return public.get_appointment_by_token(p_token)
         || jsonb_build_object('previous_starts_at', v_old);
end;
$$;

revoke all on function public.reschedule_appointment_by_token(text, timestamptz) from public, anon, authenticated;
grant execute on function public.reschedule_appointment_by_token(text, timestamptz) to service_role;
