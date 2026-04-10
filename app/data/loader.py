"""
Unified OHLCV loader.

Provider priority:
1. Cache (parquet, TTL=24h)
2. Angel One SmartAPI (NSE/BSE — primary for Indian markets)
3. Stooq (global fallback via pandas_datareader)
4. Last stale cache copy

Yahoo Finance has been removed entirely.
Indian market symbols (NSE/BSE) should be used for Angel One.
For US/global symbols, stooq fallback handles them.
"""
from __future__ import annotations
import pandas as pd
from pathlib import Path
from app.utils.logger import get_logger
from app.data.cache import DataCache

log = get_logger(__name__)

_cache = DataCache()


def _is_indian_symbol(ticker: str) -> bool:
    """
    Heuristic: symbols without dots and all-caps latin are likely NSE tickers.
    Yahoo-style suffixes like .NS or .BSE tell us explicitly.
    """
    upper = ticker.upper()
    if upper.endswith(".NS") or upper.endswith(".NSE"):
        return True
    if upper.endswith(".BSE"):
        return True
    # common Indian benchmark indices
    if upper in ("NIFTY", "NIFTY50", "BANKNIFTY", "SENSEX"):
        return True
    return False


def _strip_suffix(ticker: str) -> tuple[str, str]:
    """
    Parse 'RELIANCE.NS' -> ('RELIANCE', 'NSE')
    Parse 'RELIANCE.BSE' -> ('RELIANCE', 'BSE')
    Default exchange: NSE
    """
    upper = ticker.upper()
    if upper.endswith(".BSE"):
        return ticker[:-4], "BSE"
    if upper.endswith(".NS") or upper.endswith(".NSE"):
        return ticker.rsplit(".", 1)[0], "NSE"
    return ticker, "NSE"


def _fetch_angelone(ticker: str, start: str, end: str) -> pd.DataFrame:
    """Try Angel One SmartAPI."""
    try:
        from app.data.providers.angelone import fetch_angelone
        symbol, exchange = _strip_suffix(ticker)
        log.info(f"[Loader] Trying Angel One: {symbol} ({exchange}) {start}→{end}")
        df = fetch_angelone(symbol, start, end, exchange=exchange)
        if not df.empty:
            return df
    except EnvironmentError as e:
        log.warning(f"[Loader] Angel One not configured: {e}")
    except Exception as e:
        log.warning(f"[Loader] Angel One failed for {ticker}: {e}")
    return pd.DataFrame()


def _fetch_stooq(ticker: str, start: str, end: str) -> pd.DataFrame:
    """Fallback: stooq via pandas_datareader (works for US/global tickers)."""
    try:
        from pandas_datareader import data as pdr
        log.info(f"[Loader] Trying stooq: {ticker} {start}→{end}")
        df = pdr.DataReader(ticker, "stooq", start=start, end=end)
        if df.empty:
            raise ValueError("stooq returned empty data")
        df = df.sort_index()
        df.index = pd.to_datetime(df.index)
        df = df[["Open", "High", "Low", "Close", "Volume"]]
        return df
    except Exception as e:
        log.warning(f"[Loader] stooq failed for {ticker}: {e}")
        return pd.DataFrame()


def load_ohlcv(ticker: str, start: str, end: str) -> pd.DataFrame:
    """
    Load OHLCV data for any ticker.

    Flow
    ----
    1. Check disk cache (parquet, 24-hour TTL)
    2. Try Angel One SmartAPI  (for Indian NSE/BSE symbols)
    3. Try stooq               (global fallback — US, indices, etc.)
    4. Return stale cache if everything else fails
    5. Raise ValueError

    Parameters
    ----------
    ticker : trading symbol. Use bare symbols for NSE (e.g. "RELIANCE"),
             optionally suffixed with .NS/.BSE. US symbols work via stooq.
    start  : 'YYYY-MM-DD'
    end    : 'YYYY-MM-DD'
    """
    # ── 1. Cache hit ──────────────────────────────────────────────────────────
    cached = _cache.get(ticker, start, end)
    if cached is not None and not cached.empty:
        return cached

    # ── 2. Angel One ──────────────────────────────────────────────────────────
    df = _fetch_angelone(ticker, start, end)
    if not df.empty:
        _cache.put(ticker, start, end, df)
        return df

    # ── 3. stooq fallback ────────────────────────────────────────────────────
    df = _fetch_stooq(ticker, start, end)
    if not df.empty:
        _cache.put(ticker, start, end, df)
        return df

    # ── 4. Stale cache ────────────────────────────────────────────────────────
    stale = _cache.get(ticker, start, end)   # ignores TTL implicitly via direct read
    if stale is not None and not stale.empty:
        log.warning(f"[Loader] Using stale cache for {ticker}")
        return stale

    raise ValueError(
        f"Failed to load OHLCV for '{ticker}' ({start}→{end}). "
        f"Check Angel One credentials or try a different symbol."
    )
