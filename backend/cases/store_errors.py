"""Metadata-only persistence failures; callers must not log raw driver errors."""

from typing import Literal


class CaseConflict(ValueError):
    def __init__(self, code: Literal["idempotency_conflict", "case_already_exists"]):
        self.code = code
        super().__init__(code)


class CaseStoreError(RuntimeError):
    def __init__(
        self,
        code: Literal[
            "case_write_failed",
            "case_read_failed",
            "stored_case_invalid",
            "outer_transaction_required",
            "case_input_invalid",
        ],
    ):
        self.code = code
        super().__init__(code)
