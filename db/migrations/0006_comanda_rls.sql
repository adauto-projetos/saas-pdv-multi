-- ============================================================================
-- 0006_comanda_rls.sql — RLS das tabelas comandas + comanda_items (feature 0006F)
-- ----------------------------------------------------------------------------
-- `app_user` e `current_app_user()` já existem (0001_rls.sql).
-- Aplicado por `npm run db:rls` junto com os demais *_rls.sql.
-- stock_movements e sales já têm RLS — não duplicar.
-- Tabelas: comandas, comanda_items
-- ============================================================================

GRANT SELECT, INSERT, UPDATE, DELETE ON "comandas" TO app_user;

ALTER TABLE "comandas" ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "tenant_isolation" ON "comandas";
CREATE POLICY "tenant_isolation" ON "comandas"
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

GRANT SELECT, INSERT, UPDATE, DELETE ON "comanda_items" TO app_user;

ALTER TABLE "comanda_items" ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "tenant_isolation" ON "comanda_items";
CREATE POLICY "tenant_isolation" ON "comanda_items"
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
