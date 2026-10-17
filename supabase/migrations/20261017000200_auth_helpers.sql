-- =============================================================================
-- Helpers de autorización usados por las políticas RLS.
--
-- Son SECURITY DEFINER para poder leer `memberships`/`barbers` sin disparar
-- las políticas de esas mismas tablas (evita recursión infinita en RLS).
-- `(select auth.uid())` se evalúa una sola vez por consulta (rendimiento).
-- =============================================================================

-- ¿El usuario actual pertenece a la barbería (opcionalmente con un rol)?
create function public.has_role(p_shop uuid, p_role public.app_role default null)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.memberships m
    where m.barbershop_id = p_shop
      and m.user_id = (select auth.uid())
      and m.active
      and (p_role is null or p_role = any (m.roles))
  );
$$;

create function public.is_admin(p_shop uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.has_role(p_shop, 'admin');
$$;

-- Perfiles de barbero que corresponden al usuario actual (rol barber activo).
create function public.my_barber_ids()
returns setof uuid
language sql
stable
security definer
set search_path = ''
as $$
  select b.id
  from public.barbers b
  join public.memberships m on m.id = b.membership_id
  where m.user_id = (select auth.uid())
    and m.active
    and 'barber' = any (m.roles);
$$;

revoke all on function public.has_role(uuid, public.app_role) from public, anon;
revoke all on function public.is_admin(uuid) from public, anon;
revoke all on function public.my_barber_ids() from public, anon;
grant execute on function public.has_role(uuid, public.app_role) to authenticated;
grant execute on function public.is_admin(uuid) to authenticated;
grant execute on function public.my_barber_ids() to authenticated;

-- ---------------------------------------------------------------------------
-- Protección contra quedarse sin administrador: una barbería siempre debe
-- conservar al menos una membresía activa con rol admin.
-- ---------------------------------------------------------------------------
create function public.ensure_admin_remains()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_shop uuid := coalesce(old.barbershop_id, new.barbershop_id);
begin
  if not exists (
    select 1 from public.memberships m
    where m.barbershop_id = v_shop and m.active and 'admin' = any (m.roles)
  ) and exists (select 1 from public.barbershops where id = v_shop) then
    raise exception 'LAST_ADMIN' using
      errcode = 'P0001',
      hint = 'La barbería debe conservar al menos un administrador activo.';
  end if;
  return null;
end;
$$;

create constraint trigger memberships_keep_admin
  after update or delete on public.memberships
  deferrable initially deferred
  for each row execute function public.ensure_admin_remains();
