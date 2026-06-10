-- ============================================================================
-- 0001_rls.sql — Row Level Security (multi-tenancy / RN05) — Postgres local
-- ----------------------------------------------------------------------------
-- Aplicado APÓS as tabelas (db:push / 0000). Rode com: npm run db:rls
--
-- Princípio: a RLS é a ÚLTIMA linha de defesa. Mesmo que uma query da aplicação
-- esqueça o filtro por tenant, o banco bloqueia acesso cruzado entre lojas.
-- As políticas valem para o papel `app_user` (assumido por transação em
-- db/rls.ts -> withUserRls). O papel `postgres` (dono das tabelas) tem bypass —
-- por isso onboarding/login/seed rodam direto no `db`.
-- ============================================================================

-- Papel da aplicação (sem login; assumido via SET ROLE pela conexão postgres).
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'app_user') THEN
    CREATE ROLE app_user NOLOGIN;
  END IF;
END $$;

GRANT USAGE ON SCHEMA public TO app_user;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO app_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO app_user;

-- Usuário da sessão atual (lido da GUC setada por withUserRls).
CREATE OR REPLACE FUNCTION current_app_user() RETURNS uuid
  LANGUAGE sql STABLE AS $$
  SELECT NULLIF(current_setting('app.current_user_id', true), '')::uuid
$$;

ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenant_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;

-- users: o usuário enxerga apenas a si mesmo.
DROP POLICY IF EXISTS "user_self_read" ON "users";
CREATE POLICY "user_self_read" ON "users"
  FOR SELECT TO app_user
  USING ("id" = current_app_user());

-- tenants: o usuário enxerga apenas as lojas às quais pertence.
DROP POLICY IF EXISTS "tenant_self_read" ON "tenants";
CREATE POLICY "tenant_self_read" ON "tenants"
  FOR SELECT TO app_user
  USING (
    "id" IN (
      SELECT "tenant_id" FROM "tenant_members"
      WHERE "user_id" = current_app_user()
    )
  );

-- tenants: membros podem atualizar a própria loja (ex.: margem padrão, RF05).
DROP POLICY IF EXISTS "tenant_self_update" ON "tenants";
CREATE POLICY "tenant_self_update" ON "tenants"
  FOR UPDATE TO app_user
  USING (
    "id" IN (
      SELECT "tenant_id" FROM "tenant_members"
      WHERE "user_id" = current_app_user()
    )
  )
  WITH CHECK (
    "id" IN (
      SELECT "tenant_id" FROM "tenant_members"
      WHERE "user_id" = current_app_user()
    )
  );

-- tenant_members: política NÃO-RECURSIVA (user_id = current_app_user()).
DROP POLICY IF EXISTS "tenant_member_isolation" ON "tenant_members";
CREATE POLICY "tenant_member_isolation" ON "tenant_members"
  FOR ALL TO app_user
  USING ("user_id" = current_app_user())
  WITH CHECK ("user_id" = current_app_user());

-- products: isolamento por tenant via subquery em tenant_members (RN05).
DROP POLICY IF EXISTS "tenant_isolation" ON "products";
CREATE POLICY "tenant_isolation" ON "products"
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
