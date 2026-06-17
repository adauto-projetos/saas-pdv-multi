import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";

import { db } from "@/db";
import { users } from "@/db/schema";
import { getAuthUser } from "@/lib/auth/session";
import { AppSidebar } from "@/components/layout/AppSidebar";
import { AppTopBar } from "@/components/layout/AppTopBar";

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
    <div className="flex h-screen overflow-hidden bg-slate-100">
      <AppSidebar userEmail={userRow?.email ?? ""} />
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <AppTopBar />
        <main className="flex-1 overflow-x-hidden overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
