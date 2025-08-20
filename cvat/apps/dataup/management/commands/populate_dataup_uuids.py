from django.core.management.base import BaseCommand
from cvat.apps.organizations.models import Organization
from cvat.apps.dataup.models import DataUpOrganization, DataUpUser
from django.contrib.auth.models import User
from uuid import uuid4

class Command(BaseCommand):
    help = "Create missing DataUpOrganization entries for existing Organizations"

    def handle(self, *args, **kwargs):
        org_created = 0
        for org in Organization.objects.all():
            if not hasattr(org, "dataup"):
                DataUpOrganization.objects.create(
                    id=uuid4(),
                    organization=org,
                )
                org_created += 1

        self.stdout.write(self.style.SUCCESS(f"Created {org_created} DataUpOrganization entries."))
        user_created = 0
        for user in User.objects.all():
            if not hasattr(user, "dataup"):
                DataUpUser.objects.create(
                    id=uuid4(),
                    user=user,
                )
                user_created += 1
        self.stdout.write(self.style.SUCCESS(f"Created {user_created} DataUpUser entries."))