from fastapi import APIRouter, Depends, UploadFile, File, HTTPException
from sqlalchemy.orm import Session
from database import get_db
from models import Upload, UploadStatus
from schemas import UploadOut
from storage import upload_file
from worker import run_dst_conversion

ALLOWED_TYPES = {"image/png", "image/jpeg", "image/svg+xml", "application/pdf"}
MAX_BYTES = 10 * 1024 * 1024  # 10MB

router = APIRouter(prefix="/uploads", tags=["uploads"])

@router.post("/", response_model=UploadOut, status_code=201)
async def create_upload(
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
        status=UploadStatus.pending,
    )
    db.add(upload)
    db.commit()
    db.refresh(upload)

    run_dst_conversion.delay(upload.id)
    return upload

@router.get("/{upload_id}", response_model=UploadOut)
def get_upload(upload_id: str, db: Session = Depends(get_db)):
    upload = db.query(Upload).filter(Upload.id == upload_id).first()
    if not upload:
        raise HTTPException(404, "Upload not found")
    return upload
