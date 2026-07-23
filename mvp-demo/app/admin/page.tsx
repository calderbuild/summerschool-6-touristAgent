import { cookies } from "next/headers";
import { ADMIN_COOKIE, sessionToken } from "@/lib/admin";
import AdminLogin from "@/components/admin/AdminLogin";
import AdminConsole from "@/components/admin/AdminConsole";

// Reads a cookie to decide what to render, so it must not be prerendered.
export const dynamic = "force-dynamic";

export const metadata = { title: "Voie Libre — knowledge base console" };

export default async function AdminPage() {
  const secret = process.env.ADMIN_PASSWORD;
  const jar = await cookies();
  const authed = !!secret && jar.get(ADMIN_COOKIE)?.value === sessionToken(secret);

  if (!authed) return <AdminLogin configured={!!secret} />;
  return <AdminConsole />;
}
