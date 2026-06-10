-- ============================================================================
-- 0002_sales_rls.sql — RLS das vendas (feature 0002F)
-- ----------------------------------------------------------------------------
-- O papel `app_user` e a função `current_app_user()` já existem (0001_rls.sql).
-- Aplicado por `npm run db:rls` junto com os demais *_rls.sql.
-- ============================================================================

GRANT SELECT, INSERT, UPDATE, DELETE ON "sales" TO app_user;
GRANT SELECT, INSERT, UPDATE, DELETE ON "sale_items" TO app_user;

ALTER TABLE "sales" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "sale_items" ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "tenant_isolation" ON "sales";
CREATE POLICY "tenant_isolation" ON "sales"
  FOR ALL TO app_user
  USING (
    "tenant_id" IN (
      SELECT "tenant_id" FROM "tenant_members"
      WHERE "user_id" = current_app_user()
    )
  )
  WITH CHECK (
    "tenant_id" IN (
      SELECT "tenant_id" FROM "tenant_members"
      WHERE "user_id" = current_app_user()
    )
  );

DROP POLICY IF EXISTS "tenant_isolation" ON "sale_items";
CREATE POLICY "tenant_isolation" ON "sale_items"
  FOR ALL TO app_user
  USING (
    "tenant_id" IN (
      SELECT "tenant_id" FROM "tenant_members"
      WHERE "user_id" = current_app_user()
    )
  )
  WITH CHECK (
    "tenant_id" IN (
      SELECT "tenant_id" FROM "tenant_members"
      WHERE "user_id" = current_app_user()
    )
  );
