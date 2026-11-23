CREATE TABLE IF NOT EXISTS public.project_interaction_events (
    project_id UUID NOT NULL,
    event_id UUID NOT NULL,
    user_id TEXT NOT NULL,
    condition TEXT NOT NULL CHECK (condition IN ('model', 'fixed')),
    event_type TEXT NOT NULL,
    stage SMALLINT NOT NULL CHECK (stage BETWEEN 1 AND 5),
    occurred_at TIMESTAMPTZ NOT NULL,
    details JSONB NOT NULL DEFAULT '{}',
    PRIMARY KEY (project_id, event_id)
);

CREATE INDEX IF NOT EXISTS project_interaction_events_lookup
    ON public.project_interaction_events (user_id, project_id, occurred_at);

ALTER TABLE public.project_interaction_events ENABLE ROW LEVEL SECURITY;
