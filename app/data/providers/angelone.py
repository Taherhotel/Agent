"""
Angel One SmartAPI data provider.

Authentication Flow:
--------------------
1. SmartAPI uses a 3-factor auth:
   - API Key       : Static key from Angel One developer console
   - Client ID     : Your Angel One trading login ID
   - MPIN / Password: Your trading password
   - TOTP          : Time-based OTP (from Google Authenticator or pyotp)

2. On `connect()`, we POST to /rest/auth/angelbroking/user/v1/loginByPassword
   and receive a `jwtToken` + `refreshToken`.

3. All subsequent data calls include `Authorization: Bearer {jwtToken}`.

Symbol / Token System:
-----------------------
- SmartAPI does NOT use ticker symbols like "RELIANCE" directly.
- Every instrument has a unique numeric **token** (e.g. Reliance = "2885" on NSE).
- The symbol file is a JSON list downloadable from SmartAPI CDN.
- We cache this symbol map: {(exchange, symbol) -> token}.
- For historical data (candle API), we send:
    { "exchange": "NSE", "symboltoken": "2885", "interval": "ONE_DAY", ... }

Key Differences from Yahoo Finance:
--------------------------------------
| Aspect            | Yahoo Finance           | Angel One SmartAPI         |
|-------------------|-------------------------|----------------------------|
| Market            | Global (US focus)       | Indian (NSE / BSE)         |
| Auth              | None (public)           | JWT + TOTP required        |
| Symbol format     | "AAPL", "INFY.NS"       | Token-based (numeric ID)   |
| Historical candles| yf.download()           | POST candle API endpoint   |
| Real-time quote   | yf.Ticker().fast_info   | POST LTP/quote API         |
| Rate limits       | Unofficial / may break  | Official, documented       |
| Data latency      | 15-min delayed          | Real-time (with auth)      |
"""
from __future__ import annotations

import os
import json
import time
import pyotp
import httpx
import pandas as pd
from pathlib import Path
from typing import Optional
from app.utils.logger import get_logger

log = get_logger(__name__)

# ── SmartAPI base URL ────────────────────────────────────────────────────────
_BASE = "https://apiconnect.angelbroking.com"
_LOGIN_URL = f"{_BASE}/rest/auth/angelbroking/user/v1/loginByPassword"
_CANDLE_URL = f"{_BASE}/rest/secure/angelbroking/historical/v1/getCandleData"
_QUOTE_URL  = f"{_BASE}/rest/secure/angelbroking/market/v1/quote/"
_SYMBOL_URL = "https://margincalculator.angelbroking.com/OpenAPI_File/files/OpenAPIScripMaster.json"

# ── Interval map: our canonical → SmartAPI ───────────────────────────────────
_INTERVAL_MAP = {
    "1min":  "ONE_MINUTE",
    "5min":  "FIVE_MINUTE",
    "15min": "FIFTEEN_MINUTE",
    "30min": "THIRTY_MINUTE",
    "1hour": "ONE_HOUR",
    "1day":  "ONE_DAY",
    "1week": "ONE_WEEK",
    "1month":"ONE_MONTH",
}

# ── Symbol master cache path ─────────────────────────────────────────────────
_SYMBOL_CACHE = Path(__file__).parent.parent / "cache" / "angelone_symbols.json"
_SYMBOL_CACHE.parent.mkdir(parents=True, exist_ok=True)


