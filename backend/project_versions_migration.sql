CREATE TABLE IF NOT EXISTS project_versions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL,
    user_id TEXT,
    version INTEGER NOT NULL,
    snapshot_type TEXT NOT NULL CHECK (snapshot_type IN ('original', 'revision', 'final')),
    source TEXT,
    changed_fields TEXT[] DEFAULT '{}',
    previous_snapshot JSONB,
    snapshot JSONB NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_project_versions_project_version
    ON project_versions(project_id, version);

CREATE INDEX IF NOT EXISTS idx_project_versions_user_project
    ON project_versions(user_id, project_id);

CREATE INDEX IF NOT EXISTS idx_project_versions_type
    ON project_versions(snapshot_type);

ALTER TABLE project_versions ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_policies
        WHERE schemaname = 'public'
            AND tablename = 'project_versions'
            AND policyname = 'Allow all'
    ) THEN
        CREATE POLICY "Allow all" ON project_versions FOR ALL USING (true) WITH CHECK (true);
    END IF;
END $$;
