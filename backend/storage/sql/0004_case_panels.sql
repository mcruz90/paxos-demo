-- Explicit provisioning only: login never creates a principal or a panel grant.
CREATE TABLE clearauth_case_principals (
    tenant_id text NOT NULL CHECK (tenant_id ~ '^[a-z0-9_-]{1,64}$'),
    subject_id text NOT NULL CHECK (char_length(subject_id) BETWEEN 1 AND 150),
    actor_id text NOT NULL CHECK (actor_id ~ '^[A-Za-z0-9._:-]{1,128}$'),
    role text NOT NULL CHECK (role IN ('coordinator', 'clinician', 'admin')),
    active boolean NOT NULL DEFAULT false,
    PRIMARY KEY (tenant_id, subject_id),
    UNIQUE (tenant_id, actor_id)
);

CREATE TABLE clearauth_panel_groups (
    tenant_id text NOT NULL CHECK (tenant_id ~ '^[a-z0-9_-]{1,64}$'),
    group_id text NOT NULL CHECK (group_id ~ '^[A-Za-z0-9._:-]{1,128}$'),
    PRIMARY KEY (tenant_id, group_id)
);

CREATE TABLE clearauth_panel_members (
    tenant_id text NOT NULL,
    group_id text NOT NULL,
    actor_id text NOT NULL,
    PRIMARY KEY (tenant_id, group_id, actor_id),
    FOREIGN KEY (tenant_id, group_id) REFERENCES clearauth_panel_groups (tenant_id, group_id),
    FOREIGN KEY (tenant_id, actor_id) REFERENCES clearauth_case_principals (tenant_id, actor_id)
);

CREATE TABLE clearauth_panel_patients (
    tenant_id text NOT NULL,
    group_id text NOT NULL,
    patient_ref text NOT NULL CHECK (patient_ref ~ '^[A-Za-z0-9-]{1,64}$'),
    PRIMARY KEY (tenant_id, group_id, patient_ref),
    FOREIGN KEY (tenant_id, group_id) REFERENCES clearauth_panel_groups (tenant_id, group_id)
);
