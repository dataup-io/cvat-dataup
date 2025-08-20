from django.db import models
from django.contrib.auth.models import User
from cvat.apps.organizations.models import Organization
import uuid

class DataUpOrganization(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    organization = models.OneToOneField(
        Organization,
        on_delete=models.CASCADE,
        related_name="dataup",
    )

    def __str__(self):
        return f"DataUpOrganization: {self.organization.slug}"


class DataUpUser(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.OneToOneField(
        User,
        on_delete=models.CASCADE,
        related_name="dataup",
    )
    
    def __str__(self):
        return f"DataUpUser: {self.user.username}"