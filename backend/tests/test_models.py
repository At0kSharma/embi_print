import os

from sqlalchemy import create_engine, inspect


def test_all_tables_exist():
    engine = create_engine(os.getenv("DATABASE_URL", "postgresql://embi:embi@postgres:5432/embi"))
    inspector = inspect(engine)
    tables = inspector.get_table_names()
    for expected in ["products", "product_variants", "placement_zones", "uploads", "orders", "order_items"]:
        assert expected in tables, f"Missing table: {expected}"
