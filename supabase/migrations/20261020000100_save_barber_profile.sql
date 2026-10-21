-- Guarda el perfil de un barbero y sus servicios en una sola transacción.
-- Antes el servidor borraba barber_services y luego insertaba: si el insert
-- fallaba, el barbero quedaba sin servicios y desaparecía de la reserva.
-- SECURITY INVOKER: RLS exige admin en barbers y barber_services; la FK
-- compuesta rechaza servicios de otra barbería y toda la operación se revierte.

create function public.save_barber_profile(
  p_barber       uuid,
  p_display_name text,
  p_bio          text,
  p_photo_url    text,
  p_active       boolean,
  p_service_ids  uuid[]
)
returns void
language plpgsql
set search_path = ''
as $$
declare
  v_shop uuid;
begin
  select barbershop_id into v_shop from public.barbers where id = p_barber;
  if v_shop is null or not public.is_admin(v_shop) then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;

  update public.barbers
  set display_name = p_display_name,
      bio          = p_bio,
      photo_url    = p_photo_url,
      active       = p_active
  where id = p_barber;

  delete from public.barber_services where barber_id = p_barber;
  insert into public.barber_services (barber_id, service_id, barbershop_id)
  select p_barber, s, v_shop
  from unnest(coalesce(p_service_ids, '{}')) as s
  on conflict do nothing;
end;
$$;

revoke all on function public.save_barber_profile(uuid, text, text, text, boolean, uuid[]) from public, anon;
grant execute on function public.save_barber_profile(uuid, text, text, text, boolean, uuid[]) to authenticated;
