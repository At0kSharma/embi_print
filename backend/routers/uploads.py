import logging

from fastapi import APIRouter, Depends, File, HTTPException, Request, UploadFile
from sqlalchemy.orm import Session

from database import get_db
from dst import DSTConversionError, convert_to_dst
from models import Upload, UploadStatus
from ratelimit import limiter
from schemas import UploadOut
from storage import upload_bytes, upload_file

log = logging.getLogger(__name__)

ALLOWED_TYPES = {"image/png", "image/jpeg", "image/svg+xml"}
MAX_BYTES = 10 * 1024 * 1024  # 10MB

router = APIRouter(prefix="/uploads", tags=["uploads"])


@router.post("/", response_model=UploadOut, status_code=201)
@limiter.limit("10/minute")
async def create_upload(
    request: Request,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
):
    if file.content_type not in ALLOWED_TYPES:
        raise HTTPException(400, f"Unsupported file type: {file.content_type}")
    data = await file.read()
    if len(data) > MAX_BYTES:
        raise HTTPException(400, "File exceeds 10MB limit")

    s3_key = upload_file(data, file.filename, file.content_type)
    upload = Upload(
        s3_key=s3_key,
        original_filename=file.filename,
        mime_type=file.content_type,
        status=UploadStatus.processing,
    )
    db.add(upload)
    db.commit()
    db.refresh(upload)

    try:
        dst_bytes, stitch_count = convert_to_dst(data, file.content_type)
        dst_key = f"dst/{upload.id}.dst"
        upload_bytes(dst_bytes, dst_key, "application/octet-stream")
        upload.dst_s3_key = dst_key
        upload.stitch_count = stitch_count
        upload.status = UploadStatus.done
    except DSTConversionError as e:
        log.warning("DST conversion failed for upload %s: %s", upload.id, e)
        upload.status = UploadStatus.failed

    db.commit()
    db.refresh(upload)
    return upload


@router.get("/{upload_id}", response_model=UploadOut)
def get_upload(upload_id: str, db: Session = Depends(get_db)):
    upload = db.query(Upload).filter(Upload.id == upload_id).first()
    if not upload:
        raise HTTPException(404, "Upload not found")
    return upload
