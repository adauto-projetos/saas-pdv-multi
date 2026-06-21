import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";

import { db } from "@/db";
import { users } from "@/db/schema";
import { getAuthUser } from "@/lib/auth/session";
import { AppSidebar } from "@/components/layout/AppSidebar";
import { AppTopBar } from "@/components/layout/AppTopBar";
import { BottomNav } from "@/components/layout/BottomNav";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getAuthUser();
  if (!user) redirect("/login");

  const [userRow] = await db
    .select({ email: users.email })
    .from(users)
    .where(eq(users.id, user.id))
    .limit(1);

  return (
    <div
      className="flex h-screen flex-col overflow-hidden lg:flex-row"
      style={{ background: "var(--pdv-bg)" }}
    >
      <AppSidebar userEmail={userRow?.email ?? ""} />
      <main className="flex flex-1 flex-col min-w-0 overflow-x-hidden overflow-y-auto pb-16 lg:pb-0">
        <AppTopBar />
        {children}
      </main>
      <BottomNav className="lg:hidden" />
    </div>
  );
}
