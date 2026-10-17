-- =============================================================================
-- Privilegios explícitos (GRANT) por rol.
--
-- Supabase ya no concede privilegios por defecto en tablas nuevas del esquema
-- public: sin GRANT, el rol obtiene `permission denied` aunque exista una
-- política RLS. RLS decide QUÉ FILAS; los GRANT deciden QUÉ OPERACIONES.
-- Ambos deben permitir el acceso. Mantener sincronizado con 000300_rls.sql
-- y con README › Políticas RLS.
-- =============================================================================

-- Limpieza: nada por defecto para roles de API.
revoke all on all tables in schema public from anon, authenticated;

-- service_role (servidor con secret key): todo.
grant all on all tables in schema public to service_role;

-- anon (portal público): solo catálogo.
grant select on
  public.barbershops,
  public.business_hours,
  public.barbers,
  public.services,
  public.barber_services
to anon;

-- authenticated (staff): RLS limita filas por rol.
grant select on
  public.barbershops,
  public.business_hours,
  public.barbers,
  public.services,
  public.barber_services,
  public.barber_schedules,
  public.memberships,
  public.customers,
  public.appointments,
  public.time_off_requests,
  public.notification_log,
  public.barber_private
to authenticated;

grant insert, update, delete on
  public.business_hours,
  public.memberships,
  public.barbers,
  public.barber_private,
  public.services,
  public.barber_services,
  public.barber_schedules,
  public.time_off_requests
to authenticated;

grant update on public.barbershops to authenticated;
grant update on public.customers to authenticated;
-- Citas: el staff solo cambia estado, motivo y nota (nunca horario ni precio).
grant update (status, cancel_reason, staff_note) on public.appointments to authenticated;
