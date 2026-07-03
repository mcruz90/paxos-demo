"""agents/nodes/pas_submit.py — Transmit the assembled PA on the PAS rail.

Node contract: (InitialPaState) -> InitialPaState
The rail translation and stub submission live in etl/pas_rail/adapter.py
(adapter pattern) — this node never sees the rail shape's internals and
never branches on payer.
"""

from __future__ import annotations

from etl.pas_rail.adapter import submit_to_pas_rail, to_pas_request
from models.schemas import InitialPaState


def run_pas_submit(state: InitialPaState) -> InitialPaState:
    """Submit the assembled PA request on the PAS rail.

    Args:
        state: Initial-PA state with ``submission`` populated by pa_assembly.

    Returns:
        Updated state with ``submission_ref`` set. Input state is not mutated.
    """
    submission = state["submission"]
    assert submission is not None  # pa_assembly always runs before pas_submit
    submission_ref = submit_to_pas_rail(to_pas_request(submission))
    return {**state, "submission_ref": submission_ref}
