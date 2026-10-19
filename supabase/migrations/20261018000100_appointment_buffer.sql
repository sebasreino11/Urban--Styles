-- Tiempo muerto de 15 min entre citas de un mismo barbero.
-- La cita sigue durando lo que dura el servicio (ends_at no cambia); el
-- rango "bloqueado" incluye 15 min extra al final, tanto en la disponibilidad
-- como en la restricción anti doble reserva.

create or replace function public.appt_blocked_range(p_start timestamptz, p_end timestamptz)
returns tstzrange
language sql
immutable
parallel safe
set search_path = ''
as $$ select tstzrange(p_start, p_end + interval '15 minutes', '[)') $$;

alter table public.appointments drop constraint appointments_no_overlap;
alter table public.appointments add constraint appointments_no_overlap exclude using gist (
  barber_id with =,
  public.appt_blocked_range(starts_at, ends_at) with &&
) where (status in ('pending', 'confirmed'));

create or replace function public.get_available_slots(
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
