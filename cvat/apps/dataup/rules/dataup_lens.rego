package dataup.lens

import rego.v1

import data.utils
import data.organizations

# input: {
#     "scope": <"view"|"chat"|"sync"> or null,
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
#         "type": "dataup_lens",
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

# ---- VIEW ----

# All users can view lens jobs in personal workspace or organization
allow if {
  input.scope == utils.VIEW
  input.resource.type == "dataup_lens"
}

# ---- CHAT ----

# Personal workspace: user can use chat
allow if {
  input.scope == "chat"
  input.resource.type == "dataup_lens"
  input.resource.is_personal
  input.resource.dataup_user_id == sprintf("%v", [input.auth.user.id])
}

# Organization: all users can use chat
allow if {
  input.scope == "chat"
  input.resource.type == "dataup_lens"
  not input.resource.is_personal
  input.auth.organization != null
}

# ---- SYNC ----

# Personal workspace: user can sync
allow if {
  input.scope == "sync"
  input.resource.type == "dataup_lens"
  input.resource.is_personal
  input.resource.dataup_user_id == sprintf("%v", [input.auth.user.id])
}

# Organization: all users can sync
allow if {
  input.scope == "sync"
  input.resource.type == "dataup_lens"
  not input.resource.is_personal
  input.auth.organization != null
}

