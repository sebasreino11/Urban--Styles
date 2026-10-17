-- =============================================================================
-- Datos demo de Urban Styles. Todo es editable desde el panel admin.
-- Idempotente: se puede ejecutar varias veces.
-- Las cuentas (dueño y barberos con login) NO se crean aquí: ver
-- `npm run create-owner` en el README.
-- =============================================================================

insert into public.barbershops (
  id, slug, name, tagline, about, phone, whatsapp, email, address, city, maps_url, instagram_url,
  timezone, currency, slot_interval_min, booking_horizon_days, min_notice_min, cancel_notice_min
) values (
  '00000000-0000-4000-a000-000000000001',
  'urban-styles',
  'Urban Styles',
  'Barbería de autor en el corazón de Chapinero',
  'Desde 2016 cortamos con oficio: tijera, navaja y conversación. Un espacio para quienes cuidan los detalles — sin afanes, con toalla caliente y buena música. Cada servicio empieza con una asesoría corta para entender tu estilo, tu tipo de cabello y tu rutina.',
  '+57 601 555 0142',
  '+57 300 555 0142',
  'hola@urbanstyles.co',
  'Cra. 13 #54-21, Chapinero',
  'Bogotá',
  'https://maps.google.com/?q=Cra.+13+%2354-21+Bogot%C3%A1',
  'https://instagram.com/urbanstyles',
  'America/Bogota', 'COP', 15, 30, 60, 120
) on conflict (id) do nothing;

-- Horario comercial: L–V 9:00–20:00, S 8:00–19:00, D 10:00–15:00
insert into public.business_hours (barbershop_id, weekday, opens_at, closes_at)
select '00000000-0000-4000-a000-000000000001', d, o, c
from (values
  (1, time '09:00', time '20:00'),
  (2, time '09:00', time '20:00'),
  (3, time '09:00', time '20:00'),
  (4, time '09:00', time '20:00'),
  (5, time '09:00', time '20:00'),
  (6, time '08:00', time '19:00'),
  (0, time '10:00', time '15:00')
) as v(d, o, c)
where not exists (
  select 1 from public.business_hours
  where barbershop_id = '00000000-0000-4000-a000-000000000001'
);

insert into public.services (id, barbershop_id, name, description, duration_min, price_cop, sort_order) values
  ('00000000-0000-4000-b000-000000000001', '00000000-0000-4000-a000-000000000001', 'Corte clásico',        'Tijera y máquina, lavado y peinado.',                         45, 30000, 1),
  ('00000000-0000-4000-b000-000000000002', '00000000-0000-4000-a000-000000000001', 'Fade de autor',        'Degradado a navaja con acabado detallado.',                   45, 35000, 2),
  ('00000000-0000-4000-b000-000000000003', '00000000-0000-4000-a000-000000000001', 'Perfilado de barba',   'Diseño, contorno a navaja y aceite.',                         30, 20000, 3),
  ('00000000-0000-4000-b000-000000000004', '00000000-0000-4000-a000-000000000001', 'Corte + barba',        'El servicio completo, con toalla caliente.',                  75, 45000, 4),
  ('00000000-0000-4000-b000-000000000005', '00000000-0000-4000-a000-000000000001', 'Afeitado tradicional', 'Navaja, vapor, toalla caliente y bálsamo.',                   30, 25000, 5),
  ('00000000-0000-4000-b000-000000000006', '00000000-0000-4000-a000-000000000001', 'Cejas y detalles',     'Limpieza de cejas y líneas.',                                 15, 10000, 6)
on conflict (id) do nothing;

insert into public.barbers (id, barbershop_id, display_name, bio, sort_order) values
  ('00000000-0000-4000-c000-000000000001', '00000000-0000-4000-a000-000000000001', 'Camilo Rojas',   'Fades y texturas. 8 años detrás de la silla.', 1),
  ('00000000-0000-4000-c000-000000000002', '00000000-0000-4000-a000-000000000001', 'Valentina Ortiz','Cortes clásicos y tijera. Precisión ante todo.', 2),
  ('00000000-0000-4000-c000-000000000003', '00000000-0000-4000-a000-000000000001', 'Julián Mesa',    'Barbas y afeitado tradicional a navaja.', 3)
on conflict (id) do nothing;

-- Todos los barberos demo hacen todos los servicios.
insert into public.barber_services (barber_id, service_id, barbershop_id)
select b.id, s.id, b.barbershop_id
from public.barbers b
join public.services s on s.barbershop_id = b.barbershop_id
where b.barbershop_id = '00000000-0000-4000-a000-000000000001'
on conflict do nothing;

-- Horarios laborales: cada barbero descansa un día distinto.
insert into public.barber_schedules (barbershop_id, barber_id, weekday, starts_at, ends_at)
select '00000000-0000-4000-a000-000000000001', b, d, s, e
from (values
  -- Camilo: L–S, descansa domingo
  ('00000000-0000-4000-c000-000000000001'::uuid, 1, time '09:00', time '18:00'),
  ('00000000-0000-4000-c000-000000000001'::uuid, 2, time '09:00', time '18:00'),
  ('00000000-0000-4000-c000-000000000001'::uuid, 3, time '09:00', time '18:00'),
  ('00000000-0000-4000-c000-000000000001'::uuid, 4, time '09:00', time '18:00'),
  ('00000000-0000-4000-c000-000000000001'::uuid, 5, time '09:00', time '18:00'),
  ('00000000-0000-4000-c000-000000000001'::uuid, 6, time '08:00', time '16:00'),
  -- Valentina: M–D, descansa lunes; tarde-noche
  ('00000000-0000-4000-c000-000000000002'::uuid, 2, time '11:00', time '20:00'),
  ('00000000-0000-4000-c000-000000000002'::uuid, 3, time '11:00', time '20:00'),
  ('00000000-0000-4000-c000-000000000002'::uuid, 4, time '11:00', time '20:00'),
  ('00000000-0000-4000-c000-000000000002'::uuid, 5, time '11:00', time '20:00'),
  ('00000000-0000-4000-c000-000000000002'::uuid, 6, time '10:00', time '19:00'),
  ('00000000-0000-4000-c000-000000000002'::uuid, 0, time '10:00', time '15:00'),
  -- Julián: L–S excepto miércoles
  ('00000000-0000-4000-c000-000000000003'::uuid, 1, time '10:00', time '19:00'),
  ('00000000-0000-4000-c000-000000000003'::uuid, 2, time '10:00', time '19:00'),
  ('00000000-0000-4000-c000-000000000003'::uuid, 4, time '10:00', time '19:00'),
  ('00000000-0000-4000-c000-000000000003'::uuid, 5, time '10:00', time '20:00'),
  ('00000000-0000-4000-c000-000000000003'::uuid, 6, time '08:00', time '19:00'),
  ('00000000-0000-4000-c000-000000000003'::uuid, 0, time '10:00', time '15:00')
) as v(b, d, s, e)
where not exists (
  select 1 from public.barber_schedules
  where barbershop_id = '00000000-0000-4000-a000-000000000001'
);
