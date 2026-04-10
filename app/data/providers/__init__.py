"""Data providers package."""
from app.data.providers.angelone import fetch_angelone, fetch_quote
from app.data.providers.csv import fetch_csv

__all__ = ["fetch_angelone", "fetch_quote", "fetch_csv"]