class AngelOneClient:
    """
    Thread-safe SmartAPI client with auto-login and token caching.
    Reads credentials from env vars:
      ANGELONE_API_KEY, ANGELONE_CLIENT_ID, ANGELONE_PASSWORD, ANGELONE_TOTP_SECRET
    """

    def __init__(self):
        self.api_key    = os.getenv("ANGELONE_API_KEY", "")
        self.client_id  = os.getenv("ANGELONE_CLIENT_ID", "")
        self.password   = os.getenv("ANGELONE_PASSWORD", "")
        self.totp_secret= os.getenv("ANGELONE_TOTP_SECRET", "")

        self._jwt: Optional[str] = None
        self._jwt_expiry: float = 0.0
        self._symbol_map: dict[tuple[str, str], str] = {}  # (exchange, symbol) -> token

    # ── Credentials check ────────────────────────────────────────────────────

    def _creds_available(self) -> bool:
        return bool(self.api_key and self.client_id and self.password)

    # ── Authentication ───────────────────────────────────────────────────────

    def _get_totp(self) -> str:
        """Generate current TOTP. Returns empty string if secret not configured."""
        if not self.totp_secret:
            return ""
        return pyotp.TOTP(self.totp_secret).now()

    def _login(self) -> str:
        """
        Perform full SmartAPI login and return JWT token.
        Caches token for 20 hours (SmartAPI tokens expire in 24h).
        """
        totp = self._get_totp()
        payload = {
            "clientcode": self.client_id,
            "password":   self.password,
            "totp":       totp,
        }
        headers = {
            "Content-Type":  "application/json",
            "Accept":         "application/json",
            "X-UserType":     "USER",
            "X-SourceID":     "WEB",
            "X-ClientLocalIP":"127.0.0.1",
            "X-ClientPublicIP":"127.0.0.1",
            "X-MACAddress":   "00:00:00:00:00:00",
            "X-PrivateKey":   self.api_key,
        }

        log.info("[AngelOne] Authenticating...")
        resp = httpx.post(_LOGIN_URL, json=payload, headers=headers, timeout=15.0)
        resp.raise_for_status()
        data = resp.json()

        if not data.get("status"):
            raise ValueError(f"SmartAPI login failed: {data.get('message', 'Unknown error')}")

        jwt = data["data"]["jwtToken"]
        self._jwt = jwt
        self._jwt_expiry = time.time() + 72_000  # 20 hours
        log.info("[AngelOne] Authenticated successfully")
        return jwt

    def _get_jwt(self) -> str:
        """Return a valid JWT, re-authenticating if expired."""
        if self._jwt and time.time() < self._jwt_expiry:
            return self._jwt
        return self._login()

    def _auth_headers(self) -> dict:
        return {
            "Authorization":   f"Bearer {self._get_jwt()}",
            "Content-Type":    "application/json",
            "Accept":          "application/json",
            "X-UserType":      "USER",
            "X-SourceID":      "WEB",
            "X-ClientLocalIP": "127.0.0.1",
            "X-ClientPublicIP":"127.0.0.1",
            "X-MACAddress":    "00:00:00:00:00:00",
            "X-PrivateKey":    self.api_key,
        }

    # ── Symbol master (token lookup) ─────────────────────────────────────────

    def _load_symbol_master(self) -> None:
        """
        Download and cache the SmartAPI instrument master JSON.
        Builds a fast lookup: (exchange, tradingsymbol) -> token.
        """
        # Use cached file if less than 24 hours old
        if _SYMBOL_CACHE.exists():
            age = time.time() - _SYMBOL_CACHE.stat().st_mtime
            if age < 86_400:
                log.info("[AngelOne] Using cached symbol master")
                with open(_SYMBOL_CACHE) as f:
                    instruments = json.load(f)
                self._build_symbol_map(instruments)
                return

        log.info("[AngelOne] Downloading symbol master...")
        resp = httpx.get(_SYMBOL_URL, timeout=30.0)
        resp.raise_for_status()
        instruments = resp.json()

        # Save cache
        with open(_SYMBOL_CACHE, "w") as f:
            json.dump(instruments, f)

        self._build_symbol_map(instruments)
        log.info(f"[AngelOne] Loaded {len(instruments)} instruments")

    def _build_symbol_map(self, instruments: list) -> None:
        self._symbol_map = {}
        for inst in instruments:
            key = (inst.get("exch_seg", ""), inst.get("symbol", "").split("-")[0].strip())
            self._symbol_map[key] = inst.get("token", "")

    def resolve_token(self, symbol: str, exchange: str = "NSE") -> str:
        """
        Resolve symbol name to SmartAPI token.
        e.g. resolve_token("RELIANCE", "NSE") -> "2885"

        SmartAPI stores symbols like "RELIANCE-EQ" — we strip the suffix.
        """
        if not self._symbol_map:
            self._load_symbol_master()

        # Try exact match first, then with -EQ suffix
        token = self._symbol_map.get((exchange, symbol))
        if not token:
            token = self._symbol_map.get((exchange, f"{symbol}-EQ"))
        if not token:
            # Try BSE if NSE fails
            alt = "BSE" if exchange == "NSE" else "NSE"
            token = self._symbol_map.get((alt, symbol))

        if not token:
            raise ValueError(
                f"Symbol '{symbol}' not found on {exchange}. "
                f"Check the SmartAPI symbol master for the correct name."
            )
        return token

    # ── Historical candle data ────────────────────────────────────────────────

    def get_historical_candles(
        self,
        symbol:   str,
        exchange: str,
        token:    str,
        from_date: str,  # "YYYY-MM-DD HH:MM"  e.g. "2023-01-01 09:15"
        to_date:   str,  # "YYYY-MM-DD HH:MM"  e.g. "2024-01-01 16:30"
        interval:  str = "ONE_DAY",
    ) -> pd.DataFrame:
        """
        Fetch OHLCV historical candles from SmartAPI.
        Returns DataFrame with columns [Open, High, Low, Close, Volume].
        """
        payload = {
            "exchange":    exchange,
            "symboltoken": token,
            "interval":    interval,
            "fromdate":    from_date,
            "todate":      to_date,
        }

        log.info(f"[AngelOne] Fetching candles: {symbol} ({exchange}:{token}) {from_date} → {to_date}")
        resp = httpx.post(
            _CANDLE_URL,
            json=payload,
            headers=self._auth_headers(),
            timeout=30.0,
        )
        resp.raise_for_status()
        data = resp.json()

        if not data.get("status"):
            raise ValueError(f"SmartAPI candle error: {data.get('message', 'Unknown')}")

        candles = data.get("data", [])
        if not candles:
            raise ValueError(f"SmartAPI returned no candles for {symbol} ({from_date} → {to_date})")

        # Each candle: [timestamp, open, high, low, close, volume]
        df = pd.DataFrame(candles, columns=["Timestamp", "Open", "High", "Low", "Close", "Volume"])
        df["Timestamp"] = pd.to_datetime(df["Timestamp"])
        df = df.set_index("Timestamp")
        for col in ["Open", "High", "Low", "Close", "Volume"]:
            df[col] = pd.to_numeric(df[col], errors="coerce")
        df.dropna(inplace=True)
        df = df.sort_index()

        log.info(f"[AngelOne] Got {len(df)} bars for {symbol}")
        return df

    # ── Real-time quote ───────────────────────────────────────────────────────

    def get_quote(self, symbol: str, exchange: str = "NSE") -> dict:
        """
        Fetch real-time LTP (Last Traded Price) and quote data.
        Returns dict with keys: ltp, open, high, low, close, volume.
        """
        token = self.resolve_token(symbol, exchange)
        payload = {
            "mode": "FULL",
            "exchangeTokens": {exchange: [token]},
        }

        resp = httpx.post(
            _QUOTE_URL,
            json=payload,
            headers=self._auth_headers(),
            timeout=10.0,
        )
        resp.raise_for_status()
        data = resp.json()

        if not data.get("status"):
            raise ValueError(f"SmartAPI quote error: {data.get('message', 'Unknown')}")

        fetched = data.get("data", {}).get("fetched", [])
        if not fetched:
            raise ValueError(f"No quote data returned for {symbol}")

        q = fetched[0]
        return {
            "symbol":  symbol,
            "exchange": exchange,
            "token":   token,
            "ltp":     float(q.get("ltp", 0)),
            "open":    float(q.get("open", 0)),
            "high":    float(q.get("high", 0)),
            "low":     float(q.get("low", 0)),
            "close":   float(q.get("close", 0)),
            "volume":  int(q.get("tradeVolume", 0)),
        }


