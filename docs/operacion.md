# Operación y soporte

Guía práctica para el día a día de la barbería y para diagnosticar fallas comunes. Para la visión general, ver el [README](../README.md).

## Guía de operación para el dueño de la barbería

*Esta sección es para quien maneja la barbería. No necesitas saber programar.*

**Entrar.** Ve a la página de tu barbería, baja hasta el final y toca **"Acceso para el equipo"**. Entra con tu correo y contraseña. Como eres dueño y barbero, arriba a la derecha verás **Barbero | Administración** para pasar de tu agenda al panel del negocio.

**Agregar un barbero.**
1. Administración › **Equipo** › "Invitar al equipo".
2. Escribe su nombre y correo y marca **Barbero** (y **Administrador** solo si debe controlar todo).
3. Le llegará un correo para crear su contraseña.
4. Abre su nombre en la lista para elegir **qué servicios hace** y definir **su horario de trabajo**. Hasta que tenga horario no aparecerán horarios suyos para reservar.
5. Para que alguien deje de recibir reservas, desmarca "Visible y reservable". Para que no pueda entrar más, desmarca "Puede iniciar sesión". Su historial se conserva.

**Definir servicios y precios.** Administración › **Servicios**. Toca *Editar* para cambiar nombre, duración o precio, u *Ocultar* para retirarlo del portal. La **duración** es importante: es el tiempo que la cita bloquea en la agenda. Cambiar un precio no cambia las citas ya agendadas.

**Horario y datos de la barbería.** Administración › **Barbería**. Aquí cambias la dirección, el teléfono, el texto de "La casa" y el **horario de atención**, que admite varias franjas por día (por ejemplo, cerrar al almuerzo). También ajustas las reglas: cada cuántos minutos se ofrecen horarios, con cuántos días de anticipación se puede reservar y hasta cuándo puede cancelar el cliente.

**Aprobar días libres.** Cuando un barbero pide un día libre aparece un número rojo en **Solicitudes**. Verás las fechas, el motivo y si ya tiene citas agendadas en ese tiempo. *Aprobar* cierra su agenda en esas horas, pero **no cancela las citas que ya existían**: revísalas en **Citas**. *Rechazar* deja su agenda abierta, y puedes escribirle una nota. Tus propios bloqueos se aplican de una vez.

**Citas por teléfono.** **Agendar cita** (en tu agenda o en Administración › Citas). El cliente recibe el mismo correo de confirmación.

**Cerrar el día.** Al terminar cada cita, márcala como **Atendida** o **No vino**. Así los ingresos y la tasa de inasistencia salen exactos. En **Citas › Sin cerrar** ves las pendientes de marcar.

**Leer el Resumen.**
- **Ingresos (atendidas):** dinero de las citas marcadas como atendidas en el periodo. Es un estimado según los precios del sistema, no lo que entró a caja.
- **Citas agendadas:** reservas del periodo sin contar las canceladas.
- **Tasa de cancelación:** de cada 100 reservas, cuántas se cancelaron. Si sube, revisa la antelación para cancelar.
- **No asistieron:** de las citas ya cerradas, cuántas fueron "No vino".
- **Servicios más pedidos** y **Por barbero:** qué se vende más y quién atiende más.
- **Próximos 7 días:** citas confirmadas e ingreso esperado.

**Avisos al celular.** Cada barbero entra a *Avisos al celular*, instala la app gratuita **Hook.Notifier**, pega su URL personal y toca *Enviar prueba*.

---


## Solución de problemas comunes

| Síntoma | Causa probable | Solución |
|---|---|---|
| La página carga pero no hay servicios ni horarios; `/api/health` responde 503 | **Supabase pausó el proyecto** por 7 días sin actividad (plan Free) | Dashboard de Supabase › *Restore project*. Verifica que el Cron Trigger esté activo (Workers › urban-styles › Triggers) y que el Worker tenga `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` como vars. |
| Error 1102 / "Worker exceeded CPU time limit" | Plan Free: 10 ms de CPU por request | Revisa en *Observability* qué ruta lo provoca. Si es tráfico real, pasa a **Workers Paid (USD 5/mes)**; no requiere cambios de código. |
| `wrangler deploy` falla por tamaño ("exceeds 3 MiB") | Una dependencia nueva infló el bundle | `npx wrangler deploy --dry-run` muestra el tamaño. Evita SDKs pesados (usa `fetch`) o pasa a Workers Paid (10 MiB). |
| El cliente no recibe el correo | Falta `RESEND_API_KEY`, o el remitente `onboarding@resend.dev` (sin dominio verificado) solo entrega a tu propio correo, o se superaron 100/día | Revisa `notification_log` (status y detalle) y resend.com › Logs. Verifica tu dominio en Resend y cambia `EMAIL_FROM`. |
| El barbero no recibe el push | No configuró su URL, la URL está mal o la app no tiene permiso de notificaciones | `notification_log` mostrará `skipped` o `failed`. Pídele usar *Enviar prueba* en "Avisos al celular". |
| "Ese horario ya no está disponible" al reservar | Otro cliente lo tomó o cambió la configuración | Comportamiento esperado: la BD lo impidió. El portal recarga los horarios. |
| No aparecen horarios para un barbero | No tiene horario laboral, no tiene el servicio asignado, está oculto, no coincide con el horario comercial o tiene un bloqueo aprobado | Administración › Equipo › (barbero): revisa servicios, horario y "Visible". |
| La invitación lleva a "Enlace no válido" | Plantilla de correo sin `token_hash`, URL no permitida o enlace ya usado o expirado | Configura las plantillas y Redirect URLs (ver [Configurar Supabase](../README.md#configurar-supabase)). Reenvía la invitación o usa "¿La olvidaste?". |
| "Tu cuenta no tiene acceso activo" al entrar | La cuenta existe en Auth pero no tiene membresía activa | El admin debe activarla en Equipo, o usa `create-owner` para el primer dueño. |
| Las invitaciones dejan de enviarse | Límite del SMTP por defecto de Supabase | Configura Resend como SMTP en Supabase. |
| El formulario dice "No pudimos verificar que eres humano" | Turnstile mal configurado (dominio no agregado o llaves de otro sitio) | Cloudflare › Turnstile › agrega el dominio y revisa las llaves. |
| En `npm install`, el build falla con `workerd`/`esbuild` sin binario | npm ≥ 11 bloqueó sus scripts de instalación | `npm install-scripts approve esbuild unrs-resolver workerd && npm rebuild` |
