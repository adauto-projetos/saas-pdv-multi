"use server";

import { redirect } from "next/navigation";

import { requireFounder } from "@/lib/auth/admin";
import {
  clearImpersonation,
  setImpersonation,
} from "@/lib/auth/impersonation";
import { selectTenantById } from "@/lib/services/subscriptions/repository";

/**
 * Founder "entra" numa loja (SF03 RF03): valida founder + existência do tenant,
 * grava o cookie de impersonação e leva ao app (/caixa). A partir daí a RLS
 * libera os dados da loja via `current_app_tenants()`.
 */
export async function enterStoreAction(tenantId: string): Promise<void> {
  await requireFounder();

  const tenant = await selectTenantById(tenantId);
  if (!tenant) {
    throw new Error("Loja não encontrada");
  }

  await setImpersonation(tenantId);
  redirect("/caixa");
}

/**
 * Founder "sai" da loja (SF03 RF04): remove o cookie e volta ao painel.
 * Sair é sempre permitido (não exige revalidar founder).
 */
export async function exitStoreAction(): Promise<void> {
  await clearImpersonation();
  redirect("/superadmin");
}
