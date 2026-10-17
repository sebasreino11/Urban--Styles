import { requireStaff } from "@/lib/domain/staff";

/** Todo /admin exige rol admin. RLS lo vuelve a exigir en cada consulta. */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await requireStaff("admin");
  return children;
}
