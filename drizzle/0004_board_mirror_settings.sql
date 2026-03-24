-- Migration to add board mirror settings
CREATE TABLE IF NOT EXISTS "board_mirror_settings" (
    "id" SERIAL PRIMARY KEY,
    "board_id" INTEGER NOT NULL REFERENCES "boards"("id") ON DELETE CASCADE UNIQUE,
    "mirror_labels" BOOLEAN NOT NULL DEFAULT TRUE,
    "mirror_checklists" BOOLEAN NOT NULL DEFAULT TRUE,
    "mirror_comments" BOOLEAN NOT NULL DEFAULT FALSE,
    "mirror_attachments" BOOLEAN NOT NULL DEFAULT FALSE,
    "mirror_custom_fields" BOOLEAN NOT NULL DEFAULT TRUE,
    "mirror_dates" BOOLEAN NOT NULL DEFAULT TRUE,
    "mirror_description" BOOLEAN NOT NULL DEFAULT TRUE,
    "updated_at" TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- Enable RLS
ALTER TABLE "board_mirror_settings" ENABLE ROW LEVEL SECURITY;

-- Policies for board_mirror_settings
CREATE POLICY "Allow all for authenticated on board_mirror_settings" 
ON "board_mirror_settings" FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Allow all for anon on board_mirror_settings" 
ON "board_mirror_settings" FOR ALL TO anon USING (true) WITH CHECK (true);

-- Add to realtime publication
ALTER PUBLICATION supabase_realtime ADD TABLE board_mirror_settings;
