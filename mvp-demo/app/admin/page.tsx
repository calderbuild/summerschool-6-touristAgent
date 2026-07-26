import { cookies } from "next/headers";
import { ADMIN_COOKIE, sessionToken } from "@/lib/admin";
import AdminLogin from "@/components/admin/AdminLogin";
import AdminConsole from "@/components/admin/AdminConsole";

// Reads a cookie to decide what to render, so it must not be prerendered.
export const dynamic = "force-dynamic";

// Kept out of search results. It is a password-gated staff console, so there is
// nothing here for a search engine to show anyone, and a public listing of it is
// an invitation to try the door.
export const metadata = {
  title: "Voie Libre: knowledge base console",
  robots: { index: false, follow: false },
};

export default async function AdminPage() {
  const secret = process.env.ADMIN_PASSWORD;
  const jar = await cookies();
  const authed = !!secret && jar.get(ADMIN_COOKIE)?.value === sessionToken(secret);

  if (!authed) return <AdminLogin configured={!!secret} />;
  return <AdminConsole />;
}
