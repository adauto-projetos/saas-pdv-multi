-- ============================================================================
-- 0004_financeiro_rls.sql — RLS das tabelas financeiras (feature 0004F)
-- ----------------------------------------------------------------------------
-- `app_user` e `current_app_user()` já existem (0001_rls.sql).
-- Aplicado por `npm run db:rls` junto com os demais *_rls.sql.
-- Tabelas: customers, cash_movements, receivables, receivable_payments,
--          payables, payable_payments
-- ============================================================================

GRANT SELECT, INSERT, UPDATE, DELETE ON "customers" TO app_user;

ALTER TABLE "customers" ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "tenant_isolation" ON "customers";
CREATE POLICY "tenant_isolation" ON "customers"
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

-- ----------------------------------------------------------------------------

GRANT SELECT, INSERT, UPDATE, DELETE ON "cash_movements" TO app_user;

ALTER TABLE "cash_movements" ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "tenant_isolation" ON "cash_movements";
CREATE POLICY "tenant_isolation" ON "cash_movements"
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

-- ----------------------------------------------------------------------------

GRANT SELECT, INSERT, UPDATE, DELETE ON "receivables" TO app_user;

ALTER TABLE "receivables" ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "tenant_isolation" ON "receivables";
CREATE POLICY "tenant_isolation" ON "receivables"
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

-- ----------------------------------------------------------------------------

GRANT SELECT, INSERT, UPDATE, DELETE ON "receivable_payments" TO app_user;

ALTER TABLE "receivable_payments" ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "tenant_isolation" ON "receivable_payments";
CREATE POLICY "tenant_isolation" ON "receivable_payments"
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

-- ----------------------------------------------------------------------------

GRANT SELECT, INSERT, UPDATE, DELETE ON "payables" TO app_user;

ALTER TABLE "payables" ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "tenant_isolation" ON "payables";
CREATE POLICY "tenant_isolation" ON "payables"
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

-- ----------------------------------------------------------------------------

GRANT SELECT, INSERT, UPDATE, DELETE ON "payable_payments" TO app_user;

ALTER TABLE "payable_payments" ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "tenant_isolation" ON "payable_payments";
CREATE POLICY "tenant_isolation" ON "payable_payments"
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
