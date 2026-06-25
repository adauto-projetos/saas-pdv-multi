import { eq } from "drizzle-orm";

import { db } from "@/db";
import { users } from "@/db/schema";
import { getAuthUser } from "@/lib/auth/session";
import { UnauthorizedError } from "@/lib/services/errors";

export async function requireFounder(): Promise<{ userId: string }> {
  const user = await getAuthUser();
  if (!user) throw new UnauthorizedError();

  const [row] = await db
    .select({ isFounder: users.isFounder })
    .from(users)
    .where(eq(users.id, user.id))
    .limit(1);

  if (!row?.isFounder) throw new UnauthorizedError("Acesso restrito ao founder");

  return { userId: user.id };
}
