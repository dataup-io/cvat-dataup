# Copyright (C) 2024 CVAT.ai Corporation
#
# SPDX-License-Identifier: MIT

"""
Metrics module for CVAT DataUp agents.

This module contains various metric calculation functions for evaluating
the performance of AI agents on computer vision tasks.
"""

from .object_detection_metrics import (
    calculate_iou,
    match_predictions_to_ground_truth,
    calculate_average_precision,
    calculate_per_class_metrics,
    calculate_object_detection_metrics,
)

from .attribute_metrics import calculate_attribute_metrics

# from .utils import match_predictions_to_ground_truth
__all__ = [
    "calculate_iou",
    "match_predictions_to_ground_truth",
    "calculate_average_precision",
    "calculate_per_class_metrics",
    "calculate_attribute_metrics",
    "calculate_object_detection_metrics",
]
