ALTER TABLE clearauth_cases ADD UNIQUE (tenant_id, patient_ref, case_id);

CREATE TABLE discovery_queries (
    tenant_id text NOT NULL,
    patient_ref text NOT NULL,
    case_id uuid NOT NULL,
    query_id uuid NOT NULL,
    query text NOT NULL CHECK (length(query) <= 256),
    revision bigint NOT NULL CHECK (revision > 0),
    PRIMARY KEY (tenant_id, patient_ref, case_id, query_id),
    FOREIGN KEY (tenant_id, patient_ref, case_id)
        REFERENCES clearauth_cases (tenant_id, patient_ref, case_id)
);

CREATE TABLE discovery_results (
    tenant_id text NOT NULL,
    patient_ref text NOT NULL,
    case_id uuid NOT NULL,
    query_id uuid NOT NULL,
    result_id uuid NOT NULL,
    ordinal integer NOT NULL CHECK (ordinal >= 0),
    source jsonb NOT NULL,
    PRIMARY KEY (tenant_id, patient_ref, case_id, result_id),
    UNIQUE (tenant_id, patient_ref, case_id, query_id, ordinal),
    FOREIGN KEY (tenant_id, patient_ref, case_id, query_id) REFERENCES discovery_queries
);

CREATE TABLE discovery_attachments (
    tenant_id text NOT NULL,
    patient_ref text NOT NULL,
    case_id uuid NOT NULL,
    attachment_id uuid NOT NULL,
    result_id uuid NOT NULL,
    actor_id text NOT NULL,
    attached_at timestamptz NOT NULL DEFAULT clock_timestamp(),
    removed boolean NOT NULL DEFAULT false,
    PRIMARY KEY (tenant_id, patient_ref, case_id, attachment_id),
    FOREIGN KEY (tenant_id, patient_ref, case_id, result_id) REFERENCES discovery_results
);

CREATE TABLE discovery_receipts (
    tenant_id text NOT NULL,
    patient_ref text NOT NULL,
    case_id uuid NOT NULL,
    actor_id text NOT NULL,
    request_id text NOT NULL,
    operation text NOT NULL CHECK (operation IN ('attach','remove')),
    target_id uuid NOT NULL,
    revision bigint NOT NULL,
    attachment_id uuid NOT NULL,
    PRIMARY KEY (tenant_id, patient_ref, case_id, actor_id, request_id),
    FOREIGN KEY (tenant_id, patient_ref, case_id, attachment_id) REFERENCES discovery_attachments
);
