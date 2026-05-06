"""
Headless embroidery pipeline with proper tatami fill:
1) PNG/JPG/SVG → monochrome PGM (ImageMagick)
2) PGM → SVG (potrace) for outline extraction
3) Build DST with tatami fill + running stitch outline

Exposes `convert(input_path, work_dir) -> (dst_path, stitch_count)`.
Also runnable as a CLI: `python convert.py <image> [work_dir]`.
"""
import subprocess
import sys
from pathlib import Path

from PIL import Image
from pyembroidery import STITCH, TRIM, EmbPattern
from svgpathtools import svg2paths


def _run(cmd):
    subprocess.run(cmd, check=True)


def convert(input_path: Path, work_dir: Path) -> tuple[Path, int]:
    """Run the embroidery pipeline. Returns (dst_path, stitch_count)."""
    work_dir.mkdir(parents=True, exist_ok=True)
    pgm_file = work_dir / "tmp.pgm"
    svg_file = work_dir / "logo.svg"
    dst_file = work_dir / "output.dst"

    _run([
        "convert",
        str(input_path),
        "-threshold", "60%",
        "-alpha", "remove",
        str(pgm_file),
    ])

    _run([
        "potrace",
        "-s",
        "-o", str(svg_file),
        str(pgm_file),
    ])

    img = Image.open(pgm_file).convert("L")
    width, height = img.size
    pixels = img.load()
    paths, _ = svg2paths(str(svg_file))

    TARGET_MAX = 1000  # 10cm in 0.1mm units
    scale = TARGET_MAX / max(width, height)

    def to_emb_coords(x, y):
        x_emb = (x - width / 2) * scale
        y_emb = -(y - height / 2) * scale
        return x_emb, y_emb

    pattern = EmbPattern()

    threshold = 128
    underlay_step = 12

    for y in range(0, height, underlay_step):
        spans = []
        in_span = False
        start_x = 0
        for x in range(width):
            dark = pixels[x, y] < threshold
            if dark and not in_span:
                start_x = x
                in_span = True
            elif not dark and in_span:
                spans.append((start_x, x))
                in_span = False
        if in_span:
            spans.append((start_x, width))
        for sx, ex in spans:
            x1, y1 = to_emb_coords(sx, y)
            x2, y2 = to_emb_coords(ex, y)
            pattern.add_stitch_absolute(STITCH, x1, y1)
            pattern.add_stitch_absolute(STITCH, x2, y2)

    if pattern.stitches:
        pattern.add_stitch_absolute(TRIM, pattern.stitches[-1][1], pattern.stitches[-1][2])

    row_step = 4
    stagger = 2

    for row_idx, y in enumerate(range(0, height, row_step)):
        spans = []
        in_span = False
        start_x = 0
        for x in range(width):
            dark = pixels[x, y] < threshold
            if dark and not in_span:
                start_x = x
                in_span = True
            elif not dark and in_span:
                spans.append((start_x, x))
                in_span = False
        if in_span:
            spans.append((start_x, width))

        if row_idx % 2 == 1:
            spans = [(max(0, s + stagger), min(width, e + stagger)) for s, e in spans]
            spans.reverse()

        for sx, ex in spans:
            if row_idx % 2 == 1:
                sx, ex = ex, sx
            x1, y1 = to_emb_coords(sx, y)
            x2, y2 = to_emb_coords(ex, y)
            pattern.add_stitch_absolute(STITCH, x1, y1)
            pattern.add_stitch_absolute(STITCH, x2, y2)

    if pattern.stitches:
        pattern.add_stitch_absolute(TRIM, pattern.stitches[-1][1], pattern.stitches[-1][2])

    for path in paths:
        length = path.length(error=1e-3)
        steps = max(int(length * scale / 20) + 1, 3)
        for i in range(steps):
            t = i / (steps - 1)
            pt = path.point(t)
            x_emb = (pt.real - width / 2) * scale
            y_emb = -(pt.imag - height / 2) * scale
            pattern.add_stitch_absolute(STITCH, x_emb, y_emb)
        if pattern.stitches:
            pattern.add_stitch_absolute(TRIM, pattern.stitches[-1][1], pattern.stitches[-1][2])

    pattern.end()
    pattern.write(str(dst_file))
    return dst_file, len(pattern.stitches)


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("usage: convert.py <image> [work_dir]", file=sys.stderr)
        sys.exit(2)
    input_image = Path(sys.argv[1])
    work_dir = Path(sys.argv[2]) if len(sys.argv) > 2 else Path("/work")
    dst, count = convert(input_image, work_dir)
    print(f"DONE: {dst} ({count} stitches)")
