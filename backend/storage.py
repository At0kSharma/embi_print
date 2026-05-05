import boto3
import os
import uuid

s3 = boto3.client(
    "s3",
    region_name=os.getenv("AWS_REGION", "us-east-1"),
    aws_access_key_id=os.getenv("AWS_ACCESS_KEY_ID"),
    aws_secret_access_key=os.getenv("AWS_SECRET_ACCESS_KEY"),
)
BUCKET = os.getenv("AWS_S3_BUCKET", "embi-print")

def upload_file(file_bytes: bytes, filename: str, content_type: str) -> str:
    """Upload file to S3 and return the S3 key."""
    ext = filename.rsplit(".", 1)[-1] if "." in filename else "bin"
    key = f"uploads/{uuid.uuid4()}.{ext}"
    s3.put_object(
        Bucket=BUCKET,
        Key=key,
        Body=file_bytes,
        ContentType=content_type,
    )
    return key

def get_presigned_url(key: str, expires: int = 3600) -> str:
    """Return a temporary URL for a private S3 object."""
    return s3.generate_presigned_url(
        "get_object",
        Params={"Bucket": BUCKET, "Key": key},
        ExpiresIn=expires,
    )
