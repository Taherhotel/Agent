"""
Automator Agent — serialises strategy config and registers it for live/paper trading.
"""
from __future__ import annotations
import json
import time
from pathlib import Path
from app.nlp.schema import StrategySpec
from app.utils.logger import get_logger

log = get_logger(__name__)

DEPLOY_DIR = Path("deployments")
DEPLOY_DIR.mkdir(exist_ok=True)


class AutomatorAgent:
    name = "Automator"

    def deploy(self, spec: StrategySpec, run_id: str) -> dict:
        log.info(f"[{self.name}] Deploying strategy run_id={run_id}")
        t0 = time.time()
        try:
            config = {
                "run_id": run_id,
                "asset": spec.asset,
                "start_date": spec.start_date,
                "end_date": spec.end_date,
                "initial_capital": spec.initial_capital,
                "commission_pct": spec.commission_pct,
                "slippage_pct": spec.slippage_pct,
                "entry_conditions": [c.model_dump() for c in spec.entry_conditions],
                "exit_conditions": [c.model_dump() for c in spec.exit_conditions],
                "strategy_type": spec.strategy_type.value,
                "deployed_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
                "status": "paper_active",
                "broker": "alpaca_paper",
            }
            # Persist config
            config_path = DEPLOY_DIR / f"{run_id}.json"
            config_path.write_text(json.dumps(config, indent=2))
            log.info(f"[{self.name}] Config saved to {config_path}")

            return {
                "status": "success",
                "run_id": run_id,
                "message": f"Strategy deployed to paper trading (alpaca_paper). Config saved as {run_id}.json",
                "elapsed_seconds": round(time.time() - t0, 2),
            }
        except Exception as e:
            log.error(f"[{self.name}] Deploy failed: {e}")
            return {
                "status": "error",
                "run_id": run_id,
                "error": str(e),
                "elapsed_seconds": round(time.time() - t0, 2),
            }
