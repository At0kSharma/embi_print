"""product catalog fields: slug, description, print_method

Revision ID: b2c3d4e5f6a7
Revises: a1b2c3d4e5f6
Create Date: 2026-05-06 19:00:00.000000

Phase A of the multi-product catalog rollout. Adds:
- products.slug: required, unique, used in URLs and the
  /mockups/{slug}/{color}/{view}.png convention
- products.description: free text shown on product detail page
- products.print_method: 'embroidery' | 'dtg', default 'embroidery'
  (drives whether the customizer shows stitch-count estimates)

Existing rows are backfilled to slug='classic-tee', print_method='embroidery'.
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "b2c3d4e5f6a7"
down_revision: Union[str, None] = "a1b2c3d4e5f6"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. Add columns nullable so backfill can run
    op.add_column("products", sa.Column("slug", sa.String(), nullable=True))
    op.add_column("products", sa.Column("description", sa.Text(), nullable=True))

    print_method_enum = sa.Enum("embroidery", "dtg", name="printmethod")
    print_method_enum.create(op.get_bind(), checkfirst=True)
    op.add_column(
        "products",
        sa.Column("print_method", print_method_enum, nullable=True),
    )

    # 2. Backfill existing rows (the seeded "Classic T-Shirt")
    op.execute(
        "UPDATE products SET slug = 'classic-tee', print_method = 'embroidery' "
        "WHERE slug IS NULL"
    )

    # 3. Lock down NOT NULL + UNIQUE on slug
    op.alter_column("products", "slug", nullable=False)
    op.alter_column("products", "print_method", nullable=False)
    op.create_unique_constraint("uq_products_slug", "products", ["slug"])


def downgrade() -> None:
    op.drop_constraint("uq_products_slug", "products", type_="unique")
    op.drop_column("products", "print_method")
    op.drop_column("products", "description")
    op.drop_column("products", "slug")
    sa.Enum(name="printmethod").drop(op.get_bind(), checkfirst=True)
