"""
Headless embroidery pipeline with proper tatami fill:
1) PNG → monochrome PGM (ImageMagick)
2) PGM → SVG (potrace) for outline extraction
3) Build DST with tatami fill + running stitch outline
"""
import subprocess
import sys
from pathlib import Path

from svgpathtools import svg2paths
from pyembroidery import EmbPattern, STITCH, TRIM
from PIL import Image

input_image = Path(sys.argv[1])
workdir = Path("/work")

pgm_file = workdir / "tmp.pgm"
svg_file = workdir / "logo.svg"
dst_file = workdir / "output.dst"

def run(cmd, **kwargs):
    subprocess.run(cmd, check=True, **kwargs)

# Step 1: PNG → PGM (binarize for cleaner trace)
run([
    "convert",
    str(input_image),
    "-threshold", "60%",
    "-alpha", "remove",
    str(pgm_file),
])

# Step 2: PGM → SVG vector outline
run([
    "potrace",
    "-s",
    "-o", str(svg_file),
    str(pgm_file),
])

# Load raster mask for fill and SVG for outline
img = Image.open(pgm_file).convert("L")
width, height = img.size
pixels = img.load()
paths, _ = svg2paths(str(svg_file))

# Convert to embroidery coordinates: scale to max 10cm = 1000 units (0.1mm)
TARGET_MAX = 1000  # 10cm in 0.1mm units
scale = TARGET_MAX / max(width, height)

def to_emb_coords(x, y):
    """Convert pixel coords to centered embroidery coords (0.1mm units)"""
    x_emb = (x - width / 2) * scale
    y_emb = -(y - height / 2) * scale  # flip Y
    return x_emb, y_emb

pattern = EmbPattern()

# Step 3a: Underlay pass (sparse horizontal lines for stability)
print("Adding underlay...")
threshold = 128
underlay_step = 12  # sparse rows

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
    
    for start_x, end_x in spans:
        x1, y1 = to_emb_coords(start_x, y)
        x2, y2 = to_emb_coords(end_x, y)
        pattern.add_stitch_absolute(STITCH, x1, y1)
        pattern.add_stitch_absolute(STITCH, x2, y2)

if pattern.stitches:
    pattern.add_stitch_absolute(TRIM, pattern.stitches[-1][1], pattern.stitches[-1][2])

# Step 3b: Tatami fill (alternating rows with stagger)
print("Adding tatami fill...")
row_step = 4  # row spacing in pixels (adjust for density)
stagger = 2   # stagger offset in pixels

for row_idx, y in enumerate(range(0, height, row_step)):
    spans = []
    in_span = False
    start_x = 0
    
    # Scan row for dark regions
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
    
    # Stagger alternate rows
    if row_idx % 2 == 1:
        spans = [(max(0, s + stagger), min(width, e + stagger)) for s, e in spans]
    
    # Alternate direction per row (tatami pattern)
    if row_idx % 2 == 1:
        spans.reverse()
    
    for start_x, end_x in spans:
        if row_idx % 2 == 1:
            start_x, end_x = end_x, start_x
        x1, y1 = to_emb_coords(start_x, y)
        x2, y2 = to_emb_coords(end_x, y)
        pattern.add_stitch_absolute(STITCH, x1, y1)
        pattern.add_stitch_absolute(STITCH, x2, y2)

if pattern.stitches:
    pattern.add_stitch_absolute(TRIM, pattern.stitches[-1][1], pattern.stitches[-1][2])

# Step 3c: Running stitch outline for clean edges
print("Adding outline...")
for path in paths:
    length = path.length(error=1e-3)
    # Outline stitch spacing: ~2mm
    steps = max(int(length * scale / 20) + 1, 3)
    
    for i in range(steps):
        t = i / (steps - 1)
        pt = path.point(t)
        # SVG coords are already in pixel space
        x_emb = (pt.real - width / 2) * scale
        y_emb = -(pt.imag - height / 2) * scale
        pattern.add_stitch_absolute(STITCH, x_emb, y_emb)
    
    if pattern.stitches:
        pattern.add_stitch_absolute(TRIM, pattern.stitches[-1][1], pattern.stitches[-1][2])

pattern.end()
pattern.write(str(dst_file))

print(f"DONE: {dst_file} (max dimension: 10cm, {len(pattern.stitches)} stitches)")
