import { withUserRls } from "@/db/rls";
import {
  searchProductsByName,
  selectProductByBarcode,
} from "@/lib/services/products/data";
import type { AuthContext, ProductDto } from "@/types/product";

/** RF01 — acha produto por código de barras (sob RLS do tenant). */
export async function lookupProductByBarcode(
  ctx: AuthContext,
  barcode: string,
): Promise<ProductDto | null> {
  const code = barcode.trim();
  if (!code) return null;
  return withUserRls(ctx.userId, (tx) =>
    selectProductByBarcode(tx, ctx.tenantId, code),
  );
}

/** RF02 — busca produtos por nome (parcial). */
export async function searchProducts(
  ctx: AuthContext,
  query: string,
): Promise<ProductDto[]> {
  const q = query.trim();
  if (!q) return [];
  return withUserRls(ctx.userId, (tx) =>
    searchProductsByName(tx, ctx.tenantId, q, 20),
  );
}
