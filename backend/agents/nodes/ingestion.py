"""agents/nodes/ingestion.py — Pipeline entry point: validate and initialize state.

Node contract: (AppealRequest) -> PipelineState
Pure function — no side effects, no I/O.
"""

from __future__ import annotations

from models.schemas import AppealRequest, PipelineState


def run_ingestion(request: AppealRequest) -> PipelineState:
    """Validate *request* and construct a fresh :class:`PipelineState`.

    The request has already been validated by Pydantic at the HTTP boundary;
    this node is the canonical entry point into the LangGraph DAG and ensures
    state is initialized cleanly for every run.

    Args:
        request: A fully-validated :class:`AppealRequest`.

    Returns:
        A new :class:`PipelineState` with all fields at their zero values.
    """
    return {
        "request": request,
        "pa_context": "",
        "appeal_text": "",
        "model_name": "",
        "passed_gatekeeper": False,
        "retry_count": 0,
        "errors": [],
    }
