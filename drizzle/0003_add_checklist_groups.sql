-- Migration to add checklist groups support
CREATE TABLE IF NOT EXISTS "card_checklist_groups" (
    "id" SERIAL PRIMARY KEY,
    "card_id" INTEGER NOT NULL REFERENCES "cards"("id") ON DELETE CASCADE,
    "title" VARCHAR(255) NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    "updated_at" TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- Add group_id to card_checklists if it doesn't exist
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='card_checklists' AND column_name='group_id') THEN
        ALTER TABLE "card_checklists" ADD COLUMN "group_id" INTEGER REFERENCES "card_checklist_groups"("id") ON DELETE CASCADE;
    END IF;
END $$;
