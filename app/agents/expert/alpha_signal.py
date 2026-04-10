"""
Alpha Generation & Signal Research Expert Agent.
Algorithms: Kalman Filter for dynamic hedge ratio + Pairs Trading / Stat Arb.
Flow: cointegration test → kalman hedge ratio → spread z-score → trade on threshold.
Uses the asset paired against SPY as the companion.
Delegates all math to app.algorithms.alpha.kalman_filter and .pairs_trading.
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
from app.algorithms.alpha.kalman_filter import KalmanHedgeFilter
from app.algorithms.alpha.pairs_trading import cointegration_test, spread_zscore

log = get_logger(__name__)


class AlphaSignalAgent(BaseExpertAgent):
    name = "Alpha / Signal"

    def run(self, spec: StrategySpec) -> AgentResult:
        t0 = time.time()
        log.info(f"[{self.name}] Running Kalman Filter + Pairs Trading (Cointegration)")
        try:
            df_x = load_ohlcv("SPY", spec.start_date, spec.end_date)
            df_y = load_ohlcv(spec.asset, spec.start_date, spec.end_date)

            # Align on common dates
            combined = pd.concat(
                [df_x["Close"].rename("SPY"), df_y["Close"].rename(spec.asset)],
                axis=1,
            ).dropna()
            x = combined["SPY"].values
            y = combined[spec.asset].values
            dates = [str(d.date()) for d in combined.index]
            n = len(x)

            # ── Cointegration test via algorithm library ──────────────────────
            try:
                coint_result = cointegration_test(y, x, significance=0.05)
                coint_pvalue   = coint_result["pvalue"]
                coint_is_coint = coint_result["cointegrated"]
                ols_hedge      = coint_result["hedge_ratio"]
            except Exception:
                coint_pvalue   = float("nan")
                coint_is_coint = False
                ols_hedge      = 1.0

            # ── Kalman dynamic hedge ratio via algorithm library ───────────────
            kf = KalmanHedgeFilter(process_noise=1e-4, obs_noise=1e-3)
            kf.fit(x, y)
            hedge = kf.beta_history  # shape (n,)

            # ── Rolling z-score of Kalman spread ──────────────────────────────
            spread = y - hedge * x
            z = spread_zscore(spread, window=30)

            # ── Pairs trading strategy ────────────────────────────────────────
            capital = spec.initial_capital
            equity = [capital]
            position = 0        # +1 long asset / -1 short asset
            entry_price = 0.0
            trade_log = []

            for i in range(1, n):
                ret = (y[i] - y[i - 1]) / y[i - 1] if y[i - 1] > 0 else 0.0

                if position == 1:
                    equity.append(round(equity[-1] * (1 + ret), 2))
                    if z[i] >= 0:
                        pnl_pct = (y[i] - entry_price) / entry_price if entry_price > 0 else 0
                        trade_log.append({
                            "date": dates[i], "side": "SELL",
                            "price": round(y[i], 2), "quantity": 100,
                            "pnl_pct": round(pnl_pct * 100, 2),
                        })
                        position = 0

                elif position == -1:
                    equity.append(round(equity[-1] * (1 - ret), 2))
                    if z[i] <= 0:
                        pnl_pct = (entry_price - y[i]) / entry_price if entry_price > 0 else 0
                        trade_log.append({
                            "date": dates[i], "side": "SELL",
                            "price": round(y[i], 2), "quantity": 100,
                            "pnl_pct": round(pnl_pct * 100, 2),
                        })
                        position = 0

                else:
                    equity.append(equity[-1])
                    if z[i] < -1.0:
                        position = 1
                        entry_price = y[i]
                        trade_log.append({
                            "date": dates[i], "side": "BUY",
                            "price": round(y[i], 2), "quantity": 100, "pnl_pct": None,
                        })
                    elif z[i] > 1.0:
                        position = -1
                        entry_price = y[i]
                        trade_log.append({
                            "date": dates[i], "side": "BUY",
                            "price": round(y[i], 2), "quantity": 100, "pnl_pct": None,
                        })

            return AgentResult(
                agent_name=self.name,
                equity_curve=equity,
                dates=dates,
                trade_log=trade_log,
                paths=[hedge.tolist(), z.tolist()],   # hedge ratio + z-score for UI
                metrics={
                    "kalman_final_hedge":  round(float(hedge[-1]), 4),
                    "ols_hedge_ratio":     round(float(ols_hedge), 4),
                    "cointegration_pvalue": round(coint_pvalue, 6) if not np.isnan(coint_pvalue) else None,
                    "cointegrated":        coint_is_coint,
                    "spread_std":          round(float(np.std(spread)), 4),
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
