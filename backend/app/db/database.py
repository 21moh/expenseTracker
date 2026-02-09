from sqlalchemy import text
from sqlmodel import SQLModel, create_engine
from app.models.user import User  # noqa: F401 - register model for create_all
from app.models.transaction import Transaction  # noqa: F401

DATABASE_URL = "sqlite:///database.db"

engine = create_engine(DATABASE_URL, echo=True)


def _ensure_transaction_has_user_id():
    """Add user_id column to transaction table if missing (migration for older DBs)."""
    with engine.connect() as conn:
        res = conn.execute(
            text('SELECT name FROM pragma_table_info("transaction") WHERE name = \'user_id\'')
        )
        if res.fetchone() is None:
            conn.execute(
                text('ALTER TABLE "transaction" ADD COLUMN user_id INTEGER NOT NULL DEFAULT 1')
            )
            conn.commit()


def create_db():
    SQLModel.metadata.create_all(engine)
    _ensure_transaction_has_user_id()
