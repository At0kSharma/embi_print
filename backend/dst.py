"""Synchronous DST conversion wrapper around `convert.py`.

Used inline by `POST /uploads`. Runs the embroidery pipeline in a
thread with a hard timeout so a slow/buggy input cannot hold the
request handler indefinitely.
"""
import logging
import tempfile
from concurrent.futures import ThreadPoolExecutor
from concurrent.futures import TimeoutError as FuturesTimeoutError
from pathlib import Path

import convert as convert_module

log = logging.getLogger(__name__)

DST_TIMEOUT_SECONDS = 10

_MIME_TO_EXT = {
    "image/png": "png",
    "image/jpeg": "jpg",
    "image/svg+xml": "svg",
}


class DSTConversionError(Exception):
    """Raised when the embroidery pipeline fails or times out."""


def convert_to_dst(image_bytes: bytes, mime_type: str) -> tuple[bytes, int]:
    """Run the embroidery pipeline synchronously.

    Returns (dst_bytes, stitch_count). Raises DSTConversionError on
    timeout or pipeline failure (subprocess error, decode error, etc).
    """
    ext = _MIME_TO_EXT.get(mime_type)
    if ext is None:
        raise DSTConversionError(f"Unsupported mime type: {mime_type}")

    def _do_convert() -> tuple[bytes, int]:
        with tempfile.TemporaryDirectory(prefix="embi_dst_") as tmp:
            work_dir = Path(tmp)
            input_path = work_dir / f"input.{ext}"
            input_path.write_bytes(image_bytes)
            dst_path, stitch_count = convert_module.convert(input_path, work_dir)
            return dst_path.read_bytes(), stitch_count

    with ThreadPoolExecutor(max_workers=1) as pool:
        future = pool.submit(_do_convert)
        try:
            return future.result(timeout=DST_TIMEOUT_SECONDS)
        except FuturesTimeoutError as e:
            raise DSTConversionError(
                f"DST conversion timed out after {DST_TIMEOUT_SECONDS}s"
            ) from e
        except Exception as e:
            raise DSTConversionError(f"DST conversion failed: {e}") from e
