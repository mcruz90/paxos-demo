-- Allocation order, not commit order. Gaps from rolled-back writes are expected.
ALTER TABLE clearauth_case_events
    ADD COLUMN event_sequence bigint GENERATED ALWAYS AS IDENTITY;
ALTER TABLE clearauth_case_events
    ADD CONSTRAINT clearauth_case_events_sequence_unique UNIQUE (event_sequence),
    ADD CONSTRAINT clearauth_case_events_sequence_positive CHECK (event_sequence > 0);
