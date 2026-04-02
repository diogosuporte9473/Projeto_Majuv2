-- Enable RLS on all tables
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

-- 1. Tenants: only users in the tenant can see it
CREATE POLICY tenant_isolation_policy ON "tenants"
  FOR ALL
  USING (
    id IN (
      SELECT tenant_id FROM user_tenants 
      JOIN users ON users.id = user_tenants.user_id
      WHERE users.auth_id = auth.uid()
    )
  );

-- 2. User Tenants: only users can see their own associations
CREATE POLICY user_tenant_isolation_policy ON "user_tenants"
  FOR ALL
  USING (
    user_id IN (
      SELECT id FROM users WHERE auth_id = auth.uid()
    )
  );

-- 2.1 Users: users can only see and update their own profile
CREATE POLICY user_self_policy ON "users"
  FOR ALL
  USING (auth_id = auth.uid());

-- 3. Business Tables RLS Helper Functions
CREATE OR REPLACE FUNCTION get_current_tenant_id()
RETURNS uuid AS $$
  SELECT tenant_id FROM users WHERE auth_id = auth.uid();
$$ LANGUAGE sql STABLE;

CREATE OR REPLACE FUNCTION get_current_user_id()
RETURNS integer AS $$
  SELECT id FROM users WHERE auth_id = auth.uid();
$$ LANGUAGE sql STABLE;

-- 4. Boards (Isolamento por Tenant + Permissão por Membro/Dono)
CREATE POLICY board_isolation_policy ON "boards"
  FOR ALL
  USING (
    tenant_id = get_current_tenant_id() 
    AND (
      owner_id = get_current_user_id()
      OR id IN (SELECT board_id FROM board_members WHERE user_id = get_current_user_id())
    )
  );

-- Lists
CREATE POLICY list_isolation_policy ON "lists"
  FOR ALL
  USING (tenant_id = get_current_tenant_id());

-- Cards
CREATE POLICY card_isolation_policy ON "cards"
  FOR ALL
  USING (tenant_id = get_current_tenant_id());

-- Card Comments
CREATE POLICY card_comment_isolation_policy ON "card_comments"
  FOR ALL
  USING (tenant_id = get_current_tenant_id());

-- Card Attachments
CREATE POLICY card_attachment_isolation_policy ON "card_attachments"
  FOR ALL
  USING (tenant_id = get_current_tenant_id());

-- Notifications
CREATE POLICY notification_isolation_policy ON "notifications"
  FOR ALL
  USING (tenant_id = get_current_tenant_id());

-- Checklist Templates
CREATE POLICY checklist_template_isolation_policy ON "checklist_templates"
  FOR ALL
  USING (tenant_id = get_current_tenant_id());
