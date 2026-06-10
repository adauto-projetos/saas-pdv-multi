"use server";

import { revalidatePath } from "next/cache";

import { requireAuthContext } from "@/lib/auth";
import type { ActionResult } from "@/lib/services/errors";
import { toActionError } from "@/lib/services/errors";
import {
  getDefaultMarkup,
  updateDefaultMarkup,
} from "@/lib/services/tenants/settings-service";
import { updateDefaultMarkupSchema } from "@/lib/validation/product";
import type { TenantSettingsDto } from "@/types/product";

export async function getDefaultMarkupAction(): Promise<
  ActionResult<TenantSettingsDto>
> {
  try {
    const ctx = await requireAuthContext();
    return { ok: true, data: await getDefaultMarkup(ctx) };
  } catch (error) {
    return toActionError(error);
  }
}

export async function updateDefaultMarkupAction(
  input: unknown,
): Promise<ActionResult<TenantSettingsDto>> {
  const parsed = updateDefaultMarkupSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: "Informe uma margem válida (0 a 999,99%).",
      fieldErrors: { percent: parsed.error.issues[0]?.message ?? "Inválido" },
    };
  }
  try {
    const ctx = await requireAuthContext();
    const settings = await updateDefaultMarkup(ctx, parsed.data.percent);
    revalidatePath("/settings");
    return { ok: true, data: settings };
  } catch (error) {
    return toActionError(error);
  }
}
