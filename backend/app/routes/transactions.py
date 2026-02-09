from fastapi import APIRouter, Depends, HTTPException, status
from sqlmodel import Session, select, func
from datetime import date as _date
from app.db.database import engine
from app.models.transaction import Transaction
from app.models.user import User
from app.auth.dependencies import get_db, get_current_user
from app.schemas.transaction import TransactionCreate

router = APIRouter(prefix="/transactions", tags=["transactions"])


@router.post("/", response_model=Transaction)
def create_transaction(
    body: TransactionCreate,
    user: User = Depends(get_current_user),
    session: Session = Depends(get_db),
):
    date_val = body.date
    if isinstance(date_val, str):
        date_val = _date.fromisoformat(date_val)
    transaction = Transaction(
        user_id=user.id,
        amount=body.amount,
        category=body.category,
        date=date_val,
        note=body.note,
    )
    session.add(transaction)
    session.commit()
    session.refresh(transaction)
    return transaction


@router.delete("/{transaction_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_transaction(
    transaction_id: int,
    user: User = Depends(get_current_user),
    session: Session = Depends(get_db),
):
    transaction = session.get(Transaction, transaction_id)
    if not transaction or transaction.user_id != user.id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Transaction not found",
        )
    session.delete(transaction)
    session.commit()
    return None


@router.get("/")
def read_transactions(
    user: User = Depends(get_current_user),
    session: Session = Depends(get_db),
):
    statement = select(Transaction).where(Transaction.user_id == user.id)
    transactions = list(session.exec(statement).all())
    return transactions


@router.get("/sum")
def get_transactions_sum(
    user: User = Depends(get_current_user),
    session: Session = Depends(get_db),
):
    statement = (
        select(func.sum(Transaction.amount))
        .where(Transaction.user_id == user.id)
    )
    result = session.exec(statement).one()
    total = result or 0
    return {"total_amount": total}


@router.get("/daily-sum")
def get_daily_transactions_sum(
    user: User = Depends(get_current_user),
    session: Session = Depends(get_db),
):
    statement = (
        select(Transaction.date, func.sum(Transaction.amount))
        .where(Transaction.user_id == user.id)
        .group_by(Transaction.date)
        .order_by(Transaction.date)
    )
    rows = session.exec(statement).all()
    return {
        row[0].isoformat(): (row[1] or 0)
        for row in rows
    }
