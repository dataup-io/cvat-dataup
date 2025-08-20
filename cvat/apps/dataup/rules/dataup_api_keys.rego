package dataup.api_keys

import rego.v1

import data.utils
import data.organizations

# input: {
#     "scope": <"create"|"view"|"list"|"update"|"delete"> or null,
#     "auth": {
#         "user": {
#             "id": <num>,
#             "privilege": <"admin"|"user"|"worker"> or null
#         },
#         "organization": {
#             "id": <num>,
#             "owner": {
#                 "id": <num>
#             },
#             "user": {
#                 "role": <"owner"|"maintainer"|"supervisor"|"worker"> or null
#             }
#         } or null,
#     },
#     "resource": {
#         "type": "dataup_api_key",
#         "owner_dataup_id": <string> or null,
#         "organization_id": <num> or null,
#         "is_org_only": <bool>
#     }
# }

default allow := false

# Admin can do everything
allow if {
    utils.is_admin
}

# ---- LIST / VIEW ----

allow if {
  input.scope == utils.LIST
  input.resource.type == "dataup_api_key"
  can_view_key
}

allow if {
  input.scope == utils.VIEW
  input.resource.type == "dataup_api_key"
  can_view_key
}

# ---- CREATE ----

# Personal (outside org): user is the owner
allow if {
  input.scope == utils.CREATE
  input.resource.type == "dataup_api_key"
  input.auth.organization == null
  input.resource.is_personal
  input.resource.owner_dataup_id == sprintf("%v", [input.auth.user.id])
}

# Org (inside org): owner or maintainer can create; creator is the owner of the key
allow if {
  input.scope == utils.CREATE
  input.resource.type == "dataup_api_key"
  input.resource.is_org
  input.auth.organization != null
  input.auth.organization.user.role in {"owner", "maintainer"}
  input.resource.owner_dataup_id == sprintf("%v", [input.auth.user.id])
}

# ---- UPDATE ----

# Personal: only the owner
allow if {
  input.scope == utils.UPDATE
  input.resource.type == "dataup_api_key"
  input.resource.is_personal
  input.resource.owner_dataup_id == sprintf("%v", [input.auth.user.id])
}

# Org: owner can manage any; maintainer can manage only their own
allow if {
  input.scope == utils.UPDATE
  input.resource.type == "dataup_api_key"
  input.resource.is_org
  input.auth.organization != null

  # org owner: any key
  input.auth.organization.user.role == "owner"
} else if {
  input.scope == utils.UPDATE
  input.resource.type == "dataup_api_key"
  input.resource.is_org
  input.auth.organization != null

  # maintainer: only keys they own
  input.auth.organization.user.role == "maintainer"
  input.resource.owner_dataup_id == sprintf("%v", [input.auth.user.id])
}

# ---- DELETE ----

# Personal: only the owner
allow if {
  input.scope == utils.DELETE
  input.resource.type == "dataup_api_key"
  input.resource.is_personal
  input.resource.owner_dataup_id == sprintf("%v", [input.auth.user.id])
}

# Org: owner can manage any; maintainer can manage only their own
allow if {
  input.scope == utils.DELETE
  input.resource.type == "dataup_api_key"
  input.resource.is_org
  input.auth.organization != null

  # org owner: any key
  input.auth.organization.user.role == "owner"
} else if {
  input.scope == utils.DELETE
  input.resource.type == "dataup_api_key"
  input.resource.is_org
  input.auth.organization != null

  # maintainer: only keys they own
  input.auth.organization.user.role == "maintainer"
  input.resource.owner_dataup_id == sprintf("%v", [input.auth.user.id])
}

# ---- HELPERS ----

# View logic stays broad:
# - Personal: only the owner
# - Org: any org member may view
can_view_key if {
  input.resource.type == "dataup_api_key"
  input.resource.is_personal
  input.resource.owner_dataup_id == sprintf("%v", [input.auth.user.id])
}

can_view_key if {
  input.resource.type == "dataup_api_key"
  input.resource.is_org
  input.auth.organization != null
  input.auth.organization.user.role in {"owner","maintainer","supervisor","worker"}
}
