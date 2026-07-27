ALTER TABLE completed_projects
ADD COLUMN IF NOT EXISTS user_id TEXT;

CREATE INDEX IF NOT EXISTS idx_completed_projects_user_id ON completed_projects(user_id);
CREATE INDEX IF NOT EXISTS idx_completed_projects_user_project_id ON completed_projects(user_id, project_id);