# ── Module-level singleton ───────────────────────────────────────────────────
_client: Optional[AngelOneClient] = None


def get_client() -> AngelOneClient:
    global _client
    if _client is None:
        _client = AngelOneClient()
    return _client


# ── Public fetch function (matching provider interface) ───────────────────────

def fetch_angelone(
    ticker:   str,
    start:    str,
    end:      str,
    exchange: str = "NSE",
    interval: str = "1day",
) -> pd.DataFrame:
    """
    Fetch OHLCV data from Angel One SmartAPI.

    Parameters
    ----------
    ticker   : NSE/BSE trading symbol (e.g. "RELIANCE", "NIFTY50" -> "Nifty 50")
    start    : start date 'YYYY-MM-DD'
    end      : end date   'YYYY-MM-DD'
    exchange : 'NSE' (default) or 'BSE'
    interval : one of '1min','5min','15min','30min','1hour','1day','1week','1month'

    Returns
    -------
    DataFrame with columns [Open, High, Low, Close, Volume], DatetimeIndex
    """
    client = get_client()

    if not client._creds_available():
        raise EnvironmentError(
            "Angel One SmartAPI credentials not configured. "
            "Set ANGELONE_API_KEY, ANGELONE_CLIENT_ID, ANGELONE_PASSWORD in .env"
        )

    smartapi_interval = _INTERVAL_MAP.get(interval, "ONE_DAY")
    token = client.resolve_token(ticker, exchange)

    # SmartAPI expects datetime strings with time
    from_dt = f"{start} 09:00"
    to_dt   = f"{end} 16:00"

    df = client.get_historical_candles(
        symbol=ticker,
        exchange=exchange,
        token=token,
        from_date=from_dt,
        to_date=to_dt,
        interval=smartapi_interval,
    )

    return df


def fetch_quote(ticker: str, exchange: str = "NSE") -> dict:
    """Fetch real-time quote for a symbol."""
    client = get_client()
    if not client._creds_available():
        raise EnvironmentError("Angel One credentials not configured.")
    return client.get_quote(ticker, exchange)
