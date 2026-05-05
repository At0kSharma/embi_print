import os
from celery import Celery

REDIS_URL = os.getenv("REDIS_URL", "redis://redis:6379/0")
celery_app = Celery("embi", broker=REDIS_URL, backend=REDIS_URL)

@celery_app.task(name="run_dst_conversion")
def run_dst_conversion(upload_id: str):
    """Stub — full implementation in Task 5."""
    pass
