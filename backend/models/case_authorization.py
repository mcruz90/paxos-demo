"""Internal authenticated identity contract; never populated from a request body."""

from typing import Annotated

from pydantic import Field

from models.case_evidence import FrozenRecord
from models.requests import TenantId


class CaseIdentity(FrozenRecord):
    tenant_id: TenantId
    # Existing cookie sessions carry the authenticated login username, not actor_id.
    subject_id: Annotated[str, Field(min_length=1, max_length=150)]
