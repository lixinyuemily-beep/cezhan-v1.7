ALTER TABLE exhibits
ADD COLUMN IF NOT EXISTS user_id TEXT,
ADD COLUMN IF NOT EXISTS storage_bucket TEXT,
ADD COLUMN IF NOT EXISTS storage_path TEXT,
ADD COLUMN IF NOT EXISTS thumbnail_storage_path TEXT;

CREATE INDEX IF NOT EXISTS idx_exhibits_user_id ON exhibits(user_id);
CREATE INDEX IF NOT EXISTS idx_exhibits_user_project_id ON exhibits(user_id, project_id);
CREATE INDEX IF NOT EXISTS idx_exhibits_user_unit_id ON exhibits(user_id, unit_id);
