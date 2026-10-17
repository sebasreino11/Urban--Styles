-- =============================================================================
-- Urban Styles — esquema base (multi-tenant)
--
-- Toda tabla de negocio lleva `barbershop_id`. Las FKs compuestas
-- (id, barbershop_id) garantizan que nunca se mezclen filas de dos barberías
-- (p. ej. una cita de la barbería A con un barbero de la barbería B).
-- Si agregas una tabla aquí, documéntala en README › Modelo de datos.
-- =============================================================================

create extension if not exists btree_gist with schema extensions;

-- ---------------------------------------------------------------------------
-- Tipos
-- ---------------------------------------------------------------------------
create type public.app_role as enum ('admin', 'barber');

create type public.appointment_status as enum (
  'pending',    -- reservada para pagos en línea (roadmap); hoy las citas nacen confirmed
  'confirmed',
  'completed',
  'cancelled',
  'no_show'
);

create type public.time_off_status as enum ('pending', 'approved', 'rejected');

create type public.booking_source as enum ('web', 'api', 'whatsapp', 'staff');

-- ---------------------------------------------------------------------------
-- updated_at automático
-- ---------------------------------------------------------------------------
create function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- barbershops: el tenant. Perfil público + reglas de reserva.
-- ---------------------------------------------------------------------------
create table public.barbershops (
  id                   uuid primary key default gen_random_uuid(),
  slug                 text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  name                 text not null check (length(name) between 2 and 80),
  tagline              text,
  about                text,
  phone                text,
  whatsapp             text,
  email                text,
  address              text,
  city                 text,
  maps_url             text,
  instagram_url        text,
  timezone             text not null default 'America/Bogota',
  currency             text not null default 'COP',
  slot_interval_min    int  not null default 15  check (slot_interval_min between 5 and 60),
  booking_horizon_days int  not null default 30  check (booking_horizon_days between 1 and 180),
  min_notice_min       int  not null default 60  check (min_notice_min between 0 and 2880),
  cancel_notice_min    int  not null default 120 check (cancel_notice_min between 0 and 2880),
  custom_domain        text unique,
  plan                 text not null default 'free',
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);
create trigger barbershops_updated_at before update on public.barbershops
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- business_hours: horario comercial. Varias franjas por día (p. ej. almuerzo).
-- weekday sigue a extract(dow): 0 = domingo … 6 = sábado.
-- ---------------------------------------------------------------------------
create table public.business_hours (
  id            uuid primary key default gen_random_uuid(),
  barbershop_id uuid not null references public.barbershops (id) on delete cascade,
  weekday       smallint not null check (weekday between 0 and 6),
  opens_at      time not null,
  closes_at     time not null,
  check (closes_at > opens_at),
  exclude using gist (barbershop_id with =, weekday with =, tsrange('2000-01-01'::date + opens_at, '2000-01-01'::date + closes_at) with &&)
);
create index on public.business_hours (barbershop_id, weekday);

-- ---------------------------------------------------------------------------
-- memberships: vincula una cuenta (auth.users) a una barbería con N roles.
-- Una sola cuenta puede ser admin y barber a la vez (el dueño).
-- ---------------------------------------------------------------------------
create table public.memberships (
  id            uuid primary key default gen_random_uuid(),
  barbershop_id uuid not null references public.barbershops (id) on delete cascade,
  user_id       uuid not null references auth.users (id) on delete cascade,
  email         text, -- copia para mostrar en el panel (auth.users no es legible vía API)
  roles         public.app_role[] not null check (cardinality(roles) >= 1),
  active        boolean not null default true,
  created_at    timestamptz not null default now(),
  unique (barbershop_id, user_id),
  unique (id, barbershop_id)
);
create index on public.memberships (user_id);

-- ---------------------------------------------------------------------------
-- barbers: perfil profesional (visible al público). membership_id es nulo
-- mientras el barbero no tenga cuenta (p. ej. datos demo o invitación pendiente).
-- ---------------------------------------------------------------------------
create table public.barbers (
  id            uuid primary key default gen_random_uuid(),
  barbershop_id uuid not null references public.barbershops (id) on delete cascade,
  membership_id uuid unique,
  display_name  text not null check (length(display_name) between 2 and 60),
  bio           text,
  photo_url     text,
  active        boolean not null default true,
  sort_order    int not null default 0,
  created_at    timestamptz not null default now(),
  unique (id, barbershop_id),
  foreign key (membership_id, barbershop_id)
    references public.memberships (id, barbershop_id) on delete set null (membership_id)
);
create index on public.barbers (barbershop_id);

-- ---------------------------------------------------------------------------
-- barber_private: datos sensibles del barbero (URL de Hook.Notifier).
-- Separada de `barbers` porque `barbers` es legible por el público.
-- ---------------------------------------------------------------------------
create table public.barber_private (
  barber_id     uuid primary key,
  barbershop_id uuid not null,
  hook_url      text check (hook_url is null or hook_url ~ '^https://'),
  updated_at    timestamptz not null default now(),
  foreign key (barber_id, barbershop_id)
    references public.barbers (id, barbershop_id) on delete cascade
);
create trigger barber_private_updated_at before update on public.barber_private
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- services: catálogo. Precio en pesos enteros (COP no usa decimales).
-- ---------------------------------------------------------------------------
create table public.services (
  id            uuid primary key default gen_random_uuid(),
  barbershop_id uuid not null references public.barbershops (id) on delete cascade,
  name          text not null check (length(name) between 2 and 80),
  description   text,
  duration_min  int not null check (duration_min between 5 and 480),
  price_cop     int not null check (price_cop >= 0),
  active        boolean not null default true,
  sort_order    int not null default 0,
  created_at    timestamptz not null default now(),
  unique (id, barbershop_id)
);
create index on public.services (barbershop_id);

