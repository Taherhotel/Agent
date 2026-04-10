"""
POST /backtest — triggers a full IRIS backtest pipeline.
parse → trader + expert → verify → compare → narrate
"""

from fastapi import APIRouter, HTTPException, Depends
from sqlmodel import Session

from app.nlp.schema import RunRequest
from app.agents.manager import ManagerAgent
from app.utils.logger import get_logger
from app.db import get_session
from app.api.auth import get_current_user
from app.api.strategy import _persist_tearsheet

log = get_logger(__name__)
router = APIRouter()

_manager = ManagerAgent()


@router.post("/backtest", response_model=None)
async def run_backtest(
    req: RunRequest,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    """
    Run a full backtest pipeline:
    parse → trader + expert → verify → compare → narrate.
    """

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

        _persist_tearsheet(session, result, user_id=getattr(current_user, 'id', None))

        return result

    except ValueError as e:
        log.error(f"/backtest value error: {e}")
        raise HTTPException(
            status_code=400,
            detail=str(e)
        )

    except Exception as e:
        log.error(f"/backtest error: {e}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail="Internal error during backtest. Check backend logs."
        )