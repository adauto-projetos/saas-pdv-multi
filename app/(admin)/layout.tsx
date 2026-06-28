import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { Shield } from "lucide-react";

import { db } from "@/db";
import { users } from "@/db/schema";
import { getAuthUser } from "@/lib/auth/session";
import { SignOutButton } from "@/components/auth/SignOutButton";

/**
 * Layout do super admin (route group `(admin)`). Chrome próprio — sem o sidebar do
 * app — para a área exclusiva do founder. O guard de founder é feito em cada page
 * via requireFounder(); aqui só garantimos sessão e montamos o cabeçalho.
 */
export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getAuthUser();
  if (!user) redirect("/login");

  const [userRow] = await db
    .select({ email: users.email, isFounder: users.isFounder })
    .from(users)
    .where(eq(users.id, user.id))
    .limit(1);

  // Defesa em profundidade: além do requireFounder() de cada page, o layout
  // recusa renderizar o chrome do admin para quem não é founder.
  if (!userRow?.isFounder) redirect("/");

  return (
    <div style={{ minHeight: "100vh", background: "#f1f5f9" }}>
      <header
        style={{
          background: "#0f172a",
          color: "#fff",
          padding: "0 28px",
          height: 56,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexShrink: 0,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <Shield size={17} strokeWidth={2} color="#818cf8" />
          <span
            style={{
              fontFamily: "var(--font-jakarta)",
              fontWeight: 800,
              fontSize: 15,
              letterSpacing: "-0.3px",
            }}
          >
            PDV<span style={{ color: "#818cf8" }}>.ART</span>.br
            <span style={{ color: "#64748b", fontWeight: 600, marginLeft: 8 }}>
              / Admin
            </span>
          </span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <span style={{ color: "#94a3b8", fontSize: 13, fontWeight: 600 }}>
            {userRow?.email ?? ""}
          </span>
          <SignOutButton />
        </div>
      </header>
      <main style={{ maxWidth: 1140, margin: "0 auto", padding: "32px 24px" }}>
        {children}
      </main>
    </div>
  );
}
