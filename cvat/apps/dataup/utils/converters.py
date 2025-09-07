from cvat.apps.engine.models import Task


class DataUpAgentResultConverter:
    def __init__(self, task_id: int, label_mapping: dict = {}) -> None:
        task_db = Task.objects.get(id=task_id)
        if not task_db:
            raise Task.DoesNotExist

        self.db_labels = self._convert_labels(task_db.get_labels(prefetch=True))
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

    def convert(self, frames: list[int], annotations: list[list[dict]]) -> dict:
        data = {"shapes": [], "tags": [], "version": 1}
        for frame, anns_per_frame in zip(frames, annotations):
            shapes, tags = self._convert_annotations_one_frame(frame, anns_per_frame)
            data["shapes"].extend(shapes)
            data["tags"].extend(tags)
        return data

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

    def _parse_attrs(self, anno: dict) -> dict:
        return []

    def _map_label(self, anno: dict) -> dict:
        # mapped_label_dict = self.label_mapping.get(anno["label"], {})
        mapped_label = self.label_mapping.get(anno["label"], "unknown")
        # mapped_label = mapped_label_dict.get("name", "unknown")
        return self.db_labels.get(mapped_label)

    def _parse_shape(
        self, frame: int, anno: dict, conv_mask_to_poly: bool = False
    ) -> dict:
        label = self._map_label(anno)
        if label is None:
            return None

        attrs = self._parse_attrs(anno)
        shape = {
            "frame": frame,
            "label_id": label["id"],
            "source": "auto",
            "attributes": attrs,
            "group": None,
            "occluded": False,
            "outside": anno.get("outside", False),
            "z_order": 0,
        }

        if anno["rle_mask"] and conv_mask_to_poly:
            shape.update({"type": "polygon"})
            # Convert mask to polygon using RLE conversion
            return shape

        if anno["rle_mask"]:
            shape.update({"type": "polygon"})
            return shape

        if anno["polygon"] and conv_mask_to_poly:
            shape.update({"type": "polygon"})
            return {}

        bbox = anno["bbox"]
        xl, yl = bbox["x"], bbox["y"]
        xr, yr = xl + bbox["width"], yl + bbox["height"]
        shape.update({"type": "rectangle", "points": [xl, yl, xr, yr]})
        return shape
