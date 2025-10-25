from cvat.apps.engine.models import Task
import itertools
from cvat.apps.engine.serializers import LabeledDataSerializer

def _bbox_to_polygon(xl: float, yl: float, xr: float, yr: float) -> list[list[float]]:
    return [[xl, yl], [xr, yl], [xr, yr], [xl, yr]]

def get_shape_points_from_anno(anno: dict, db_label: dict) -> list[float]:
    bbox = anno["bbox"]
    xl, yl = bbox["x"], bbox["y"]
    xr, yr = xl + bbox["width"], yl + bbox["height"]

    if db_label["type"] == "bbox":
        return [xl, yl, xr, yr]
    elif db_label["type"] == "polygon":
        points = anno["polygon"].get("points", _bbox_to_polygon(xl, yl, xr, yr)) if anno["polygon"] else _bbox_to_polygon(xl, yl, xr, yr)
        return list(itertools.chain(*points))
    else:
        raise ValueError(f"Unsupported conversion for label type {db_label['type']}")

class DataUpAgentResultConverter:
    def __init__(self, task_id: int, label_mapping: dict = {}, task_type: str = "annotate_frame") -> None:
        task_db = Task.objects.get(id=task_id)
        if not task_db:
            raise Task.DoesNotExist

        self.db_labels = self._convert_labels(task_db.get_labels(prefetch=True))
        self.task_type = task_type
        print("DB labels", self.db_labels)
        self.label_mapping = label_mapping

    @classmethod
    def _convert_labels(cls, db_labels) -> dict:
        labels = {}
        for label in db_labels:
            labels[label.name] = {"id": label.id, "attributes": {}, "type": label.type}
            if label.type == "skeleton":
                labels[label.name]["sublabels"] = cls._convert_labels(
                    label.sublabels.all()
                )
            for attr in label.attributespec_set.values():
                labels[label.name]["attributes"][attr["name"]] = attr["id"]
        return labels


    def convert(self, frames: list[int], results: list[list[dict]]) -> dict:
        if self.task_type == "annotate_frame":
            return self.convert_detection_results(frames, results)
        elif self.task_type == "interact":
            return self.convert_interact_results(frames, results)
        raise ValueError(f"Unknown task type {self.task_type}")



    def convert_interact_results(self, frames: list[int], interaction_results: list[dict]) -> dict:
        # TODO: refactor this, just for testing purposes right now
        return {"blob": interaction_results[0]["blob"]}

    def convert_detection_results(self, frames: list[int], detection_results: list[list[dict]]) -> dict:
        data = {"shapes": [], "tags": [], "version": 1}
        for frame, anns_per_frame in zip(frames, detection_results):
            shapes, tags = self._convert_annotations_one_frame(frame, anns_per_frame["labels"])
            data["shapes"].extend(shapes)
            data["tags"].extend(tags)

        serialized_output = LabeledDataSerializer(data=data)
        serialized_output.is_valid(raise_exception=True)
        return serialized_output.validated_data

    def _convert_annotations_one_frame(
        self, frame, anns_per_frame, conv_mask_to_polygon: bool = False
    ):
        shapes, tags = [], []
        for anno in anns_per_frame:
            shape = self._parse_shape(frame, anno, conv_mask_to_polygon)
            if shape is None:
                continue
            shapes.append(shape)
        return shapes, tags

    def _parse_attrs(self, anno: dict, db_label: dict) -> list[dict]:
        anno_attributes: list = anno.get("attributes")
        db_label_attributes: dict = db_label.get("attributes")
        if not anno_attributes or not db_label_attributes:
            return []
        attrs = [{"spec_id": sid, "value": a["value"]} for a in anno_attributes if (sid := db_label_attributes.get(a.get("key"))) is not None]
        return attrs

    def _map_label(self, anno: dict) -> dict:
        mapped_label = self.label_mapping.get(anno["label"].lower(), "unknown")
        return self.db_labels.get(mapped_label)

    def _parse_shape(
        self, frame: int, anno: dict, conv_mask_to_poly: bool = False
    ) -> dict:
        db_label = self._map_label(anno)
        if db_label is None:
            return None

        attrs = self._parse_attrs(anno, db_label)
        shape = {
            "frame": frame,
            "label_id": db_label["id"],
            "source": "auto",
            "attributes": attrs,
            "group": None,
            "occluded": False,
            "outside": anno.get("outside", False),
            "z_order": 0,
        }

        if anno["rle_mask"] and conv_mask_to_poly:
            shape.update({"type": "polygon"})
            return shape

        if anno["rle_mask"]:
            shape.update({"type": "polygon"})
            return shape

        points = get_shape_points_from_anno(anno, db_label)
        shape.update({"type": db_label["type"], "points": points})
        return shape
