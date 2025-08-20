# Copyright (C) 2023 CVAT.ai Corporation
#
# SPDX-License-Identifier: MIT

from cvat.apps.engine.models import LabeledShape, LabeledImage
from django.db.models import Count



def get_class_distribution(task_id=None, job_id=None, project_id=None):
    """Retrieve the count of instances per class more efficiently."""
    filters = {}

    if task_id:
        filters["job__segment__task_id"] = task_id
    elif job_id:
        filters["job_id"] = job_id
    elif project_id:
        filters["job__segment__task__project_id"] = project_id

    # Use Django ORM to count occurrences at the DB level
    class_counts = (
        LabeledShape.objects.filter(**filters)
        .values("label__name")  # Get label names
        .annotate(count=Count("id"))  # Count occurrences
    )

    # Count labels in Annotation
    tag_counts = (
        LabeledImage.objects.filter(**filters)
        .values("label__name")
        .annotate(count=Count("id"))
    )
    merged_counts = {"class_counts": {}, "tag_counts": {}}


    for entry in class_counts:
        label = entry["label__name"]
        merged_counts['class_counts'][label] = merged_counts.get(label, 0) + entry["count"]



    for entry in tag_counts:
        label = entry["label__name"]
        merged_counts['tag_counts'][label] = merged_counts.get(label, 0) + entry["count"]

    return merged_counts
    # return [{"class": entry["label__name"], "count": entry["count"]} for entry in class_counts]
