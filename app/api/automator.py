"""
POST /automate/{run_id} — deploys an approved strategy via AutomatorAgent.
POST /automate/strategy — deploy from raw StrategySpec JSON.
"""

from fastapi import APIRouter, HTTPException, Depends
from sqlmodel import select, Session

from app.nlp.schema import StrategySpec
from app.agents.automator import AutomatorAgent
from app.api.auth import get_current_user
from app.api.strategy import _tearsheets
from app.utils.logger import get_logger, new_run_id
from app.db import get_session
from app.models import TearsheetRecord

log = get_logger(__name__)
router = APIRouter()

_automator = AutomatorAgent()


@router.post("/automate/strategy")
async def automate_from_spec(
    spec: StrategySpec,
    current_user=Depends(get_current_user),
):
    """
    Deploy directly from StrategySpec payload.
    Must be declared BEFORE /automate/{run_id} to avoid being swallowed by it.
    """

    run_id = new_run_id()

    try:
        result = _automator.deploy(spec, run_id)
        return result

    except Exception as e:
        log.error(f"/automate/strategy error: {e}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail=str(e)
        )


@router.post("/automate/{run_id}")
async def automate_from_run(
    run_id: str,
    use_expert: bool = False,
    session: Session = Depends(get_session),
    current_user=Depends(get_current_user),
):
    """
    Deploy a strategy using an existing run_id.

    Lookup order:
    1. Database
    2. In-memory tearsheets cache
    """

    ts_data = None

    # ---------- Try Database ----------
    try:
        ts_record = session.exec(
            select(TearsheetRecord).where(TearsheetRecord.run_id == run_id)
        ).first()

        if ts_record:
            ts_data = ts_record.payload
    except Exception as e:
        log.warning(f"DB lookup failed for run {run_id}: {e}")

    # ---------- Try Memory ----------
    if not ts_data:
        ts_data = _tearsheets.get(run_id)

    if not ts_data:
        raise HTTPException(
            status_code=404,
            detail=f"Run '{run_id}' not found"
        )

    try:
        spec = StrategySpec(**ts_data["strategy_spec"])
        result = _automator.deploy(spec, run_id)
        return result

    except Exception as e:
        log.error(f"/automate/{run_id} error: {e}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail=str(e)
        )