from fastapi import APIRouter
from sqlmodel import Session, select, func
from datetime import date as _date
from app.db.database import engine
from app.models.transaction import Transaction

router = APIRouter(prefix="/transactions", tags=["transactions"])

@router.post("/")
def create_transaction(transaction: Transaction):
    # Ensure `date` is a proper `datetime.date` object for SQLite
    if isinstance(transaction.date, str):
        transaction.date = _date.fromisoformat(transaction.date)

    with Session(engine) as session:
        session.add(transaction)
        session.commit()
        session.refresh(transaction)
        return transaction


@router.get("/")
def read_transactions():
    with Session(engine) as session:
        transactions = session.query(Transaction).all()
        return transactions


@router.get("/sum")
def get_transactions_sum():
    with Session(engine) as session:
        statement = select(func.sum(Transaction.amount))
        result = session.exec(statement).one()
        total = result or 0
        return {"total_amount": total}


@router.get("/daily-sum")
def get_daily_transactions_sum():
    with Session(engine) as session:
        statement = (
            select(Transaction.date, func.sum(Transaction.amount))
            .group_by(Transaction.date)
            .order_by(Transaction.date)
        )
        rows = session.exec(statement).all()
        # Return a mapping of "YYYY-MM-DD" -> total_amount
        return {
            row[0].isoformat(): (row[1] or 0)
            for row in rows
        }