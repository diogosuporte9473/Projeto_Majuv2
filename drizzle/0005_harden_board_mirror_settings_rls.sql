-- Harden RLS policies for board_mirror_settings:
-- remove permissive public/authenticated policies.
DROP POLICY IF EXISTS "Allow all for authenticated on board_mirror_settings" ON "board_mirror_settings";
DROP POLICY IF EXISTS "Allow all for anon on board_mirror_settings" ON "board_mirror_settings";

-- Default deny remains enabled through RLS.
