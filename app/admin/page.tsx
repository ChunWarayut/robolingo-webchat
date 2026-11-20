import { redirect } from "next/navigation";
import AdminInbox from "@/components/AdminInbox";
import { isAdmin } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  if (!(await isAdmin())) redirect("/admin/login");
  return <AdminInbox />;
}
