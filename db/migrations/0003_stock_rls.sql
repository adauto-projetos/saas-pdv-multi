-- ============================================================================
-- 0003_stock_rls.sql — RLS das movimentações de estoque (feature 0003F)
-- ----------------------------------------------------------------------------
-- `app_user` e `current_app_user()` já existem (0001_rls.sql).
-- Aplicado por `npm run db:rls` junto com os demais *_rls.sql.
-- ============================================================================

GRANT SELECT, INSERT, UPDATE, DELETE ON "stock_movements" TO app_user;

ALTER TABLE "stock_movements" ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "tenant_isolation" ON "stock_movements";
CREATE POLICY "tenant_isolation" ON "stock_movements"
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
