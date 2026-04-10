"""
FastAPI routes: POST /run, POST /parse
Supports both DB persistence and in-memory cache.
Tearsheet, history, and automate routes live in their own router files.
"""

from fastapi import APIRouter, HTTPException, Depends
from sqlmodel import Session
from typing import Optional

from app.nlp.schema import RunRequest
from app.agents.manager import ManagerAgent
from app.utils.logger import get_logger
from app.db import get_session
from app.api.auth import get_current_user
from app.models import TearsheetRecord

log = get_logger(__name__)
router = APIRouter()

_manager = ManagerAgent()

# in-memory cache
_tearsheets: dict[str, dict] = {}


def _persist_tearsheet(session: Optional[Session], ts_dict: dict, user_id: Optional[int] = None):
    """
    Persist tearsheet to both:
    - database
    - in-memory cache

    user_id: if provided, associates the record with that user; otherwise
             skips the foreign-key column to avoid an FK violation when no
             seed user exists yet.
    """

    run_id = ts_dict.get("run_id")

    # ---------- MEMORY CACHE ----------
    _tearsheets[run_id] = ts_dict

    # ---------- DATABASE ----------
    if session:
        try:
            spec = ts_dict.get("strategy_spec", {})
            tm = ts_dict.get("trader_metrics", {})

            record = TearsheetRecord(
                run_id=run_id,
                user_id=user_id,
                asset=spec.get("asset", ""),
                start_date=spec.get("start_date", ""),
                end_date=spec.get("end_date", ""),
                payload=ts_dict,
                trader_sharpe=tm.get("sharpe"),
                trader_cagr=tm.get("cagr"),
                trader_max_dd=tm.get("max_drawdown"),
            )

            session.add(record)
            session.commit()

        except Exception as e:
            log.warning(f"DB persist failed for {run_id}: {e}")


@router.post("/run", response_model=None)
async def run_strategy(
    req: RunRequest,
    session: Session = Depends(get_session),
    current_user=Depends(get_current_user),
):
    """Full pipeline: parse → trader + expert → verify → compare → narrate."""

    try:
        ts = _manager.run(
            prompt=req.prompt,
            asset=req.asset,
            start_date=req.start_date,
            end_date=req.end_date,
            initial_capital=req.initial_capital,
            commission_bps=req.commission_bps,
            slippage_bps=req.slippage_bps,
            max_position_pct=req.max_position_pct,
            expert_type=req.expert_type,
            groq_api_key=req.groq_api_key,
        )

        result = ts.model_dump()

        _persist_tearsheet(session, result, user_id=None)

        return result

    except ValueError as e:
        log.error(f"/run value error: {e}")
        raise HTTPException(status_code=400, detail=str(e))

    except Exception as e:
        log.error(f"/run error: {e}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail="Internal error during run. Check backend logs."
        )


@router.post("/parse")
async def parse_strategy(req: RunRequest):
    """Parse-only endpoint for debugging."""

    from app.nlp.parser import StrategyParser

    parser = StrategyParser()

    spec = parser.parse(
        prompt=req.prompt,
        asset=req.asset,
        start_date=req.start_date,
        end_date=req.end_date,
        initial_capital=req.initial_capital,
    )

    return spec.model_dump()

