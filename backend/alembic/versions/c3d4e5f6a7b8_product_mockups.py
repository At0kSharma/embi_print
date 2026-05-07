"""products.mockups (admin-uploaded mockup image URLs)

Revision ID: c3d4e5f6a7b8
Revises: b2c3d4e5f6a7
Create Date: 2026-05-06 21:00:00.000000

Stores admin-uploaded mockup URLs per (color, view). Existing rows
keep mockups=NULL and continue to resolve images via the
/mockups/{slug}/{color}/{view}.png public-folder convention. New
admin-created products write S3 (or MinIO) URLs here.

Shape:
{
  "white": { "front": "https://...", "back": "https://..." },
  "black": { "front": "https://..." }
}
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "c3d4e5f6a7b8"
down_revision: Union[str, None] = "b2c3d4e5f6a7"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("products", sa.Column("mockups", sa.JSON(), nullable=True))


def downgrade() -> None:
    op.drop_column("products", "mockups")
