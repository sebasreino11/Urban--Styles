-- El cliente puede reprogramar su cita una sola vez desde el enlace del correo.
--
-- 1. appointments.rescheduled_at: cuándo se reprogramó (nulo = nunca).
-- 2. get_appointment_by_token expone rescheduled_at y can_reschedule.
-- 3. reschedule_appointment_by_token rechaza una segunda reprogramación
--    (ALREADY_RESCHEDULED). El `for update` serializa dos envíos simultáneos:
--    el segundo ve la fila ya marcada.

-- ---------------------------------------------------------------------------
-- 1. Marca de reprogramación
-- ---------------------------------------------------------------------------
alter table public.appointments add column rescheduled_at timestamptz;

-- ---------------------------------------------------------------------------
-- 2. get_appointment_by_token: añade rescheduled_at y can_reschedule
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
    'can_reschedule', a.status in ('pending', 'confirmed')
                      and a.starts_at - now() >= make_interval(mins => s.cancel_notice_min)
                      and a.rescheduled_at is null
                      and a.service_id is not null,
    'rescheduled_at', a.rescheduled_at,
    'cancel_notice_min', s.cancel_notice_min
  )
  from public.appointments a
  join public.barbers b      on b.id = a.barber_id
  join public.customers c    on c.id = a.customer_id
  join public.barbershops s  on s.id = a.barbershop_id
  where a.cancel_token_hash = encode(sha256(convert_to(p_token, 'UTF8')), 'hex');
$$;

-- ---------------------------------------------------------------------------
-- 3. Reprogramación por token: una sola vez
-- ---------------------------------------------------------------------------
create or replace function public.reschedule_appointment_by_token(p_token text, p_starts_at timestamptz)
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
  if v_appt.rescheduled_at is not null then
    raise exception 'ALREADY_RESCHEDULED' using errcode = 'P0001';
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
    set starts_at      = v_start,
        ends_at        = v_end,
        rescheduled_at = now()
    where id = v_appt.id;
  exception when exclusion_violation then
    raise exception 'SLOT_TAKEN' using errcode = 'P0001';
  end;

  return public.get_appointment_by_token(p_token)
         || jsonb_build_object('previous_starts_at', v_old);
end;
$$;
