CREATE TABLE clearauth_cases (
    tenant_id text NOT NULL CHECK (tenant_id ~ '^[a-z0-9_-]{1,64}$'),
    case_id text NOT NULL CHECK (case_id ~ '^[A-Za-z0-9._:-]{1,128}$'),
    patient_ref text NOT NULL CHECK (patient_ref ~ '^[A-Za-z0-9-]{1,64}$'),
    revision bigint NOT NULL DEFAULT 1 CHECK (revision >= 1),
    created_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (tenant_id, case_id)
);
