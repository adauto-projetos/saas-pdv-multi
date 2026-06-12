-- ============================================================================
-- 0005_lucro_rls.sql — RLS da tabela cash_sessions (feature 0005F)
-- ----------------------------------------------------------------------------
-- `app_user` e `current_app_user()` já existem (0001_rls.sql).
-- Aplicado por `npm run db:rls` junto com os demais *_rls.sql.
-- sale_items e cash_movements já têm RLS (0002_rls.sql / 0004_financeiro_rls.sql)
-- — só ganharam colunas novas, sem necessidade de nova política.
-- Tabelas: cash_sessions
-- ============================================================================

GRANT SELECT, INSERT, UPDATE, DELETE ON "cash_sessions" TO app_user;

ALTER TABLE "cash_sessions" ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "tenant_isolation" ON "cash_sessions";
CREATE POLICY "tenant_isolation" ON "cash_sessions"
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
