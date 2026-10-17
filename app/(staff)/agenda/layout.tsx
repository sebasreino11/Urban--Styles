import { requireStaff } from "@/lib/domain/staff";

/** Todo /agenda exige el rol barber (con perfil de barbero vinculado). */
export default async function AgendaLayout({ children }: { children: React.ReactNode }) {
  await requireStaff("barber");
  return children;
}
