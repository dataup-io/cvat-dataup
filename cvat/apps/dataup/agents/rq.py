from cvat.apps.engine.types import ExtendedRequest
from cvat.apps.engine.rq import (
    BaseRQMeta,
    ImmutableRQMetaAttribute,
    MutableRQMetaAttribute,
    RQJobMetaField,
)
from django.db.models import Model


class AgentRQMeta(BaseRQMeta):
    agent_id = str = ImmutableRQMetaAttribute(RQJobMetaField.AGENT_ID)
    agent_: bool | None = ImmutableRQMetaAttribute(RQJobMetaField.AGENT, optional=True)
    progress: int | None = MutableRQMetaAttribute(RQJobMetaField.PROGRESS, validator=lambda x: isinstance(x, int), optional=True)

    @classmethod
    def build_for(
        cls,
        *,
        request: ExtendedRequest,
        db_obj: Model,
        agent_id: str,
    ):
        base_meta = BaseRQMeta.build(request=request, db_obj=db_obj)
        return {
            **base_meta,
            RQJobMetaField.AGENT_ID: agent_id,
            RQJobMetaField.AGENT: True,
        }
