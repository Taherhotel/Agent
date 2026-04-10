from datetime import datetime
from typing import Optional

from sqlmodel import SQLModel, Field, Column, JSON


class User(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    email: str = Field(index=True, unique=True)
    hashed_password: str
    created_at: datetime = Field(default_factory=datetime.utcnow)


class TearsheetRecord(SQLModel, table=True):
    run_id: str = Field(primary_key=True)

    # Soft reference to User (no FK constraint so anonymous/seed-less runs never fail)
    user_id: Optional[int] = Field(default=None, index=True)

    asset: str
    start_date: str
    end_date: str

    payload: dict = Field(sa_column=Column(JSON))

    trader_sharpe: Optional[float] = None
    trader_cagr: Optional[float] = None
    trader_max_dd: Optional[float] = None

    created_at: datetime = Field(default_factory=datetime.utcnow, index=True)


class PriceCache(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)

    ticker: str = Field(index=True)
    start_date: str
    end_date: str

    data: dict = Field(sa_column=Column(JSON))

    created_at: datetime = Field(default_factory=datetime.utcnow)