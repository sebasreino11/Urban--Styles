/** Tipos de dominio compartidos entre servidor y UI (solo datos, sin lógica). */

export type AppRole = "admin" | "barber";
export type AppointmentStatus = "pending" | "confirmed" | "completed" | "cancelled" | "no_show";
export type TimeOffStatus = "pending" | "approved" | "rejected";
export type BookingSource = "web" | "api" | "whatsapp" | "staff";

export interface Shop {
  id: string;
  slug: string;
  name: string;
  tagline: string | null;
  about: string | null;
  phone: string | null;
  whatsapp: string | null;
  email: string | null;
  address: string | null;
  city: string | null;
  maps_url: string | null;
  instagram_url: string | null;
  timezone: string;
  currency: string;
  slot_interval_min: number;
  booking_horizon_days: number;
  min_notice_min: number;
  cancel_notice_min: number;
}

export interface BusinessHours {
  id: string;
  weekday: number;
  opens_at: string;
  closes_at: string;
}

export interface Service {
  id: string;
  name: string;
  description: string | null;
  duration_min: number;
  price_cop: number;
  active: boolean;
  sort_order: number;
}

export interface Barber {
  id: string;
  display_name: string;
  bio: string | null;
  photo_url: string | null;
  active: boolean;
  sort_order: number;
  membership_id: string | null;
}

export interface PublicBarber extends Pick<Barber, "id" | "display_name" | "bio" | "photo_url"> {
  service_ids: string[];
}

export interface Slot {
  startsAt: string;
  endsAt: string;
  barberIds: string[];
}

export interface Booking {
  appointment_id: string;
  barbershop_id: string;
  shop_name: string;
  timezone: string;
  barber_id: string;
  barber_name: string;
  service_name: string;
  price_cop: number;
  starts_at: string;
  ends_at: string;
  customer_name: string;
  customer_email: string;
  cancel_token: string;
}

export interface TokenAppointment {
  appointment_id: string;
  status: AppointmentStatus;
  starts_at: string;
  ends_at: string;
  service_id: string | null;
  barber_id: string;
  service_name: string;
  price_cop: number;
  barber_name: string;
  customer_name: string;
  shop_name: string;
  shop_slug: string;
  shop_phone: string | null;
  shop_address: string | null;
  timezone: string;
  can_cancel: boolean;
  cancel_notice_min: number;
}

export interface RescheduledAppointment extends TokenAppointment {
  previous_starts_at: string;
}

export interface StaffAppointment {
  id: string;
  barber_id: string;
  starts_at: string;
  ends_at: string;
  status: AppointmentStatus;
  service_name: string;
  price_cop: number;
  source: BookingSource;
  cancel_reason: string | null;
  cancelled_by: "customer" | "staff" | null;
  staff_note: string | null;
  customer: { name: string; email: string; phone: string | null } | null;
  barber: { display_name: string } | null;
}

export interface TimeOffRequest {
  id: string;
  barber_id: string;
  starts_at: string;
  ends_at: string;
  reason: string;
  status: TimeOffStatus;
  review_note: string | null;
  reviewed_at: string | null;
  created_at: string;
  barber?: { display_name: string } | null;
}

export interface Insights {
  total: number;
  completed: number;
  cancelled: number;
  no_show: number;
  upcoming: number;
  /** Citas ya terminadas que nadie marcó como atendida / no vino. */
  overdue: number;
  revenue_cop: number;
  expected_cop: number;
  cancellation_rate: number;
  no_show_rate: number;
  top_services: { name: string; count: number; revenue_cop: number }[];
  by_barber: { id: string; name: string; completed: number; booked: number; revenue_cop: number }[];
  daily: { day: string; booked: number; cancelled: number }[];
}
