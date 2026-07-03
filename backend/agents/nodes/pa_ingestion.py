"""agents/nodes/pa_ingestion.py — Initial-PA pipeline entry point.

Node contract: (InitialPaRequest) -> InitialPaState
Pure function — no side effects, no I/O.
"""

from __future__ import annotations

from models.schemas import InitialPaRequest, InitialPaState


def run_pa_ingestion(request: InitialPaRequest) -> InitialPaState:
    """Construct a fresh :class:`InitialPaState` from a validated request.

    The request has already been validated by Pydantic at the HTTP boundary;
    this node is the canonical entry point into the initial-PA StateGraph and
    ensures state is initialized cleanly for every run.

    Args:
        request: A fully-validated :class:`InitialPaRequest`.

    Returns:
        A new :class:`InitialPaState` with all fields at their zero values.
    """
    return {
        "request": request,
        "pa_required": None,
        "pa_context": "",
        "pa_resolution": "",
        "submission": None,
        "submission_ref": "",
        "outcome": None,
        "appeal_handoff": None,
        "errors": [],
    }
