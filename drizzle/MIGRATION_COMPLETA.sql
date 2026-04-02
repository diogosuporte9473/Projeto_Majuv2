-- 1. Criar Tabela de Tenants
CREATE TABLE IF NOT EXISTS "tenants" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "name" text NOT NULL,
  "slug" text NOT NULL UNIQUE,
  "app_logo_url" text,
  "primary_color" text DEFAULT '#4b4897',
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

-- 2. Criar Tabela de User Tenants (N:N)
CREATE TABLE IF NOT EXISTS "user_tenants" (
  "id" serial PRIMARY KEY,
  "user_id" integer NOT NULL,
  "tenant_id" uuid NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
  "role" text DEFAULT 'member' NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS "user_tenant_idx" ON "user_tenants" ("user_id", "tenant_id");

-- 3. Adicionar colunas necessárias na tabela users
DO $$ 
BEGIN 
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='auth_id') THEN
    ALTER TABLE "users" ADD COLUMN "auth_id" uuid UNIQUE;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='tenant_id') THEN
    ALTER TABLE "users" ADD COLUMN "tenant_id" uuid REFERENCES "tenants"("id");
  ELSE
    -- Se já existe mas o tipo é diferente (ex: integer), precisamos converter ou recriar
    -- Para este script, vamos assumir que se já existe, o tipo está correto ou o usuário cuidará disso
    -- Se for integer, o comando abaixo pode falhar, mas o RLS funcionará se o tipo for UUID.
    ALTER TABLE "users" ALTER COLUMN "tenant_id" TYPE uuid USING tenant_id::uuid;
  END IF;
END $$;

-- 4. Adicionar tenant_id nas tabelas de negócio (Boards, Lists, Cards, etc.)
DO $$ 
DECLARE
  t text;
BEGIN 
  FOR t IN SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name IN ('boards', 'lists', 'cards', 'card_comments', 'card_attachments', 'notifications', 'checklist_templates')
  LOOP
    EXECUTE format('ALTER TABLE %I ADD COLUMN IF NOT EXISTS tenant_id uuid REFERENCES tenants(id)', t);
  END LOOP;
END $$;

-- 5. Vincular usuários existentes pelo e-mail (Opcional, mas ajuda no erro que você teve)
UPDATE public.users u
SET auth_id = a.id
FROM auth.users a
WHERE a.email = u.username || '@projeto-maju.com'
AND u.auth_id IS NULL;

-- 6. Habilitar RLS e Criar Políticas (Copie o conteúdo do 0006_setup_rls.sql abaixo se preferir rodar tudo junto)
-- [O conteúdo abaixo é o mesmo do arquivo 0006_setup_rls.sql atualizado]

ALTER TABLE "tenants" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "user_tenants" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "users" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "boards" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "lists" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "cards" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "card_comments" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "card_attachments" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "notifications" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "checklist_templates" ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation_policy ON "tenants";
CREATE POLICY tenant_isolation_policy ON "tenants" FOR ALL USING (
  id IN (SELECT tenant_id FROM user_tenants JOIN users ON users.id = user_tenants.user_id WHERE users.auth_id = auth.uid())
);

DROP POLICY IF EXISTS user_tenant_isolation_policy ON "user_tenants";
CREATE POLICY user_tenant_isolation_policy ON "user_tenants" FOR ALL USING (
  user_id IN (SELECT id FROM users WHERE auth_id = auth.uid())
);

DROP POLICY IF EXISTS user_self_policy ON "users";
CREATE POLICY user_self_policy ON "users" FOR ALL USING (auth_id = auth.uid());

CREATE OR REPLACE FUNCTION get_current_tenant_id() RETURNS uuid AS $$
  SELECT tenant_id FROM users WHERE auth_id = auth.uid();
$$ LANGUAGE sql STABLE;

CREATE OR REPLACE FUNCTION get_current_user_id() RETURNS integer AS $$
  SELECT id FROM users WHERE auth_id = auth.uid();
$$ LANGUAGE sql STABLE;

DROP POLICY IF EXISTS board_isolation_policy ON "boards";
CREATE POLICY board_isolation_policy ON "boards" FOR ALL USING (
  tenant_id = get_current_tenant_id() AND (owner_id = get_current_user_id() OR id IN (SELECT board_id FROM board_members WHERE user_id = get_current_user_id()))
);

DROP POLICY IF EXISTS list_isolation_policy ON "lists";
CREATE POLICY list_isolation_policy ON "lists" FOR ALL USING (tenant_id = get_current_tenant_id());

DROP POLICY IF EXISTS card_isolation_policy ON "cards";
CREATE POLICY card_isolation_policy ON "cards" FOR ALL USING (tenant_id = get_current_tenant_id());
