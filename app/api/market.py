"""
GET /api/quote/{symbol} — Real-time NSE/BSE quote via Angel One SmartAPI.
GET /api/symbols/search — Search symbols in the SmartAPI master.
"""
from __future__ import annotations
from fastapi import APIRouter, HTTPException, Query
from app.utils.logger import get_logger

log = get_logger(__name__)
router = APIRouter()


@router.get("/quote/{symbol}")
async def get_quote(symbol: str, exchange: str = Query("NSE", pattern="^(NSE|BSE)$")):
    """
    Fetch real-time quote for an NSE/BSE symbol.

    Parameters
    ----------
    symbol   : Trading symbol e.g. RELIANCE, INFY, NIFTY50
    exchange : NSE (default) or BSE
    """
    try:
        from app.data.providers.angelone import fetch_quote
        data = fetch_quote(symbol.upper(), exchange.upper())
        return data
    except EnvironmentError as e:
        raise HTTPException(status_code=503, detail=str(e))
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        log.error(f"[Quote] Failed for {symbol}: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Quote fetch failed: {e}")


@router.get("/symbols/search")
async def search_symbols(q: str = Query(..., min_length=1), exchange: str = Query("NSE")):
    """
    Search SmartAPI instrument master for symbols matching query string.
    Returns up to 20 results with name and token.
    """
    try:
        from app.data.providers.angelone import get_client
        client = get_client()
        if not client._symbol_map:
            client._load_symbol_master()

        q_upper = q.upper()
        results = []
        for (exch, sym), token in client._symbol_map.items():
            if exch == exchange.upper() and q_upper in sym:
                results.append({"symbol": sym, "exchange": exch, "token": token})
                if len(results) >= 20:
                    break
        return results
    except Exception as e:
        log.error(f"[SymbolSearch] Error: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))
