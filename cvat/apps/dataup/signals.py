from cvat.apps.dataup.models import DataUpUser, DataUpOrganization
from cvat.apps.organizations.models import Organization
from django.db.models.signals import post_save
from django.dispatch import receiver
from django.contrib.auth.models import User


@receiver(post_save, sender=User)
def create_dataup_user(sender, instance, created, **kwargs):
    """
    Signal to automatically create a DataUpUser instance when a User is created.
    """
    if created:
        DataUpUser.objects.create(user=instance)



@receiver(post_save, sender=User)
def save_dataup_user(sender, instance, **kwargs):
    """
    Signal to save the DataUpUser instance when the User is saved.
    """
    if hasattr(instance, 'dataup'):
        instance.dataup.save()
    else:
        # Create DataUpUser if it doesn't exist (for existing users)
        DataUpUser.objects.get_or_create(user=instance)
        
        
@receiver(post_save, sender=Organization)
def create_dataup_organization(sender, instance, created, **kwargs):
    if created and not hasattr(instance, 'dataup'):
        DataUpOrganization.objects.create(organization=instance)