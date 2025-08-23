from cvat.apps.engine.models import Task
from cvat.apps.engine.frame_provider import TaskFrameProvider, JobFrameProvider
from django.conf import settings



class DataUpTaskFrameProvider(TaskFrameProvider):
    def __init__(self, task_db: Task):
        super().__init__(task_db)
        self.task_db = task_db
        
    def get_frame_url(self, frame_id: int) -> str:
        image = self.get_frame(frame_id)
        # create temporary url here

        
