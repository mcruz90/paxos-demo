ALTER TABLE discovery_queries
    ADD COLUMN actor_id text,
    ADD COLUMN request_id text,
    ADD COLUMN created_at timestamptz,
    ADD CHECK (request_id IS NULL OR actor_id IS NOT NULL);

-- T-20 did not record creation times. Only stamp subsequent inserts.
ALTER TABLE discovery_queries ALTER COLUMN created_at SET DEFAULT clock_timestamp();

CREATE UNIQUE INDEX discovery_search_request
    ON discovery_queries (tenant_id, patient_ref, case_id, actor_id, request_id)
    WHERE request_id IS NOT NULL;

CREATE INDEX discovery_query_history
    ON discovery_queries (tenant_id, patient_ref, case_id, created_at DESC NULLS LAST, query_id DESC);
