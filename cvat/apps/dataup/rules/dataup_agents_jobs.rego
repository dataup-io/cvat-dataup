package dataup.agent_jobs

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
#         "type": "dataup_agents_jobs",
#         "dataup_user_id": <string> or null,
#         "dataup_org_id": <string> or null,
#         "is_personal": <bool>,
#         "is_org": <bool>,
#         "role": <string> or null
#     }
# }

default allow := false

# Admin can do everything
allow if {
    utils.is_admin
}

# ---- HELPERS ----

# Check if user is the owner of the job
is_job_owner if {
    input.resource.dataup_user_id == sprintf("%v", [input.auth.user.id])
}

# Check if user has supervisor role or higher in organization
is_supervisor_or_higher if {
    input.auth.organization != null
    input.auth.organization.user.role in {"owner", "supervisor", "maintainer"}
}

# ---- LIST / VIEW ----

# Personal workspace: only owner can list/view their jobs
allow if {
    input.scope in {utils.LIST, utils.VIEW}
    input.resource.type == "dataup_agents_jobs"
    input.resource.is_personal
    is_job_owner
}

# Organization: owner and supervisors can list/view all jobs
allow if {
    input.scope in {utils.LIST, utils.VIEW}
    input.resource.type == "dataup_agents_jobs"
    input.resource.is_org
    input.auth.organization != null
    is_supervisor_or_higher
}

# Organization: job owner can view their own jobs
allow if {
    input.scope in {utils.LIST, utils.VIEW}
    input.resource.type == "dataup_agents_jobs"
    input.resource.is_org
    input.auth.organization != null
    is_job_owner
}

# ---- CREATE ----

# Personal workspace: user can create jobs
allow if {
    input.scope == utils.CREATE
    input.resource.type == "dataup_agents_jobs"
    input.resource.is_personal
    is_job_owner
}

# Organization: only owner and supervisors can create jobs
allow if {
    input.scope == utils.CREATE
    input.resource.type == "dataup_agents_jobs"
    input.resource.is_org
    input.auth.organization != null
    is_supervisor_or_higher
}

# ---- UPDATE ----

# Personal workspace: only the owner can update their jobs
allow if {
    input.scope == utils.UPDATE
    input.resource.type == "dataup_agents_jobs"
    input.resource.is_personal
    is_job_owner
}

# Organization: owner and supervisors can update any job
allow if {
    input.scope == utils.UPDATE
    input.resource.type == "dataup_agents_jobs"
    input.resource.is_org
    input.auth.organization != null
    is_supervisor_or_higher
}

# Organization: job owner can update their own jobs
allow if {
    input.scope == utils.UPDATE
    input.resource.type == "dataup_agents_jobs"
    input.resource.is_org
    input.auth.organization != null
    is_job_owner
}

# ---- DELETE (Cancel) ----

# Personal workspace: only the owner can cancel their jobs
allow if {
    input.scope == utils.DELETE
    input.resource.type == "dataup_agents_jobs"
    input.resource.is_personal
    is_job_owner
}

# Organization: only owner and supervisors can cancel jobs
allow if {
    input.scope == utils.DELETE
    input.resource.type == "dataup_agents_jobs"
    input.resource.is_org
    input.auth.organization != null
    is_supervisor_or_higher
}

# Note: Regular organization members (maintainer, worker) cannot cancel jobs
# Only owners and supervisors have cancellation privileges in organizations