from sqlmodel import SQLModel, Field
from datetime import date
from typing import Optional

class Transaction(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    amount: float
    category: str
    date: date
    note: Optional[str] = None
