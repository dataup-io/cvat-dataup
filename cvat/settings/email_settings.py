# Copyright (C) 2020-2022 Intel Corporation
# Copyright (C) CVAT.ai Corporation
#
# SPDX-License-Identifier: MIT

import os

# Inherit parent config
from cvat.settings.production import *  # pylint: disable=wildcard-import

# https://github.com/pennersr/django-allauth
ACCOUNT_AUTHENTICATION_METHOD = "username_email"
ACCOUNT_CONFIRM_EMAIL_ON_GET = True
ACCOUNT_EMAIL_REQUIRED = True
ACCOUNT_EMAIL_VERIFICATION = "mandatory"

# Email backend settings for Django
# Use SMTP backend for actual email sending
EMAIL_BACKEND = "django.core.mail.backends.smtp.EmailBackend"

# SMTP Configuration - these should be set via environment variables
EMAIL_HOST = os.getenv("EMAIL_HOST", "localhost")
EMAIL_PORT = int(os.getenv("EMAIL_PORT", 587))
EMAIL_USE_TLS = os.getenv("EMAIL_USE_TLS", "True").lower() == "true"
EMAIL_USE_SSL = os.getenv("EMAIL_USE_SSL", "False").lower() == "true"
EMAIL_HOST_USER = os.getenv("EMAIL_HOST_USER", "")
EMAIL_HOST_PASSWORD = os.getenv("EMAIL_HOST_PASSWORD", "")
DEFAULT_FROM_EMAIL = os.getenv("DEFAULT_FROM_EMAIL", "noreply@cvat.ai")
SERVER_EMAIL = os.getenv("SERVER_EMAIL", DEFAULT_FROM_EMAIL)

# Email timeout settings
EMAIL_TIMEOUT = int(os.getenv("EMAIL_TIMEOUT", 60))

# For development/testing, you can use console backend by setting EMAIL_BACKEND env var
if os.getenv("EMAIL_BACKEND"):
    EMAIL_BACKEND = os.getenv("EMAIL_BACKEND")
