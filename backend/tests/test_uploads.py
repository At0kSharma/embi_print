"""Tests for the /uploads endpoint.

Covers: happy path, oversized files, unsupported MIME, DST conversion
failure (graceful degradation), and rate limiting.

Network/external calls are stubbed:
- `storage.upload_file` and `storage.upload_bytes` are patched to no-op
  S3 writes (otherwise tests would require real AWS credentials).
- `dst.convert_to_dst` is patched per-test to avoid invoking ImageMagick
  / potrace during unit tests.
"""
from io import BytesIO
from unittest.mock import patch

import pytest
from fastapi.testclient import TestClient

from dst import DSTConversionError
from main import app
from models import Upload, UploadStatus
from tests.conftest import TestSessionLocal


@pytest.fixture
def client():
    return TestClient(app)


@pytest.fixture
def stub_s3():
    with (
        patch("routers.uploads.upload_file", return_value="uploads/test-key.png"),
        patch("routers.uploads.upload_bytes", return_value="dst/test-key.dst"),
    ):
        yield


@pytest.fixture
def stub_dst_success():
    with patch(
        "routers.uploads.convert_to_dst",
        return_value=(b"DST_BYTES", 4321),
    ) as m:
        yield m


@pytest.fixture
def stub_dst_failure():
    with patch(
        "routers.uploads.convert_to_dst",
        side_effect=DSTConversionError("simulated failure"),
    ) as m:
        yield m


def test_upload_happy_path(client, stub_s3, stub_dst_success):
    files = {"file": ("logo.png", BytesIO(b"\x89PNG fake"), "image/png")}
    resp = client.post("/uploads/", files=files)
    assert resp.status_code == 201, resp.text
    body = resp.json()
    assert body["status"] == "done"
    assert body["stitch_count"] == 4321
    assert body["original_filename"] == "logo.png"


def test_upload_dst_failure_still_succeeds(client, stub_s3, stub_dst_failure):
    """DST is best-effort. A failure must not block the upload itself."""
    files = {"file": ("logo.png", BytesIO(b"\x89PNG fake"), "image/png")}
    resp = client.post("/uploads/", files=files)
    assert resp.status_code == 201
    body = resp.json()
    assert body["status"] == "failed"
    assert body["stitch_count"] is None


def test_upload_unsupported_mime(client):
    files = {"file": ("doc.pdf", BytesIO(b"%PDF-1.4"), "application/pdf")}
    resp = client.post("/uploads/", files=files)
    assert resp.status_code == 400
    assert "Unsupported" in resp.json()["detail"]


def test_upload_too_large(client, stub_s3, stub_dst_success):
    big = b"\x89PNG" + b"\x00" * (10 * 1024 * 1024 + 1)
    files = {"file": ("logo.png", BytesIO(big), "image/png")}
    resp = client.post("/uploads/", files=files)
    assert resp.status_code == 400
    assert "10MB" in resp.json()["detail"]


def test_get_upload_not_found(client):
    resp = client.get("/uploads/does-not-exist")
    assert resp.status_code == 404


def test_get_upload_returns_status(client, stub_s3, stub_dst_success):
    files = {"file": ("logo.png", BytesIO(b"\x89PNG fake"), "image/png")}
    create_resp = client.post("/uploads/", files=files)
    upload_id = create_resp.json()["id"]
    get_resp = client.get(f"/uploads/{upload_id}")
    assert get_resp.status_code == 200
    assert get_resp.json()["id"] == upload_id
    assert get_resp.json()["status"] == "done"


def test_upload_rate_limited(client, stub_s3, stub_dst_success):
    """11th upload within the same minute returns 429."""
    files_factory = lambda: {"file": ("logo.png", BytesIO(b"\x89PNG fake"), "image/png")}
    for i in range(10):
        resp = client.post("/uploads/", files=files_factory())
        assert resp.status_code == 201, f"call #{i+1} unexpectedly limited: {resp.text}"
    resp = client.post("/uploads/", files=files_factory())
    assert resp.status_code == 429
