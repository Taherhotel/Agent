from sqlmodel import SQLModel, create_engine, Session
from pathlib import Path
from app.config import settings

DB_PATH = Path(settings.db_url.replace('sqlite:///','')) if settings.db_url.startswith('sqlite:///') else None
if DB_PATH:
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)

engine = create_engine(settings.db_url, echo=False, connect_args={"check_same_thread": False} if settings.db_url.startswith('sqlite') else {})


def get_session():
    with Session(engine) as session:
        yield session


def init_db():
    SQLModel.metadata.create_all(engine)
