

from statistics import covariance
from cvat.apps.engine.serializers import LabeledDataSerializer
from typing import Optional
from cvat.apps.engine.models import Task


class DataUpDetectionResultConverter:
    def __init__(self, task_id: int, label_mapping: dict={}) -> None:
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
                labels[label.name]["sublabels"] = cls._convert_labels(label.sublabels.all())
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

    def _convert_annotations_one_frame(self, frame, anns_per_frame, conv_mask_to_polygon: bool=False):
        shapes, tags = [], []
        for anno in anns_per_frame:
            shape = self._parse_shape(conv_mask_to_polygon, frame, anno)
            if shape is None:
                continue
            shapes.append(shape)
        return shapes, tags

    # f'''
    # DataUP Annotation contract
    # {
    #     label: str
    #     score: float
    #     bbox: BoundingBox
    #     polygon: Polygon | None = None
    #     rle_mask: str
    # }
    # '''


    def _parse_attrs(self, anno: dict) -> dict:
        return []


    def _map_label(self, anno: dict) -> dict:
        mapped_label_dict = self.label_mapping.get(anno["label"], {})
        mapped_label = mapped_label_dict.get("name", "unknown")
        return self.db_labels.get(mapped_label)

    def _parse_shape(self, conv_mask_to_poly: bool, frame: int, anno: dict) -> dict:
        label = self._map_label(anno)
        if label is None:
            return None

        attrs = self._parse_attrs(anno)
        shape ={
                "frame": frame,
                "label_id": label["id"],
                "source": "auto",
                "attributes": attrs,
                "group": None,
                "occluded": False,
                "outside": anno.get("outside", False),
                "z_order": 0,
        }


        if anno['rle_mask'] and conv_mask_to_poly:
            shape.update({"type": "polygon"})
            # Convert mask to polygon using RLE conversion
            return shape


        if anno['rle_mask']:
            shape.update({"type": "polygon"})
            return shape


        if anno['polygon'] and conv_mask_to_poly:
            shape.update({"type": "polygon"})
            return {}


        bbox = anno["bbox"]
        xl, yl = bbox['x'], bbox['y']
        xr, yr = xl + bbox['width'], yl + bbox['height']
        shape.update({"type": "rectangle", "points": [xl, yl, xr, yr]})
        return shape


    def _parse_anno(
        self, *, labels: dict, conv_mask_to_poly: bool, frame: int, anno: dict
    ) -> Optional[dict]:
        label = labels.get(anno["label"])
        if label is None:
            # Invalid label provided
            return None

        attrs = [
            {"spec_id": label["attributes"][attr["name"]], "value": attr["value"]}
            for attr in anno.get("attributes", [])
            if attr["name"] in label["attributes"]
        ]

        if anno["type"].lower() == "tag":
            return {
                "frame": frame,
                "label_id": label["id"],
                "source": "auto",
                "attributes": attrs,
                "group": None,
            }
        else:
            shape = {
                "frame": frame,
                "label_id": label["id"],
                "source": "auto",
                "attributes": attrs,
                "group": anno["group_id"] if "group_id" in anno else None,
                "type": anno["type"],
                "occluded": False,
                "outside": anno.get("outside", False),
                "points": (
                    anno.get("mask", []) if anno["type"] == "mask" else anno.get("points", [])
                ),
                "z_order": 0,
            }

            if shape["type"] in ("rectangle", "ellipse"):
                shape["rotation"] = anno.get("rotation", 0)

            if anno["type"] == "mask" and "points" in anno and conv_mask_to_poly:
                shape["type"] = "polygon"
                shape["points"] = anno["points"]
            elif anno["type"] == "mask":
                [xtl, ytl, xbr, ybr] = shape["points"][-4:]
                cut_points = shape["points"][:-4]
                rle = mask_tools.mask_to_rle(np.array(cut_points)[:, np.newaxis])["counts"].tolist()
                rle.extend([xtl, ytl, xbr, ybr])
                shape["points"] = rle

            if shape["type"] == "skeleton":
                parsed_elements = [
                    self._parse_anno(
                        labels=label["sublabels"],
                        conv_mask_to_poly=conv_mask_to_poly,
                        frame=frame,
                        anno=x,
                    )
                    for x in anno["elements"]
                ]

                # find a center to set position of missing points
                center = [0, 0]
                for element in parsed_elements:
                    center[0] += element["points"][0]
                    center[1] += element["points"][1]
                center[0] /= len(parsed_elements) or 1
                center[1] /= len(parsed_elements) or 1

                def _map(sublabel_body):
                    try:
                        return next(
                            filter(lambda x: x["label_id"] == sublabel_body["id"], parsed_elements)
                        )
                    except StopIteration:
                        return {
                            "frame": frame,
                            "label_id": sublabel_body["id"],
                            "source": "auto",
                            "attributes": [],
                            "group": None,
                            "type": sublabel_body["type"],
                            "occluded": False,
                            "points": center,
                            "outside": True,
                            "z_order": 0,
                        }

                shape["elements"] = list(map(_map, label["sublabels"].values()))
                if all(element["outside"] for element in shape["elements"]):
                    return None

            return shape



# class DataUpDetectionResultConverter:

#     @classmethod
#     def convert(cls, frames: list[int], annotations: list[list[dict]]) -> dict:
#         data = {"shapes": [], "tags": []}
#         for frame, anns_per_frame in zip(frames, annotations):
#             shapes, tags = cls._convert_annotations_for_one_frame(frame, anns_per_frame)
#             data["shapes"].extend(shapes)
#             data["tags"].extend(tags)

#         serializer = LabeledDataSerializer(data=data)
#         if serializer.is_valid():
#             return serializer.validated_data
#         return {}

#     @classmethod
#     def _convert_annotations_for_one_frame(cls, frame: int, annotations: list[dict]) -> tuple[list, list]:
#         shapes, tags = [], []
#         for ann in annotations:
#             shape = _convert_dataup_label_to_cvat_shape(ann)
#             shape.update({"frame": frame})
#             shapes.append(shape)
#         return shapes, tags
