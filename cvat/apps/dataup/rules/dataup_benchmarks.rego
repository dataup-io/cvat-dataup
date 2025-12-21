package dataup.benchmarks

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
#         "type": "dataup_benchmarks",
#         "dataup_user_id": <string> or null,
#         "dataup_org_id": <string> or null,
#         "is_personal": <bool>
#     }
# }

default allow := false

# Admin can do everything
allow if {
    utils.is_admin
}

# ---- LIST / VIEW ----

# All users can view/list benchmarks in personal workspace or organization
allow if {
  input.scope == utils.LIST
  input.resource.type == "dataup_benchmarks"
}

allow if {
  input.scope == utils.VIEW
  input.resource.type == "dataup_benchmarks"
}

# ---- CREATE ----

# Personal workspace: user can create benchmarks
allow if {
  input.scope == utils.CREATE
  input.resource.type == "dataup_benchmarks"
  input.resource.is_personal
  input.resource.dataup_user_id == sprintf("%v", [input.auth.user.id])
}

# Organization: only owner or maintainer can create benchmarks
allow if {
  input.scope == utils.CREATE
  input.resource.type == "dataup_benchmarks"
  not input.resource.is_personal
  input.auth.organization != null
  input.auth.organization.user.role in {"owner", "maintainer"}
  input.resource.dataup_user_id == sprintf("%v", [input.auth.user.id])
}

# ---- UPDATE ----

# Personal workspace: only the owner can update
allow if {
  input.scope == utils.UPDATE
  input.resource.type == "dataup_benchmarks"
  input.resource.is_personal
  input.resource.dataup_user_id == sprintf("%v", [input.auth.user.id])
}

# Organization: owner/maintainer can update
allow if {
  input.scope == utils.UPDATE
  input.resource.type == "dataup_benchmarks"
  not input.resource.is_personal
  input.auth.organization != null
  input.auth.organization.user.role in {"owner", "maintainer"}
}

# ---- DELETE ----

# Personal workspace: only the owner can delete
allow if {
  input.scope == utils.DELETE
  input.resource.type == "dataup_benchmarks"
  input.resource.is_personal
  input.resource.dataup_user_id == sprintf("%v", [input.auth.user.id])
}

# Organization: owner/maintainer can manage any; maintainer can manage only their own
allow if {
  input.scope == utils.DELETE
  input.resource.type == "dataup_benchmarks"
  not input.resource.is_personal
  input.auth.organization != null
  input.auth.organization.user.role in {"owner", "maintainer"}
}

