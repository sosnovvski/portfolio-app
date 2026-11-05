import { AdminApp } from "@/admin/AdminApp";

/** Holds no data and checks no session. Spring enforces all authorization on the API calls. */
export default function AdminPage() {
  return <AdminApp />;
}
