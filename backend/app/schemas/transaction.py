from pydantic import BaseModel
from datetime import date
from typing import Optional


class TransactionCreate(BaseModel):
    amount: float
    category: str
    date: date
    note: Optional[str] = None
