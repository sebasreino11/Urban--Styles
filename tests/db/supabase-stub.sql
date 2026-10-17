-- Réplica mínima del entorno que Supabase provee antes de nuestras
-- migraciones: roles, esquema auth, auth.uid() y privilegios por defecto.
-- Solo se usa en tests (PGlite); en Supabase real todo esto ya existe.

create schema if not exists extensions;
create schema if not exists auth;

create role anon nologin noinherit;
create role authenticated nologin noinherit;
create role service_role nologin noinherit bypassrls;

create table auth.users (
  id    uuid primary key default gen_random_uuid(),
  email text unique
);

create function auth.uid() returns uuid
language sql stable as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
$$;

create function auth.role() returns text
language sql stable as $$
  select nullif(current_setting('request.jwt.claim.role', true), '')
$$;

grant usage on schema public, auth, extensions to anon, authenticated, service_role;
grant execute on all functions in schema auth to anon, authenticated, service_role;

-- Supabase moderno NO concede privilegios por defecto en tablas nuevas de
-- public: cada migración debe hacer GRANT explícito (ver 000500_grants.sql).
-- Las funciones sí quedan ejecutables por defecto (PUBLIC), como en Postgres.
