CREATE TABLE clearauth_case_events (
    tenant_id text NOT NULL,
    event_id text NOT NULL CHECK (event_id ~ '^[A-Za-z0-9._:-]{1,128}$'),
    case_id uuid NOT NULL,
    actor_id text NOT NULL CHECK (actor_id ~ '^[A-Za-z0-9._:-]{1,128}$'),
    action text NOT NULL CHECK (action = 'case_created'),
    case_revision bigint NOT NULL CHECK (case_revision = 1),
    idempotency_key text NOT NULL CHECK (idempotency_key ~ '^[A-Za-z0-9._:-]{1,128}$'),
    occurred_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (tenant_id, event_id),
    UNIQUE (tenant_id, actor_id, action, idempotency_key),
    UNIQUE (tenant_id, case_id, action),
    FOREIGN KEY (tenant_id, case_id) REFERENCES clearauth_cases (tenant_id, case_id)
);
