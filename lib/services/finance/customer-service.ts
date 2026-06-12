import { withUserRls } from "@/db/rls";
import type {
  CreateCustomerInput,
  CustomerQueryInput,
} from "@/lib/validation/finance";
import type { CustomerDto } from "@/types/finance";
import type { AuthContext } from "@/types/product";

import * as data from "./customer-data";

/** RF06 — cadastra cliente. `tenantId` do contexto (RN06); nome obrigatório (RN09). */
export async function createCustomer(
  ctx: AuthContext,
  input: CreateCustomerInput,
): Promise<CustomerDto> {
  return withUserRls(ctx.userId, (tx) =>
    data.insertCustomer(tx, ctx.tenantId, {
      name: input.name,
      phone: input.phone,
    }),
  );
}

/** RF06 — lista clientes do tenant, filtrável por busca no nome. */
export async function listCustomers(
  ctx: AuthContext,
  query: CustomerQueryInput,
): Promise<CustomerDto[]> {
  return withUserRls(ctx.userId, (tx) =>
    data.selectCustomers(tx, ctx.tenantId, query.search),
  );
}
