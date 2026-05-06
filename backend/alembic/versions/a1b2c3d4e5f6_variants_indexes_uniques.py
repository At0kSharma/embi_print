"""variants, unique payment ids, upload index, drop colors/sizes JSON

Revision ID: a1b2c3d4e5f6
Revises: 6258883002d9
Create Date: 2026-05-06 00:00:00.000000

Notes:
- Drops `products.colors` and `products.sizes` JSON columns (replaced by
  the new `product_variants` table). Existing seed data must be re-seeded
  after this migration via `python seed.py`.
- Drops `order_items.size` and `order_items.color` (replaced by
  `order_items.variant_id`). v1 has no production order data yet, so this
  is safe.
- Adds UNIQUE constraints on `orders.stripe_payment_intent_id` and
  `orders.printful_order_id` (nullable-unique).
- Adds index on `uploads.created_at` for recency queries.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "a1b2c3d4e5f6"
down_revision: Union[str, None] = "6258883002d9"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "product_variants",
        sa.Column("id", sa.String(), nullable=False),
        sa.Column("product_id", sa.String(), nullable=False),
        sa.Column("color", sa.String(), nullable=False),
        sa.Column("size", sa.String(), nullable=False),
        sa.Column("printful_variant_id", sa.String(), nullable=False),
        sa.Column("price_delta", sa.Numeric(precision=10, scale=2), nullable=False, server_default="0"),
        sa.ForeignKeyConstraint(["product_id"], ["products.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("product_id", "color", "size", name="uq_variant_product_color_size"),
    )

    op.drop_column("products", "colors")
    op.drop_column("products", "sizes")

    op.add_column(
        "order_items",
        sa.Column("variant_id", sa.String(), nullable=False),
    )
    op.create_foreign_key(
        "fk_order_items_variant_id",
        "order_items",
        "product_variants",
        ["variant_id"],
        ["id"],
    )
    op.drop_column("order_items", "size")
    op.drop_column("order_items", "color")

    op.create_unique_constraint(
        "uq_orders_stripe_payment_intent_id",
        "orders",
        ["stripe_payment_intent_id"],
    )
    op.create_unique_constraint(
        "uq_orders_printful_order_id",
        "orders",
        ["printful_order_id"],
    )

    op.create_index("ix_uploads_created_at", "uploads", ["created_at"])


def downgrade() -> None:
    op.drop_index("ix_uploads_created_at", table_name="uploads")
    op.drop_constraint("uq_orders_printful_order_id", "orders", type_="unique")
    op.drop_constraint("uq_orders_stripe_payment_intent_id", "orders", type_="unique")

    op.add_column("order_items", sa.Column("color", sa.String(), nullable=False))
    op.add_column("order_items", sa.Column("size", sa.String(), nullable=False))
    op.drop_constraint("fk_order_items_variant_id", "order_items", type_="foreignkey")
    op.drop_column("order_items", "variant_id")

    op.add_column("products", sa.Column("sizes", sa.JSON(), nullable=False))
    op.add_column("products", sa.Column("colors", sa.JSON(), nullable=False))

    op.drop_table("product_variants")
