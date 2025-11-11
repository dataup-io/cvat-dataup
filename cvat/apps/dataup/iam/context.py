from typing import Optional
from cvat.apps.dataup.models import DataUpOrganization, DataUpUser
from cvat.apps.iam.permissions import (
    IamContext,
    get_membership,
    get_organization,
)
from cvat.apps.organizations.models import Membership
from dataclasses import dataclass


def get_dataup_user(request) -> DataUpUser:
    try:
        user = DataUpUser.objects.get(user=request.user)
    except DataUpUser.DoesNotExist:
        raise Exception("A valid user is mandatory to perform this action")
    return user


def get_dataup_organization(request, obj=None) -> DataUpOrganization:
    organization = get_organization(request, obj)
    if isinstance(organization, DataUpOrganization):
        return organization
    try:
        return DataUpOrganization.objects.get(organization=organization)
    except DataUpOrganization.DoesNotExist:
        return None


def get_dataup_membership(request, dataup_organization: DataUpOrganization) -> Membership:
    if dataup_organization is None:
        return None
    return get_membership(request, dataup_organization.organization)


def build_dataup_iam_context(request, dataup_organization: DataUpOrganization, membership: Membership) -> IamContext:
    # Get DataUp user ID
    try:
        dataup_user = DataUpUser.objects.get(user=request.user)
        dataup_user_id = str(dataup_user.id)
    except DataUpUser.DoesNotExist:
        dataup_user_id = request.user.id  # Fallback to CVAT user ID

    dataup_org_id = None
    org_slug = None
    org_owner_id = None

    if dataup_organization:
        dataup_org_id = str(dataup_organization.id)
        org_slug = dataup_organization.organization.slug
        org_owner_id = dataup_organization.organization.owner_id

    context = {
        "user_id": dataup_user_id,
        "group_name": request.iam_context["privilege"],
        "org_id": dataup_org_id,
        "org_slug": org_slug,
        "org_owner_id": org_owner_id,
        "org_role": getattr(membership, "role", None),
    }
    return context


def get_dataup_iam_context(request, obj):
    dataup_organization = get_dataup_organization(request, obj)
    membership = get_dataup_membership(request, dataup_organization)
    return build_dataup_iam_context(request, dataup_organization, membership)


@dataclass(frozen=True)
class DataUpContext:
    user: "DataUpUser"
    organization: Optional["DataUpOrganization"]
    role: Optional[str]

    @property
    def user_uuid(self) -> str:
        return str(self.user.id)

    @property
    def org_uuid(self) -> Optional[str]:
        return str(self.organization.id) if self.organization else None

    @classmethod
    def from_request(cls, request) -> "DataUpContext":
        user = get_dataup_user(request)
        organization = get_dataup_organization(request, obj=None)
        membership = get_dataup_membership(request, organization)
        role = membership.role if membership else None
        return cls(user=user, organization=organization, role=role)
