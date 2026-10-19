import { AdminDashboard } from "@/components/admin/AdminDashboard";
import { isAdminAuthenticated } from "./actions";
import { AdminLoginGate } from "./AdminLoginGate";
import { pageMetadata } from "@/lib/seo";

export const metadata = pageMetadata("Admin Workspace", "Sportsmetric administration.", "/admin", false);

export default async function AdminPage() {
  const authenticated = await isAdminAuthenticated();

  if (!authenticated) {
    return <AdminLoginGate />;
  }

  return <AdminDashboard />;
}
