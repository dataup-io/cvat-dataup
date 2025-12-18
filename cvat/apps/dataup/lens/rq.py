from cvat.apps.engine.types import ExtendedRequest
from cvat.apps.engine.rq import (
    BaseRQMeta,
    ImmutableRQMetaAttribute,
    MutableRQMetaAttribute,
    RQJobMetaField,
)
from django.db.models import Model
from cvat.apps.dataup.models import LensRowType


class LensRQMeta(BaseRQMeta):
    lens_: bool | None = ImmutableRQMetaAttribute(RQJobMetaField.LENS, optional=True)
    progress: int | None = MutableRQMetaAttribute(RQJobMetaField.PROGRESS, validator=lambda x: isinstance(x, int), optional=True)

    @classmethod
    def build_for(
        cls,
        *,
        request: ExtendedRequest,
        db_obj: Model,
        lens_type: str = LensRowType.JOB_OVERVIEW.value,
    ):
        base_meta = BaseRQMeta.build(request=request, db_obj=db_obj)
        return {
            **base_meta,
            RQJobMetaField.LENS_TYPE: lens_type,
            RQJobMetaField.LENS: True,
        }
