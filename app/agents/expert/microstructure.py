"""
Market Microstructure Expert Agent.
Algorithms: Hidden Markov Model (HMM) for regime detection + VWAP execution scheduling.
Flow: fit 2-state HMM (bull/bear) → trade only in bull regime → VWAP-sized orders.
Delegates all math to app.algorithms.microstructure.hmm and .vwap_twap.
"""
from __future__ import annotations
import time
import numpy as np
import pandas as pd
from app.agents.expert.base import BaseExpertAgent
from app.nlp.schema import StrategySpec, AgentResult
from app.data.loader import load_ohlcv
from app.utils.logger import get_logger

# ── Algorithm library imports ────────────────────────────────────────────────
from app.algorithms.microstructure.hmm import RegimeHMM
from app.algorithms.microstructure.vwap_twap import vwap, execution_schedule

log = get_logger(__name__)


class MicrostructureAgent(BaseExpertAgent):
    name = "Microstructure"

    def run(self, spec: StrategySpec) -> AgentResult:
        t0 = time.time()
        log.info(f"[{self.name}] Running RegimeHMM + VWAP execution scheduling")
        try:
            df = load_ohlcv(spec.asset, spec.start_date, spec.end_date)
            close  = df["Close"].values
            volume = (
                df["Volume"].values
                if "Volume" in df.columns
                else np.ones(len(close))
            )
            dates = [str(d.date()) for d in df.index]
            n = len(close)

            returns = np.diff(close) / close[:-1]
            returns = np.where(np.isfinite(returns), returns, 0.0)

            # ── Rolling RegimeHMM (60-day windows) ───────────────────────────
            states = np.zeros(n, dtype=int)   # 0 = bear, 1 = bull
            hmm    = RegimeHMM(n_states=2, n_iter=50, random_state=42)

            for i in range(60, n):
                window_ret = returns[max(0, i - 60):i]
                try:
                    hmm.fit(window_ret)
                    preds = hmm.predict(window_ret)
                    # Last state of the window is current regime
                    states[i] = int(preds[-1])
                except Exception:
                    states[i] = states[i - 1]   # carry forward on failure

            # ── VWAP series via algorithm library ─────────────────────────────
            vwap_series = vwap(close, volume, window=20)  # rolling 20-bar VWAP

            # ── Strategy: enter bull regime, VWAP-scheduled size ─────────────
            capital      = spec.initial_capital
            equity       = [capital]
            in_position  = False
            entry_price  = 0.0
            trade_log    = []

            for i in range(1, n):
                daily_ret = returns[i - 1]

                if in_position:
                    equity.append(round(equity[-1] * (1 + daily_ret), 2))
                    # Exit on regime flip to bear
                    if states[i] == 0:
                        pnl_pct = (close[i] - entry_price) / entry_price
                        trade_log.append({
                            "date": dates[i], "side": "SELL",
                            "price": round(close[i], 2), "quantity": 100,
                            "pnl_pct": round(pnl_pct * 100, 2),
                        })
                        in_position = False
                else:
                    equity.append(equity[-1])
                    # Enter on bull regime start
                    if states[i] == 1:
                        # VWAP execution schedule: slice entry over 5 intervals
                        vol_profile = volume[max(0, i - 5):i]
                        schedule = execution_schedule(
                            total_quantity=100,
                            n_intervals=min(5, len(vol_profile)),
                            volume_profile=vol_profile,
                            algo="vwap",
                        )
                        in_position  = True
                        entry_price  = vwap_series[i]   # use VWAP as effective entry price
                        trade_log.append({
                            "date": dates[i], "side": "BUY",
                            "price": round(float(entry_price), 2),
                            "quantity": int(schedule.sum()),
                            "pnl_pct": None,
                        })

            # ── Regime statistics via algorithm library ───────────────────────
            try:
                hmm.fit(returns)
                regime_stats = hmm.regime_stats(returns)
            except Exception:
                regime_stats = {}

            return AgentResult(
                agent_name=self.name,
                equity_curve=equity,
                dates=dates,
                trade_log=trade_log,
                metrics={
                    "bull_regime_pct":         round(float(np.mean(states)), 4),
                    "regime_switches":          int(np.sum(np.diff(states) != 0)),
                    "bull_mean_return_ann":     regime_stats.get("bull", {}).get("mean_return", None),
                    "bear_mean_return_ann":     regime_stats.get("bear", {}).get("mean_return", None),
                    "bull_volatility_ann":      regime_stats.get("bull", {}).get("volatility", None),
                    "bear_volatility_ann":      regime_stats.get("bear", {}).get("volatility", None),
                },
                elapsed_seconds=round(time.time() - t0, 2),
            )
        except Exception as e:
            log.error(f"[{self.name}] Error: {e}", exc_info=True)
            return AgentResult(
                agent_name=self.name,
                error=str(e),
                elapsed_seconds=round(time.time() - t0, 2),
            )
