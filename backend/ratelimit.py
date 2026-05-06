"""Rate limiter shared across routers.

We use slowapi backed by an in-memory store. For multi-process
deployments swap the storage backend; v1 runs single-process uvicorn
behind Railway, so in-memory is sufficient.
"""
from slowapi import Limiter
from slowapi.util import get_remote_address

limiter = Limiter(key_func=get_remote_address)
