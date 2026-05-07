"""HTTP Basic Auth for the admin endpoints.

The admin dashboard is single-operator (one shared username +
password supplied via ADMIN_USER / ADMIN_PASSWORD env vars). If
either env var is missing or empty, all admin endpoints return 503
— better than silently disabling auth.
"""
import os
import secrets

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBasic, HTTPBasicCredentials

_basic = HTTPBasic(realm="embi_print admin")


def require_admin(credentials: HTTPBasicCredentials = Depends(_basic)) -> str:
    expected_user = os.getenv("ADMIN_USER", "")
    expected_password = os.getenv("ADMIN_PASSWORD", "")

    if not expected_user or not expected_password:
        raise HTTPException(
            status.HTTP_503_SERVICE_UNAVAILABLE,
            "Admin auth is not configured. Set ADMIN_USER + ADMIN_PASSWORD.",
        )

    user_ok = secrets.compare_digest(credentials.username, expected_user)
    pass_ok = secrets.compare_digest(credentials.password, expected_password)
    if not (user_ok and pass_ok):
        raise HTTPException(
            status.HTTP_401_UNAUTHORIZED,
            "Bad credentials",
            headers={"WWW-Authenticate": 'Basic realm="embi_print admin"'},
        )
    return credentials.username