-- ---------------------------------------------------------------------------
-- barber_services: qué servicios realiza cada barbero.
-- ---------------------------------------------------------------------------
create table public.barber_services (
  barber_id     uuid not null,
  service_id    uuid not null,
  barbershop_id uuid not null,
  primary key (barber_id, service_id),
  foreign key (barber_id, barbershop_id) references public.barbers (id, barbershop_id) on delete cascade,
  foreign key (service_id, barbershop_id) references public.services (id, barbershop_id) on delete cascade
);
create index on public.barber_services (service_id);

-- ---------------------------------------------------------------------------
-- barber_schedules: horario laboral semanal de cada barbero.
-- La disponibilidad real es la intersección con business_hours.
-- ---------------------------------------------------------------------------
create table public.barber_schedules (
  id            uuid primary key default gen_random_uuid(),
  barbershop_id uuid not null,
  barber_id     uuid not null,
  weekday       smallint not null check (weekday between 0 and 6),
  starts_at     time not null,
  ends_at       time not null,
  check (ends_at > starts_at),
  foreign key (barber_id, barbershop_id) references public.barbers (id, barbershop_id) on delete cascade,
  exclude using gist (barber_id with =, weekday with =, tsrange('2000-01-01'::date + starts_at, '2000-01-01'::date + ends_at) with &&)
);
create index on public.barber_schedules (barber_id, weekday);

-- ---------------------------------------------------------------------------
-- customers: contacto del cliente final. Sin cuenta, sin contraseña.
-- Se deduplica por (barbería, email).
-- ---------------------------------------------------------------------------
create table public.customers (
  id            uuid primary key default gen_random_uuid(),
  barbershop_id uuid not null references public.barbershops (id) on delete cascade,
  name          text not null check (length(name) between 2 and 80),
  email         text not null check (email = lower(email) and email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  phone         text,
  created_at    timestamptz not null default now(),
  unique (barbershop_id, email),
  unique (id, barbershop_id)
);

-- ---------------------------------------------------------------------------
-- appointments: las citas.
-- service_name y price_cop son una "foto" del servicio al reservar, para que
-- editar el catálogo no altere citas pasadas ni los ingresos reportados.
-- ---------------------------------------------------------------------------
create table public.appointments (
  id                uuid primary key default gen_random_uuid(),
  barbershop_id     uuid not null,
  barber_id         uuid not null,
  service_id        uuid,
  customer_id       uuid not null,
  starts_at         timestamptz not null,
  ends_at           timestamptz not null,
  status            public.appointment_status not null default 'confirmed',
  service_name      text not null,
  price_cop         int not null check (price_cop >= 0),
  source            public.booking_source not null default 'web',
  cancel_token_hash text unique,
  cancelled_at      timestamptz,
  cancelled_by      text check (cancelled_by in ('customer', 'staff')),
  cancel_reason     text,
  staff_note        text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  check (ends_at > starts_at),
  foreign key (barber_id, barbershop_id)   references public.barbers (id, barbershop_id),
  foreign key (service_id, barbershop_id)  references public.services (id, barbershop_id) on delete set null (service_id),
  foreign key (customer_id, barbershop_id) references public.customers (id, barbershop_id),

  -- PREVENCIÓN DE DOBLE RESERVA. Postgres rechaza (SQLSTATE 23P01) cualquier
  -- cita activa que se solape con otra del mismo barbero, incluso si dos
  -- transacciones llegan en el mismo milisegundo. Es la última línea de
  -- defensa: no depende del frontend ni de la lógica de disponibilidad.
  constraint appointments_no_overlap exclude using gist (
    barber_id with =,
    tstzrange(starts_at, ends_at, '[)') with &&
  ) where (status in ('pending', 'confirmed'))
);
create index on public.appointments (barbershop_id, starts_at);
create index on public.appointments (barber_id, starts_at);
create index on public.appointments (customer_id);
create trigger appointments_updated_at before update on public.appointments
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- time_off_requests: solicitudes de indisponibilidad. Solo bloquean la agenda
-- cuando status = 'approved'.
-- ---------------------------------------------------------------------------
create table public.time_off_requests (
  id            uuid primary key default gen_random_uuid(),
  barbershop_id uuid not null,
  barber_id     uuid not null,
  starts_at     timestamptz not null,
  ends_at       timestamptz not null,
  reason        text not null check (length(trim(reason)) between 3 and 500),
  status        public.time_off_status not null default 'pending',
  requested_by  uuid references auth.users (id) on delete set null,
  reviewed_by   uuid references auth.users (id) on delete set null,
  reviewed_at   timestamptz,
  review_note   text,
  created_at    timestamptz not null default now(),
  check (ends_at > starts_at),
  foreign key (barber_id, barbershop_id) references public.barbers (id, barbershop_id) on delete cascade
);
create index on public.time_off_requests (barbershop_id, status);
create index on public.time_off_requests (barber_id, starts_at);

-- ---------------------------------------------------------------------------
-- notification_log: rastro de correos y push enviados (diagnóstico).
-- ---------------------------------------------------------------------------
create table public.notification_log (
  id             uuid primary key default gen_random_uuid(),
  barbershop_id  uuid not null references public.barbershops (id) on delete cascade,
  appointment_id uuid references public.appointments (id) on delete set null,
  channel        text not null check (channel in ('email', 'push')),
  event          text not null,
  status         text not null check (status in ('sent', 'failed', 'skipped')),
  detail         text,
  created_at     timestamptz not null default now()
);
create index on public.notification_log (barbershop_id, created_at desc);
