from fastapi import APIRouter, Depends, HTTPException, status, Body
from sqlmodel import Session, select, func
from datetime import date as _date
from app.db.database import engine
from app.models.transaction import Transaction
from app.models.user import User
from app.auth.dependencies import get_db, get_current_user
from app.schemas.transaction import TransactionCreate

router = APIRouter(prefix="/transactions", tags=["transactions"])


def _parse_update_body(body: dict) -> dict:
    """Normalize PATCH body: only include keys that are present and valid. Coerce types."""
    result = {}
    if "amount" in body:
        v = body["amount"]
        if v is None:
            raise HTTPException(status_code=422, detail="amount cannot be null")
        try:
            result["amount"] = float(v) if not isinstance(v, (int, float)) else float(v)
        except (TypeError, ValueError):
            raise HTTPException(status_code=422, detail="amount must be a number")
    if "category" in body:
        v = body["category"]
        if v is None or (isinstance(v, str) and not v.strip()):
            raise HTTPException(status_code=422, detail="category cannot be empty")
        result["category"] = str(v).strip()
    if "date" in body:
        v = body["date"]
        if v is None or (isinstance(v, str) and not str(v).strip()):
            raise HTTPException(status_code=422, detail="date cannot be empty")
        if isinstance(v, str):
            try:
                result["date"] = _date.fromisoformat(str(v).strip())
            except ValueError:
                raise HTTPException(status_code=422, detail="date must be YYYY-MM-DD")
        elif isinstance(v, _date):
            result["date"] = v
        else:
            raise HTTPException(status_code=422, detail="date must be YYYY-MM-DD string")
    if "note" in body:
        v = body["note"]
        result["note"] = None if (v is None or (isinstance(v, str) and not str(v).strip())) else str(v).strip()
    return result


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


@router.patch("/{transaction_id}", response_model=Transaction)
def update_transaction(
    transaction_id: int,
    body: dict = Body(...),
    user: User = Depends(get_current_user),
    session: Session = Depends(get_db),
):
    transaction = session.get(Transaction, transaction_id)
    if not transaction or transaction.user_id != user.id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Transaction not found",
        )
    data = _parse_update_body(body)
    for key, value in data.items():
        setattr(transaction, key, value)
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
    statement = (
        select(Transaction)
        .where(Transaction.user_id == user.id)
        .order_by(Transaction.date.desc(), Transaction.id.desc())
    )
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
