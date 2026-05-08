"""product_variants.hex_color (admin-supplied swatch color)

Revision ID: d4e5f6a7b8c9
Revises: c3d4e5f6a7b8
Create Date: 2026-05-08 12:00:00.000000

Stores the swatch hex (e.g. "#1B2A4A") next to each variant so the
storefront's color picker draws an accurate swatch for any color the
admin adds. Pre-existing variants get NULL and the frontend falls
back to its named-color map.
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "d4e5f6a7b8c9"
down_revision: Union[str, None] = "c3d4e5f6a7b8"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "product_variants",
        sa.Column("hex_color", sa.String(length=9), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("product_variants", "hex_color")
