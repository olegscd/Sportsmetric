import { AdminDashboard } from "@/components/admin/AdminDashboard";
import { isAdminAuthenticated } from "./actions";
import { AdminLoginGate } from "./AdminLoginGate";

export default async function AdminPage() {
  const authenticated = await isAdminAuthenticated();

  if (!authenticated) {
    return <AdminLoginGate />;
  }

  return <AdminDashboard />;
}
